"use client";
import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Bell, Briefcase, Filter, UserCheck, CheckCircle2, ChevronRight, MoreHorizontal } from "lucide-react";
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

export default function RecruiterDashboard() {
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
          animate={{ x: [0, -100, 100, 0], y: [0, 100, -100, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-300/20 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, 120, -120, 0], y: [0, -120, 120, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-sky-300/20 blur-[130px]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] right-[40%] w-[40vw] h-[40vw] rounded-full bg-purple-300/10 blur-[100px]"
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
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest ml-2 border border-indigo-200/50">Recruiter</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <button className="hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100"><Search size={18} /></button>
            <button className="hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100 relative">
              <Bell size={18} />
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm cursor-pointer border-2 border-white ml-2">
              RC
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
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
             <motion.div variants={itemVariants}>
               <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-600 uppercase rounded-full bg-indigo-50/80 border border-indigo-200/50 backdrop-blur-md shadow-sm mb-4">
                 <Briefcase size={14} /> Pipeline Management
               </div>
               <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-slate-900 drop-shadow-sm">
                 Candidate Pipeline
               </h1>
               <p className="mt-4 max-w-2xl text-sm text-slate-600 sm:text-base font-medium">
                 Manage your active job postings, evaluate fit scores, and shortlist top talent seamlessly.
               </p>
             </motion.div>
             
             <motion.div variants={itemVariants} className="flex items-center gap-3">
               <button className="px-5 py-2.5 rounded-full border border-slate-200 bg-white/50 backdrop-blur-md text-sm font-bold text-slate-700 hover:bg-white hover:border-slate-300 transition-all flex items-center gap-2 shadow-sm">
                 <Filter size={16} /> Filter Candidates
               </button>
               <button className="px-5 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">
                 Post New Job
               </button>
             </motion.div>
          </div>

          {/* Pipeline Stats & Funnel Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <motion.div variants={itemVariants} className="lg:col-span-1 flex flex-col gap-4">
              {[
                { label: "Sourced", value: "1,248", change: "+12%", bg: "bg-slate-100", color: "text-slate-700" },
                { label: "Screened", value: "342", change: "+5%", bg: "bg-blue-100", color: "text-blue-700" },
                { label: "Interview", value: "84", change: "+2%", bg: "bg-indigo-100", color: "text-indigo-700" },
                { label: "Offered", value: "12", change: "+1", bg: "bg-emerald-100", color: "text-emerald-700" }
              ].map((stat, i) => (
                <div key={i} className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-all group cursor-pointer hover:border-indigo-100">
                  <div>
                    <div className="text-sm font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">{stat.label}</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{stat.value}</div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded-md ${stat.bg} ${stat.color}`}>
                    {stat.change}
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div variants={itemVariants} className="lg:col-span-3 bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-6 sm:p-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60"></div>
              <h3 className="text-lg font-bold text-slate-900 mb-6 relative z-10 flex items-center gap-2">
                Conversion Funnel
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-widest">Healthy</span>
              </h3>
              <div className="flex-1 flex flex-col justify-center gap-4 relative z-10">
                {[
                  { stage: "Sourced", count: 1248, percentage: 100, color: "from-slate-400 to-slate-300" },
                  { stage: "Screened", count: 342, percentage: 27.4, color: "from-sky-500 to-blue-400" },
                  { stage: "Interview", count: 84, percentage: 6.7, color: "from-indigo-500 to-purple-400" },
                  { stage: "Offered", count: 12, percentage: 1.0, color: "from-emerald-500 to-teal-400" },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-4 group cursor-pointer">
                    <div className="w-24 text-right text-sm font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">
                      {step.stage}
                    </div>
                    <div className="flex-1 h-10 sm:h-12 bg-white/60 rounded-full border border-white p-1 relative flex items-center shadow-inner">
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: `${step.percentage}%`, opacity: 1 }}
                        transition={{ duration: 1.2, delay: i * 0.15, type: "spring", bounce: 0.2 }}
                        className={`h-full rounded-full bg-gradient-to-r ${step.color} shadow-sm relative min-w-[3.5rem] group-hover:brightness-110 transition-all`}
                      >
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-[10px] sm:text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          {step.percentage.toFixed(1)}%
                        </span>
                      </motion.div>
                    </div>
                    <div className="w-16 text-left text-sm font-extrabold text-slate-700 group-hover:text-slate-900">
                      {step.count}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Active Jobs */}
            <motion.div variants={itemVariants} className="flex flex-col">
               <div className="h-full bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl p-6">
                  <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Briefcase className="text-indigo-500" size={18} />
                    Active Requisitions
                  </h2>
                  
                  <div className="space-y-4">
                    {[
                      { title: "Software Engineer II", dept: "Engineering", matches: 45, status: "Active" },
                      { title: "Product Manager", dept: "Product", matches: 12, status: "Active" },
                      { title: "Data Analyst", dept: "Data", matches: 8, status: "Review" },
                    ].map((job, i) => (
                      <div key={i} className="group p-4 bg-white/60 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                           <div>
                              <div className="font-bold text-slate-800 text-sm">{job.title}</div>
                              <div className="text-xs font-medium text-slate-500 mt-0.5">{job.dept}</div>
                           </div>
                           <MoreHorizontal size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                           <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                             {job.matches} High Matches
                           </div>
                           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                             {job.status}
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </motion.div>

            {/* Shortlisted Candidates */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
               <div className="h-full bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl p-6 sm:p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Top Shortlists</h2>
                      <p className="text-sm text-slate-500 mt-1 font-medium">Candidates with &gt;85% Fit Score for active roles</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                          <th className="pb-4 pl-2">Candidate</th>
                          <th className="pb-4">Applied Role</th>
                          <th className="pb-4">Fit Score</th>
                          <th className="pb-4">Status</th>
                          <th className="pb-4"></th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {[
                          { name: "Ananya Sharma", role: "Software Engineer II", score: 94, status: "Interview", initials: "AS", color: "bg-indigo-100 text-indigo-700" },
                          { name: "Vikram Gupta", role: "Product Manager", score: 89, status: "Screened", initials: "VG", color: "bg-emerald-100 text-emerald-700" },
                          { name: "Neha Patel", role: "Software Engineer II", score: 87, status: "Screened", initials: "NP", color: "bg-purple-100 text-purple-700" },
                          { name: "Rohan Desai", role: "Data Analyst", score: 85, status: "Sourced", initials: "RD", color: "bg-sky-100 text-sky-700" },
                        ].map((c, i) => (
                          <tr key={i} className="border-b border-slate-100/50 hover:bg-white/40 transition-colors group">
                            <td className="py-4 pl-2">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${c.color}`}>
                                  {c.initials}
                                </div>
                                <span className="font-bold text-slate-800">{c.name}</span>
                              </div>
                            </td>
                            <td className="py-4 font-medium text-slate-600">{c.role}</td>
                            <td className="py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-full max-w-[80px] bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div className="bg-gradient-to-r from-indigo-500 to-sky-500 h-full rounded-full" style={{ width: `${c.score}%` }}></div>
                                </div>
                                <span className="font-bold text-slate-700">{c.score}%</span>
                              </div>
                            </td>
                            <td className="py-4">
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-md border border-slate-200">
                                {c.status}
                              </span>
                            </td>
                            <td className="py-4 text-right pr-2">
                              <button className="text-slate-400 hover:text-indigo-600 transition-colors p-1 opacity-0 group-hover:opacity-100">
                                <ChevronRight size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-6 flex justify-center">
                    <button className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                      Load More Candidates
                    </button>
                  </div>
               </div>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
