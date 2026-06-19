"use client";

import { useEffect, type RefObject } from "react";

/**
 * Single reusable GSAP scroll-reveal primitive for the whole app.
 *
 * Framer Motion stays the system for INTERACTION (hover/tap/stagger/page
 * transitions). GSAP (via this hook + <Reveal>) is the system for
 * SCROLL-TRIGGERED reveals only — so the two never fight.
 *
 * Hard guarantees:
 *  - prefers-reduced-motion → content shown instantly (no animation).
 *  - gsap import / ScrollTrigger failure → content forced visible (never
 *    stuck at opacity:0, the classic scroll-reveal footgun).
 *  - lazy-imports gsap so it never bloats the initial bundle / breaks SSR.
 */
export type RevealPreset = "fade" | "slide-up" | "stagger";

export interface ScrollRevealOptions {
  preset?: RevealPreset;
  y?: number;
  duration?: number;
  stagger?: number;
  /** ScrollTrigger start, e.g. "top 85%". */
  start?: string;
  once?: boolean;
  /** Skip entirely (render static) — e.g. when a parent already animates. */
  disabled?: boolean;
}

function forceVisible(targets: HTMLElement[]) {
  targets.forEach((t) => {
    t.style.opacity = "1";
    t.style.transform = "none";
  });
}

export function useScrollReveal<T extends HTMLElement>(
  ref: RefObject<T | null>,
  opts: ScrollRevealOptions = {}
): void {
  const {
    preset = "slide-up",
    y = 24,
    duration = 0.7,
    stagger = 0.08,
    start = "top 85%",
    once = true,
    disabled = false,
  } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets: HTMLElement[] =
      preset === "stagger"
        ? (Array.from(el.children) as HTMLElement[])
        : [el];

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (disabled || reduced || targets.length === 0) {
      forceVisible(targets);
      return;
    }

    let killed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ctx: any;

    (async () => {
      try {
        const gsapMod: any = await import("gsap");
        const stMod: any = await import("gsap/ScrollTrigger");
        const gsap = gsapMod.gsap || gsapMod.default;
        const ScrollTrigger = stMod.ScrollTrigger || stMod.default;
        if (killed || !gsap || !ScrollTrigger) {
          forceVisible(targets);
          return;
        }
        gsap.registerPlugin(ScrollTrigger);
        ctx = gsap.context(() => {
          gsap.set(targets, { opacity: 0, y: preset === "fade" ? 0 : y });
          gsap.to(targets, {
            opacity: 1,
            y: 0,
            duration,
            ease: "power3.out",
            stagger: preset === "stagger" ? stagger : 0,
            scrollTrigger: { trigger: el, start, once },
          });
        }, el);
      } catch {
        forceVisible(targets);
      }
    })();

    return () => {
      killed = true;
      try {
        ctx?.revert();
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, preset, y, duration, stagger, start, once, disabled]);
}
