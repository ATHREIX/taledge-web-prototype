import { cn } from "@/lib/utils";

/**
 * Canonical badge/chip. Replaces inline chip markup scattered across pages.
 * Tone maps to semantic meaning, not per-role color.
 */
type Tone = "neutral" | "brand" | "success" | "warn" | "danger" | "dark";

const tones: Record<Tone, string> = {
  neutral: "border-ink-200/80 bg-white text-ink-700",
  brand: "border-brand-100 bg-brand-50 text-brand-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  dark: "border-ink-900 bg-ink-900 text-white",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
