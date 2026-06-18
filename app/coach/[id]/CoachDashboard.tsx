"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { examAspirants, students } from "@/lib/data";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  ButtonLink,
  Badge,
  Heading,
  Eyebrow,
  Stat,
} from "@/components/ui";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

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

function toPlacementQueueItem(item: QueueItem): QueueViewItem | null {
  const student = students.find((candidate) => candidate?.id === item.menteeId);
  if (!student) return null;
  return {
    ...item,
    name: student.name,
    initials: student.avatar,
    subtitle: `${student.targetRole} - ${student.status}`,
    href: `/student/${student.id}`,
    scoreLabel: "Fit",
    scoreValue: student.fit?.fit ?? 0,
    riskCount: student.risks?.length ?? 0,
  };
}

function toExamQueueItem(item: QueueItem): QueueViewItem | null {
  const aspirant = examAspirants.find((candidate) => candidate?.id === item.menteeId);
  if (!aspirant) return null;
  return {
    ...item,
    name: aspirant.name,
    initials: aspirant.avatar,
    subtitle: `${aspirant.exam} - ${aspirant.attempt}`,
    href: `/exam/${aspirant.id}`,
    scoreLabel: "Potential",
    scoreValue: aspirant.successPotential ?? 0,
    riskCount: aspirant.risks?.length ?? 0,
  };
}

// --- HELPER COMPONENTS ---

const GlassCard = ({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay, ease: EASE }}
    whileHover={{ y: -5, scale: 1.01 }}
  >
    <Card variant="frosted" className={cn("p-6 overflow-hidden relative group", className)}>
      {children}
    </Card>
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

// --- MAIN DASHBOARD ---

