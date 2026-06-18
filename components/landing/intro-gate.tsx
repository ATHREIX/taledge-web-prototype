"use client";

import React from "react";
import TaledgeHero from "@/components/landing/taledge-hero";

// Module-scoped flag: reset on every full page load (so a refresh replays the
// intro), but preserved across client-side navigations within a session (so
// clicking the logo back to "/" doesn't force the 12s intro again). Set only
// once the intro is actually dismissed, which keeps it React-StrictMode safe.
let introPlayed = false;

/**
 * Wraps the landing page. On a full page load it plays the 12s Taledge hero
 * animation full-screen, then fades into the landing page underneath.
 * Skippable, never shown with reduced-motion, and not replayed on SPA nav.
 */
export default function IntroGate({ children }: { children: React.ReactNode }) {
  // Start in "intro" so the black overlay paints immediately during SSR (the
  // landing never flashes underneath). The hero itself mounts client-only.
  const [phase, setPhase] = React.useState<"intro" | "fading" | "done">("intro");
  const [mounted, setMounted] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = React.useCallback((instant = false) => {
    introPlayed = true;
    if (instant) {
      setPhase("done");
      return;
    }
    setPhase((p) => (p === "intro" ? "fading" : p));
    timerRef.current = setTimeout(() => setPhase("done"), 700);
  }, []);

  React.useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (introPlayed || reduced) {
      dismiss(true);
    } else {
      setMounted(true);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {children}
      {phase !== "done" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "#050506",
            opacity: phase === "fading" ? 0 : 1,
            transition: "opacity 700ms cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: phase === "fading" ? "none" : "auto",
          }}
        >
          {mounted && <TaledgeHero loop={false} showControls={false} persist={false} onComplete={() => dismiss()} />}
          {mounted && (
            <button
              onClick={() => dismiss()}
              aria-label="Skip intro"
              style={{
                position: "absolute",
                right: 24,
                bottom: 24,
                padding: "10px 20px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                color: "rgba(255,255,255,0.85)",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "var(--font-inter), 'Plus Jakarta Sans', system-ui, sans-serif",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              Skip intro ›
            </button>
          )}
        </div>
      )}
    </>
  );
}
