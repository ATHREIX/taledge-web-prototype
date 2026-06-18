"use client";

import { MotionConfig } from "framer-motion";

/**
 * Wraps the app in framer-motion's MotionConfig with reducedMotion="user",
 * so all motion components automatically honor the OS-level
 * prefers-reduced-motion setting (WCAG 2.3.3).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
