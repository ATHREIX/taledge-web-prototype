"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, BookOpen, User, Star, TrendingUp, Compass, ArrowRight, Zap, Target } from "lucide-react";
import { Student } from "@/lib/data";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
};

export default function DashboardClient({ student }: { student: Student }) {
  const techScore = student?.fit?.technical || 75;
  const behavScore = student?.fit?.behavioural || 65;

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Animated background */}
      <div className="fixed inset-0 -z-20 min-h-screen bg-slate-50 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      <motion.section
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="container mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-600 uppercase rounded-full bg-indigo-50/80 border border-indigo-200/50 backdrop-blur-md shadow-sm mb-4">
            <TrendingUp size={14} /> Analytics Dashboard
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
            Development & Analytics
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-600 sm:text-base">
            Comprehensive breakdown of your competencies, actionable gaps, and personalized path to achieving your target role as {student.targetRole}.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quadrant Column */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <div className="relative h-full bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Compass className="text-indigo-500" size={20} />
                    Strength vs. Development Quadrant
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Technical vs Behavioural competencies matrix</p>
                </div>
              </div>
              
              {/* 2x2 Matrix */}
              <div className="relative w-full aspect-square max-h-[400px] border border-white/40 shadow-[inset_0_0_30px_rgba(0,0,0,0.02)] rounded-3xl bg-white/40 overflow-hidden backdrop-blur-md group hover:bg-white/50 transition-colors duration-500">
                {/* Axes */}
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-slate-300/80 to-transparent" />
                <div className="absolute top-0 left-1/2 w-[2px] h-full bg-gradient-to-b from-transparent via-slate-300/80 to-transparent" />
                
                {/* Labels */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/60 backdrop-blur-sm rounded-full text-[10px] font-extrabold text-slate-500 uppercase tracking-widest shadow-sm border border-white/50">High Tech</div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/60 backdrop-blur-sm rounded-full text-[10px] font-extrabold text-slate-500 uppercase tracking-widest shadow-sm border border-white/50">Low Tech</div>
                <div className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 -rotate-90 px-1.5 py-0.5 sm:px-3 sm:py-1 bg-white/60 backdrop-blur-sm rounded-full text-[8px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-widest shadow-sm border border-white/50 origin-center z-10">Low Behav</div>
                <div className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 rotate-90 px-1.5 py-0.5 sm:px-3 sm:py-1 bg-white/60 backdrop-blur-sm rounded-full text-[8px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-widest shadow-sm border border-white/50 origin-center z-10">High Behav</div>
                
                {/* Quadrant Backgrounds */}
                <div className="absolute top-0 left-1/2 w-1/2 h-1/2 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 backdrop-blur-[2px] transition-colors hover:bg-emerald-500/20" />
                <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-bl from-blue-500/10 to-blue-500/5 backdrop-blur-[2px] transition-colors hover:bg-blue-500/20" />
                <div className="absolute top-1/2 left-1/2 w-1/2 h-1/2 bg-gradient-to-tl from-amber-500/10 to-amber-500/5 backdrop-blur-[2px] transition-colors hover:bg-amber-500/20" />
                <div className="absolute top-1/2 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-rose-500/10 to-rose-500/5 backdrop-blur-[2px] transition-colors hover:bg-rose-500/20" />
                
                {/* Data Points */}
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 15 }}
                  whileHover={{ scale: 1.2 }}
                  className="absolute w-6 h-6 rounded-full z-20 cursor-pointer group"
                  style={{ 
                    left: `${behavScore}%`, 
                    top: `${100 - techScore}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-30 group-hover:opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.7)] border-2 border-white" />
                  
                  {/* Tooltip */}
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white text-xs font-semibold px-4 py-2 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100 shadow-2xl pointer-events-none origin-bottom">
                    You (Tech: {techScore}, Behav: {behavScore})
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900/95 border-r border-b border-white/10 rotate-45" />
                  </div>
                </motion.div>
                
                {/* Example Batch Average */}
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.7, type: "spring", stiffness: 200, damping: 15 }}
                  whileHover={{ scale: 1.2 }}
                  className="absolute w-5 h-5 rounded-full z-10 cursor-pointer group"
                  style={{ 
                    left: '60%', 
                    top: '40%',
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div className="absolute inset-0 bg-slate-400 rounded-full animate-ping opacity-20" />
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full shadow-[0_0_15px_rgba(148,163,184,0.5)] border-2 border-white" />
                  
                  {/* Tooltip */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur-xl border border-white/10 text-slate-100 text-[11px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100 shadow-xl pointer-events-none origin-bottom">
                    Batch Avg
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800/95 border-r border-b border-white/10 rotate-45" />
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Actionable Gaps & Recommendations */}
          <motion.div variants={itemVariants} className="flex flex-col gap-6">
            <div className="bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-400/10 rounded-full blur-2xl" />
              <h3 className="text-sm font-bold tracking-[0.1em] text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Target size={16} /> Batch-Level Gaps
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.4)]" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">System Design Articulation</p>
                    <p className="text-xs text-slate-500 mt-1">68% of cohort struggles with trade-off framing.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Behavioural Storytelling</p>
                    <p className="text-xs text-slate-500 mt-1">STAR method often lacks metric-driven results.</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-indigo-500/10 to-blue-500/5 backdrop-blur-2xl border border-indigo-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl p-6 flex-1">
              <h3 className="text-sm font-bold tracking-[0.1em] text-indigo-500 uppercase mb-4 flex items-center gap-2">
                <Zap size={16} /> Learning Recommendations
              </h3>
              <div className="space-y-3">
                <div className="group p-3 bg-white/60 rounded-xl border border-white/80 hover:bg-white/90 transition-colors cursor-pointer">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-slate-800">Micro-module: System Trade-offs</p>
                    <ArrowRight size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">15 min read + interactive drill</p>
                </div>
                <div className="group p-3 bg-white/60 rounded-xl border border-white/80 hover:bg-white/90 transition-colors cursor-pointer">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-slate-800">STAR Story Builder</p>
                    <ArrowRight size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Interactive worksheet</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Coaching Support */}
        <motion.div variants={itemVariants} className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <User className="text-indigo-500" size={24} />
              Coaching Support
            </h2>
            <Link href="#" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1">
              View all <ArrowRight size={16} />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Sarah Jenkins", role: "Tech Lead @ Google", rating: 4.9, sessions: 120, focus: "System Design" },
              { name: "Rahul Sharma", role: "Sr. PM @ Microsoft", rating: 4.8, sessions: 85, focus: "Behavioural & Leadership" },
              { name: "Elena Rostova", role: "Staff Engineer @ Meta", rating: 5.0, sessions: 200, focus: "Algorithms & Data Structures" }
            ].map((coach, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="bg-white/60 backdrop-blur-md border border-white/80 shadow-lg shadow-slate-200/40 rounded-3xl p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                    {coach.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900">{coach.name}</h4>
                    <p className="text-xs text-slate-500">{coach.role}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs font-medium text-amber-600">
                      <Star size={12} fill="currentColor" />
                      {coach.rating} <span className="text-slate-400">({coach.sessions} sessions)</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{coach.focus}</span>
                  <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                    Book
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.section>
    </div>
  );
}
