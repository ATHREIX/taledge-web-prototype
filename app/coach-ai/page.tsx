"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
    <main className="grid min-h-screen place-items-center bg-white px-6 text-center text-slate-900">
      <div>
        <h1 className="text-2xl font-black">This workspace is not available in Phase 1.</h1>
        <p className="mt-2 text-sm text-slate-500">Return to the Phase 1 platform workspace.</p>
      </div>
    </main>
  );
}

function CoachAIPhaseTwo() {
  const [vol, setVol] = useState(0);
  const [conn, setConn] = useState(false);
  const [turn, setTurn] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (conn) {
      t = setInterval(() => setVol(Math.random() * 100), 100);
    } else {
      setVol(0);
    }
    return () => clearInterval(t);
  }, [conn]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-[#FAFAFA] text-slate-900 selection:bg-indigo-500/30 overflow-x-hidden font-sans">
      {/* Dynamic Background Orbs */}
      <motion.div 
        animate={{
          x: mousePos.x * 0.05,
          y: mousePos.y * 0.05,
        }}
        transition={{ type: "spring", damping: 50, stiffness: 50 }}
        className="pointer-events-none absolute inset-0 overflow-hidden -z-10"
      >
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/20 blur-[150px] mix-blend-screen" />
        <div className="absolute top-[40%] left-[60%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[100px] mix-blend-screen" />
      </motion.div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none -z-10" />
      
      {/* Nav/Header Strip */}
      <header className="relative z-10 w-full border-b border-slate-200 bg-white/40 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-6 sm:px-10 sm:py-8 lg:flex lg:items-end lg:justify-between">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-400 backdrop-blur-md">
                <IconSpark className="w-3.5 h-3.5" /> Phase 2 Preview
              </span>
              <span className="rounded-full bg-white/60 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                Lifelong Success Intelligence
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter text-slate-900">
              Real-time Voice <br className="hidden sm:block"/> Coaching for Roles
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-500 font-light leading-relaxed">
              Designed for <span className="font-medium text-slate-900">Gemini Live</span> once Phase 2 is enabled.
              Low-latency voice coaching with provider-issued ephemeral tokens.
            </p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="mt-6 lg:mt-0 flex flex-wrap items-center gap-3"
          >
            {['75ms Latency', '32 Languages', 'In Development'].map((tag, i) => (
              <span key={tag} className="rounded-lg bg-white/60 border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-md">
                {tag}
              </span>
            ))}
          </motion.div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 sm:px-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* LEFT COLUMN: Voice Orb + Chat */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            
            {/* VOICE ORB CARD */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-3xl border border-slate-200 bg-white/60 backdrop-blur-2xl p-8 sm:p-12 overflow-hidden shadow-2xl group"
            >
              {/* Subtle hover gradient */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              
              <div className="relative z-10 flex flex-col items-center">
                {/* Glowing Orb */}
                <div className="relative flex items-center justify-center w-64 h-64">
                  <AnimatePresence>
                    {conn && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 rounded-full bg-indigo-500/20 blur-[60px]"
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
                    className="absolute w-48 h-48 sm:w-56 sm:h-56 rounded-full border border-indigo-500/30"
                  />
                  
                  {/* Inner Ring */}
                  <motion.div
                    animate={conn ? {
                      scale: [1, 1 + vol / 200, 1],
                      borderWidth: [1, 2, 1]
                    } : { scale: 1, borderWidth: 1 }}
                    transition={{ duration: 0.15, ease: "linear" }}
                    className="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full border border-indigo-400/40 bg-indigo-500/5 backdrop-blur-md"
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
                    className="relative z-20 flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 shadow-[0_0_40px_rgba(99,102,241,0.5)]"
                  >
                    <IconMic className="w-8 h-8 text-slate-900 drop-shadow-md" />
                  </motion.div>
                </div>

                <div className="mt-10 text-center">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">AI Coach · Sales</h2>
                  <p className="mt-2 text-sm text-slate-500 h-5">
                    {conn ? "Listening to you intently..." : "Tap to begin a coaching session"}
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setConn(!conn)}
                    className={`relative overflow-hidden rounded-full px-8 py-3.5 text-sm font-bold shadow-2xl transition-all duration-300 ${
                      conn 
                        ? "bg-slate-100/60 text-slate-900 border border-slate-300 hover:bg-white/20"
                        : "bg-white text-black hover:bg-gray-100"
                    }`}
                  >
                    {conn && (
                      <span className="absolute inset-0 rounded-full border border-slate-300 animate-ping opacity-20" />
                    )}
                    {conn ? "End Session" : "Start Voice Session"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTurn((t) => Math.min(t + 1, scripted.length))}
                    disabled={!conn}
                    className="rounded-full bg-white/60 border border-slate-200 px-6 py-3.5 text-sm font-medium text-slate-600 backdrop-blur-md transition-colors hover:bg-slate-100/60 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Advance Preview ({turn}/{scripted.length})
                  </motion.button>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  {['Latency: 75ms', 'Lang: English (IN)', 'Voice: Sonia'].map((t) => (
                    <span key={t} className="rounded-md bg-white/60 border border-slate-200 px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* LIVE TRANSCRIPT */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-3xl border border-slate-200 bg-white/60 backdrop-blur-2xl p-6 sm:p-8 flex-1 min-h-[300px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Live Transcript</h3>
                <AnimatePresence>
                  {conn && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                      <span className="text-xs font-medium text-red-400">Recording</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {scripted.slice(0, turn).map((t, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                      className={`flex ${t.who === "ai" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 text-sm sm:text-base leading-relaxed shadow-lg ${
                          t.who === "ai"
                            ? "rounded-tl-sm bg-slate-100/60 border border-slate-200 text-slate-800 backdrop-blur-md"
                            : "rounded-tr-sm bg-indigo-500 text-white"
                        }`}
                      >
                        {t.text}
                      </div>
                    </motion.div>
                  ))}
                  {turn === 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex h-full items-center justify-center"
                    >
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-8 py-10 text-center text-sm text-slate-500">
                        Start the session and advance turns to view the live coaching transcript.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
                      whileHover={{ scale: 1.03, backgroundColor: "rgba(255,255,255,0.1)" }}
                      whileTap={{ scale: 0.97 }}
                      key={v.e} 
                      className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white/60 px-4 py-4 transition-colors"
                    >
                      <div className="text-slate-600 group-hover:text-slate-900 transition-colors">{v.icon}</div>
                      <div className="mt-3 text-sm font-semibold text-slate-700 group-hover:text-slate-900">{v.e}</div>
                    </motion.button>
                  ))}
                </div>
              </GlassCard>

              {/* Role Transition Gap */}
              <GlassCard 
                title="Role Transition Gap" 
                badge="Sales"
              >
                <div className="mt-1 text-lg font-semibold tracking-tight text-slate-900">SDR → AE Promotion</div>
                <div className="mt-6 space-y-5">
                  <SignalRow label="Discovery Framing" v={62} color="bg-yellow-400" />
                  <SignalRow label="Objection Handling" v={71} color="bg-emerald-400" />
                  <SignalRow label="Multi-threading" v={48} color="bg-rose-400" />
                  <SignalRow label="Forecast Accuracy" v={66} color="bg-indigo-400" />
                </div>
              </GlassCard>

              {/* Longitudinal Growth */}
              <GlassCard title="Longitudinal Growth">
                <div className="mt-1 text-sm font-medium text-slate-600">Confidence Index</div>
                <div className="mt-4 h-16 w-full rounded-xl bg-white/60 border border-slate-200 flex items-end p-2 gap-1">
                  {/* Mock sparkline */}
                  {[35, 40, 38, 50, 60, 55, 75, 80, 85].map((val, i) => (
                    <motion.div 
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${val}%` }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.1, type: "spring" }}
                      className="flex-1 bg-gradient-to-t from-indigo-600/50 to-indigo-400 rounded-sm"
                    />
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Stat label="6-mo Lift" value="+26%" />
                  <Stat label="Sessions" value="34" />
                </div>
              </GlassCard>

              {/* Behavioural Nudge */}
              <GlassCard title="Behavioural Nudge" glow>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-700 italic font-medium">
                  "On your next stakeholder call, restate concerns in one sentence <span className="text-slate-900 bg-white/20 px-1 rounded">before</span> responding. You've practiced this 3×."
                </p>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-5 w-full rounded-xl bg-slate-100/60 hover:bg-white/20 border border-slate-300 py-3 text-sm font-semibold text-slate-900 transition-colors"
                >
                  Send to Phone
                </motion.button>
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
            transition={{ duration: 0.7 }}
            className="mb-10 lg:mb-14 text-center max-w-2xl mx-auto"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 text-sm font-medium text-purple-400 backdrop-blur-md mb-6">
              <IconSpark className="w-4 h-4" /> Phase 2 Roadmap
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
              What Phase 2 Unlocks
            </h2>
            <p className="text-base text-slate-500">
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
                className="group relative rounded-3xl border border-slate-200 bg-white/60 p-8 backdrop-blur-xl transition-all hover:bg-slate-100/60 hover:border-slate-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Vertical {String(i + 1).padStart(2, "0")}</span>
                    <span className="rounded-md bg-slate-100/60 px-2 py-1 text-[10px] uppercase font-bold text-slate-500">Phase 2</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{c.t}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{c.d}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      {/* Global CSS overrides specifically for scrollbar to keep it clean */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
}

// Subcomponents

function GlassCard({ title, badge, children, glow = false }: { title: string; badge?: string; children: React.ReactNode; glow?: boolean }) {
  return (
    <div className={`relative rounded-3xl border border-slate-200 bg-white/60 backdrop-blur-xl p-6 sm:p-7 overflow-hidden ${glow ? "shadow-[0_0_30px_rgba(99,102,241,0.15)] border-indigo-500/20" : ""}`}>
      {glow && <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[50px] -z-10" />}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</h3>
        {badge && <span className="rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-1 text-[10px] font-bold uppercase">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function SignalRow({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-bold text-slate-900">{v}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100/60">
        <motion.div 
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/60 border border-slate-200 p-4 flex flex-col items-center justify-center text-center hover:bg-slate-100/60 transition-colors">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
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
