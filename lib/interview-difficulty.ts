/**
 * Interview difficulty — the level the candidate (or recruiter/institute) picks
 * BEFORE the interview starts. It only sets where the interviewer STARTS; the AI
 * still auto-judges every answer and climbs/drops the ladder from there. Pure
 * data + helpers so it's safe to import in both the browser (the selector UI)
 * and the server routes (prompt assembly).
 */

export type Difficulty = "adaptive" | "easy" | "medium" | "hard";

export const DEFAULT_DIFFICULTY: Difficulty = "adaptive";

export const DIFFICULTY_OPTIONS: { key: Difficulty; label: string; blurb: string }[] = [
  {
    key: "adaptive",
    label: "Adaptive",
    blurb: "AI reads your answers and finds your level automatically.",
  },
  {
    key: "easy",
    label: "Easy",
    blurb: "Start with foundational questions and build up gently.",
  },
  {
    key: "medium",
    label: "Medium",
    blurb: "Start at a solid mid-level and climb from there.",
  },
  {
    key: "hard",
    label: "Hard",
    blurb: "Open with demanding, senior-level questions from the start.",
  },
];

export function isDifficulty(v: unknown): v is Difficulty {
  return v === "adaptive" || v === "easy" || v === "medium" || v === "hard";
}

export function normalizeDifficulty(v: unknown): Difficulty {
  return isDifficulty(v) ? v : DEFAULT_DIFFICULTY;
}

/**
 * Bias the opening "ladder stage" by the chosen difficulty. The default
 * schedule is turn ≤3 BASIC, ≤7 MEDIUM, else HARD; the chosen level shifts where
 * that schedule begins. The AI's per-answer ratings still override this, so a
 * strong/weak candidate is met where they actually are.
 */
export function ladderStageFor(
  difficulty: Difficulty,
  turnIndex: number
): "BASIC" | "MEDIUM" | "HARD" {
  const shift =
    difficulty === "hard" ? 5 : difficulty === "medium" ? 2 : difficulty === "easy" ? -2 : 0;
  const t = turnIndex + shift;
  if (t <= 3) return "BASIC";
  if (t <= 7) return "MEDIUM";
  return "HARD";
}

/**
 * A forceful directive spliced into the interviewer's system prompt telling it
 * where to START and reminding it to keep auto-adapting. Mode-agnostic.
 */
export function difficultyDirective(difficulty: Difficulty): string {
  switch (difficulty) {
    case "easy":
      return `STARTING DIFFICULTY — EASY: Open with foundational, confidence-building questions and stay at that level longer than usual. Only climb to medium/hard once the candidate has clearly demonstrated mastery. Be encouraging. You MUST still auto-judge each answer and raise the bar the moment they prove they can handle more.`;
    case "medium":
      return `STARTING DIFFICULTY — MEDIUM: Skip the most basic warm-ups quickly and open at a solid mid-level for this domain. Climb to hard, senior-level questions as soon as answers are strong. You MUST still auto-judge each answer and drop a rung if they genuinely struggle, then climb back.`;
    case "hard":
      return `STARTING DIFFICULTY — HARD: From early on, ask demanding, senior-level questions — edge cases, trade-offs, system/design decisions, failure modes, and deep "why / what-if" follow-ups. Do not waste turns on basics. You MUST still auto-judge each answer: if the candidate genuinely struggles, drop a rung to isolate the gap, then climb back to hard. Never pile hard questions on someone who is visibly drowning.`;
    default:
      return `STARTING DIFFICULTY — ADAPTIVE: Open basic and warm, then quickly find the candidate's true level from their first real answers and calibrate up or down. Continuously hunt for the edge of their ability and keep auto-judging every answer.`;
  }
}
