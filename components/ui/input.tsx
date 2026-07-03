import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Canonical form primitives. One focus treatment shared with <Button>
 * (focus-visible:ring-2 focus-visible:ring-brand-500/40), ink-* text, and the
 * canonical rounded-xl radius so every field looks like one product.
 *
 * Consumers should migrate their hand-rolled <input>/<textarea>/<select> to
 * these instead of re-declaring border/focus/placeholder styles per form.
 */
const base =
  "w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm transition-colors placeholder:text-ink-400 hover:border-ink-300 focus-visible:outline-none focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-[6rem] resize-y leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(base, "cursor-pointer pr-9", className)} {...props} />
));
Select.displayName = "Select";
