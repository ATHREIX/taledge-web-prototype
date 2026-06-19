"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe hook for the OS-level prefers-reduced-motion setting (WCAG 2.3.3).
 * Returns false on the server / first paint, then updates on the client.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}
