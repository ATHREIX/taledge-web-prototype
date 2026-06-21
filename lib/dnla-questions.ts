import "server-only";
import { logger } from "@/lib/logger";

/**
 * DNLA interview question source.
 *
 * The DNLA interview round is meant to be driven by the licensed DNLA provider's
 * own question API (Germany). That endpoint does not exist yet, so this module is
 * a thin seam: when `DNLA_QUESTION_API_URL` is configured we call it; otherwise
 * callers fall back to the SAME Gemini question generation used by the AI
 * interview. This keeps the DNLA interview working today and lets us swap in the
 * real provider later by only touching this file + the env var.
 *
 * TODO: when the real DNLA question API ships, set DNLA_QUESTION_API_URL and map
 * its response shape inside `fetchDnlaQuestion`.
 */

export function getDnlaQuestionApiUrl(): string | null {
  const url = process.env.DNLA_QUESTION_API_URL?.trim();
  return url ? url : null;
}

/** True once the real DNLA question API is configured via env. */
export function isDnlaApiConfigured(): boolean {
  return getDnlaQuestionApiUrl() !== null;
}

export type DnlaQuestionRequest = {
  /** Stable id for this candidate's DNLA interview session. */
  sessionId: string;
  studentId: string;
  /** Turn number — 1 for the opening question, then incrementing. */
  turnIndex: number;
  /** The candidate's most recent answer (empty on the opening question). */
  lastAnswer?: string;
  /** Compact DNLA competency report (scores vs benchmark), when available. */
  dnlaSummary?: string;
};

export type DnlaQuestionResult = {
  question: string;
  /** Provider may signal the questionnaire is complete. */
  isDone?: boolean;
};

/**
 * Fetch the next DNLA interview question from the provider API.
 *
 * Returns `null` when the API is not configured (the normal state right now) OR
 * when the call fails — in both cases the caller falls back to Gemini so the
 * interview never breaks. This is intentionally defensive: the response contract
 * below is our best guess and MUST be reconciled with the real provider docs.
 */
export async function fetchDnlaQuestion(
  req: DnlaQuestionRequest
): Promise<DnlaQuestionResult | null> {
  const url = getDnlaQuestionApiUrl();
  if (!url) return null; // not configured → fall back to Gemini

  try {
    const apiKey = process.env.DNLA_QUESTION_API_KEY?.trim();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(req),
      // Don't let a slow provider hang the interview turn.
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      logger.error("[dnla] question API non-200, falling back to Gemini", {
        status: res.status,
      });
      return null;
    }
    const data = await res.json();
    // TODO: adjust these field names to the real provider response shape.
    const question = typeof data?.question === "string" ? data.question.trim() : "";
    if (!question) {
      logger.error("[dnla] question API returned no question, falling back");
      return null;
    }
    return { question, isDone: data?.isDone === true };
  } catch (e) {
    logger.error("[dnla] question API call failed, falling back to Gemini", {
      err: String((e as any)?.message || e),
    });
    return null;
  }
}
