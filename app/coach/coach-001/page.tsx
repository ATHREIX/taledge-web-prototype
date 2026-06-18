"use client";
import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Bell, Calendar, Video, Clock, MessageSquare, Target } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { PageShell, PageHeader, Card, Button, Badge, Heading, Eyebrow, Stat } from "@/components/ui";
import { containerVariants, itemVariants, EASE } from "@/lib/motion";

const QUEUE = [
  { name: "Ananya Sharma", topic: "Behavioral Storytelling (STAR)", time: "2:00 PM", duration: "45m", type: "Follow-up" },
  { name: "Vikram Gupta", topic: "Product Sense & Execution", time: "4:30 PM", duration: "60m", type: "Initial Mock" },
  { name: "Neha Patel", topic: "Frontend Architecture", time: "6:00 PM", duration: "45m", type: "Follow-up" },
];

const ACTIVITY = [
  { day: "M", val: 30 },
  { day: "T", val: 50 },
  { day: "W", val: 40 },
  { day: "T", val: 80 },
  { day: "F", val: 60 },
  { day: "S", val: 20 },
  { day: "S", val: 10 },
];

const GOALS = [
  { name: "Rohan D.", goal: "Pass FAANG System Design", progress: 65, color: "from-brand-400 to-brand-600", bg: "bg-brand-50" },
  { name: "Ananya S.", goal: "Master STAR Method", progress: 85, color: "from-brand-400 to-accent-500", bg: "bg-brand-50" },
  { name: "Vikram G.", goal: "Product Case Studies", progress: 40, color: "from-amber-400 to-amber-500", bg: "bg-amber-50" },
];

