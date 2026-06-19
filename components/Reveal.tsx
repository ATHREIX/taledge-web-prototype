"use client";

import { useRef, type ReactNode } from "react";
import { useScrollReveal, type RevealPreset } from "@/lib/motion-gsap";

/**
 * Drop-in scroll-reveal wrapper. Any section can do:
 *   <Reveal preset="slide-up">...</Reveal>
 *   <Reveal preset="stagger">{cards}</Reveal>   // animates direct children
 *
 * Safe by construction: respects reduced-motion and never leaves content
 * invisible if GSAP fails to load (see lib/motion-gsap.ts).
 */
export function Reveal({
  children,
  preset = "slide-up",
  className,
  start,
  stagger,
  disabled,
  id,
}: {
  children: ReactNode;
  preset?: RevealPreset;
  className?: string;
  start?: string;
  stagger?: number;
  disabled?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref, { preset, start, stagger, disabled });
  return (
    <div ref={ref} className={className} id={id}>
      {children}
    </div>
  );
}
