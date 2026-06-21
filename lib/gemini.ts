export const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
export const GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-preview-12-2025";

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
  const deadline = Date.now() + 25_000;
  const PER_ATTEMPT_TIMEOUT_MS = 20_000;

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
// ─────────────────────────── Google Cloud TTS (Chirp 3 HD) ───────────────────
// High-quality voices: https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types#chirp3_hd_voices
// Default is a female Chirp 3 HD voice to match the prior interviewer voice.
const DEFAULT_TTS_VOICE = "en-US-Chirp3-HD-Leda";

/** Cloud TTS key. Cloud TTS (Chirp 3 HD) is OPT-IN: only used when an explicit
 *  GOOGLE_TTS_API_KEY is set (and the Cloud Text-to-Speech API is enabled).
 *  Otherwise the interviewer voice uses Gemini TTS — the original behaviour. */
export function getGoogleTtsApiKey(): string {
  return process.env.GOOGLE_TTS_API_KEY || "";
}

/** Strip the WAV/RIFF header off a LINEAR16 payload, returning base64 of the raw
 *  PCM samples — the interview client plays raw 16-bit mono PCM @24kHz directly. */
function wavBase64ToPcmBase64(wavB64: string): string {
  const buf = Buffer.from(wavB64, "base64");
  const dataIdx = buf.indexOf(Buffer.from("data", "ascii"));
  const start = dataIdx >= 0 ? dataIdx + 8 : 44; // 8 = "data" tag + 4-byte size
  return buf.subarray(start).toString("base64");
}

/**
 * Google Cloud Text-to-Speech using a Chirp 3 HD voice. Returns base64 RAW PCM
 * (16-bit mono, 24kHz) so the existing client audio player works unchanged.
 * Throws on any failure so callers can fall back to Gemini/browser TTS.
 */
export async function generateGoogleCloudTTS(text: string): Promise<string> {
  const apiKey = getGoogleTtsApiKey();
  if (!apiKey) throw new Error("Google Cloud TTS is not configured.");
  const voiceName = process.env.GOOGLE_TTS_VOICE || DEFAULT_TTS_VOICE;
  const languageCode = voiceName.split("-").slice(0, 2).join("-") || "en-US";
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, name: voiceName },
        audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000 },
      }),
      signal: AbortSignal.timeout(20_000),
    }
  );
  if (!response.ok) {
    const upstreamError = await response.text();
    throw Object.assign(new Error(`Cloud TTS error: ${response.status}`), {
      status: response.status,
      upstreamError: upstreamError.slice(0, 300),
    });
  }
  const data = await response.json();
  const wavB64 = data?.audioContent;
  if (!wavB64 || typeof wavB64 !== "string") throw new Error("Cloud TTS returned no audio.");
  return wavBase64ToPcmBase64(wavB64);
}

/**
 * Synthesize the interviewer's speech with the best available voice:
 *   1) Gemini TTS — the default (the original interviewer voice),
 *   2) Google Cloud TTS Chirp 3 HD — ONLY when GOOGLE_TTS_API_KEY is set (opt-in HD upgrade),
 *   3) "" → the client falls back to the browser voice.
 * Never throws; returns "" if all options fail.
 */
export async function synthesizeInterviewSpeech(text: string, geminiApiKey: string): Promise<string> {
  if (!text) return "";
  // Opt-in HD voice: only attempt Cloud TTS when an explicit key is configured.
  if (getGoogleTtsApiKey()) {
    try {
      return await generateGoogleCloudTTS(text);
    } catch {
      /* Cloud TTS unavailable (API not enabled / key restricted) — try Gemini. */
    }
  }
  if (geminiApiKey) {
    try {
      return await generateGeminiTTS(geminiApiKey, text);
    } catch {
      /* rate-limited / unavailable — client falls back to the browser voice */
    }
  }
  return "";
}

export async function generateGeminiTTS(apiKey: string, text: string): Promise<string> {
  // Key goes in the header, never the URL (URLs leak into logs/proxies).
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Read the following text exactly aloud:\n\n" + text }] }],
      generationConfig: { responseModalities: ["AUDIO"] }
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Gemini TTS API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  try {
    return data.candidates[0].content.parts[0].inlineData.data;
  } catch (e) {
    console.error("Failed to extract TTS audio data", JSON.stringify(data).substring(0, 500));
    return "";
  }
}
