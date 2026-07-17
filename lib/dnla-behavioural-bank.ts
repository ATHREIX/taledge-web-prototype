/**
 * DNLA behavioural-interview bank.
 *
 * The behavioural round is framed on the DNLA report ONLY — not on the AI
 * (technical/skills) interview. Every question here is derived directly from a
 * DNLA factor's definition in the licensed reports:
 *   - Social Competence  (ESK): 17 factors across 4 areas
 *   - Leadership Quality (AZS): adds Entrepreneurial + Cooperation areas
 *
 * The factors shared by both reports are tagged `both`; ESK-only and AZS-only
 * factors are tagged accordingly so the round can present the set that matches
 * whichever report the candidate actually took. Scoring is on the DNLA 1–7 scale
 * (benchmark-with-the-best optimum band = 4–7); the report's own development
 * section prescribes interviewing the sub-benchmark ("development") factors, so
 * that is what this bank prioritises when the candidate's scores are known.
 *
 * These are ANCHORS, never a script: the interviewer adapts each to the
 * candidate's resume and last answer and never reads one aloud verbatim.
 */

export type DnlaArea =
  | "Achievement Dynamics"
  | "Interpersonal"
  | "Will to Succeed"
  | "Stress Capacity"
  | "Entrepreneurial"
  | "Cooperation";

/** Which DNLA product(s) a factor appears in. */
export type DnlaProduct = "both" | "esk" | "azs";

export type DnlaBehaviouralFactor = {
  /** Stable key (matches/aligns with normalizeDnlaResults factor keys). */
  key: string;
  /** Human factor name as printed in the report. */
  factor: string;
  area: DnlaArea;
  product: DnlaProduct;
  /** Behavioural/situational anchor question probing THIS factor. */
  probe: string;
};

