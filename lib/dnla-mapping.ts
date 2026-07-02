import "server-only";
import type { DnlaResults } from "@/lib/dnla-client";

/**
 * Maps a raw DNLA result (`values: { esk_*: "1".."N" }`) onto the four PRD
 * competency axes and the shape the Fit Score generator consumes.
 *
 * ── TWO THINGS TO CONFIRM with DNLA before go-live (set via env, no code change):
 *   1. Scale: DNLA_SCALE_MAX  — the max raw value (example shows "1".."5";
 *      DNLA ESK is often a 1–9 stanine). Default 9. Wrong value only mis-scales,
 *      it never crashes.
 *   2. Polarity: DNLA_SCALE_HIGHER_IS_BETTER (default true). If 1 = best, set false.
 *   3. The FULL esk_* factor → axis mapping. We place the documented keys
 *      explicitly below and fall back to keyword heuristics for the rest, so the
 *      integration works immediately and gets more precise as keys are confirmed.
 */

export type AxisKey = "achievement" | "interpersonal" | "will_to_succeed" | "stress_capacity";

export const AXIS_LABEL: Record<AxisKey, string> = {
  achievement: "Achievement Dynamics",
  interpersonal: "Interpersonal Relations",
  will_to_succeed: "Will to Succeed",
  stress_capacity: "Stress Capacity",
};

// ───────────────────────────────────────────────────────────────────────────
// TODO(DNLA meeting) — fill in from the answers to DNLA_MEETING_NOTES.md.
// Until confirmed, the values here are best-guesses and the integration stays
// behind the DNLA feature flag.
//
//   [ ] Q1 SCALE     → env DNLA_SCALE_MAX (raw max; guess 9) +
//                      DNLA_SCALE_HIGHER_IS_BETTER (guess true). Confirm whether
//                      any factor is reverse-scored (would need per-factor flags).
//   [ ] Q1 NORMS     → env DNLA_BENCHMARK, or switch to per-factor norms if DNLA
//                      returns an "Idealbereich" per factor (extend DnlaItem).
//   [ ] Q2 CATALOGUE → replace the keyword heuristics in axisForFactor() with the
//                      FULL factor-key → axis map below (keys + EN/DE labels +
//                      official groups). Confirm our 4 axes match DNLA's groups.
//   [ ] Q8 AREA      → env DNLA_API_AREA (ESK | AZS); catalogue differs per area.
// ───────────────────────────────────────────────────────────────────────────

// Explicit placements for the keys documented in the DNLA spec. Extend this as
// the full ESK factor list is confirmed — anything not listed is routed by the
// keyword heuristics in axisForFactor().
const KNOWN_FACTOR_AXIS: Record<string, AxisKey> = {
  esk_self_confidence: "achievement",
  esk_drive_and_application: "achievement",
  esk_self_responsibility: "will_to_succeed",
};

function scaleMax(): number {
  const n = Number(process.env.DNLA_SCALE_MAX);
  return Number.isFinite(n) && n > 0 ? n : 9;
}
function higherIsBetter(): boolean {
  return process.env.DNLA_SCALE_HIGHER_IS_BETTER !== "false";
}

/** Best-guess axis for an unknown factor key, by keyword. */
function axisForFactor(key: string): AxisKey {
  if (KNOWN_FACTOR_AXIS[key]) return KNOWN_FACTOR_AXIS[key];
  const k = key.toLowerCase();
  if (/(stress|resilien|pressure|emotion|stabil|frustrat|optimis|outlook)/.test(k)) return "stress_capacity";
  if (/(team|social|contact|empath|interpers|communicat|cooperat|assert|relation)/.test(k)) return "interpersonal";
  if (/(responsib|initiativ|systemat|disciplin|will|persever|goal|diligen|consisten)/.test(k)) return "will_to_succeed";
  // drive / motivation / confidence / achievement and everything else
  return "achievement";
}

/** Turn a factor key like "esk_self_responsibility" into "Self responsibility". */
export function humanizeFactor(key: string): string {
  const s = key.replace(/^esk_/, "").replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Normalize a single raw factor value to 0–100. */
export function normalizeValue(raw: string | number): number | null {
  const v = Number(raw);
  if (!Number.isFinite(v)) return null;
  const max = scaleMax();
  const pct = higherIsBetter() ? (v / max) * 100 : ((max - v) / (max - 1 || 1)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export type DnlaItem = {
  competency: string;
  group: string;
  score: number; // 0–100
  benchmark: number; // 0–100 (DNLA "ideal range" midpoint; configurable)
  insight: string;
};

export type NormalizedDnla = {
  profile: string;
  finishedAt: string;
  /** Per-axis 0–100 averages. */
  axes: Record<AxisKey, number>;
  /** Overall behavioural baseline (mean of populated axes), 0–100. */
  baseline: number;
  /** Per-factor breakdown for the Fit Score's DNLA component. */
  dnla: DnlaItem[];
  strengths: string[];
  developmentAreas: string[];
  risks: string[];
};

const BENCHMARK = Number(process.env.DNLA_BENCHMARK) || 70;

/**
 * Convert a DNLA results document into the normalized, axis-mapped shape used by
 * the Fit Score generator and the candidate-facing DNLA card.
 */
export function normalizeDnlaResults(res: DnlaResults): NormalizedDnla {
  const items: DnlaItem[] = [];
  const axisScores: Record<AxisKey, number[]> = {
    achievement: [],
    interpersonal: [],
    will_to_succeed: [],
    stress_capacity: [],
  };

  for (const [key, raw] of Object.entries(res.values || {})) {
    const score = normalizeValue(raw);
    if (score == null) continue;
    const axis = axisForFactor(key);
    axisScores[axis].push(score);
    items.push({
      competency: humanizeFactor(key),
      group: AXIS_LABEL[axis],
      score,
      benchmark: BENCHMARK,
      insight: "",
    });
  }

  const axes = Object.fromEntries(
    (Object.keys(axisScores) as AxisKey[]).map((a) => {
      const arr = axisScores[a];
      return [a, arr.length ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length) : 0];
    })
  ) as Record<AxisKey, number>;

  const populated = Object.values(axes).filter((v) => v > 0);
  const baseline = populated.length
    ? Math.round(populated.reduce((a, b) => a + b, 0) / populated.length)
    : 0;

  const sorted = [...items].sort((a, b) => b.score - a.score);
  const strengths = sorted.filter((i) => i.score >= BENCHMARK).slice(0, 5).map((i) => i.competency);
  const developmentAreas = sorted
    .filter((i) => i.score < BENCHMARK)
    .slice(-5)
    .reverse()
    .map((i) => i.competency);
  const risks = items.filter((i) => i.score < BENCHMARK - 20).map((i) => `${i.competency} below benchmark`);

  return {
    profile: res.profile || "",
    finishedAt: res.finished_at || "",
    axes,
    baseline,
    dnla: items,
    strengths,
    developmentAreas,
    risks,
  };
}
