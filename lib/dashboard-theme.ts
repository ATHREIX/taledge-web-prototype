/**
 * Shared dashboard theming helpers so every stakeholder dashboard maps
 * scores/severities to the SAME colour language (no more hardcoded
 * #be123c / #b45309 / #047857 scattered per page).
 */
export type Tone = "brand" | "success" | "warn" | "danger" | "neutral";

/** Score (0-100) -> semantic tone. */
export function scoreToTone(score: number): Tone {
  if (score < 0) return "neutral";
  if (score >= 75) return "success";
  if (score >= 55) return "brand";
  if (score >= 40) return "warn";
  return "danger";
}

/** Tailwind text/border/bg class trio for a tone (frosted card accents). */
export const toneClasses: Record<Tone, { text: string; bg: string; border: string; dot: string }> = {
  brand: { text: "text-brand-700", bg: "bg-brand-50", border: "border-brand-200", dot: "bg-brand-500" },
  success: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  warn: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
  danger: { text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500" },
  neutral: { text: "text-ink-700", bg: "bg-ink-50", border: "border-ink-200", dot: "bg-ink-400" },
};

/** Heatmap fill for a 0-100 value (recruiter grid, institute readiness). */
export function heatmapColor(value: number): string {
  if (value >= 75) return "rgba(16,185,129,0.18)";
  if (value >= 55) return "rgba(79,70,229,0.16)";
  if (value >= 40) return "rgba(245,158,11,0.16)";
  return "rgba(244,63,94,0.16)";
}
