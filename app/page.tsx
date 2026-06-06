"use client";

import React from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Logo } from "@/components/logo";

const SHOW_PHASE_2 = false;

const tracks = [
  {
    initial: "P",
    title: "Placement Success",
    desc: "Resume context, technical interview, behavioural interview, Fit Score, coaching pathway.",
    href: "/onboarding",
    tag: "Track 01",
  },
  {
    initial: "E",
    title: "Competitive Exam Success",
    desc: "Exam context mapping, Success Potential, non-clinical risk signals, counselling plan.",
    href: "/onboarding",
    tag: "Track 02",
  },
];

const workspaces = [
  {
    initial: "C",
    title: "Candidate Workspace",
    desc: "Assessment pipeline, reports, reattempts, and publish controls.",
    href: "/student/candidate-001",
  },
  {
    initial: "I",
    title: "Institute Workspace",
    desc: "Batch readiness, heatmaps, at-risk lists, and interventions.",
    href: "/institute/institute-placement",
  },
  {
    initial: "R",
    title: "Recruiter Workspace",
    desc: "Jobs, candidate filters, shortlists, shared reports.",
    href: "/recruiter/recruiter-001",
  },
  {
    initial: "T",
    title: "Coach Workspace",
    desc: "Session queues, goals, progress tracking, outcomes.",
    href: "/coach/coach-001",
  },
];

const hiddenPhaseTwoLinks = [
  { initial: "A", title: "AI Coach", href: "/coach-ai" },
  { initial: "V", title: "AI Voice", href: "/interview" },
];
const renderedPhaseTwoLinks = SHOW_PHASE_2 ? hiddenPhaseTwoLinks : [];

const bullets = [
  {
    title: "Assess → Interpret → Evaluate",
    desc: "Profile, AI interviews, and DNLA intelligence.",
  },
  {
    title: "Improve → Track → Achieve",
    desc: "Fit Score, coaching, and measurable progress.",
  },
  {
    title: "Role-controlled visibility",
    desc: "Targeted insights for all stakeholders.",
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any },
  },
};

