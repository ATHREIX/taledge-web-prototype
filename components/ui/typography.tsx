import { cn } from "@/lib/utils";

/**
 * Canonical type scale. Use these instead of ad-hoc text-4xl font-black
 * combinations (the prototype mixed tracking-tight vs tracking-tighter vs
 * none across page headlines).
 */

export function Display({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "h-headline text-4xl sm:text-5xl lg:text-6xl leading-[1.05]",
        className
      )}
      {...props}
    />
  );
}

export function Heading({
  as: Tag = "h2",
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h1" | "h2" | "h3" }) {
  return (
    <Tag
      className={cn("h-headline text-2xl sm:text-3xl", className)}
      {...props}
    />
  );
}

export function Eyebrow({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("section-title", className)} {...props} />;
}

export function Label({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("label", className)} {...props} />;
}
