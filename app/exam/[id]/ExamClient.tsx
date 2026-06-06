"use client";

import React from "react";
import { motion, type Variants } from "framer-motion";
import { ScoreRing, Bar, Sparkline } from "@/components/score-ring";

type Tone = "dark" | "success" | "warn" | "danger";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function ExamClient({
  e,
  stressTrend,
  consistencyDelta,
  stressDelta,
  riskLevel,
  scoreTone,
  context,
  interventions,
  scoreInputs,
  progress,
}: any) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 font-sans selection:bg-purple-500/30 overflow-x-hidden relative">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-purple-600/20 blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-[40%] -right-[10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/20 blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-[20%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-pink-600/20 blur-[120px]"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 md:py-20">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8">
          
          {/* Header Section */}
          <motion.header variants={itemVariants} className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
            <div className="flex items-center gap-6">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 5 }}
                className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-white/60 border border-slate-200 flex items-center justify-center text-3xl shadow-2xl backdrop-blur-xl"
              >
                {e.avatar}
              </motion.div>
              <div>
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-slate-200 text-xs font-medium tracking-wide text-slate-600 mb-3"
                >
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  Competitive Exam Track
                </motion.div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                  {e.name}
                </h1>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                  <span className="text-slate-700 font-medium">{e.exam}</span>
                  <span>•</span>
                  <span>Attempt {e.attempt}</span>
                  <span>•</span>
                  <span>{e.monthsPreparing} months in</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Badge tone="warn">DNLA pending</Badge>
              <Badge tone={riskLevel === "Priority" ? "danger" : riskLevel === "Monitor" ? "warn" : "success"}>
                {riskLevel} support
              </Badge>
            </div>
          </motion.header>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Success Potential - Main Card */}
            <motion.div variants={itemVariants} className="md:col-span-5 lg:col-span-4 rounded-[2rem] bg-white/60 border border-slate-200 p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <h2 className="text-lg font-medium text-slate-700 mb-6">Success Potential</h2>
              <div className="flex justify-center transform group-hover:scale-105 transition-transform duration-500">
                <ScoreRing
                  value={e.successPotential}
                  size={220}
                  stroke={16}
                  label="Score"
                  sub={e.exam}
                  tone={scoreTone}
                />
              </div>
              <div className="mt-8 space-y-4">
                {scoreInputs.map((input: any, i: number) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{input.label}</span>
                      <span className="text-slate-900 font-medium">{input.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100/60 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${input.value}%` }}
                        transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                        className={`h-full rounded-full ${
                          input.value >= 70 ? 'bg-emerald-400' : input.value >= 55 ? 'bg-blue-400' : 'bg-rose-400'
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Middle Column */}
            <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-6">
              
              {/* Context Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div variants={itemVariants} className="rounded-[2rem] bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-slate-200 p-8 backdrop-blur-xl group hover:border-purple-500/30 transition-colors">
                  <h3 className="text-sm text-purple-300 font-semibold uppercase tracking-wider mb-2">Exam Profile</h3>
                  <div className="text-2xl font-bold text-slate-900 mb-2">{context.title}</div>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6">{context.summary}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/60 border border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Cadence</div>
                      <div className="font-semibold text-slate-800">{context.cadence}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/60 border border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Review</div>
                      <div className="font-semibold text-slate-800">Weekly</div>
                    </div>
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="rounded-[2rem] bg-white/60 border border-slate-200 p-8 backdrop-blur-xl">
                  <h3 className="text-sm text-slate-500 font-semibold uppercase tracking-wider mb-6">Preparation Demands</h3>
                  <div className="space-y-4">
                    {context.demands.map((demand: any, i: number) => (
                      <div key={i} className="flex flex-col gap-1 p-3 rounded-xl hover:bg-white/60 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-700 font-medium">{demand.label}</span>
                          <span className="text-xs px-2 py-1 rounded-md bg-slate-100/60 text-slate-600">{demand.value}</span>
                        </div>
                        <span className="text-xs text-slate-500">{demand.detail}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* Trends Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <TrendWidget title="Study Consistency" data={e.consistencyTrend} delta={consistencyDelta} suffix="pts" positiveGood={true} />
                <TrendWidget title="Stress Index" data={stressTrend} delta={stressDelta} suffix="pts" positiveGood={false} />
                <TrendWidget title="Daily Hours" data={e.studyHoursTrend} delta={0} suffix="h" isHours />
              </div>
            </div>

          </div>

          {/* Bottom Section - Interventions & Risks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <motion.div variants={itemVariants} className="lg:col-span-2 rounded-[2rem] bg-white/60 border border-slate-200 p-8 backdrop-blur-xl">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Action Plan</h2>
                  <p className="text-sm text-slate-500">Counsellor interventions and roadmap</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {interventions.map((item: any, i: number) => (
                  <motion.div whileHover={{ y: -4 }} key={i} className="p-6 rounded-2xl bg-white/60 border border-slate-200 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <Badge tone={item.tone}>{item.priority}</Badge>
                      <span className="text-xs text-slate-500">{item.review}</span>
                    </div>
                    <h4 className="text-lg font-semibold text-slate-800 mb-2">{item.title}</h4>
                    <p className="text-sm text-slate-500 flex-grow mb-4">{item.detail}</p>
                    <div className="pt-4 border-t border-slate-200 flex justify-between text-xs">
                      <span className="text-slate-500">Owner: <span className="text-slate-700">{item.owner}</span></span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="rounded-[2rem] bg-white/60 border border-slate-200 p-8 backdrop-blur-xl flex flex-col">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Risk Patterns</h2>
              <p className="text-sm text-slate-500 mb-6">Non-clinical indicators</p>
              
              <div className="flex-grow space-y-4">
                {e.risks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/40 animate-pulse" />
                    </div>
                    <p className="text-sm text-emerald-200">No critical risks detected. Trajectory is stable.</p>
                  </div>
                ) : (
                  e.risks.map((r: any, i: number) => (
                    <div key={i} className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">{r.severity}</span>
                        <span className="text-xs text-slate-500">{r.detected}</span>
                      </div>
                      <div className="text-sm font-medium text-slate-800">{r.label}</div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>

          {/* Workflow Journey */}
          <motion.div variants={itemVariants} className="rounded-[2rem] bg-white/60 border border-slate-200 p-8 backdrop-blur-xl overflow-x-auto hidden-scrollbar">
            <h2 className="text-xl font-bold text-slate-900 mb-8">Phase 1 Operating Flow</h2>
            <div className="flex gap-4 min-w-max">
              {progress.map((step: any, i: number) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`flex flex-col p-5 rounded-2xl border w-64 ${step.state === 'Complete' ? 'bg-emerald-500/10 border-emerald-500/20' : step.state === 'Active' || step.state === 'Tracking' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-white/60 border-slate-200'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100/60 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                      <Badge tone={step.tone}>{step.state}</Badge>
                    </div>
                    <div className="text-sm font-medium text-slate-700">{step.label}</div>
                  </div>
                  {i < progress.length - 1 && (
                    <div className="w-8 h-[2px] bg-slate-100/60" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode, tone: string }) {
  const colors = {
    success: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    warn: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    danger: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    dark: "bg-slate-100/60 text-slate-600 border-slate-300",
  };
  const cls = colors[tone as keyof typeof colors] || colors.dark;
  
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${cls} backdrop-blur-md`}>
      {children}
    </span>
  );
}

function TrendWidget({ title, data, delta, suffix, positiveGood = true, isHours = false }: any) {
  const last = data[data.length - 1];
  const isPositive = delta >= 0;
  const isGood = isHours ? true : positiveGood ? isPositive : !isPositive;
  
  return (
    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="rounded-[2rem] bg-white/60 border border-slate-200 p-6 backdrop-blur-xl flex flex-col justify-between">
      <div className="text-sm text-slate-500 font-medium mb-4">{title}</div>
      <div className="flex items-end gap-3 mb-6">
        <span className="text-4xl font-bold text-slate-900 tracking-tight">{last}{suffix}</span>
        {!isHours && (
          <span className={`text-sm font-semibold mb-1 ${isGood ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? '+' : ''}{delta}
          </span>
        )}
      </div>
      <div className="h-16 w-full opacity-60 mix-blend-screen filter saturate-200">
        <Sparkline data={data} tone={isGood ? "success" : "warn"} />
      </div>
    </motion.div>
  );
}