// Ordered by report area so the interviewer can sweep area-by-area.
export const DNLA_BEHAVIOURAL_FACTORS: DnlaBehaviouralFactor[] = [
  // ── Achievement Dynamics ────────────────────────────────────────────────
  {
    key: "self_responsibility",
    factor: "Self-responsibility",
    area: "Achievement Dynamics",
    product: "esk",
    probe:
      "Tell me about a recent result you're proud of — what did YOU personally do that drove it, versus what was down to luck or other people?",
  },
  {
    key: "drive_and_application",
    factor: "Drive and Application",
    area: "Achievement Dynamics",
    product: "both",
    probe:
      "Describe a time you had to perform at your very best when it really counted — a deadline, a big presentation, an exam. How did you handle the pressure of the goal?",
  },
  {
    key: "self_confidence",
    factor: "Self-confidence",
    area: "Achievement Dynamics",
    product: "both",
    probe:
      "Tell me about a task you took on when you weren't sure you were up to it. How did you judge whether your abilities matched what it demanded?",
  },
  {
    key: "motivation",
    factor: "Motivation",
    area: "Achievement Dynamics",
    product: "both",
    probe:
      "What part of your work genuinely energises you — and tell me about a time that connection kept you going when the work got hard?",
  },

  // ── Interpersonal ───────────────────────────────────────────────────────
  {
    key: "sociability",
    factor: "Sociability",
    area: "Interpersonal",
    product: "both",
    probe:
      "Tell me about a working relationship you built from scratch with someone quite different from you. How did you get past the surface and actually connect?",
  },
  {
    key: "assertiveness",
    factor: "Assertiveness",
    area: "Interpersonal",
    product: "esk",
    probe:
      "Describe a time you had to put forward a view that clashed with someone more senior, or speak up in a room where you weren't the expert. What did you do?",
  },
  {
    key: "empathy",
    factor: "Empathy",
    area: "Interpersonal",
    product: "both",
    probe:
      "Tell me about a time you picked up that something was wrong with a colleague or client before they said it outright. What tipped you off, and what did you do?",
  },

  // ── Will to Succeed ─────────────────────────────────────────────────────
  {
    key: "commitment",
    factor: "Commitment",
    area: "Will to Succeed",
    product: "both",
    probe:
      "Tell me about a time you pushed something through to completion entirely on your own initiative — no one chasing you, no one checking.",
  },
  {
    key: "status_awareness",
    factor: "Status Awareness",
    area: "Will to Succeed",
    product: "esk",
    probe:
      "What does recognition or reward actually look like for you at work, and tell me about a time it drove how hard you pushed?",
  },
  {
    key: "systematic_mentality",
    factor: "Systematic Mentality",
    area: "Will to Succeed",
    product: "both",
    probe:
      "Walk me through how you plan a complex task with a lot of moving parts. Give me a recent, concrete example — where did you start?",
  },
  {
    key: "initiative",
    factor: "Initiative",
    area: "Will to Succeed",
    product: "both",
    probe:
      "Tell me about something you improved or started at work that nobody asked you to. What made you act?",
  },

  // ── Stress Capacity ─────────────────────────────────────────────────────
  {
    key: "feedback_reaction",
    factor: "Feedback Reaction",
    area: "Stress Capacity",
    product: "esk",
    probe:
      "Tell me about the last time someone criticised your work. What was your honest first reaction in the moment — and what did you do next?",
  },
  {
    key: "resilience",
    factor: "Resilience",
    area: "Stress Capacity",
    product: "both",
    probe:
      "Describe a real setback or failure. Walk me through the days right after it — how did you get yourself back on track?",
  },
  {
    key: "outlook",
    factor: "Outlook",
    area: "Stress Capacity",
    product: "both",
    probe:
      "When you start something new, do you tend to see the opportunities first or the risks first? Give me a recent example that shows which.",
  },
  {
    key: "self_esteem",
    factor: "Self-esteem",
    area: "Stress Capacity",
    product: "esk",
    probe:
      "Tell me about a time you had to take a stand or push a decision in your professional environment despite real hesitation. How did it go?",
  },
  {
    key: "flexibility",
    factor: "Flexibility",
    area: "Stress Capacity",
    product: "both",
    probe:
      "Tell me about a major, unexpected change at work — a new process, a reshuffle, a scrapped plan. How did you adapt to it?",
  },
  {
    key: "job_satisfaction",
    factor: "Job Satisfaction",
    area: "Stress Capacity",
    product: "esk",
    probe:
      "What conditions bring out your best work? Tell me about a time the environment around you clearly helped — or clearly hurt — how you performed.",
  },

  // ── Entrepreneurial thinking and acting (AZS / Leadership) ──────────────
  {
    key: "personal_standards",
    factor: "Personal standards",
    area: "Entrepreneurial",
    product: "azs",
    probe:
      "Tell me about the standard you hold yourself to on your own work. Give me an example where you pushed past 'good enough' when you didn't have to.",
  },
  {
    key: "readiness_to_take_decisions",
    factor: "Readiness to take decisions",
    area: "Entrepreneurial",
    product: "azs",
    probe:
      "Describe a decision with real consequences that you had to make without complete information. How did you move on it?",
  },
  {
    key: "innovation",
    factor: "Innovation",
    area: "Entrepreneurial",
    product: "azs",
    probe:
      "Tell me about a time you replaced an established, comfortable way of doing something with a better one. What resistance did you meet?",
  },
  {
    key: "quality_awareness",
    factor: "Quality Awareness",
    area: "Entrepreneurial",
    product: "azs",
    probe:
      "Tell me about a time you had to balance quality against cost or speed. How did you decide the right level — and were you right?",
  },

  // ── Cooperation and consensus (AZS / Leadership) ────────────────────────
  {
    key: "conflict_behaviour",
    factor: "Conflict behaviour",
    area: "Cooperation",
    product: "azs",
    probe:
      "Tell me about a disagreement where you wanted to keep the peace but also held a position that mattered. How did you handle both?",
  },
  {
    key: "cooperation",
    factor: "Cooperation",
    area: "Cooperation",
    product: "azs",
    probe:
      "Describe a time you had to get something done through people outside your own team, whose priorities weren't yours.",
  },
  {
    key: "teamwork",
    factor: "Teamwork",
    area: "Cooperation",
    product: "azs",
    probe:
      "Tell me about a time you had to choose between just doing it yourself and working it through the team. What did you decide, and why?",
  },
];

