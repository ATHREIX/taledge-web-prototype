"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { examAspirants, students } from "@/lib/data";

// --- TYPES ---
type Track = "placement" | "exam";
type Priority = "critical" | "high" | "medium" | "steady";
type Tone = "dark" | "success" | "warn" | "danger" | "muted";

type QueueItem = {
  id: string;
  track: Track;
  menteeId: string;
  priority: Priority;
  focus: string;
  queueReason: string;
  nextSlot: string;
  cadence: string;
  goal: string;
  evidence: string[];
};

type QueueViewItem = QueueItem & {
  name: string;
  initials: string;
  subtitle: string;
  href: string;
  scoreLabel: string;
  scoreValue: number;
  riskCount: number;
};

type SessionRecord = {
  id: string;
  track: Track;
  mentee: string;
  date: string;
  mode: string;
  topic: string;
  outcome: string;
  followUp: string;
};

type GoalRecord = {
  id: string;
  track: Track;
  owner: string;
  goal: string;
  due: string;
  progress: number;
  measure: string;
};

type OutcomeMetric = {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
  data: number[];
};

// --- DATA ---
const placementQueue: QueueItem[] = [
  { id: "pq-1", track: "placement", menteeId: "candidate-001", priority: "high", focus: "Feedback reaction and self-advocacy", queueReason: "Strong technical score with behavioural drag before recruiter publishing.", nextSlot: "Jun 05, 2026 - 5:00 PM", cadence: "2 sessions in 14 days", goal: "Move behavioural score from 58 to 66 before final publish.", evidence: ["Defensive response in mock feedback", "Panel self-advocacy below target"] },
  { id: "pq-2", track: "placement", menteeId: "candidate-003", priority: "critical", focus: "Collaborative communication", queueReason: "Confidence and accuracy gap may affect team-fit interviews.", nextSlot: "Jun 06, 2026 - 7:00 PM", cadence: "Weekly until next mock", goal: "Reduce overconfidence flags and improve disagreement handling.", evidence: ["Blunt pushback in behavioural interview", "Feedback reaction below benchmark"] },
  { id: "pq-3", track: "placement", menteeId: "candidate-002", priority: "steady", focus: "Written product storytelling", queueReason: "Interview-ready candidate needs a polish sprint for PM case rounds.", nextSlot: "Jun 08, 2026 - 4:00 PM", cadence: "One polish session", goal: "Convert strong stakeholder stories into crisp PRD narratives.", evidence: ["Strong behavioural score", "Written PRD structure needs tightening"] },
];

const examQueue: QueueItem[] = [
  { id: "eq-1", track: "exam", menteeId: "aspirant-001", priority: "critical", focus: "Stress reset and consistency recovery", queueReason: "Elevated stress indicators with declining study consistency.", nextSlot: "Jun 04, 2026 - 6:30 PM", cadence: "2 counselling check-ins this week", goal: "Stabilize daily plan and reduce stress index from 71 to below 60.", evidence: ["Study consistency down for 3 weeks", "Mood trend and stress markers worsening"] },
  { id: "eq-2", track: "exam", menteeId: "aspirant-003", priority: "medium", focus: "Mock-test rhythm", queueReason: "Preparation is viable, but mock-test cadence is inconsistent.", nextSlot: "Jun 07, 2026 - 11:00 AM", cadence: "Bi-weekly", goal: "Build a repeatable mock review and recovery routine.", evidence: ["Medium consistency risk", "Study hours fluctuate around mock windows"] },
  { id: "eq-3", track: "exam", menteeId: "aspirant-002", priority: "steady", focus: "Momentum preservation", queueReason: "Strong trajectory; light-touch counselling keeps preparation stable.", nextSlot: "Jun 10, 2026 - 8:00 AM", cadence: "Monthly checkpoint", goal: "Protect strong consistency without creating burnout.", evidence: ["Success potential above 75", "Stress index currently low"] },
];

