"use client";

import React from "react";
import { motion, type Variants } from "framer-motion";

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
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

// Mock data for Candidate Heatmap
// Tech Accuracy (X-axis: 0-100) vs Behavioural Resilience (Y-axis: 0-100)
const candidates = [
  { id: 1, name: "Alice Chen", tech: 85, res: 90, role: "Frontend", img: "A" },
  { id: 2, name: "Bob Smith", tech: 92, res: 75, role: "Backend", img: "B" },
  { id: 3, name: "Charlie Doe", tech: 70, res: 85, role: "Fullstack", img: "C" },
  { id: 4, name: "Diana Prince", tech: 95, res: 95, role: "Data Scientist", img: "D" },
  { id: 5, name: "Evan Wright", tech: 60, res: 50, role: "DevOps", img: "E" },
  { id: 6, name: "Fiona Gallagher", tech: 80, res: 60, role: "Frontend", img: "F" },
  { id: 7, name: "George Mason", tech: 45, res: 70, role: "QA", img: "G" },
  { id: 8, name: "Hannah Abbott", tech: 88, res: 82, role: "Backend", img: "H" },
];

export default function RecruiterPortal() {
  return (
    <div className="relative min-h-screen w-full bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-500/20 flex overflow-hidden">
      {/* Background styling inherited from landing page */}
      <div className="absolute inset-0 z-0 pointer-events-none fixed">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)`,
            backgroundSize: `60px 60px`,
            maskImage: `radial-gradient(ellipse 120% 120% at 50% 50%, #000 40%, transparent 100%)`,
            WebkitMaskImage: `radial-gradient(ellipse 120% 120% at 50% 50%, #000 40%, transparent 100%)`,
          }}
        />
        <motion.div
          animate={{ x: [0, 60, -60, 0], y: [0, -60, 60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[0%] w-[50vw] h-[50vw] rounded-full bg-indigo-200/40 blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, -80, 80, 0], y: [0, 80, -80, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-sky-200/40 blur-[150px]"
        />
      </div>

      {/* Sidebar Mock */}
      <div className="relative z-10 w-64 border-r border-slate-200/60 bg-white/40 backdrop-blur-xl hidden md:flex flex-col p-6 shadow-xl shadow-indigo-500/5">
        <div className="flex items-center gap-3 mb-12">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white font-bold shadow-lg shadow-indigo-500/20">
            R
          </div>
          <span className="font-bold text-lg tracking-tight">Recruiter<br/>Portal</span>
        </div>
        <nav className="space-y-3 flex-1">
          {["Dashboard", "Jobs", "Candidates", "Interviews", "Analytics"].map((item, i) => (
            <div
              key={item}
              className={`px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                i === 0
                  ? "bg-white/80 border border-indigo-100 text-indigo-600 shadow-sm shadow-indigo-500/10"
                  : "text-slate-500 hover:bg-white/50 hover:text-slate-900 border border-transparent"
              }`}
            >
              {item}
            </div>
          ))}
        </nav>
        <div className="mt-auto px-4 py-3 rounded-2xl bg-white/50 border border-white/60 shadow-sm flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">JP</div>
          <div className="text-xs font-bold text-slate-700">Jane Premium</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden p-8 lg:p-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-6xl w-full mx-auto space-y-10"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <motion.div variants={itemVariants}>
              <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 drop-shadow-sm mb-2">
                Talent <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-500">Intelligence</span>
              </h1>
              <p className="text-slate-500 font-medium text-lg">
                Evaluate candidates across technical accuracy and behavioural resilience.
              </p>
            </motion.div>
            <motion.div variants={itemVariants} className="flex gap-3">
              <button className="px-6 py-2.5 rounded-full bg-white/60 border border-white/80 backdrop-blur-md font-bold text-slate-700 shadow-sm hover:bg-white hover:shadow-md transition-all">
                Filter
              </button>
              <button className="px-6 py-2.5 rounded-full bg-indigo-600 font-bold text-white shadow-xl shadow-indigo-500/25 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-500/40 transition-all">
                New Requisition
              </button>
            </motion.div>
          </div>

          {/* Top Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Active Candidates", value: "1,204", trend: "+12%" },
              { label: "High Resilience", value: "342", trend: "+5%" },
              { label: "Avg Tech Accuracy", value: "76%", trend: "+2.4%" },
            ].map((stat, i) => (
              <div key={i} className="rounded-[2rem] bg-white/50 border border-white/60 backdrop-blur-2xl p-6 shadow-xl shadow-indigo-500/5 hover:shadow-indigo-500/10 transition-shadow">
                <div className="text-sm font-bold text-slate-500 mb-2">{stat.label}</div>
                <div className="flex items-end gap-3">
                  <div className="text-4xl font-black text-slate-900">{stat.value}</div>
                  <div className="text-sm font-bold text-emerald-500 mb-1">{stat.trend}</div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Candidate Heatmap Section */}
          <motion.div variants={itemVariants} className="relative group mt-8">
            <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-indigo-500/20 to-sky-500/20 blur-xl opacity-60 group-hover:opacity-100 transition duration-1000" />
            <div className="relative rounded-[2.5rem] bg-white/50 border border-white/60 backdrop-blur-2xl p-8 lg:p-12 shadow-2xl shadow-indigo-500/10">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Candidate Heatmap</h2>
                  <p className="text-sm font-medium text-slate-500">Tech Accuracy vs Behavioural Resilience</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm" /> Ideal Fit</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" /> Trainable</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-400 shadow-sm" /> High Risk</div>
                </div>
              </div>

              {/* Heatmap Graph */}
              <div className="relative w-full aspect-video bg-slate-100/50 rounded-3xl border border-slate-200/60 p-6 sm:p-10">
                {/* Y-Axis Label */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-bold text-slate-400 tracking-widest uppercase">
                  Behavioural Resilience
                </div>
                {/* X-Axis Label */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-400 tracking-widest uppercase">
                  Tech Accuracy
                </div>

                {/* Grid Lines */}
                <div className="absolute inset-8 sm:inset-12 border-l-2 border-b-2 border-slate-300/50 flex flex-col justify-between pb-0 pl-0">
                  <div className="w-full h-px bg-slate-300/50 absolute top-1/4" />
                  <div className="w-full h-px bg-slate-300/50 absolute top-2/4" />
                  <div className="w-full h-px bg-slate-300/50 absolute top-3/4" />
                  <div className="h-full w-px bg-slate-300/50 absolute left-1/4" />
                  <div className="h-full w-px bg-slate-300/50 absolute left-2/4" />
                  <div className="h-full w-px bg-slate-300/50 absolute left-3/4" />

                  {/* Quadrant Backgrounds (Soft) */}
                  <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-emerald-400/5 rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-rose-400/5 rounded-bl-xl" />

                  {/* Data Points */}
                  {candidates.map((c, i) => {
                    const left = `${c.tech}%`;
                    const bottom = `${c.res}%`;
                    const isIdeal = c.tech >= 75 && c.res >= 75;
                    const isRisk = c.tech < 60 && c.res < 60;
                    const colorClass = isIdeal ? "bg-emerald-400 text-emerald-900 border-emerald-200 shadow-emerald-500/40" 
                                     : isRisk ? "bg-rose-400 text-rose-900 border-rose-200 shadow-rose-500/40" 
                                     : "bg-amber-400 text-amber-900 border-amber-200 shadow-amber-500/40";

                    return (
                      <motion.div
                        key={c.id}
                        className="absolute group z-10 cursor-pointer"
                        style={{ left, bottom, transform: "translate(-50%, 50%)" }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
                        whileHover={{ scale: 1.2, zIndex: 50 }}
                      >
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center font-bold text-xs sm:text-sm shadow-lg backdrop-blur-md transition-colors ${colorClass}`}>
                          {c.img}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="bg-slate-900 text-white text-xs font-medium py-2 px-3 rounded-xl whitespace-nowrap shadow-xl">
                            <div className="font-bold text-sm mb-0.5">{c.name}</div>
                            <div className="text-slate-300">{c.role}</div>
                            <div className="mt-1 flex gap-2">
                              <span className="text-sky-300">Tech: {c.tech}</span>
                              <span className="text-indigo-300">Res: {c.res}</span>
                            </div>
                          </div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
          
        </motion.div>
      </div>
    </div>
  );
}
