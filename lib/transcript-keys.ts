/**
 * Resolve which localStorage key holds a round's REAL transcript.
 *
 * The interview page persists a transcript the moment the AI greeting exists,
 * so a round the candidate opened and abandoned leaves an assistant-only stub.
 * Preferring merely the first NON-EMPTY key lets that greeting stub shadow the
 * completed round stored under a fallback key (open /interview/behavioural →
 * bail at the greeting → later finish the real round under :dnla or :final).
 *
 * Fix: prefer the first candidate key whose transcript actually contains a
 * USER answer; fall back to the first non-empty stub only if none has answers,
 * then to the seed default. Shared by the fit-score, per-interview report, and
 * comparison pages so the resolution can never diverge between them again.
 */
type Turn = { role?: string };

function hasUserAnswer(raw: string | null): boolean {
  if (!raw || raw === "[]") return false;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.some((m: Turn) => m?.role === "user");
  } catch {
    return false;
  }
}

/** The candidate keys for the behavioural round, in preference order. */
export function behaviouralKeyCandidates(id: string): string[] {
  return [
    `taledge:interview:${id}:behavioural`,
    `taledge:interview:${id}:dnla`,
    `taledge:interview:${id}:final`,
  ];
}

/**
 * Best behavioural transcript key for `id`. `seedDefault` is returned on the
 * server (no localStorage) and when nothing is stored — callers pass the index
 * whose seed data they expect (the pages historically default to `:dnla`).
 */
export function resolveBehaviouralKey(id: string, seedDefaultIndex = 1): string {
  const candidates = behaviouralKeyCandidates(id);
  if (typeof window === "undefined") return candidates[seedDefaultIndex];
  // First key with a real user answer wins.
  for (const k of candidates) {
    if (hasUserAnswer(localStorage.getItem(k))) return k;
  }
  // Otherwise the first non-empty stub (so an in-progress round still shows).
  for (const k of candidates) {
    const v = localStorage.getItem(k);
    if (v && v !== "[]") return k;
  }
  return candidates[seedDefaultIndex];
}
