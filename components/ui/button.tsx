import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "soft" | "danger" | "link";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";

const variants: Record<Variant, string> = {
  primary:
    "rounded-xl bg-brand-600 text-white border border-transparent hover:bg-brand-700 hover:shadow-md",
  ghost:
    "rounded-xl border border-ink-200 bg-white text-ink-900 shadow-sm hover:bg-ink-50 hover:border-ink-300",
  soft:
    "rounded-xl border border-brand-100 bg-brand-50 text-brand-700 hover:bg-brand-100",
  danger:
    "rounded-xl bg-rose-600 text-white border border-transparent hover:bg-rose-700 hover:shadow-md",
  link:
    "text-brand-700 underline-offset-4 hover:text-brand-800 hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "px-3.5 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        base,
        variant !== "link" && sizes[size],
        variants[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

export interface ButtonLinkProps
  extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

/** Same visual language as Button, rendered as a Next.js Link. */
export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        base,
        variant !== "link" && sizes[size],
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
