import type { Variants, Transition } from "framer-motion";

/**
 * Shared motion primitives. Every page must import these instead of
 * redefining container/item variants inline (the prototype duplicated
 * these definitions across 6+ pages).
 */

// Signature easing curve used across the whole product.
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const transition: Transition = { duration: 0.6, ease: EASE };

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition },
};

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.7, ease: EASE } },
};

/** Scroll-reveal (use with framer `whileInView`) — one source of truth. */
export const scrollRevealVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

/** Section/page enter presets shared by dashboards and routed views. */
export const sectionEnter = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition,
} as const;

export const pageEnter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: EASE },
} as const;
