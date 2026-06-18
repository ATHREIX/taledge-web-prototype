"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Badge,
  Display,
  Heading,
  Eyebrow,
  Stat,
} from "@/components/ui";
import { EASE, transition } from "@/lib/motion";

// Types
type Turn = { who: "ai" | "you"; text: string };

const SHOW_PHASE_2 = false;

const scripted: Turn[] = [
  { who: "ai", text: "Welcome back. Last week you flagged that a stakeholder review went sideways. Want to debrief on that?" },
  { who: "you", text: "Yeah. I think I got defensive when product pushed back on the rollout timeline." },
  { who: "ai", text: "Got it. Let's separate what they said from what you heard. In one sentence, what did the stakeholder actually say?" },
  { who: "you", text: "They said the rollout was too aggressive for the support team's current capacity." },
  { who: "ai", text: "Right. That's a capacity claim, not a critique of your plan. Notice the difference? Next time, pause two seconds and restate before responding." },
];

export default function CoachAI() {
  return SHOW_PHASE_2 ? (
    <CoachAIPhaseTwo />
  ) : (
    <PageShell className="grid min-h-screen place-items-center text-center">
      <div>
        <Heading as="h1" className="text-2xl">This workspace is not available in Phase 1.</Heading>
        <p className="mt-2 text-sm text-ink-500">Return to the Phase 1 platform workspace.</p>
      </div>
    </PageShell>
  );
}

