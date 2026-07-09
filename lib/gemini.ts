export const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
export const GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GenerateOptions = {
  parts?: GeminiPart[];
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "application/json" | "text/plain";
  model?: string;
  /**
   * Gemini 2.5 "thinking" budget. Set to 0 to DISABLE thinking for fast,
   * deterministic short outputs (e.g. a yes/no proctoring check) - otherwise the
   * model can spend the entire maxOutputTokens budget thinking and return empty
   * text. Omit to leave the model default.
   */
  thinkingBudget?: number;
  /**
   * Per-attempt fetch timeout (default 20s) and total retry deadline (default
   * 25s). The defaults suit short conversational turns; LONG generations (the
   * Fit Score report: ~16KB prompt + up to 8192 output tokens with thinking)
   * routinely need >20s, so those callers must raise both — otherwise every
   * attempt is self-aborted and the route fails with "upstream timeout".
   */
  timeoutMs?: number;
  totalDeadlineMs?: number;
};

export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || "";
}

export function extractJson(text: string): any | null {
  const trimmed = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function generateGeminiContent(
  apiKey: string,
  prompt: string,
  options: GenerateOptions = {}
) {
  // Preserve image/inlineData parts if provided
  const combinedParts: any[] = [{ text: prompt }];
  if (options.parts) {
    options.parts.forEach(p => {
      if ("inlineData" in p) combinedParts.push(p);
      if ("text" in p && typeof (p as any).text === "string") combinedParts.push(p);
    });
  }

  const modelToUse = options.model || GEMINI_TEXT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent`;

  let response: Response | null = null;
  let lastErrorText = "";
  const maxRetries = 3;
  // 429 (quota/rate-limit) won't recover within our short backoff window, so we
  // fail fast on it rather than burning ~13s of retries. Only transient 5xx retry.
  const RETRYABLE = new Set([500, 502, 503, 504]);
  // Bound total time spent retrying so a hung upstream never burns the whole
  // serverless maxDuration. Each attempt is independently timed out.
  const PER_ATTEMPT_TIMEOUT_MS = options.timeoutMs ?? 20_000;
  const deadline = Date.now() + (options.totalDeadlineMs ?? 25_000);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: combinedParts }],
          generationConfig: {
            temperature: options.temperature ?? 0.2,
            // Always cap output so a single call can't run away on cost.
            maxOutputTokens: options.maxOutputTokens ?? 2048,
            ...(options.responseMimeType === "application/json"
              ? { responseMimeType: "application/json" }
              : {}),
            // Disable/limit 2.5 "thinking" when requested so short outputs are
            // not starved by reasoning tokens.
            ...(typeof options.thinkingBudget === "number"
              ? { thinkingConfig: { thinkingBudget: options.thinkingBudget } }
              : {}),
          },
        }),
        signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
      });
    } catch (e: any) {
      // Network/timeout error - treat as retryable within the deadline.
      lastErrorText = e?.name === "TimeoutError" ? "upstream timeout" : String(e?.message || e);
      response = null;
    }

    if (response?.ok) break;
    if (response) lastErrorText = await response.text();

    const retryable = !response || RETRYABLE.has(response.status);
    const backoff = Math.min(2000 * 2 ** attempt, 6000) + Math.random() * 400; // jitter
    if (retryable && attempt < maxRetries && Date.now() + backoff < deadline) {
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    break;
  }

  if (!response || !response.ok) {
    throw Object.assign(new Error("AI service unavailable via Google Gemini API."), {
      status: response?.status || 503,
      upstreamError: lastErrorText.slice(0, 300),
    });
  }

  const data = await response.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { text, model: modelToUse };
}

export async function generateGeminiJson<T = any>(
  apiKey: string,
  prompt: string,
  options: GenerateOptions = {}
): Promise<{ parsed: T; text: string; model: string }> {
  const result = await generateGeminiContent(apiKey, prompt, {
    ...options,
    responseMimeType: "application/json",
  });
  const parsed = extractJson(result.text);
  if (!parsed) {
    throw Object.assign(new Error("Gemini returned unparseable JSON."), {
      status: 422,
      rawPreview: result.text.slice(0, 300),
    });
  }
  return { parsed: parsed as T, ...result };
}
// NOTE: Server-side TTS (Google Cloud Chirp 3 HD) was removed — the interviewer
// voice is the Gemini Live native audio (voice "Aoede"), so no separate TTS
// service is used. The REST interview routes return no server audio.
