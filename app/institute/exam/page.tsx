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

// Mock data for Behavioural Risk Patterns (Burnout Trends)
const burnoutTrends = [
  { month: "Jan", riskLevel: 30 },
  { month: "Feb", riskLevel: 45 },
  { month: "Mar", riskLevel: 60 },
  { month: "Apr", riskLevel: 85 }, // Peak exam stress
  { month: "May", riskLevel: 50 },
  { month: "Jun", riskLevel: 40 },
];

const atRiskStudents = [
  { id: 1, name: "Liam O'Connor", risk: 92, status: "Critical Intervention", trend: "up" },
  { id: 2, name: "Emma Watson", risk: 85, status: "High Risk", trend: "up" },
  { id: 3, name: "Noah Patel", risk: 78, status: "Moderate Risk", trend: "down" },
  { id: 4, name: "Olivia Kim", risk: 75, status: "Moderate Risk", trend: "same" },
];

export default function ExamInstituteDashboard() {
  return (
    <div className="relative min-h-screen w-full bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-500/20 flex overflow-hidden">
      {/* Sharp Grid Background & Soft Orbs */}
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
          className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-rose-200/30 blur-[150px]"
        />
      </div>

      {/* Sidebar Mock */}
      <div className="relative z-10 w-64 border-r border-slate-200/60 bg-white/40 backdrop-blur-xl hidden md:flex flex-col p-6 shadow-xl shadow-indigo-500/5">
        <div className="flex items-center gap-3 mb-12">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white font-bold shadow-lg shadow-indigo-500/20">
            EI
          </div>
          <span className="font-bold text-lg tracking-tight leading-tight">Exam<br/>Institute</span>
        </div>
        <nav className="space-y-3 flex-1">
          {["Dashboard", "Batches", "Risk Patterns", "Interventions", "Settings"].map((item, i) => (
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
                Exam <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-500">Dashboard</span>
              </h1>
              <p className="text-slate-500 font-medium text-lg">
                Monitor student well-being and identify critical burnout trends.
              </p>
            </motion.div>
            <motion.div variants={itemVariants} className="flex gap-3">
              <button className="px-6 py-2.5 rounded-full bg-white/60 border border-white/80 backdrop-blur-md font-bold text-slate-700 shadow-sm hover:bg-white hover:shadow-md transition-all">
                Export Data
              </button>
              <button className="px-6 py-2.5 rounded-full bg-indigo-600 font-bold text-white shadow-xl shadow-indigo-500/25 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-500/40 transition-all">
                Schedule Intervention
              </button>
            </motion.div>
          </div>

          {/* Top Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Total Exam Cohort", value: "8,450", trend: "+2.1%", positive: true },
              { label: "High Burnout Risk", value: "412", trend: "+14%", positive: false },
              { label: "Avg Stress Index", value: "68/100", trend: "-5%", positive: true },
            ].map((stat, i) => (
              <div key={i} className="rounded-[2rem] bg-white/50 border border-white/60 backdrop-blur-2xl p-6 shadow-xl shadow-indigo-500/5 hover:shadow-indigo-500/10 transition-shadow">
                <div className="text-sm font-bold text-slate-500 mb-2">{stat.label}</div>
                <div className="flex items-end gap-3">
                  <div className="text-4xl font-black text-slate-900">{stat.value}</div>
                  <div className={`text-sm font-bold mb-1 ${stat.positive ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {stat.trend}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Behavioural Risk Patterns & At-Risk List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            {/* Burnout Trends Bar Chart */}
            <motion.div variants={itemVariants} className="relative group flex flex-col">
              <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-rose-500/20 to-orange-500/20 blur-xl opacity-60 group-hover:opacity-100 transition duration-1000" />
              <div className="relative flex-1 rounded-[2.5rem] bg-white/50 border border-white/60 backdrop-blur-2xl p-8 lg:p-10 shadow-2xl shadow-indigo-500/10 flex flex-col">
                <div className="mb-8">
                  <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Behavioural Risk Patterns</h2>
                  <p className="text-sm font-medium text-slate-500">Aggregate Burnout Trends (Last 6 Months)</p>
                </div>
                
                <div className="flex-1 flex items-end gap-4 h-64 mt-auto">
                  {burnoutTrends.map((trend, i) => {
                    const isHigh = trend.riskLevel >= 75;
                    const colorClass = isHigh 
                      ? "from-rose-500 to-orange-400 shadow-rose-500/30" 
                      : "from-indigo-500 to-sky-400 shadow-indigo-500/30";
                    return (
                      <div key={trend.month} className="flex-1 flex flex-col items-center group/bar cursor-pointer">
                        <div className="relative w-full flex justify-center h-full items-end pb-2">
                          <motion.div 
                            className={`w-10 sm:w-12 rounded-xl bg-gradient-to-t ${colorClass} shadow-lg transition-transform hover:-translate-y-1`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: `${trend.riskLevel}%`, opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.2 + i * 0.1, type: "spring", bounce: 0.3 }}
                          >
                            <div className="opacity-0 group-hover/bar:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs font-bold py-1.5 px-3 rounded-lg pointer-events-none transition-opacity">
                              {trend.riskLevel}%
                            </div>
                          </motion.div>
                        </div>
                        <div className="text-sm font-bold text-slate-500 mt-2">{trend.month}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* At-Risk Students List */}
            <motion.div variants={itemVariants} className="relative group flex flex-col">
              <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-xl opacity-60 group-hover:opacity-100 transition duration-1000" />
              <div className="relative flex-1 rounded-[2.5rem] bg-white/50 border border-white/60 backdrop-blur-2xl p-8 lg:p-10 shadow-2xl shadow-indigo-500/10 flex flex-col">
                <div className="mb-8 flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Critical Watchlist</h2>
                    <p className="text-sm font-medium text-slate-500">Students requiring immediate intervention</p>
                  </div>
                  <button className="text-indigo-600 font-bold text-sm hover:text-indigo-800 transition-colors">
                    View All →
                  </button>
                </div>
                
                <div className="space-y-5 flex-1">
                  {atRiskStudents.map((student, i) => (
                    <motion.div 
                      key={student.id}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="group/item flex items-center gap-4 p-4 rounded-2xl bg-white/40 border border-white/60 shadow-sm hover:bg-white/80 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm">
                        {student.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-bold text-slate-900 truncate">{student.name}</h4>
                          <span className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                            {student.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-gradient-to-r from-orange-400 to-rose-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${student.risk}%` }}
                              transition={{ duration: 1, delay: 0.8 + i * 0.1 }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-600 w-8">{student.risk}%</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
          
        </motion.div>
      </div>
    </div>
  );
}
