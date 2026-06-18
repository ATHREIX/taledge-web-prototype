import { cn } from "@/lib/utils";

/**
 * Single canonical card. Replaces the 5+ inline card styles in the prototype
 * (varying backdrop-blur, border opacity, and shadow values).
 *
 *  - default  : solid white card, panel elevation
 *  - frosted  : translucent frosted panel for dashboards / side rails
 *  - flat     : no shadow, soft border (nested / list items)
 */
type CardVariant = "default" | "frosted" | "flat";

const variants: Record<CardVariant, string> = {
  default: "bg-white border-ink-200/70 shadow-panel",
  frosted: "bg-white/80 border-ink-200/60 shadow-panel backdrop-blur-xl",
  flat: "bg-ink-50/60 border-ink-200/50",
};

export function Card({
  className,
  variant = "default",
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl2 border transition-all duration-300",
        variants[variant],
        hover && "hover:shadow-panel-hover hover:-translate-y-0.5",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 sm:p-6 pt-0", className)} {...props} />;
}
