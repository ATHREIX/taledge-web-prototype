import { cn } from "@/lib/utils";

/**
 * Deterministic initials avatar. Same name → same on-brand tint everywhere
 * (nav, profile, candidate rows). Stays within the existing brand/accent/ink
 * palette - no new colors introduced.
 */
const TINTS = [
  "bg-brand-600",
  "bg-brand-700",
  "bg-brand-500",
  "bg-accent-600",
  "bg-accent-500",
  "bg-ink-700",
] as const;

const SIZES = {
  xs: "h-7 w-7 text-[11px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
} as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({
  name,
  email,
  size = "md",
  className,
}: {
  name?: string | null;
  email?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const label = (name || email || "User").trim();
  const initials =
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "U";
  const tint = TINTS[hashString(label) % TINTS.length];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-black leading-none text-white",
        tint,
        SIZES[size],
        className
      )}
    >
      {initials}
    </span>
  );
}