function CoachAIPhaseTwo() {
  const [vol, setVol] = useState(0);
  const [conn, setConn] = useState(false);
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (conn) {
      t = setInterval(() => setVol(Math.random() * 100), 100);
    } else {
      setVol(0);
    }
    return () => clearInterval(t);
  }, [conn]);

  return (
    <PageShell width="wide" className="selection:bg-brand-500/30 font-sans">
      {/* Nav/Header Strip */}
      <PageHeader
        className="mb-10 lg:mb-14 items-start lg:items-end"
        title={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <Badge tone="brand">
                <IconSpark className="w-3.5 h-3.5" /> Phase 2 Preview
              </Badge>
              <Badge tone="neutral">Lifelong Success Intelligence</Badge>
            </div>
            <Display className="text-4xl sm:text-5xl lg:text-6xl">
              Real-time Voice <br className="hidden sm:block" /> Coaching for Roles
            </Display>
            <p className="mt-4 text-base sm:text-lg text-ink-500 font-light leading-relaxed">
              Designed for <span className="font-medium text-ink-900">Gemini Live</span> once Phase 2 is enabled.
              Low-latency voice coaching with provider-issued ephemeral tokens.
            </p>
          </motion.div>
        }
        actions={
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
            className="mt-6 lg:mt-0 flex flex-wrap items-center gap-3"
          >
            {['75ms Latency', '32 Languages', 'In Development'].map((tag) => (
              <span key={tag} className="rounded-lg border border-ink-200/70 bg-white px-4 py-2 text-xs font-medium text-ink-600 shadow-sm">
                {tag}
              </span>
            ))}
          </motion.div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

        {/* LEFT COLUMN: Voice Orb + Chat */}
        <div className="lg:col-span-7 flex flex-col gap-8">

          {/* VOICE ORB CARD */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <Card variant="frosted" className="relative rounded-xl3 p-8 sm:p-12 overflow-hidden group">
              {/* Subtle hover gradient */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/5 to-accent-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="relative z-10 flex flex-col items-center">
                {/* Glowing Orb */}
                <div className="relative flex items-center justify-center w-64 h-64">
                  <AnimatePresence>
                    {conn && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 rounded-full bg-brand-500/20 blur-[60px]"
                      />
                    )}
                  </AnimatePresence>

                  {/* Outer Ring */}
                  <motion.div
                    animate={conn ? {
                      scale: [1, 1 + vol / 300, 1],
                      opacity: [0.3, 0.5 + vol / 200, 0.3],
                    } : {
                      scale: 1,
                      opacity: 0.2
                    }}
                    transition={{ duration: 0.2, ease: "linear" }}
                    className="absolute w-48 h-48 sm:w-56 sm:h-56 rounded-full border border-brand-500/30"
                  />

                  {/* Inner Ring */}
                  <motion.div
                    animate={conn ? {
                      scale: [1, 1 + vol / 200, 1],
                      borderWidth: [1, 2, 1]
                    } : { scale: 1, borderWidth: 1 }}
                    transition={{ duration: 0.15, ease: "linear" }}
                    className="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full border border-brand-400/40 bg-brand-500/5 backdrop-blur-md"
                  />

                  {/* Core Orb */}
                  <motion.div
                    animate={conn ? {
                      scale: [1, 1 + vol / 100, 1],
                      boxShadow: [
                        "0 0 20px rgba(99, 102, 241, 0.3)",
                        "0 0 60px rgba(99, 102, 241, 0.6)",
                        "0 0 20px rgba(99, 102, 241, 0.3)",
                      ]
                    } : {
                      scale: 1,
                      boxShadow: "0 0 20px rgba(99, 102, 241, 0.2)"
                    }}
                    transition={{ duration: 0.1, ease: "linear" }}
                    className="relative z-20 flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-brand-600 to-accent-500 shadow-[0_0_40px_rgba(99,102,241,0.5)]"
                  >
                    <IconMic className="w-8 h-8 text-white drop-shadow-md" />
                  </motion.div>
                </div>

                <div className="mt-10 text-center">
                  <Heading as="h2" className="text-2xl">AI Coach · Sales</Heading>
                  <p className="mt-2 text-sm text-ink-500 h-5">
                    {conn ? "Listening to you intently..." : "Tap to begin a coaching session"}
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <Button
                    type="button"
                    variant={conn ? "ghost" : "primary"}
                    size="lg"
                    onClick={() => setConn(!conn)}
                    aria-pressed={conn}
                    className="rounded-full"
                  >
                    {conn ? "End Session" : "Start Voice Session"}
                  </Button>
                  <Button
                    type="button"
                    variant="soft"
                    size="lg"
                    onClick={() => setTurn((t) => Math.min(t + 1, scripted.length))}
                    disabled={!conn}
                    className="rounded-full"
                  >
                    Advance Preview ({turn}/{scripted.length})
                  </Button>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  {['Latency: 75ms', 'Lang: English (IN)', 'Voice: Sonia'].map((t) => (
                    <span key={t} className="rounded-md border border-ink-200/70 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* LIVE TRANSCRIPT */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            className="flex-1"
          >
            <Card variant="frosted" className="relative rounded-xl3 p-6 sm:p-8 min-h-[300px] flex flex-col h-full">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-ink-200/70">
                <Eyebrow>Live Transcript</Eyebrow>
                <AnimatePresence>
                  {conn && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      <span className="text-xs font-medium text-rose-500">Recording</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {(scripted ?? []).slice(0, turn).map((t, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                      className={`flex ${t.who === "ai" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] rounded-xl2 px-5 py-3.5 text-sm sm:text-base leading-relaxed shadow-sm ${
                          t.who === "ai"
                            ? "rounded-tl-sm bg-ink-50/60 border border-ink-200/50 text-ink-800"
                            : "rounded-tr-sm bg-brand-600 text-white"
                        }`}
                      >
                        {t.text}
                      </div>
                    </motion.div>
                  ))}
                  {(turn === 0 || (scripted ?? []).slice(0, turn).length === 0) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex h-full items-center justify-center"
                    >
                      <div className="rounded-xl2 border border-dashed border-ink-300 bg-white px-8 py-10 text-center text-sm text-ink-500">
                        Start the session and advance turns to view the live coaching transcript.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* RIGHT COLUMN: Signals */}
        <div className="lg:col-span-5 space-y-6 lg:space-y-8">
          <StaggerWrapper delay={0.3}>

            {/* Verticals */}
            <GlassCard title="Available Verticals">
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { e: "Sales", icon: <IconBriefcase /> },
                  { e: "Leadership", icon: <IconCrown /> },
                  { e: "Sports", icon: <IconActivity /> },
                  { e: "Blue-collar", icon: <IconTool /> },
                ].map((v) => (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    key={v.e}
                    aria-label={`${v.e} coaching vertical`}
                    className="group flex flex-col items-start rounded-xl2 border border-ink-200/50 bg-white px-4 py-4 transition-colors hover:bg-ink-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                  >
                    <div className="text-ink-600 group-hover:text-ink-900 transition-colors" aria-hidden="true">{v.icon}</div>
                    <div className="mt-3 text-sm font-semibold text-ink-700 group-hover:text-ink-900">{v.e}</div>
                  </motion.button>
                ))}
              </div>
            </GlassCard>

            {/* Role Transition Gap */}
            <GlassCard
              title="Role Transition Gap"
              badge="Sales"
            >
              <div className="mt-1 text-lg font-semibold tracking-tight text-ink-900">SDR → AE Promotion</div>
              <div className="mt-6 space-y-5">
                <SignalRow label="Discovery Framing" v={62} color="bg-amber-400" />
                <SignalRow label="Objection Handling" v={71} color="bg-emerald-400" />
                <SignalRow label="Multi-threading" v={48} color="bg-rose-400" />
                <SignalRow label="Forecast Accuracy" v={66} color="bg-brand-500" />
              </div>
            </GlassCard>

            {/* Longitudinal Growth */}
            <GlassCard title="Longitudinal Growth">
              <div className="mt-1 text-sm font-medium text-ink-600">Confidence Index</div>
              <div
                role="img"
                aria-label="Confidence Index trend, rising from 35 to 85 over recent sessions"
                className="mt-4 h-16 w-full rounded-xl border border-ink-200/50 bg-white flex items-end p-2 gap-1"
              >
                {/* Mock sparkline */}
                {[35, 40, 38, 50, 60, 55, 75, 80, 85].map((val, i) => (
                  <motion.div
                    key={i}
                    aria-hidden="true"
                    initial={{ height: 0 }}
                    animate={{ height: `${val}%` }}
                    transition={{ duration: 1, delay: 0.5 + i * 0.1, type: "spring" }}
                    className="flex-1 bg-gradient-to-t from-brand-600/50 to-brand-400 rounded-sm"
                  />
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Stat
                  label="6-mo Lift"
                  value="+26%"
                  tone="success"
                  className="rounded-xl2 border border-ink-200/50 bg-white p-4 transition-colors hover:bg-ink-50/60"
                />
                <Stat
                  label="Sessions"
                  value="34"
                  className="rounded-xl2 border border-ink-200/50 bg-white p-4 transition-colors hover:bg-ink-50/60"
                />
              </div>
            </GlassCard>

            {/* Behavioural Nudge */}
            <GlassCard title="Behavioural Nudge" glow>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-700 italic font-medium">
                "On your next stakeholder call, restate concerns in one sentence <span className="text-ink-900 bg-brand-50 px-1 rounded">before</span> responding. You've practiced this 3×."
              </p>
              <Button
                type="button"
                variant="ghost"
                className="mt-5 w-full rounded-xl"
              >
                Send to Phone
              </Button>
            </GlassCard>

          </StaggerWrapper>
        </div>
      </div>

      {/* PHASE 2 GRID */}
      <section className="mt-20 lg:mt-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={transition}
          className="mb-10 lg:mb-14 text-center max-w-2xl mx-auto flex flex-col items-center"
        >
          <Badge tone="brand" className="mb-6">
            <IconSpark className="w-4 h-4" /> Phase 2 Roadmap
          </Badge>
          <Heading className="mb-4">What Phase 2 Unlocks</Heading>
          <p className="text-base text-ink-500">
            Six new verticals and longitudinal growth tracking. Built on the same closed-loop, low-latency architecture.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { t: "Sales Vertical", d: "AE/SDR coaching, discovery + objection drills, forecasting reflection." },
            { t: "Leadership Vertical", d: "First-time manager onboarding, conflict resolution, feedback loops." },
            { t: "Sports Vertical", d: "Pre-game mental routines, recovery, focus drills · multilingual." },
            { t: "Blue-collar Coaching", d: "Hindi + regional language voice coaching for shop-floor & service workers." },
            { t: "Role Gap Analyzer", d: "Compare current role profile vs target role · generates skill + behaviour pathway." },
            { t: "Longitudinal Tracker", d: "12-week + 12-month trajectories. Team dynamics dashboard for org buyers." },
          ].map((c, i) => (
            <motion.div
              key={c.t}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <Card variant="frosted" hover className="group relative rounded-xl3 p-8 overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-ink-500">Vertical {String(i + 1).padStart(2, "0")}</span>
                    <Badge tone="neutral" className="text-[10px] uppercase">Phase 2</Badge>
                  </div>
                  <h3 className="text-xl font-bold text-ink-900 mb-3">{c.t}</h3>
                  <p className="text-sm leading-relaxed text-ink-600">{c.d}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Global CSS overrides specifically for scrollbar to keep it clean */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.04);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.12);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(15, 23, 42, 0.2);
        }
      `}} />
    </PageShell>
  );
}

// Subcomponents

function GlassCard({ title, badge, children, glow = false }: { title: string; badge?: string; children: React.ReactNode; glow?: boolean }) {
  return (
    <Card variant="frosted" className={`relative rounded-xl3 p-6 sm:p-7 overflow-hidden ${glow ? "border-brand-500/20" : ""}`}>
      <div className="flex items-center justify-between mb-5">
        <Eyebrow>{title}</Eyebrow>
        {badge && <Badge tone="brand" className="text-[10px] uppercase">{badge}</Badge>}
      </div>
      {children}
    </Card>
  );
}

function SignalRow({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-700">{label}</span>
        <span className="text-sm font-bold text-ink-900">{v}</span>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${v} out of 100`}
        className="h-2 w-full overflow-hidden rounded-full bg-ink-100"
      >
        <motion.div
          aria-hidden="true"
          initial={{ width: 0 }}
          whileInView={{ width: `${v}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

function StaggerWrapper({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.1, delayChildren: delay } },
        hidden: {},
      }}
      className="space-y-6 lg:space-y-8"
    >
      {React.Children.map(children, (child) => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } }
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

// Icons
function IconSpark({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.7L20 10l-5 4 1.5 6L12 17l-4.5 3L9 14l-5-4 6.1-1.3z" />
    </svg>
  );
}
function IconBriefcase({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}
function IconCrown({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 18h20" />
      <path d="M5 18 3 7l5 5 4-8 4 8 5-5-2 11" />
    </svg>
  );
}
function IconActivity({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function IconTool({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
function IconMic({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}
