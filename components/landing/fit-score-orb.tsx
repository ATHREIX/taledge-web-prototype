"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { EASE } from "@/lib/motion";

/**
 * The hero "live Fit Score" - a luminous orb with an animated progress ring and
 * a number that counts up on mount. The single blur-glow on the page lives here
 * so it owns the visual hierarchy. Reduced-motion is handled by the global
 * MotionConfig + the prefers-reduced-motion CSS guard.
 */
export function FitScoreOrb({ value = 87, label = "Fit Score" }: { value?: number; label?: string }) {
  const [count, setCount] = useState(0);
  const R = 130;
  const C = 2 * Math.PI * R;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      // easeOutExpo-ish
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setCount(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className="relative grid place-items-center">
      {/* ambient glow - the one halo on the page */}
      <div aria-hidden className="absolute h-[22rem] w-[22rem] rounded-full bg-brand-500/25 blur-[90px]" />
      <div aria-hidden className="absolute h-[16rem] w-[16rem] rounded-full bg-accent-400/20 blur-[70px]" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative"
        role="img"
        aria-label={`${label}: ${value} out of 100`}
      >
        <svg width="320" height="320" viewBox="0 0 320 320" className="-rotate-90">
          <defs>
            <linearGradient id="orbGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
          <circle cx="160" cy="160" r={R} fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth="14" />
          <motion.circle
            cx="160"
            cy="160"
            r={R}
            fill="none"
            stroke="url(#orbGrad)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C - (value / 100) * C }}
            transition={{ duration: 1.6, ease: EASE }}
          />
        </svg>

        {/* center readout */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="h-headline text-6xl text-ink-900 tabular-nums">{count}</div>
            <div className="section-title mt-1 text-brand-600">{label}</div>
          </div>
        </div>

        {/* orbiting node */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2"
          animate={{ rotate: 360 }}
          transition={{ duration: 14, ease: "linear", repeat: Infinity }}
          style={{ originX: "50%", originY: "50%" }}
        >
          <div className="absolute -top-[150px] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-accent-400 shadow-[0_0_16px_4px_rgba(56,189,248,0.6)]" />
        </motion.div>
      </motion.div>
    </div>
  );
}
