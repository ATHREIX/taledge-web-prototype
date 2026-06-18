import { cn } from "@/lib/utils";

/**
 * Standard page scaffold. Every page renders inside a PageShell so the
 * canvas color, max-width, horizontal padding, and ambient brand glow are
 * identical everywhere (the prototype had 3 bg colors + 4 max-widths).
 *
 * width:
 *   default -> max-w-7xl  (dashboards, portals)
 *   wide    -> max-w-[90rem] (marketing / landing)
 *   narrow  -> max-w-3xl  (forms, reports, reading)
 */
type Width = "default" | "wide" | "narrow";

const widths: Record<Width, string> = {
  default: "max-w-7xl",
  wide: "max-w-[90rem]",
  narrow: "max-w-3xl",
};

export function PageShell({
  children,
  className,
  width = "default",
  glow = true,
  grid = true,
}: {
  children: React.ReactNode;
  className?: string;
  width?: Width;
  glow?: boolean;
  grid?: boolean;
}) {
  return (
    <div className="relative min-h-screen bg-canvas">
      {grid && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
        />
      )}
      {glow && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/3 h-[28rem] w-[28rem] rounded-full bg-brand-300/20 blur-[120px]" />
          <div className="absolute -top-20 right-1/4 h-[22rem] w-[22rem] rounded-full bg-accent-300/20 blur-[120px]" />
        </div>
      )}
      <div
        className={cn(
          "relative mx-auto px-5 sm:px-8 py-10 sm:py-14",
          widths[width],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Standard page header: eyebrow + title + optional description and actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <div className="section-title mb-2">{eyebrow}</div>}
        <h1 className="h-headline text-3xl sm:text-4xl lg:text-5xl">{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-ink-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
