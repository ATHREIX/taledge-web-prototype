"use client";

import { useEffect, useRef } from "react";
import anime from "animejs";

/**
 * anime.js word-by-word reveal for the hero headline. Renders the provided
 * segments (plain text + an optional gradient-highlighted word) as spans and
 * staggers them in on mount. Honors prefers-reduced-motion.
 */
export function AnimeHeadline({
  lines,
  className,
}: {
  lines: { text: string; gradient?: boolean }[][];
  className?: string;
}) {
  const root = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const words = el.querySelectorAll<HTMLElement>(".ah-word");
    if (reduce) {
      words.forEach((w) => (w.style.opacity = "1"));
      return;
    }
    anime({
      targets: words,
      translateY: [40, 0],
      opacity: [0, 1],
      rotateZ: [4, 0],
      duration: 900,
      delay: anime.stagger(70, { start: 120 }),
      easing: "easeOutExpo",
    });
  }, []);

  return (
    <h1 ref={root} className={"h-headline text-4xl sm:text-5xl lg:text-6xl leading-[1.05] " + (className || "")}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.map((seg, si) => (
            <span
              key={si}
              className={"ah-word inline-block opacity-0 will-change-transform " + (seg.gradient ? "text-gradient-brand" : "")}
              style={{ marginRight: "0.22em" }}
            >
              {seg.text}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}