const sessionHistory: SessionRecord[] = [
  { id: "s-1", track: "placement", mentee: "Candidate 001", date: "Jun 01, 2026", mode: "Role-play", topic: "Self-advocacy in panel interviews", outcome: "Panel answer structure improved from 2 to 4 anchors.", followUp: "Record one revised ownership story." },
  { id: "s-2", track: "exam", mentee: "Aspirant 001", date: "May 31, 2026", mode: "Counselling", topic: "Stress reset after mock slump", outcome: "14-day recovery routine agreed with institute counsellor.", followUp: "Daily check-in until Jun 07, 2026." },
  { id: "s-3", track: "placement", mentee: "Candidate 003", date: "May 29, 2026", mode: "Feedback drill", topic: "Responding to disagreement", outcome: "Acknowledgement before defence used in 3 of 4 practice rounds.", followUp: "Repeat with peer interviewer." },
  { id: "s-4", track: "placement", mentee: "Candidate 002", date: "May 28, 2026", mode: "Writing lab", topic: "Crisp written PRDs", outcome: "Problem framing score moved from 5.4 to 6.1.", followUp: "Rewrite onboarding metric section." },
  { id: "s-5", track: "exam", mentee: "Aspirant 003", date: "May 27, 2026", mode: "Study planning", topic: "Mock review rhythm", outcome: "Post-mock review checklist created.", followUp: "Run checklist after next mock." },
];

const interventionGoals: GoalRecord[] = [
  { id: "g-1", track: "placement", owner: "Candidate 001", goal: "Accept critical feedback without defensive framing.", due: "Jun 14, 2026", progress: 62, measure: "4 clean responses across 5 feedback drills" },
  { id: "g-2", track: "placement", owner: "Candidate 003", goal: "Use collaborative disagreement structure in interviews.", due: "Jun 18, 2026", progress: 48, measure: "Peer mock score above 65" },
  { id: "g-3", track: "exam", owner: "Aspirant 001", goal: "Restore minimum viable daily study rhythm.", due: "Jun 11, 2026", progress: 41, measure: "5 focused blocks per day for 6 of 7 days" },
  { id: "g-4", track: "exam", owner: "Aspirant 003", goal: "Convert mock tests into structured review cycles.", due: "Jun 21, 2026", progress: 68, measure: "2 completed mock reviews with error log" },
];

const outcomeMetrics: OutcomeMetric[] = [
  { label: "Placement behavioural lift", value: "+11.2", detail: "Average score lift across active placement mentees.", tone: "success", data: [47, 49, 52, 55, 58, 61, 63, 65] },
  { label: "Interview-ready conversion", value: "72%", detail: "Mentees moved to publishable readiness after coaching.", tone: "dark", data: [44, 48, 53, 57, 61, 66, 69, 72] },
  { label: "Exam stress reduction", value: "-14", detail: "Average stress-index drop after two counselling sessions.", tone: "success", data: [74, 70, 68, 65, 62, 60, 58, 56] },
  { label: "Goal completion", value: "81%", detail: "Intervention goals closed on or before target date.", tone: "dark", data: [58, 61, 64, 70, 73, 76, 78, 81] },
];

function toPlacementQueueItem(item: QueueItem): QueueViewItem {
  const student = students.find((candidate) => candidate.id === item.menteeId) ?? students[0];
  return {
    ...item,
    name: student.name,
    initials: student.avatar,
    subtitle: `${student.targetRole} - ${student.status}`,
    href: `/student/${student.id}`,
    scoreLabel: "Fit",
    scoreValue: student.fit.fit,
    riskCount: student.risks.length,
  };
}

function toExamQueueItem(item: QueueItem): QueueViewItem {
  const aspirant = examAspirants.find((candidate) => candidate.id === item.menteeId) ?? examAspirants[0];
  return {
    ...item,
    name: aspirant.name,
    initials: aspirant.avatar,
    subtitle: `${aspirant.exam} - ${aspirant.attempt}`,
    href: `/exam/${aspirant.id}`,
    scoreLabel: "Potential",
    scoreValue: aspirant.successPotential,
    riskCount: aspirant.risks.length,
  };
}

// --- HELPER COMPONENTS ---