export default function CoachDashboard({ coachId }: { coachId: string }) {
  const placementItems = placementQueue
    .map(toPlacementQueueItem)
    .filter((item): item is QueueViewItem => item !== null);
  const examItems = examQueue
    .map(toExamQueueItem)
    .filter((item): item is QueueViewItem => item !== null);
  const allQueue = [...placementItems, ...examItems];
  const urgentItems = allQueue.filter((item) => item.priority === "critical" || item.priority === "high");
  const hasQueue = allQueue.length > 0;
  const urgentCount = urgentItems.length;
  const activeGoals = interventionGoals.filter((goal) => goal.progress < 100).length;
  const coachName = coachId === "coach-001" ? "Lead Coach" : "Coach Workspace";

  const [activeTab, setActiveTab] = useState<"overview" | "placement" | "exam">("overview");

  return (
    <PageShell>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <Badge tone="brand" className="mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          Workspace Active
        </Badge>
      </motion.div>

      <PageHeader
        title={coachName}
        description="Command center for placement coaching and exam counselling. Monitor risks, track interventions, and review outcomes in real-time."
        actions={
          <>
            <Button type="button" variant="ghost">
              <IconCalendar aria-hidden="true" />
              <span>Schedule</span>
            </Button>
            <Button type="button" variant="primary">
              <IconClock aria-hidden="true" />
              <span>Open Slot</span>
            </Button>
          </>
        }
      />

      {/* KPI Grid */}
      <section className="mb-16 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <KPICard label="Placement Queue" value={String(placementItems.length)} subtitle="Active mentees" delay={0.1} icon={<IconUsers />} />
          <KPICard label="Exam Counselling" value={String(examItems.length)} subtitle="Active aspirants" delay={0.2} icon={<IconQueue />} />
          <KPICard label="Urgent Reviews" value={String(urgentCount)} subtitle="Critical priority" delay={0.3} tone="danger" icon={<IconShield />} />
          <KPICard label="Active Goals" value={String(activeGoals)} subtitle="Tracked interventions" delay={0.4} icon={<IconTarget />} />
        </div>
      </section>

      {/* Main Content Tabs */}
      <section className="relative z-10">
        <div role="tablist" aria-label="Coaching views" className="flex gap-4 mb-8 overflow-x-auto pb-2 no-scrollbar">
          {["overview", "placement", "exam"].map((tab, i) => (
            <motion.button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-label={`Show ${tab} view`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 capitalize border",
                activeTab === tab
                  ? "bg-ink-900 text-white border-transparent shadow-panel"
                  : "bg-white/80 text-ink-500 border-ink-200/70 hover:bg-ink-50 hover:text-ink-900"
              )}
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
                  <div aria-hidden="true" className="w-8 h-8 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-600">
                    <IconShield />
                  </div>
                  <Heading as="h2">Requires Attention</Heading>
                </div>
                {urgentItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {urgentItems.map((item, i) => (
                      <QueueCard key={item.id} item={item} delay={0.1 * i} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message={hasQueue ? "Nothing needs urgent attention right now." : "No sessions yet."} />
                )}
              </div>

              {/* Goals & Outcomes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div aria-hidden="true" className="w-8 h-8 rounded-full bg-brand-500/15 flex items-center justify-center text-brand-600">
                      <IconTarget />
                    </div>
                    <Heading as="h2">Active Goals</Heading>
                  </div>
                  <GlassCard delay={0.2} className="p-0">
                    <div className="divide-y divide-ink-200/60">
                      {interventionGoals.map((goal) => (
                        <GoalRow key={goal.id} goal={goal} />
                      ))}
                    </div>
                  </GlassCard>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div aria-hidden="true" className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600">
                      <IconLine />
                    </div>
                    <Heading as="h2">Outcome Impact</Heading>
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
              {placementItems.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {placementItems.map((item, i) => (
                    <QueueCard key={item.id} item={item} delay={0.1 * i} fullWidth />
                  ))}
                </div>
              ) : (
                <EmptyState message="No sessions yet." />
              )}
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
              {examItems.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {examItems.map((item, i) => (
                    <QueueCard key={item.id} item={item} delay={0.1 * i} fullWidth />
                  ))}
                </div>
              ) : (
                <EmptyState message="No sessions yet." />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </PageShell>
  );
}

// --- SUB-COMPONENTS ---

function KPICard({ label, value, subtitle, delay, tone = "default", icon }: any) {
  const isDanger = tone === "danger";
  return (
    <GlassCard delay={delay} className={cn("group", isDanger && "border-rose-200 bg-rose-50/60")}>
      <Stat
        tone={isDanger ? "danger" : "neutral"}
        icon={icon}
        label={label}
        value={<AnimatedNumber value={value} />}
        sub={subtitle}
      />
    </GlassCard>
  );
}

function QueueCard({ item, delay, fullWidth = false }: { item: QueueViewItem, delay: number, fullWidth?: boolean }) {
  const isCritical = item.priority === "critical";
  const isHigh = item.priority === "high";

  return (
    <GlassCard delay={delay} className={cn("flex flex-col", isCritical && "border-rose-200", isHigh && "border-amber-200")}>
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div aria-hidden="true" className="w-12 h-12 rounded-xl2 bg-gradient-to-br from-brand-600 to-accent-500 flex items-center justify-center font-bold text-white shadow-panel">
            {item.initials}
          </div>
          <div>
            <h3 className="font-bold text-lg text-ink-900">{item.name}</h3>
            <p className="text-xs text-ink-500">{item.subtitle}</p>
          </div>
        </div>
        <PriorityBadge priority={item.priority} />
      </div>

      <div className="mb-6 space-y-4 flex-1">
        <div>
          <Eyebrow className="mb-1 block">Focus Area</Eyebrow>
          <p className="text-sm font-medium text-ink-800">{item.focus}</p>
        </div>
        <div className="p-3 rounded-xl bg-ink-50/60 border border-ink-200/60">
          <Eyebrow className="mb-1 block">Reason</Eyebrow>
          <p className="text-xs text-ink-600 leading-relaxed">{item.queueReason}</p>
        </div>
      </div>

      <div className="mt-auto flex gap-3 pt-4 border-t border-ink-200/60">
        <ButtonLink href={item.href} variant="ghost" size="sm" className="flex-1">
          View Profile
        </ButtonLink>
        <Button type="button" variant="primary" size="sm" className="flex-1 bg-ink-900 hover:bg-ink-800">
          Action
        </Button>
      </div>
    </GlassCard>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const tones: Record<string, "danger" | "warn" | "brand" | "success"> = {
    critical: "danger",
    high: "warn",
    medium: "brand",
    steady: "success",
  };
  return (
    <Badge tone={tones[priority] ?? "success"} className="uppercase">
      {priority}
    </Badge>
  );
}

function GoalRow({ goal }: { goal: GoalRecord }) {
  return (
    <div className="p-5 hover:bg-ink-50/60 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group">
      <div className="flex-1">
        <h4 className="font-semibold text-ink-800 mb-1">{goal.goal}</h4>
        <div className="flex gap-3 text-xs text-ink-500">
          <span>{goal.owner}</span>
          <span>&bull;</span>
          <span>Due: {goal.due.replace(", 2026", "")}</span>
        </div>
      </div>
      <div className="w-full sm:w-48">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-ink-500">Progress</span>
          <span className="font-bold text-ink-900">{goal.progress}%</span>
        </div>
        <div
          className="h-2 w-full bg-ink-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={goal.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${goal.goal} progress: ${goal.progress}%`}
        >
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${goal.progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("h-full rounded-full", goal.progress >= 65 ? "bg-emerald-500" : goal.progress >= 45 ? "bg-amber-500" : "bg-rose-500")}
          />
        </div>
      </div>
    </div>
  );
}

function OutcomeCard({ metric, delay }: { metric: OutcomeMetric, delay: number }) {
  return (
    <GlassCard delay={delay} className="p-5">
      <Stat
        tone={metric.tone === "success" ? "success" : "neutral"}
        label={metric.label}
        value={metric.value}
        sub={metric.detail}
      />
    </GlassCard>
  );
}

function EmptyState({ message = "No sessions yet." }: { message?: string }) {
  return (
    <Card variant="frosted" className="p-10 flex flex-col items-center justify-center text-center">
      <div aria-hidden="true" className="w-12 h-12 rounded-xl2 bg-ink-50 text-ink-500 flex items-center justify-center mb-4">
        <IconQueue />
      </div>
      <Heading as="h3" className="text-ink-900">{message}</Heading>
      <p className="mt-2 text-sm text-ink-500 max-w-sm">
        Sessions will appear here once mentees are added to the coaching queue.
      </p>
    </Card>
  );
}

// --- ICONS ---
type IconProps = React.SVGProps<SVGSVGElement>;
function IconUsers(props: IconProps) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
function IconQueue(props: IconProps) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /></svg>; }
function IconShield(props: IconProps) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M20 13c0 5-3.5 7.5-7.7 8.9a2 2 0 0 1-1.3 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.3a1.5 1.5 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1v7Z" /><path d="m9 12 2 2 4-4" /></svg>; }
function IconTarget(props: IconProps) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>; }
function IconLine(props: IconProps) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M3 3v18h18" /><path d="m7 17 4-4 4 4 5-5" /></svg>; }
function IconCalendar(props: IconProps) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>; }
function IconClock(props: IconProps) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>; }
