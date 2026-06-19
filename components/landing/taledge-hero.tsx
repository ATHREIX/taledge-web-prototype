"use client";

// TaledgeHero — 12s landing hero animation for Taledge.
// Ported from the Claude Design project "Taledge Hero" (TaledgeHero.jsx).
// Self-contained: minimal timeline engine + three scenes + playback bar.
// Brand palette already matches the project tokens (brand/accent/orange/ink).

import React from "react";

// ── Easing ────────────────────────────────────────────────────────────────
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xe = sampleX(t) - x;
      const d = dX(t);
      if (Math.abs(xe) < 1e-4) break;
      if (Math.abs(d) < 1e-6) break;
      t -= xe / d;
    }
    return sampleY(t);
  };
}
// Framer Motion "smooth" curve.
const easeFramer = cubicBezier(0.16, 1, 0.3, 1);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ── Timeline / Stage ────────────────────────────────────────────────────────
const TimelineContext = React.createContext({ time: 0, duration: 12 });
const useTime = () => React.useContext(TimelineContext).time;
const useTimeline = () => React.useContext(TimelineContext);

function Stage({
  width,
  height,
  duration,
  background,
  persistKey = "taledge",
  loop = true,
  showControls = true,
  persist = true,
  onComplete,
  children,
}: {
  width: number;
  height: number;
  duration: number;
  background: string;
  persistKey?: string;
  loop?: boolean;
  showControls?: boolean;
  persist?: boolean;
  onComplete?: () => void;
  children: React.ReactNode;
}) {
  const [time, setTime] = React.useState<number>(() => {
    if (!persist) return 0;
    try {
      const v = parseFloat(localStorage.getItem(persistKey + ":t") || "0");
      return isFinite(v) ? clamp(v, 0, duration) : 0;
    } catch {
      return 0;
    }
  });
  const [playing, setPlaying] = React.useState(true);
  const [hoverTime, setHoverTime] = React.useState<number | null>(null);
  const [scale, setScale] = React.useState(1);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastTsRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!persist) return;
    try {
      localStorage.setItem(persistKey + ":t", String(time));
    } catch {}
  }, [time, persistKey, persist]);

  const completedRef = React.useRef(false);

  // Fire completion as a post-render side-effect (never inside the setTime
  // updater, which must stay pure — calling a parent setState there throws
  // "Cannot update a component while rendering a different component").
  React.useEffect(() => {
    if (!loop && !completedRef.current && time >= duration) {
      completedRef.current = true;
      setPlaying(false);
      onComplete?.();
    }
  }, [time, loop, duration, onComplete]);

  React.useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const measure = () => {
      const barH = 44;
      const s = Math.min(el.clientWidth / width, (el.clientHeight - barH) / height);
      setScale(Math.max(0.05, s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [width, height]);

  React.useEffect(() => {
    if (!playing) {
      lastTsRef.current = null;
      return;
    }
    const step = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setTime((t) => {
        const n = t + dt;
        if (n < duration) return n;
        return loop ? n % duration : duration;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [playing, duration, loop, onComplete]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.code === "ArrowLeft") setTime((t) => clamp(t - (e.shiftKey ? 1 : 0.1), 0, duration));
      else if (e.code === "ArrowRight") setTime((t) => clamp(t + (e.shiftKey ? 1 : 0.1), 0, duration));
      else if (e.key === "0" || e.code === "Home") setTime(0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duration]);

  const displayTime = hoverTime != null ? hoverTime : time;
  const ctxValue = React.useMemo(() => ({ time: displayTime, duration }), [displayTime, duration]);

  return (
    <div
      ref={stageRef}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "#050506",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <div
          data-screen-label="Taledge Hero"
          style={{
            width,
            height,
            background,
            position: "relative",
            transform: `scale(${scale})`,
            transformOrigin: "center",
            flexShrink: 0,
            boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          <TimelineContext.Provider value={ctxValue}>{children}</TimelineContext.Provider>
        </div>
      </div>
      {showControls && (
        <PlaybackBar
          time={displayTime}
          duration={duration}
          playing={playing}
          onPlayPause={() => setPlaying((p) => !p)}
          onReset={() => setTime(0)}
          onSeek={(t) => setTime(t)}
          onHover={(t) => setHoverTime(t)}
        />
      )}
    </div>
  );
}

function PlaybackBar({
  time,
  duration,
  playing,
  onPlayPause,
  onReset,
  onSeek,
  onHover,
}: {
  time: number;
  duration: number;
  playing: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  onSeek: (t: number) => void;
  onHover: (t: number | null) => void;
}) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const timeFromEvent = React.useCallback(
    (e: { clientX: number }) => {
      const rect = trackRef.current!.getBoundingClientRect();
      return clamp((e.clientX - rect.left) / rect.width, 0, 1) * duration;
    },
    [duration]
  );
  const onTrackMove = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const t = timeFromEvent(e);
    dragging ? onSeek(t) : onHover(t);
  };
  const onTrackLeave = () => {
    if (!dragging) onHover(null);
  };
  const onTrackDown = (e: React.MouseEvent) => {
    setDragging(true);
    onSeek(timeFromEvent(e));
    onHover(null);
  };
  React.useEffect(() => {
    if (!dragging) return;
    const onUp = () => setDragging(false);
    const onMove = (e: MouseEvent) => {
      if (trackRef.current) onSeek(timeFromEvent(e));
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
    };
  }, [dragging, timeFromEvent, onSeek]);
  const pct = duration > 0 ? (time / duration) * 100 : 0;
  const fmt = (t: number) => {
    const tot = Math.max(0, t);
    const s = Math.floor(tot % 60);
    const cs = Math.floor((tot * 100) % 100);
    return `0:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };
  const mono = "JetBrains Mono, ui-monospace, monospace";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        background: "rgba(10,10,12,0.92)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        width: "100%",
        maxWidth: 680,
        alignSelf: "center",
        borderRadius: 8,
        color: "#f4f4f5",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <IconButton onClick={onReset} title="Restart (0)">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 2v10M12 2L5 7l7 5V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </IconButton>
      <IconButton onClick={onPlayPause} title="Play/pause (space)">
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <rect x="3" y="2" width="3" height="10" fill="currentColor" />
            <rect x="8" y="2" width="3" height="10" fill="currentColor" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M3 2l9 5-9 5V2z" fill="currentColor" />
          </svg>
        )}
      </IconButton>
      <div style={{ fontFamily: mono, fontSize: 12, fontVariantNumeric: "tabular-nums", width: 56, textAlign: "right" }}>{fmt(time)}</div>
      <div
        ref={trackRef}
        onMouseMove={onTrackMove}
        onMouseLeave={onTrackLeave}
        onMouseDown={onTrackDown}
        style={{ flex: 1, height: 22, position: "relative", cursor: "pointer", display: "flex", alignItems: "center" }}
      >
        <div style={{ position: "absolute", left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2 }} />
        <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 4, background: "#6366f1", borderRadius: 2 }} />
        <div style={{ position: "absolute", left: `${pct}%`, top: "50%", width: 12, height: 12, marginLeft: -6, marginTop: -6, background: "#fff", borderRadius: 6, boxShadow: "0 2px 4px rgba(0,0,0,0.4)" }} />
      </div>
      <div style={{ fontFamily: mono, fontSize: 12, fontVariantNumeric: "tabular-nums", width: 56, color: "rgba(244,244,245,0.55)" }}>{fmt(duration)}</div>
    </div>
  );
}

function IconButton({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hover ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 6,
        color: "#f4f4f5",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── Brand palette (matches tailwind.config brand/accent/orange/ink tokens) ───
const C = {
  brand600: "#4f46e5",
  brand500: "#6366f1",
  brand400: "#818cf8",
  accent500: "#0ea5e9",
  accent400: "#38bdf8",
  orange: "#f57f00",
  ink400: "#a1a1aa",
  white: "#ffffff",
};

// Site typeface (Sora, exposed by layout.tsx as --font-sans) so the animation
// matches the rest of the app rather than falling back to a system font.
const FONT = "var(--font-sans), system-ui, sans-serif";

// Canonical brand gradient — mirrors the `.text-gradient-brand` utility used on
// the live landing hero (from-brand-600 to-accent-500).
const BRAND_GRADIENT = `linear-gradient(100deg, ${C.brand600} 0%, ${C.accent500} 100%)`;

const W = 1920,
  H = 1080,
  CX = 960,
  CY = 524;

// ── helpers ─────────────────────────────────────────────────────────────────
// Reveal envelope: fade + rise on entry, optional fade-out.
function envelope(
  t: number,
  start: number,
  dur: number,
  {
    rise = 16,
    ease = easeFramer,
    outStart = null as number | null,
    outDur = 0.4,
    outRise = -10,
  }: { rise?: number; ease?: (t: number) => number; outStart?: number | null; outDur?: number; outRise?: number } = {}
) {
  let opacity = 0,
    ty = rise;
  const local = t - start;
  if (local >= 0) {
    const p = clamp(local / dur, 0, 1);
    const e = ease(p);
    opacity = e;
    ty = (1 - e) * rise;
  }
  if (outStart != null && t > outStart) {
    const p = clamp((t - outStart) / outDur, 0, 1);
    const e = easeOutCubic(p);
    opacity *= 1 - e;
    ty += e * outRise;
  }
  return { opacity, ty };
}

// ── Particle ring (Scene 1) ──────────────────────────────────────────────────
function ParticleRing({ groupOpacity }: { groupOpacity: number }) {
  const t = useTime();
  const N = 56;
  const ringR = 300;
  const particles = React.useMemo(() => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: N }, (_, i) => ({
      ang: (i / N) * Math.PI * 2,
      startR: ringR + 220 + rnd() * 420,
      spiral: (1.4 + rnd() * 1.6) * Math.PI,
      delay: rnd() * 0.45,
      size: 3 + rnd() * 4,
      dur: 1.15 + rnd() * 0.35,
      tw: rnd() * Math.PI * 2,
    }));
  }, []);

  const ringGlow = easeFramer(clamp((t - 0.9) / 0.9, 0, 1)) * groupOpacity;
  const globalRot = t * 0.06;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: groupOpacity }}>
      {/* central soft glow */}
      <div
        style={{
          position: "absolute",
          left: CX,
          top: CY,
          width: 720,
          height: 720,
          marginLeft: -360,
          marginTop: -360,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(99,102,241,0.30) 0%, rgba(79,70,229,0.10) 38%, rgba(10,10,11,0) 68%)`,
          filter: "blur(8px)",
          opacity: ringGlow,
        }}
      />
      {/* glowing ring stroke */}
      <div
        style={{
          position: "absolute",
          left: CX,
          top: CY,
          width: ringR * 2,
          height: ringR * 2,
          marginLeft: -ringR,
          marginTop: -ringR,
          borderRadius: "50%",
          border: "1.5px solid rgba(129,140,248,0.55)",
          boxShadow: "0 0 40px rgba(99,102,241,0.45), inset 0 0 60px rgba(99,102,241,0.18)",
          opacity: ringGlow * 0.9,
          transform: `scale(${lerp(0.92, 1, ringGlow)})`,
        }}
      />
      {/* particles */}
      {particles.map((p, i) => {
        const fp = easeFramer(clamp((t - p.delay) / p.dur, 0, 1));
        const r = lerp(p.startR, ringR, fp);
        const ang = p.ang + p.spiral * (1 - fp) + globalRot;
        const x = CX + r * Math.cos(ang);
        const y = CY + r * Math.sin(ang);
        const twinkle = 0.55 + 0.45 * Math.sin(t * 2.4 + p.tw);
        const op = fp * (fp >= 1 ? twinkle : 1);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              borderRadius: "50%",
              background: i % 5 === 0 ? C.accent400 : C.brand400,
              boxShadow: `0 0 ${6 + p.size}px ${i % 5 === 0 ? "rgba(56,189,248,0.9)" : "rgba(129,140,248,0.9)"}`,
              opacity: op,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Scene 1: headline ─────────────────────────────────────────────────────────
function Scene1() {
  const t = useTime();
  const group = 1 - easeOutCubic(clamp((t - 4.55) / 0.45, 0, 1)); // fade whole scene out 4.55–5.0
  if (group <= 0) return null;

  const words = ["Turn", "potential", "into", "proof."];
  const headStart = 1.25,
    stagger = 0.16;

  const sub = envelope(t, 3.05, 0.7, { rise: 16, outStart: 4.55, outDur: 0.4 });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <ParticleRing groupOpacity={group} />
      {/* headline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: CY - 78,
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "0 26px",
          padding: "0 80px",
          opacity: group,
        }}
      >
        {words.map((w, i) => {
          const e = envelope(t, headStart + i * stagger, 0.55, { rise: 18, outStart: 4.55, outDur: 0.4, outRise: -8 });
          const isLast = i === words.length - 1;
          return (
            <span
              key={i}
              style={{
                fontSize: 118,
                fontWeight: 700,
                lineHeight: 1.04,
                letterSpacing: "-0.035em",
                opacity: e.opacity,
                transform: `translateY(${e.ty}px)`,
                display: "inline-block",
                willChange: "transform, opacity",
                color: isLast ? "transparent" : C.white,
                backgroundImage: isLast ? BRAND_GRADIENT : "none",
                WebkitBackgroundClip: isLast ? "text" : "border-box",
                backgroundClip: isLast ? "text" : "border-box",
                WebkitTextFillColor: isLast ? "transparent" : C.white,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      {/* subline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: CY + 96,
          textAlign: "center",
          padding: "0 120px",
          opacity: sub.opacity,
          transform: `translateY(${sub.ty}px)`,
          fontSize: 31,
          fontWeight: 400,
          letterSpacing: "-0.01em",
          color: C.ink400,
          lineHeight: 1.45,
        }}
      >
        AI interviews, DNLA psychometrics and human coaching: one defensible score.
      </div>
    </div>
  );
}

// ── Scene 2: logo lockup ──────────────────────────────────────────────────────
function Peak({ start, w, h, grad }: { start: number; w: number; h: number; grad: string }) {
  const t = useTime();
  const p = easeFramer(clamp((t - start) / 0.5, 0, 1));
  return (
    <div style={{ width: w, height: 168, position: "relative", display: "flex", alignItems: "flex-end" }}>
      <div style={{ width: w, height: h, background: grad, clipPath: "polygon(50% 0, 100% 100%, 0 100%)", transform: `scaleY(${p})`, transformOrigin: "bottom", opacity: clamp(p * 1.6, 0, 1) }} />
    </div>
  );
}

function Scene2() {
  const t = useTime();
  if (t < 4.85) return null;

  const card = envelope(t, 5.0, 0.65, { rise: 26, ease: easeFramer });
  const cardScale = lerp(0.94, 1, easeFramer(clamp((t - 5.0) / 0.7, 0, 1)));
  const orbPulse = 0.5 + 0.22 * Math.sin((t - 5) * 2.0);
  const orbScale = 1 + 0.07 * Math.sin((t - 5) * 2.0);

  // wordmark typing
  const letters = "taledge".split("");
  const typeStart = 6.55,
    perChar = 0.07;
  const revealed = Math.floor(clamp((t - typeStart) / perChar, 0, letters.length));
  const cursorOn = t > typeStart && t < typeStart + letters.length * perChar + 0.6 && Math.sin(t * 9) > 0;

  const tag = envelope(t, 7.5, 0.6, { rise: 12 });

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* glow orb behind card */}
      <div
        style={{
          position: "absolute",
          left: CX,
          top: CY,
          width: 760,
          height: 760,
          marginLeft: -380,
          marginTop: -380,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.45) 0%, rgba(79,70,229,0.16) 40%, rgba(10,10,11,0) 70%)",
          filter: "blur(24px)",
          opacity: card.opacity * orbPulse,
          transform: `scale(${orbScale})`,
        }}
      />
      {/* frosted card */}
      <div
        style={{
          position: "relative",
          width: 880,
          padding: "76px 80px",
          borderRadius: 32,
          background: "rgba(24,24,27,0.55)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          opacity: card.opacity,
          transform: `translateY(${card.ty}px) scale(${cardScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
        }}
      >
        {/* logo lockup row */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
          {/* peaks */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <Peak start={5.35} w={84} h={104} grad="linear-gradient(160deg, #4d7eff, #1b3fbf)" />
            <Peak start={5.6} w={96} h={158} grad="linear-gradient(160deg, #ffb14d, #f57f00)" />
            <Peak start={5.85} w={84} h={130} grad="linear-gradient(160deg, #84efc1, #21a17c)" />
          </div>
          {/* wordmark */}
          <div style={{ display: "flex", alignItems: "baseline", fontSize: 96, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1, paddingBottom: 6 }}>
            {letters.map((ch, i) => (
              <span key={i} style={{ color: i < 3 ? C.white : C.orange, opacity: i < revealed ? 1 : 0, transition: "opacity 90ms linear" }}>
                {ch}
              </span>
            ))}
            <span style={{ width: 5, height: 78, background: C.orange, marginLeft: 6, opacity: cursorOn ? 0.9 : 0, alignSelf: "center" }} />
          </div>
        </div>
        {/* tagline */}
        <div style={{ fontSize: 26, fontWeight: 400, letterSpacing: "0.01em", color: C.ink400, opacity: tag.opacity, transform: `translateY(${tag.ty}px)` }}>
          Turn potential into proof.
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function TaledgeHero({
  loop = true,
  showControls = true,
  persist = true,
  onComplete,
}: {
  loop?: boolean;
  showControls?: boolean;
  persist?: boolean;
  onComplete?: () => void;
} = {}) {
  return (
    <Stage
      width={W}
      height={H}
      duration={9}
      background="radial-gradient(circle at 50% 42%, #18181b 0%, #0a0a0a 60%, #050506 100%)"
      loop={loop}
      showControls={showControls}
      persist={persist}
      onComplete={onComplete}
    >
      <Scene1 />
      <Scene2 />
    </Stage>
  );
}