export default function CoachDashboard() {
  const queue = Array.isArray(QUEUE) ? QUEUE : [];
  const activity = Array.isArray(ACTIVITY) ? ACTIVITY : [];
  const goals = Array.isArray(GOALS) ? GOALS : [];

  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = React.useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  React.useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col font-sans">
      {/* Navbar */}
      <nav className="relative z-20 w-full border-b border-ink-200/60 bg-white/70 backdrop-blur-xl">
        <div className="max-w-[90rem] mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" aria-label="Back to dashboard" className="text-ink-500 hover:text-brand-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="h-6 w-px bg-ink-200"></div>
            <Logo />
            <Badge tone="brand" className="uppercase tracking-widest ml-2">Coach</Badge>
          </div>
          <div className="flex items-center gap-4 text-ink-500">
            <button type="button" aria-label="Search" onClick={() => notify("Search is coming soon to the coach workspace.")} className="hover:text-brand-600 transition-colors p-2 rounded-full hover:bg-ink-100"><Search size={18} /></button>
            <button type="button" aria-label="Notifications" onClick={() => notify("You have 1 new notification.")} className="hover:text-brand-600 transition-colors p-2 rounded-full hover:bg-ink-100 relative">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 border-2 border-white"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-600 to-accent-500 flex items-center justify-center text-white font-bold text-sm shadow-sm cursor-pointer border-2 border-white ml-2">
              CH
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <PageShell width="wide" className="flex-1 flex flex-col">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Header */}
          <motion.div variants={itemVariants}>
            <PageHeader
              eyebrow="Session Management"
              title="Coaching Queue"
              description="Track your upcoming 1-on-1 sessions, review candidate progress, and manage coaching goals."
              actions={
                <Button type="button" variant="ghost" onClick={() => notify("Calendar synced. Your sessions are up to date.")}>
                  <Calendar size={16} /> Sync Calendar
                </Button>
              }
            />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Main Column - Upcoming Sessions */}
            <motion.div variants={itemVariants} className="lg:col-span-2 flex flex-col gap-8">

               {/* Next Session Alert */}
               <div className="bg-gradient-to-r from-brand-600 to-accent-500 rounded-xl3 p-6 sm:p-8 text-white shadow-panel relative overflow-hidden">
                 <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                       <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm mb-3">
                         <Clock size={14} /> Starting in 15 mins
                       </div>
                       <h2 className="text-2xl font-extrabold mb-1">System Design Mock Interview</h2>
                       <p className="text-brand-50 font-medium text-sm">with Rohan Desai • Software Engineer II candidate</p>
                    </div>
                    <button type="button" onClick={() => notify("Launching meeting room with Rohan Desai...")} className="bg-white text-brand-700 px-6 py-3 rounded-xl font-bold hover:bg-brand-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm">
                      <Video size={18} /> Join Meeting
                    </button>
                 </div>
               </div>

               {/* Session Queue */}
               <Card variant="frosted" className="h-full p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <Heading as="h2" className="text-lg flex items-center gap-2">
                      <Calendar className="text-brand-500" size={18} />
                      Today's Queue
                    </Heading>
                    <Eyebrow>{queue.length} Sessions Left</Eyebrow>
                  </div>

                  {queue.length === 0 ? (
                    <Card variant="flat" className="p-6 text-center text-sm text-ink-500">
                      No sessions queued for today.
                    </Card>
                  ) : (
                  <div className="space-y-4">
                    {queue.map((session, i) => (
                      <Card key={i} variant="flat" hover className="group p-4 hover:border-brand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                           <div className="w-10 h-10 rounded-full bg-ink-100 flex items-center justify-center font-bold text-ink-600 shrink-0">
                             {session.name.split(' ').map(n => n[0]).join('')}
                           </div>
                           <div>
                              <div className="font-bold text-ink-800 text-sm">{session.name}</div>
                              <div className="text-xs font-medium text-ink-500 mt-0.5">{session.topic}</div>
                           </div>
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6 pl-14 sm:pl-0">
                           <div className="text-right">
                             <div className="font-bold text-ink-700 text-sm">{session.time}</div>
                             <div className="text-[10px] font-bold text-ink-500 uppercase tracking-widest mt-0.5">{session.duration} • {session.type}</div>
                           </div>
                           <button
                             type="button"
                             aria-label={`Message ${session.name}`}
                             title={`Message ${session.name}`}
                             onClick={() => notify(`Message draft opened for ${session.name}.`)}
                             className="text-ink-500 hover:text-brand-600 transition-colors p-2 bg-ink-50 hover:bg-brand-50 rounded-full"
                           >
                             <MessageSquare size={16} />
                           </button>
                        </div>
                      </Card>
                    ))}
                  </div>
                  )}
               </Card>
            </motion.div>

            {/* Right Column - Stats & Goals */}
            <motion.div variants={itemVariants} className="flex flex-col gap-6">

               {/* Quick Stats & Activity */}
               <Card variant="frosted" className="p-6">
                 <div className="grid grid-cols-2 gap-4 mb-6">
                   <Stat label="Weekly Hours" value="12.5" />
                   <Stat
                     label="Avg Rating"
                     value={
                       <span className="flex items-end gap-1">
                         4.9 <span className="text-lg text-brand-500 mb-1">★</span>
                       </span>
                     }
                   />
                 </div>

                 {/* Activity Sparkline */}
                 <div
                   role="img"
                   aria-label="Coaching hours over the past 7 days"
                   className="w-full h-24 flex items-end justify-between gap-1.5 mt-4"
                 >
                   {activity.map((d, i) => (
                     <div key={i} className="flex flex-col items-center gap-2 flex-1 group cursor-pointer h-full justify-end">
                       <motion.div
                         initial={{ height: 0 }}
                         animate={{ height: `${d.val}%` }}
                         transition={{ duration: 0.8, delay: i * 0.1, ease: EASE }}
                         className="w-full max-w-[12px] bg-gradient-to-t from-brand-200 to-accent-300 rounded-t-md group-hover:from-brand-400 group-hover:to-accent-400 transition-all relative shadow-sm"
                       >
                         {/* Tooltip */}
                         <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ink-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-panel z-20">
                           {d.val / 10} hrs
                         </div>
                       </motion.div>
                       <span className="text-[10px] font-bold text-ink-500 group-hover:text-brand-600 transition-colors">{d.day}</span>
                     </div>
                   ))}
                 </div>
               </Card>

               {/* Goal Tracking */}
               <Card variant="frosted" className="p-6 flex-1 flex flex-col mt-6">
                  <Eyebrow className="mb-6 flex items-center gap-2">
                    <Target size={16} /> Candidate Goal Progress
                  </Eyebrow>

                  {goals.length === 0 ? (
                    <Card variant="flat" className="p-6 text-center text-sm text-ink-500">
                      No trainee goals to display yet.
                    </Card>
                  ) : (
                  <div className="space-y-6 flex-1 flex flex-col justify-center">
                    {goals.map((student, i) => (
                      <div key={i} className="group cursor-pointer">
                        <div className="flex justify-between items-center mb-2">
                           <div className="text-sm font-bold text-ink-800 group-hover:text-brand-600 transition-colors">{student.name}</div>
                           <div className="text-xs font-extrabold text-ink-700 bg-white px-2 py-0.5 rounded-full shadow-sm">{student.progress}%</div>
                        </div>
                        <div className="text-xs font-medium text-ink-500 mb-2 truncate">{student.goal}</div>
                        <div className={`w-full ${student.bg} h-2.5 rounded-full overflow-hidden border border-white/50 shadow-inner`}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${student.progress}%` }}
                            transition={{ duration: 1.2, delay: 0.2 + i * 0.15, ease: EASE }}
                            className={`h-full rounded-full bg-gradient-to-r ${student.color} relative`}
                          >
                             <div className="absolute inset-0 bg-white/20 w-full h-full" style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem' }} />
                          </motion.div>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  <Button type="button" variant="ghost" onClick={() => notify("Full trainee roster is coming soon.")} className="w-full mt-8 hover:text-brand-600 hover:border-brand-200">
                    View All Trainees
                  </Button>
               </Card>
            </motion.div>
          </div>
        </motion.div>
      </PageShell>

      {/* Inline toast feedback */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: EASE }}
            role="status"
            className="pointer-events-auto flex items-center gap-2 rounded-xl bg-ink-800 px-4 py-3 text-sm font-medium text-white shadow-panel"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent-400" />
            {toast}
          </motion.div>
        )}
      </div>
    </div>
  );
}
