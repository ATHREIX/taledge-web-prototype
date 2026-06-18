import { cn } from "@/lib/utils";

/**
 * Canonical metric primitive. Replaces the ad-hoc "label over a big number"
 * blocks scattered across the dashboards (varying label casing, value sizing,
 * and color usage).
 *
 * Renders a labelled metric: a small uppercase label, a headline value, and an
 * optional sub line. `tone` colors the value (and icon) for semantic emphasis,
 * matching the Badge tone palette.
 */
type Tone = "neutral" | "brand" | "success" | "warn" | "danger";

const valueTones: Record<Tone, string> = {
  neutral: "text-ink-900",
  brand: "text-brand-700",
  success: "text-emerald-600",
  warn: "text-amber-600",
  danger: "text-rose-600",
};

const iconTones: Record<Tone, string> = {
  neutral: "border-ink-200/80 bg-ink-50 text-ink-500",
  brand: "border-brand-100 bg-brand-50 text-brand-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl2 p-1",
        className
      )}
      {...props}
    >
      {icon != null && (
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl2 border",
            iconTones[tone]
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <span className="label block">{label}</span>
        <div
          className={cn(
            "h-headline mt-1 text-2xl sm:text-3xl leading-none",
            valueTones[tone]
          )}
        >
          {value}
        </div>
        {sub != null && (
          <div className="mt-1.5 text-sm text-ink-500">{sub}</div>
        )}
      </div>
    </div>
  );
}
