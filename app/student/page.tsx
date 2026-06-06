"use client";

import React, { useState } from "react";
import { motion, type Variants } from "framer-motion";
import { 
  ArrowLeft, 
  Brain, 
  Target, 
  TrendingUp, 
  BookOpen, 
  Award, 
  CheckCircle2, 
  Circle,
  Clock,
  ChevronRight,
  Sparkles,
  Zap
} from "lucide-react";
import Link from "next/link";

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
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any },
  },
};

// Radar Chart Component
const DNLA_CATEGORIES = [
  { label: "Resilience", value: 85, color: "text-indigo-600" },
  { label: "Leadership", value: 70, color: "text-sky-500" },
  { label: "Problem Solving", value: 90, color: "text-indigo-500" },
  { label: "Adaptability", value: 65, color: "text-sky-400" },
  { label: "Communication", value: 80, color: "text-blue-500" },
  { label: "Emotional Int.", value: 75, color: "text-indigo-400" },
];

const RadarChart = () => {
  const size = 300;
  const center = size / 2;
  const radius = (size / 2) - 40; // leaving room for labels
  const numCategories = DNLA_CATEGORIES.length;
  const angleStep = (Math.PI * 2) / numCategories;

  // Grid levels (e.g., 20%, 40%, 60%, 80%, 100%)
  const levels = [0.2, 0.4, 0.6, 0.8, 1];

  const getPoint = (value: number, index: number, max: number = 100) => {
    const angle = index * angleStep - Math.PI / 2; // start from top
    const r = (value / max) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const dataPoints = DNLA_CATEGORIES.map((cat, i) => getPoint(cat.value, i));
  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto flex items-center justify-center">
      <svg width={size} height={size} className="overflow-visible drop-shadow-sm">
        {/* Grids */}
        {levels.map((level, i) => {
          const points = DNLA_CATEGORIES.map((_, index) => {
            const p = getPoint(100 * level, index);
            return `${p.x},${p.y}`;
          }).join(" ");
          return (
            <polygon
              key={`grid-${i}`}
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-slate-200/80"
            />
          );
        })}

        {/* Axes */}
        {DNLA_CATEGORIES.map((_, i) => {
          const p = getPoint(100, i);
          return (
            <line
              key={`axis-${i}`}
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              stroke="currentColor"
              strokeWidth="1"
              className="text-slate-200/80"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Data Polygon with Gradient */}
        <defs>
          <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(14, 165, 233)" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        
        <motion.polygon
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          points={polygonPoints}
          fill="url(#radarGradient)"
          stroke="rgb(99, 102, 241)"
          strokeWidth="2.5"
          className="drop-shadow-lg"
          style={{ transformOrigin: "center" }}
        />

        {/* Data Points */}
        {dataPoints.map((p, i) => (
          <motion.circle
            initial={{ opacity: 0, r: 0 }}
            animate={{ opacity: 1, r: 4 }}
            transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
            key={`point-${i}`}
            cx={p.x}
            cy={p.y}
            fill="white"
            stroke="rgb(99, 102, 241)"
            strokeWidth="2.5"
            className="shadow-sm"
          />
        ))}

        {/* Labels */}
        {DNLA_CATEGORIES.map((cat, i) => {
          const p = getPoint(115, i); // move labels slightly outward
          
          // Adjust text anchoring based on position
          let anchor: "middle" | "start" | "end" = "middle";
          if (p.x < center - 10) anchor = "end";
          if (p.x > center + 10) anchor = "start";

          return (
            <text
              key={`label-${i}`}
              x={p.x}
              y={p.y + (p.y > center ? 5 : 0)}
              textAnchor={anchor}
              alignmentBaseline="middle"
              className="text-[10px] font-bold fill-slate-500 tracking-wider uppercase"
            >
              {cat.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

const PATHWAY_STEPS = [
  {
    id: 1,
    title: "Communication Mastery",
    desc: "Improve cross-functional articulation.",
    type: "course",
    status: "completed",
    duration: "2h 30m",
    icon: <BookOpen className="w-5 h-5" />,
  },
  {
    id: 2,
    title: "Leadership Fundamentals",
    desc: "Leading with empathy and clarity.",
    type: "workshop",
    status: "in-progress",
    duration: "4h 00m",
    progress: 65,
    icon: <Target className="w-5 h-5" />,
  },
  {
    id: 3,
    title: "Adaptability Simulation",
    desc: "High-pressure environment roleplay.",
    type: "simulation",
    status: "locked",
    duration: "1h 15m",
    icon: <Zap className="w-5 h-5" />,
  },
  {
    id: 4,
    title: "Final Evaluation",
    desc: "Comprehensive DNLA reassessment.",
    type: "assessment",
    status: "locked",
    duration: "3h 00m",
    icon: <Award className="w-5 h-5" />,
  },
];

export default function StudentDashboard() {
  return (
    <div className="relative min-h-screen w-full bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-500/20 overflow-x-hidden pb-20">
      {/* Background aesthetics copied from page.tsx */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)`,
            backgroundSize: `60px 60px`,
            maskImage: `radial-gradient(ellipse 120% 120% at 50% 50%, #000 40%, transparent 100%)`,
            WebkitMaskImage: `radial-gradient(ellipse 120% 120% at 50% 50%, #000 40%, transparent 100%)`
          }}
        />
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

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 pt-12">
        {/* Header Nav */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-12"
        >
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 border border-white/60 backdrop-blur-md text-slate-600 hover:text-slate-900 hover:bg-white/80 transition-all shadow-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-bold">Back to Platform</span>
          </Link>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-slate-900">Alex Carter</span>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">Candidate</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 p-[2px] shadow-md">
                <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-white">
                  <img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" alt="Profile" className="w-full h-full object-cover" />
                </div>
             </div>
          </div>
        </motion.div>

        {/* Dashboard Title */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="mb-10">
          <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 drop-shadow-sm mb-3">
            Student <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-500">Development</span>
          </motion.h1>
          <motion.p variants={itemVariants} className="text-lg text-slate-600 font-medium max-w-2xl">
            Track your psychometric traits, measure core competencies, and follow a personalized pathway to success.
          </motion.p>
        </motion.div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: DNLA Chart & Stats */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-5 space-y-8"
          >
            {/* Radar Chart Card */}
            <motion.div variants={itemVariants} className="relative group">
              <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-b from-indigo-500/20 to-sky-500/20 blur-xl opacity-50 group-hover:opacity-100 transition duration-700" />
              <div className="relative rounded-[2rem] bg-white/60 border border-white/60 backdrop-blur-2xl p-8 shadow-xl shadow-indigo-500/5">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-indigo-500" />
                      DNLA Profile
                    </h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">Psychometric Analysis</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-lg shadow-inner">
                    81
                  </div>
                </div>

                <RadarChart />

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/50">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Strongest</div>
                    <div className="text-base font-bold text-indigo-700">Problem Solving</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-100/50">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Focus Area</div>
                    <div className="text-base font-bold text-sky-700">Adaptability</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Stat Cards */}
            <motion.div variants={containerVariants} className="grid grid-cols-2 gap-4">
              <motion.div variants={itemVariants} className="rounded-2xl bg-white/60 border border-white/60 backdrop-blur-xl p-5 shadow-lg shadow-slate-200/50 hover:-translate-y-1 transition-transform duration-300">
                <TrendingUp className="w-6 h-6 text-sky-500 mb-3" />
                <div className="text-2xl font-black text-slate-900">Top 15%</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Cohort Ranking</div>
              </motion.div>
              <motion.div variants={itemVariants} className="rounded-2xl bg-white/60 border border-white/60 backdrop-blur-xl p-5 shadow-lg shadow-slate-200/50 hover:-translate-y-1 transition-transform duration-300">
                <Sparkles className="w-6 h-6 text-indigo-500 mb-3" />
                <div className="text-2xl font-black text-slate-900">4 / 6</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Traits Optimized</div>
              </motion.div>
            </motion.div>

          </motion.div>


          {/* Right Column: Learning Pathway */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-7"
          >
            <motion.div variants={itemVariants} className="relative h-full">
              <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-sky-500/20 to-indigo-500/20 blur-xl opacity-50" />
              <div className="relative h-full rounded-[2.5rem] bg-white/60 border border-white/60 backdrop-blur-2xl p-8 shadow-xl shadow-indigo-500/5 flex flex-col">
                
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                      <Target className="w-6 h-6 text-sky-500" />
                      Dynamic Pathway
                    </h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">Curated steps based on your DNLA profile</p>
                  </div>
                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 shadow-sm flex items-center gap-1.5 hidden sm:flex">
                    <Clock className="w-3.5 h-3.5" />
                    10h 45m remaining
                  </span>
                </div>

                <div className="relative flex-1">
                  {/* Timeline Line */}
                  <div className="absolute left-[28px] top-4 bottom-4 w-0.5 bg-slate-200/80 rounded-full" />
                  
                  <div className="space-y-6 relative z-10">
                    {PATHWAY_STEPS.map((step, i) => (
                      <motion.div 
                        key={step.id}
                        variants={itemVariants}
                        className={`relative group flex gap-6 ${step.status === 'locked' ? 'opacity-60' : ''}`}
                      >
                        {/* Timeline Node */}
                        <div className="shrink-0 flex flex-col items-center">
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center border-[3px] shadow-sm z-10 transition-transform group-hover:scale-110 ${
                            step.status === 'completed' ? 'bg-indigo-500 border-indigo-200 text-white shadow-indigo-500/30' :
                            step.status === 'in-progress' ? 'bg-white border-indigo-500 text-indigo-600 shadow-indigo-500/20' :
                            'bg-slate-50 border-slate-200 text-slate-400'
                          }`}>
                            {step.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : step.icon}
                          </div>
                        </div>

                        {/* Card */}
                        <div className={`flex-1 rounded-2xl border p-5 transition-all duration-300 ${
                          step.status === 'in-progress' 
                            ? 'bg-white border-indigo-200 shadow-lg shadow-indigo-500/10' 
                            : 'bg-white/40 border-white/60 hover:bg-white/80 hover:shadow-md'
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                            <h3 className={`text-lg font-bold ${step.status === 'locked' ? 'text-slate-600' : 'text-slate-900'}`}>
                              {step.title}
                            </h3>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-md border uppercase tracking-wider self-start sm:self-auto ${
                              step.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              step.status === 'in-progress' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                              'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {step.status.replace("-", " ")}
                            </span>
                          </div>
                          
                          <p className="text-sm font-medium text-slate-500 mb-4">{step.desc}</p>
                          
                          {step.status === 'in-progress' && step.progress !== undefined && (
                            <div className="mb-4">
                              <div className="flex justify-between text-xs font-bold mb-1.5">
                                <span className="text-indigo-600">Progress</span>
                                <span className="text-slate-600">{step.progress}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${step.progress}%` }}
                                  transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                                  className="bg-indigo-500 h-full rounded-full" 
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                              <Clock className="w-3.5 h-3.5" />
                              {step.duration}
                            </span>
                            {step.status !== 'locked' && (
                              <button className="ml-auto text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group/btn">
                                {step.status === 'completed' ? 'Review' : 'Continue'}
                                <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
