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

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: combinedParts }],
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          ...(options.responseMimeType === "application/json"
            ? { responseMimeType: "application/json" }
            : {})
        }
      })
    });

    if (response.ok) break;

    lastErrorText = await response.text();
    if (response.status === 503 && attempt < maxRetries) {
      // Exponential backoff: 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, attempt)));
      continue;
    }
    
    break; // Break on non-503 errors or if out of retries
  }

  if (!response || !response.ok) {
    throw Object.assign(new Error("AI service unavailable via Google Gemini API."), {
      status: response?.status || 500,
      upstreamError: lastErrorText.slice(0, 300),
    });
  }

  const data = await response.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { text, model: GEMINI_TEXT_MODEL };
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
export async function generateGeminiTTS(apiKey: string, text: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Read the following text exactly aloud:\n\n" + text }] }],
      generationConfig: { responseModalities: ["AUDIO"] }
    })
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
