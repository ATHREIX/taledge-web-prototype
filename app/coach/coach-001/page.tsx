"use client";
import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Bell, Calendar, Video, Clock, CheckCircle, ChevronRight, MessageSquare, Target } from "lucide-react";
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

export default function CoachDashboard() {
  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden font-sans selection:bg-emerald-500/20 flex flex-col">
      
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-50/90 to-emerald-50/40" />
        <div 
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `linear-gradient(to right, #10b981 1px, transparent 1px), linear-gradient(to bottom, #10b981 1px, transparent 1px)`,
            backgroundSize: `4rem 4rem`,
            maskImage: `radial-gradient(ellipse 80% 80% at 50% 50%, #000 20%, transparent 100%)`,
            WebkitMaskImage: `radial-gradient(ellipse 80% 80% at 50% 50%, #000 20%, transparent 100%)`
          }}
        />
        <motion.div
          animate={{ x: [0, -60, 60, 0], y: [0, -80, 80, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[0%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-emerald-300/20 blur-[130px]"
        />
        <motion.div
          animate={{ x: [0, 80, -80, 0], y: [0, 60, -60, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[10%] w-[70vw] h-[70vw] rounded-full bg-teal-300/20 blur-[140px]"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] left-[60%] w-[40vw] h-[40vw] rounded-full bg-indigo-300/10 blur-[120px]"
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
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest ml-2 border border-emerald-200/50">Coach</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <button className="hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100"><Search size={18} /></button>
            <button className="hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100 relative">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-sm cursor-pointer border-2 border-white ml-2">
              CH
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
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
             <motion.div variants={itemVariants}>
               <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-emerald-600 uppercase rounded-full bg-emerald-50/80 border border-emerald-200/50 backdrop-blur-md shadow-sm mb-4">
                 <Calendar size={14} /> Session Management
               </div>
               <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-slate-900 drop-shadow-sm">
                 Coaching Queue
               </h1>
               <p className="mt-4 max-w-2xl text-sm text-slate-600 sm:text-base font-medium">
                 Track your upcoming 1-on-1 sessions, review candidate progress, and manage coaching goals.
               </p>
             </motion.div>
             
             <motion.div variants={itemVariants} className="flex items-center gap-3">
               <button className="px-5 py-2.5 rounded-full border border-slate-200 bg-white/50 backdrop-blur-md text-sm font-bold text-slate-700 hover:bg-white hover:border-slate-300 transition-all flex items-center gap-2 shadow-sm">
                 <Calendar size={16} /> Sync Calendar
               </button>
             </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Column - Upcoming Sessions */}
            <motion.div variants={itemVariants} className="lg:col-span-2 flex flex-col gap-8">
               
               {/* Next Session Alert */}
               <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-200/50 relative overflow-hidden">
                 <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[150%] bg-white/10 rotate-12 blur-2xl"></div>
                 <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                       <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm mb-3">
                         <Clock size={14} /> Starting in 15 mins
                       </div>
                       <h2 className="text-2xl font-extrabold mb-1">System Design Mock Interview</h2>
                       <p className="text-emerald-50 font-medium text-sm">with Rohan Desai • Software Engineer II candidate</p>
                    </div>
                    <button className="bg-white text-emerald-700 px-6 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm">
                      <Video size={18} /> Join Meeting
                    </button>
                 </div>
               </div>

               {/* Session Queue */}
               <div className="h-full bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="text-emerald-500" size={18} />
                      Today's Queue
                    </h2>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">3 Sessions Left</span>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { name: "Ananya Sharma", topic: "Behavioral Storytelling (STAR)", time: "2:00 PM", duration: "45m", type: "Follow-up" },
                      { name: "Vikram Gupta", topic: "Product Sense & Execution", time: "4:30 PM", duration: "60m", type: "Initial Mock" },
                      { name: "Neha Patel", topic: "Frontend Architecture", time: "6:00 PM", duration: "45m", type: "Follow-up" },
                    ].map((session, i) => (
                      <div key={i} className="group p-4 bg-white/60 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer">
                        <div className="flex items-start gap-4">
                           <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 shrink-0">
                             {session.name.split(' ').map(n => n[0]).join('')}
                           </div>
                           <div>
                              <div className="font-bold text-slate-800 text-sm">{session.name}</div>
                              <div className="text-xs font-medium text-slate-500 mt-0.5">{session.topic}</div>
                           </div>
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6 pl-14 sm:pl-0">
                           <div className="text-right">
                             <div className="font-bold text-slate-700 text-sm">{session.time}</div>
                             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{session.duration} • {session.type}</div>
                           </div>
                           <button className="text-slate-400 hover:text-emerald-600 transition-colors p-2 bg-slate-50 hover:bg-emerald-50 rounded-full opacity-0 group-hover:opacity-100">
                             <MessageSquare size={16} />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </motion.div>

            {/* Right Column - Stats & Goals */}
            <motion.div variants={itemVariants} className="flex flex-col gap-6">
               
               {/* Quick Stats & Activity */}
               <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl p-6">
                 <div className="grid grid-cols-2 gap-4 mb-6">
                   <div>
                     <div className="text-sm font-bold text-slate-500 mb-1">Weekly Hours</div>
                     <div className="text-3xl font-extrabold text-slate-900">12.5</div>
                   </div>
                   <div>
                     <div className="text-sm font-bold text-slate-500 mb-1">Avg Rating</div>
                     <div className="flex items-end gap-1 text-3xl font-extrabold text-slate-900">
                       4.9 <span className="text-lg text-emerald-500 mb-1">★</span>
                     </div>
                   </div>
                 </div>
                 
                 {/* Activity Sparkline */}
                 <div className="w-full h-24 flex items-end justify-between gap-1.5 mt-4">
                   {[
                     { day: "M", val: 30 },
                     { day: "T", val: 50 },
                     { day: "W", val: 40 },
                     { day: "T", val: 80 },
                     { day: "F", val: 60 },
                     { day: "S", val: 20 },
                     { day: "S", val: 10 },
                   ].map((d, i) => (
                     <div key={i} className="flex flex-col items-center gap-2 flex-1 group cursor-pointer h-full justify-end">
                       <motion.div
                         initial={{ height: 0 }}
                         animate={{ height: `${d.val}%` }}
                         transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" as any }}
                         className="w-full max-w-[12px] bg-gradient-to-t from-emerald-200 to-teal-300 rounded-t-md group-hover:from-emerald-400 group-hover:to-teal-400 transition-all relative shadow-sm"
                       >
                         {/* Tooltip */}
                         <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-20">
                           {d.val / 10} hrs
                         </div>
                       </motion.div>
                       <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">{d.day}</span>
                     </div>
                   ))}
                 </div>
               </div>

               {/* Goal Tracking */}
               <div className="bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl p-6 flex-1 flex flex-col mt-6">
                  <h3 className="text-sm font-bold tracking-[0.1em] text-slate-400 uppercase mb-6 flex items-center gap-2">
                    <Target size={16} /> Candidate Goal Progress
                  </h3>
                  
                  <div className="space-y-6 flex-1 flex flex-col justify-center">
                    {[
                      { name: "Rohan D.", goal: "Pass FAANG System Design", progress: 65, color: "from-blue-400 to-indigo-500", bg: "bg-blue-50" },
                      { name: "Ananya S.", goal: "Master STAR Method", progress: 85, color: "from-emerald-400 to-teal-500", bg: "bg-emerald-50" },
                      { name: "Vikram G.", goal: "Product Case Studies", progress: 40, color: "from-amber-400 to-orange-500", bg: "bg-amber-50" },
                    ].map((student, i) => (
                      <div key={i} className="group cursor-pointer">
                        <div className="flex justify-between items-center mb-2">
                           <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{student.name}</div>
                           <div className="text-xs font-extrabold text-slate-700 bg-white px-2 py-0.5 rounded-full shadow-sm">{student.progress}%</div>
                        </div>
                        <div className="text-xs font-medium text-slate-500 mb-2 truncate">{student.goal}</div>
                        <div className={`w-full ${student.bg} h-2.5 rounded-full overflow-hidden border border-white/50 shadow-inner`}>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${student.progress}%` }}
                            transition={{ duration: 1.2, delay: 0.2 + i * 0.15, ease: "easeOut" as any }}
                            className={`h-full rounded-full bg-gradient-to-r ${student.color} relative`}
                          >
                             <div className="absolute inset-0 bg-white/20 w-full h-full" style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem' }} />
                          </motion.div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button className="w-full mt-8 py-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm">
                    View All Trainees
                  </button>
               </div>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
