"use client";

import { useEffect, useState } from "react";

/**
 * Animated integer count-up on mount. Respects prefers-reduced-motion (renders
 * the final value immediately). Use for whole-number metrics only - pass the
 * already-formatted string for "Pending"/"-" cases instead.
 */
export function CountUp({
  value,
  duration = 900,
  className,
  suffix = "",
}: {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(safe);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) {
      setDisplay(safe);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const from = 0;
    const step = (now: number) => {
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (safe - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [safe, duration]);

  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}