const GlassCard = ({ children, className = "", delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -5, scale: 1.01 }}
    className={`bg-white/60 backdrop-blur-2xl border border-slate-200 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-6 overflow-hidden relative group ${className}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    {children}
  </motion.div>
);

const AnimatedNumber = ({ value }: { value: string }) => {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="inline-block"
    >
      {value}
    </motion.span>
  );
};

const GlowEffect = () => (
  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-gradient-to-b from-indigo-500/30 via-purple-500/20 to-transparent blur-3xl pointer-events-none -z-10 rounded-full mix-blend-screen opacity-70" />
);

// --- MAIN DASHBOARD ---

export default function CoachDashboard({ coachId }: { coachId: string }) {
  const placementItems = placementQueue.map(toPlacementQueueItem);
  const examItems = examQueue.map(toExamQueueItem);
  const allQueue = [...placementItems, ...examItems];
  const urgentCount = allQueue.filter((item) => item.priority === "critical" || item.priority === "high").length;
  const activeGoals = interventionGoals.filter((goal) => goal.progress < 100).length;
  const coachName = coachId === "coach-001" ? "Lead Coach" : "Coach Workspace";

  const [activeTab, setActiveTab] = useState<"overview" | "placement" | "exam">("overview");

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 selection:bg-indigo-500/30 font-sans pb-24 relative overflow-x-hidden">
      <GlowEffect />
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Header */}
      <header className="pt-20 pb-12 px-6 sm:px-12 max-w-7xl mx-auto relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 border border-slate-200 text-xs font-medium tracking-wide text-indigo-300 mb-6 backdrop-blur-md"
        >
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          Workspace Active
        </motion.div>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/50 leading-tight">
              {coachName}
            </h1>
            <p className="mt-4 text-lg text-slate-500 max-w-xl leading-relaxed font-light">
              Command center for placement coaching and exam counselling. Monitor risks, track interventions, and review outcomes in real-time.
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex gap-4"
          >
            <button className="px-6 py-3 rounded-2xl bg-white/60 border border-slate-200 hover:bg-slate-100/60 transition-colors backdrop-blur-xl text-sm font-semibold flex items-center gap-2 group">
              <IconCalendar /> 
              <span>Schedule</span>
            </button>
            <button className="px-6 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)] text-sm font-semibold text-white flex items-center gap-2">
              <IconClock /> 
              <span>Open Slot</span>
            </button>
          </motion.div>
        </div>
      </header>

      {/* KPI Grid */}
      <section className="px-6 sm:px-12 max-w-7xl mx-auto mb-16 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <KPICard label="Placement Queue" value={String(placementItems.length)} subtitle="Active mentees" delay={0.1} icon={<IconUsers />} />
          <KPICard label="Exam Counselling" value={String(examItems.length)} subtitle="Active aspirants" delay={0.2} icon={<IconQueue />} />
          <KPICard label="Urgent Reviews" value={String(urgentCount)} subtitle="Critical priority" delay={0.3} tone="danger" icon={<IconShield />} />
          <KPICard label="Active Goals" value={String(activeGoals)} subtitle="Tracked interventions" delay={0.4} icon={<IconTarget />} />
        </div>
      </section>

      {/* Main Content Tabs */}
      <section className="px-6 sm:px-12 max-w-7xl mx-auto z-10 relative">
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2 no-scrollbar">
          {["overview", "placement", "exam"].map((tab, i) => (
            <motion.button
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 capitalize ${
                activeTab === tab 
                  ? "bg-slate-900 text-white shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                  : "bg-white/60 text-slate-500 hover:bg-slate-100/60 hover:text-slate-900"
              }`}
            >
              {tab}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-12"
            >
              {/* Urgent Items */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                    <IconShield />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight">Requires Attention</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allQueue.filter(q => q.priority === "critical" || q.priority === "high").map((item, i) => (
                    <QueueCard key={item.id} item={item} delay={0.1 * i} />
                  ))}
                </div>
              </div>

              {/* Goals & Outcomes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <IconTarget />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Active Goals</h2>
                  </div>
                  <GlassCard delay={0.2} className="p-0">
                    <div className="divide-y divide-white/5">
                      {interventionGoals.map((goal) => (
                        <GoalRow key={goal.id} goal={goal} />
                      ))}
                    </div>
                  </GlassCard>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <IconLine />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Outcome Impact</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {outcomeMetrics.map((metric, i) => (
                      <OutcomeCard key={metric.label} metric={metric} delay={0.3 + i * 0.1} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "placement" && (
            <motion.div
              key="placement"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {placementItems.map((item, i) => (
                  <QueueCard key={item.id} item={item} delay={0.1 * i} fullWidth />
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "exam" && (
            <motion.div
              key="exam"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {examItems.map((item, i) => (
                  <QueueCard key={item.id} item={item} delay={0.1 * i} fullWidth />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function KPICard({ label, value, subtitle, delay, tone = "default", icon }: any) {
  const isDanger = tone === "danger";
  return (
    <GlassCard delay={delay} className={`group ${isDanger ? 'border-rose-500/30 bg-rose-500/5' : ''}`}>
      <div className="flex justify-between items-start mb-4">
        <span className="text-slate-500 text-sm font-medium">{label}</span>
        <span className={`p-2 rounded-lg ${isDanger ? 'bg-rose-500/20 text-rose-400' : 'bg-white/60 text-slate-500'}`}>
          {icon}
        </span>
      </div>
      <div className={`text-4xl sm:text-5xl font-black tracking-tighter ${isDanger ? 'text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'text-slate-900'}`}>
        <AnimatedNumber value={value} />
      </div>
      <div className="mt-2 text-xs text-slate-500">{subtitle}</div>
    </GlassCard>
  );
}

function QueueCard({ item, delay, fullWidth = false }: { item: QueueViewItem, delay: number, fullWidth?: boolean }) {
  const isCritical = item.priority === "critical";
  const isHigh = item.priority === "high";
  
  return (
    <GlassCard delay={delay} className={`flex flex-col ${isCritical ? 'border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.1)]' : ''} ${isHigh ? 'border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.1)]' : ''}`}>
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-slate-900 shadow-lg">
            {item.initials}
          </div>
          <div>
            <h3 className="font-bold text-lg">{item.name}</h3>
            <p className="text-xs text-slate-500">{item.subtitle}</p>
          </div>
        </div>
        <PriorityBadge priority={item.priority} />
      </div>

      <div className="mb-6 space-y-4 flex-1">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 block">Focus Area</span>
          <p className="text-sm font-medium text-slate-800">{item.focus}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/60 border border-slate-200">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 block">Reason</span>
          <p className="text-xs text-slate-600 leading-relaxed">{item.queueReason}</p>
        </div>
      </div>

      <div className="mt-auto flex gap-3 pt-4 border-t border-slate-200">
        <Link href={item.href} className="flex-1 py-2.5 rounded-xl bg-white/60 hover:bg-slate-100/60 text-center text-xs font-semibold transition-colors">
          View Profile
        </Link>
        <button className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-white/90 text-center text-xs font-bold transition-colors">
          Action
        </button>
      </div>
    </GlassCard>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: any = {
    critical: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    steady: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${styles[priority] || styles.steady}`}>
      {priority}
    </span>
  );
}

function GoalRow({ goal }: { goal: GoalRecord }) {
  return (
    <div className="p-5 hover:bg-white/60 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group">
      <div className="flex-1">
        <h4 className="font-semibold text-slate-800 mb-1">{goal.goal}</h4>
        <div className="flex gap-3 text-xs text-slate-500">
          <span>{goal.owner}</span>
          <span>&bull;</span>
          <span>Due: {goal.due.replace(", 2026", "")}</span>
        </div>
      </div>
      <div className="w-full sm:w-48">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-slate-500">Progress</span>
          <span className="font-bold text-slate-900">{goal.progress}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100/60 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            whileInView={{ width: `${goal.progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full ${goal.progress >= 65 ? 'bg-emerald-500' : goal.progress >= 45 ? 'bg-amber-500' : 'bg-rose-500'}`}
          />
        </div>
      </div>
    </div>
  );
}

function OutcomeCard({ metric, delay }: { metric: OutcomeMetric, delay: number }) {
  return (
    <GlassCard delay={delay} className="p-5">
      <div className="text-xs text-slate-500 mb-2">{metric.label}</div>
      <div className="text-3xl font-bold mb-3">{metric.value}</div>
      <p className="text-xs text-slate-500 leading-relaxed">{metric.detail}</p>
    </GlassCard>
  );
}

// --- ICONS ---
function IconUsers() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
function IconQueue() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /></svg>; }
function IconShield() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.7 8.9a2 2 0 0 1-1.3 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.3a1.5 1.5 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1v7Z" /><path d="m9 12 2 2 4-4" /></svg>; }
function IconTarget() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>; }
function IconLine() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 17 4-4 4 4 5-5" /></svg>; }
function IconCalendar() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>; }
function IconClock() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>; }