/** Factors visible for a given DNLA product. `both` always includes shared factors. */
export function factorsForProduct(product: "esk" | "azs"): DnlaBehaviouralFactor[] {
  return DNLA_BEHAVIOURAL_FACTORS.filter((f) => f.product === "both" || f.product === product);
}

/**
 * Pull this student's DNLA development (sub-benchmark) factors out of the
 * injected DNLA summary so the behavioural round can be driven by THEIR OWN
 * report. Matches the `buildDnlaSummary` line shape
 *   "<Competency> (<Group>): <n>/7 vs benchmark <m> - development area"
 * and returns the competency names flagged as development areas. Names come from
 * whatever taxonomy produced the summary (internal template today, real DNLA
 * factor names once the provider import lands) — they are passed to the model as
 * weighting hints, not looked up in code, so either works.
 */
export function developmentFactorsFromSummary(summary?: string): string[] {
  if (!summary) return [];
  const out: string[] = [];
  for (const line of summary.split("\n")) {
    if (!/development area/i.test(line)) continue;
    // Competency name is the text before " (" (group) or before the first ":".
    const name = line.split(/\s*\(|:/)[0]?.trim();
    if (name) out.push(name);
  }
  return out;
}

/**
 * The interviewer directive for the behavioural round, framed on the DNLA report
 * ONLY. Lists the factor anchors (optionally scoped to a product), grouped by
 * area, and tells the interviewer to prioritise the candidate's development
 * (sub-benchmark) factors when those are known via the injected DNLA summary.
 */
export function dnlaBehaviouralDirective(opts?: {
  product?: "esk" | "azs";
  /** Development-area factor names (sub-benchmark) to weight toward, if known. */
  developmentFactors?: string[];
}): string {
  const factors = opts?.product ? factorsForProduct(opts.product) : DNLA_BEHAVIOURAL_FACTORS;

  // Group by area, preserving the report's area order.
  const order: DnlaArea[] = [
    "Achievement Dynamics",
    "Interpersonal",
    "Will to Succeed",
    "Stress Capacity",
    "Entrepreneurial",
    "Cooperation",
  ];
  const byArea = order
    .map((area) => ({ area, items: factors.filter((f) => f.area === area) }))
    .filter((g) => g.items.length > 0);

  const block = byArea
    .map(
      (g) =>
        `  ${g.area}:\n` +
        g.items.map((f) => `    - ${f.factor}: ${f.probe}`).join("\n")
    )
    .join("\n");

  const devLine =
    opts?.developmentFactors && opts.developmentFactors.length
      ? `\nPRIORITISE these development factors (the candidate scored below benchmark on them): ${opts.developmentFactors.join(", ")}. Spend most of the round here; confirm the strong factors only briefly.`
      : "";

  return (
    `DNLA COMPETENCY FRAMEWORK (this behavioural round is framed on the DNLA report ONLY — do NOT ask technical, coding, skills, or role-domain questions; those belong to the separate AI interview). Cover the DNLA factors below, moving AREA BY AREA in this order. Ask ONE adapted behavioural question per factor, always tailored to THIS candidate's resume and their last answer — never read these aloud verbatim, never announce the factor or that a list exists, never quiz them in list order. Listen for the report's own signals (ownership vs blame, opening up vs distance, calm vs defensiveness under criticism). Factors and anchor questions:\n` +
    block +
    devLine
  );
}
