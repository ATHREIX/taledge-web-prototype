"use client";
import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Bell, TrendingUp, Users, AlertTriangle, CheckCircle, BarChart3, ChevronRight } from "lucide-react";
import Link from "next/link";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as any } }
};

export default function InstituteDashboard() {
  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden font-sans selection:bg-indigo-500/20 flex flex-col">
      
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-50/90 to-sky-50/50" />
        <div 
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `linear-gradient(to right, #6366f1 1px, transparent 1px), linear-gradient(to bottom, #6366f1 1px, transparent 1px)`,
            backgroundSize: `4rem 4rem`,
            maskImage: `radial-gradient(ellipse 80% 80% at 50% 50%, #000 20%, transparent 100%)`,
            WebkitMaskImage: `radial-gradient(ellipse 80% 80% at 50% 50%, #000 20%, transparent 100%)`
          }}
        />
        <motion.div
          animate={{ x: [0, 100, -100, 0], y: [0, -100, 100, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-300/20 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -120, 120, 0], y: [0, 120, -120, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[70vw] h-[70vw] rounded-full bg-sky-300/20 blur-[130px]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] left-[40%] w-[40vw] h-[40vw] rounded-full bg-purple-300/10 blur-[100px]"
        />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 w-full border-b border-slate-200/60 bg-white/60 backdrop-blur-xl">
        <div className="max-w-[90rem] mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-500 hover:text-indigo-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="h-6 w-px bg-slate-200"></div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">Taledge</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest ml-2 border border-indigo-200/50">Institute</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <button className="hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100"><Search size={18} /></button>
            <button className="hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100 relative">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-white"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white font-bold text-sm shadow-sm cursor-pointer border-2 border-white ml-2">
              IU
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="relative z-10 w-full max-w-[90rem] mx-auto px-6 sm:px-8 py-8 sm:py-12 flex-1 flex flex-col">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-600 uppercase rounded-full bg-indigo-50/80 border border-indigo-200/50 backdrop-blur-md shadow-sm mb-4">
              <BarChart3 size={14} /> Batch Overview
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-slate-900 drop-shadow-sm">
              Placement Readiness
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-600 sm:text-base font-medium">
              Monitor batch performance, identify at-risk candidates, and track overall readiness for upcoming placement drives.
            </p>
          </motion.div>

          {/* Stats Row */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: "Total Students", value: "450", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Placement Ready", value: "284", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Needs Intervention", value: "112", icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "At Risk", value: "54", icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50" }
            ].map((stat, i) => (
              <div key={i} className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-6 flex flex-col hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                    <stat.icon size={20} />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mb-1">{stat.value}</div>
                <div className="text-sm font-semibold text-slate-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Heatmap Area */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
               <div className="h-full bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl p-6 sm:p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Batch Readiness Heatmap</h2>
                      <p className="text-sm text-slate-500 mt-1 font-medium">Competency distribution across departments</p>
                    </div>
                    <button className="text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-full transition-colors">
                      Export Report
                    </button>
                  </div>
                  
                  {/* Interactive Bar Chart Mock */}
                  <div className="flex-1 w-full bg-white/40 rounded-2xl border border-white/60 flex items-end justify-around p-6 pt-12 min-h-[300px] relative mt-4 shadow-inner">
                    <div className="absolute inset-0 bg-gradient-to-t from-sky-50/50 to-transparent rounded-2xl pointer-events-none" />
                    
                    {/* Grid lines */}
                    <div className="absolute inset-0 p-6 pt-12 pointer-events-none flex flex-col justify-between">
                      {[100, 75, 50, 25, 0].map((val, i) => (
                        <div key={i} className="w-full border-t border-slate-200/50 relative">
                          <span className="absolute -top-2.5 -left-1 text-[10px] font-bold text-slate-400 bg-white/50 px-1 rounded-sm">{val}%</span>
                        </div>
                      ))}
                    </div>

                    {[
                      { month: "Jan", value: 30 },
                      { month: "Feb", value: 45 },
                      { month: "Mar", value: 65 },
                      { month: "Apr", value: 50 },
                      { month: "May", value: 85 },
                      { month: "Jun", value: 70 },
                      { month: "Jul", value: 95 },
                    ].map((data, i) => (
                      <div key={i} className="flex flex-col items-center gap-3 w-full group z-10 h-full justify-end">
                        <div className="relative w-full max-w-[40px] h-[calc(100%-2rem)] flex items-end justify-center">
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: `${data.value}%`, opacity: 1 }}
                            transition={{ duration: 1, delay: i * 0.1, type: "spring", stiffness: 50 }}
                            className="w-full bg-gradient-to-t from-indigo-500 to-sky-400 rounded-t-lg shadow-lg relative group-hover:from-indigo-400 group-hover:to-sky-300 transition-all cursor-pointer"
                          >
                             {/* Tooltip */}
                             <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50">
                               {data.value}% Ready
                               <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                             </div>
                          </motion.div>
                        </div>
                        <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">{data.month}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </motion.div>

            {/* At-risk List */}
            <motion.div variants={itemVariants} className="flex flex-col">
               <div className="h-full bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="text-rose-500" size={18} />
                      At-Risk Candidates
                    </h2>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { name: "Rahul S.", dept: "Computer Science", issue: "Low Tech Score", score: "42" },
                      { name: "Priya M.", dept: "Information Tech", issue: "Behavioral Flag", score: "55" },
                      { name: "Amit K.", dept: "Electronics", issue: "Missed Assessments", score: "N/A" },
                      { name: "Sneha P.", dept: "Computer Science", issue: "Low Fit Score", score: "48" },
                    ].map((student, i) => (
                      <div key={i} className="group p-4 bg-white/60 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer flex items-center justify-between">
                        <div>
                           <div className="font-bold text-slate-800 text-sm">{student.name}</div>
                           <div className="text-xs font-medium text-slate-500 mt-0.5">{student.dept}</div>
                           <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mt-1">{student.issue}</div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="text-lg font-extrabold text-slate-700">{student.score}</div>
                           <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button className="w-full mt-6 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                    View All Candidates
                  </button>
               </div>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