export default function Home() {
  return (
    <div className="relative min-h-screen w-full bg-[#F8FAFC] text-slate-900 overflow-x-hidden font-sans selection:bg-indigo-500/20 flex flex-col justify-between">
      
      {/* Sharp Grid Background & Soft Orbs */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Crisp Checkered Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)`,
            backgroundSize: `60px 60px`,
            maskImage: `radial-gradient(ellipse 120% 120% at 50% 50%, #000 40%, transparent 100%)`,
            WebkitMaskImage: `radial-gradient(ellipse 120% 120% at 50% 50%, #000 40%, transparent 100%)`
          }}
        />

        {/* Very soft glowing orbs to break the flatness without overpowering the grid */}
        <motion.div
          animate={{ x: [0, 60, -60, 0], y: [0, -60, 60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[0%] w-[50vw] h-[50vw] rounded-full bg-indigo-200/30 blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, -80, 80, 0], y: [0, 80, -80, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-sky-200/30 blur-[150px]"
        />
      </div>

      <div className="relative z-10 w-full max-w-[90rem] mx-auto px-8 lg:px-16 flex-1 flex flex-col justify-center py-12 lg:py-20">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center"
        >
          {/* LEFT COLUMN */}
          <div className="flex flex-col justify-center">
            <motion.div variants={itemVariants} className="mb-8">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/50 border border-white/60 backdrop-blur-2xl shadow-lg shadow-indigo-500/5 hover:bg-white/60 transition-colors">
                 <div className="text-indigo-600 scale-90 origin-left">
                    <Logo />
                 </div>
                 <span className="text-sm font-bold tracking-wide text-slate-800">Taledge Platform</span>
              </div>
            </motion.div>

            <motion.h1 
              variants={itemVariants}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-black tracking-tighter leading-[1.05] text-slate-900 drop-shadow-sm"
            >
              Dual-track <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-500 drop-shadow-sm">
                success intelligence
              </span>
            </motion.h1>

            <motion.p variants={itemVariants} className="mt-8 max-w-xl text-base sm:text-lg text-slate-600 leading-relaxed font-medium">
              Taledge measures, predicts, and improves outcomes across placement
              readiness and competitive exam preparation by combining AI evaluation,
              DNLA-ready psychometrics, and human intervention.
            </motion.p>

            <motion.div variants={itemVariants} className="mt-10 space-y-6">
              {bullets.map((b, i) => (
                <div key={b.title} className="group flex items-start gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/60 backdrop-blur-xl border border-white/60 text-indigo-600 shadow-md shadow-indigo-500/5 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-indigo-500/10 group-hover:border-indigo-300 group-hover:bg-white">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div className="pt-1">
                    <div className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {b.title}
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-500">{b.desc}</div>
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div variants={itemVariants} className="mt-12 flex flex-wrap items-center gap-6">
              <Link href="/onboarding" className="group inline-flex h-14 items-center justify-center rounded-full bg-indigo-600 px-8 py-2 text-base font-bold text-white shadow-xl shadow-indigo-500/25 hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all duration-300 gap-2">
                Start Phase 1 Onboarding
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-1"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </Link>
              
              <Link href="/student/candidate-001" className="group flex items-center gap-3 text-sm font-bold text-slate-500 transition-all hover:text-slate-900">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/50 backdrop-blur-md border border-white/60 shadow-sm group-hover:bg-white group-hover:border-indigo-200 group-hover:shadow-md group-hover:shadow-indigo-500/10 group-hover:-translate-y-1 transition-all duration-300">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></svg>
                </div>
                Candidate Workspace
                <span className="transition-transform group-hover:translate-x-1 text-indigo-500">→</span>
              </Link>
            </motion.div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-lg space-y-8">
              
              {/* Goal Section */}
              <motion.div variants={itemVariants} className="relative group">
                <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-indigo-500/30 to-sky-500/30 blur-2xl opacity-60 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                <div className="relative rounded-[2.5rem] bg-white/50 border border-white/60 backdrop-blur-2xl p-10 shadow-2xl shadow-indigo-500/10">
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
                    Start with a goal
                  </h2>
                  <p className="text-sm font-medium text-slate-500 mb-8">
                    Phase 1 routes every user into one of two production pathways.
                  </p>
                  
                  <div className="space-y-4">
                    {tracks.map((r, i) => (
                      <motion.div key={r.title} whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                        <Link
                          href={r.href}
                          className="group flex items-center gap-4 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md p-5 transition-all duration-300 hover:bg-white/80 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-lg font-bold text-white shadow-inner group-hover:scale-110 transition-transform duration-300">
                            {r.initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                {r.title}
                              </h3>
                              <span className="shrink-0 rounded-full border border-indigo-100 bg-indigo-50/50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-600">
                                {r.tag}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-600 leading-relaxed group-hover:text-slate-700 transition-colors">
                              {r.desc}
                            </p>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Workspaces Section */}
              <motion.div variants={itemVariants}>
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-[1px] flex-1 bg-slate-200" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Authorized Workspaces</span>
                  <div className="h-[1px] flex-1 bg-slate-200" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {[...workspaces, ...renderedPhaseTwoLinks].map((r, i) => (
                    <motion.div key={r.title} whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Link
                        href={r.href}
                        className="group flex items-center gap-3 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md p-4 transition-all duration-300 hover:bg-white/80 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/50 text-xs font-extrabold text-slate-600 transition-all duration-300 shadow-sm group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 group-hover:scale-110">
                          {r.initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="truncate text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {r.title}
                          </h4>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Footer */}
      <div className="w-full z-10 flex justify-center py-6 pointer-events-none relative mt-auto">
         <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.5, duration: 1 }}
            className="text-[11px] font-bold text-slate-400 tracking-widest uppercase"
          >
            Taledge © 2026. Talent Intelligence & Success Platform.
         </motion.div>
      </div>

    </div>
  );
}
