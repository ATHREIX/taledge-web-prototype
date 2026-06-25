"use client";
import { motion } from "framer-motion";
import { Star, User, ArrowRight, Zap, Target, Compass, TrendingUp, Brain, Play, Rocket, ClipboardList, Gauge, Award, BarChart3, Activity } from "lucide-react";
import { Student } from "@/lib/data";
import { Card, Button, ButtonLink, Badge, Eyebrow, Heading, Stat, useToast } from "@/components/ui";
import { Bar } from "@/components/score-ring";
import { itemVariants } from "@/lib/motion";
import { DashboardShell, DashboardHeader, KPIGrid } from "@/components/dashboard";
import { scoreToTone } from "@/lib/dashboard-theme";

type Coach = { name: string; role: string; rating: number; sessions: number; focus: string };

const COACHES: Coach[] = [
  { name: "Sarah Jenkins", role: "Tech Lead @ Google", rating: 4.9, sessions: 120, focus: "System Design" },
  { name: "Rahul Sharma", role: "Sr. PM @ Microsoft", rating: 4.8, sessions: 85, focus: "Behavioural & Leadership" },
  { name: "Elena Rostova", role: "Staff Engineer @ Meta", rating: 5.0, sessions: 200, focus: "Algorithms & Data Structures" },
];

export default function DashboardClient({ student }: { student: Student }) {
  const { toast } = useToast();
  const techScore = student?.fit?.technical ? student.fit.technical : -1;
  const behavScore = student?.fit?.behavioural ? student.fit.behavioural : -1;
  const targetRole = student?.targetRole || "your target role";
  const coaches: Coach[] = COACHES;

  // DNLA behavioural competency snapshot (sample/dummy data for the pilot).
  const dnla = student?.dnla ?? [];
  const dnlaSorted = [...dnla].sort((a, b) => b.score - a.score);
  const dnlaTop = dnlaSorted.slice(0, 5);
  const strongest = dnlaSorted[0];
  const weakest = dnlaSorted[dnlaSorted.length - 1];
  const dnlaBarTone = (score: number): "success" | "dark" | "warn" | "danger" =>
    score >= 6 ? "success" : score >= 4 ? "dark" : score >= 3 ? "warn" : "danger";

  // Assessment progress: a populated fit score means the candidate has already
  // run the pilot flow, so we surface "Continue" instead of a cold "Start".
  const hasStarted = Boolean(student?.fit?.fit);
  const ctaTitle = hasStarted ? "Continue assessment" : "Start assessment";
  const ctaDescription = hasStarted
    ? "Pick up where you left off. Your assessment progress is saved - jump back into the pilot flow or review your results."
    : "Begin your assessment with the DNLA behavioural profile (step 1), then move on to the technical and behavioural interviews.";

  // Treat a 0 / missing score as "not started" so the synthetic fallback record
  // (getStudent returns fit.fit = 0 for unknown ids) renders an em-dash instead
  // of a misleading "0". Real candidates always have a non-zero composite.
  const fitScore = student?.fit?.fit ? student.fit.fit : -1;
  const successProb = student?.fit?.successProbability ? student.fit.successProbability : -1;
  const fmt = (n: number) => (n < 0 ? "-" : `${n}`);

  return (
    <DashboardShell>
      <DashboardHeader
        eyebrow="Analytics Dashboard"
        title="Development & Analytics"
        description={`Comprehensive breakdown of your competencies, actionable gaps, and personalized path to achieving your target role as ${targetRole}.`}
      />

      {/* KPI strip - the same top-line metric pattern every dashboard now shares */}
      <KPIGrid
        items={[
          { label: "Fit Score", value: fmt(fitScore), hint: "Weighted composite", tone: scoreToTone(fitScore), icon: <Gauge size={16} /> },
          { label: "Success Probability", value: fitScore < 0 ? "-" : `${fmt(successProb)}%`, hint: "Placement likelihood", tone: scoreToTone(successProb), icon: <Award size={16} /> },
          { label: "Technical", value: fmt(techScore), hint: "Tech interview + coding", tone: scoreToTone(techScore), icon: <BarChart3 size={16} /> },
          { label: "Behavioural", value: fmt(behavScore), hint: "Behavioural + DNLA", tone: scoreToTone(behavScore), icon: <Activity size={16} /> },
        ]}
      />

      {/* Assessment CTA - keeps the pilot flow reachable from the hub */}
      <motion.div variants={itemVariants} className="mb-12">
          <Card
            variant="default"
            className="rounded-xl2 shadow-panel p-6 sm:p-8 bg-brand-50/70 border-brand-200"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl2 bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-inner">
                  <Rocket size={22} aria-hidden="true" />
                </div>
                <div>
                  <Eyebrow className="mb-1 flex items-center gap-2 text-brand-600">
                    <Play size={14} aria-hidden="true" /> Your assessment
                  </Eyebrow>
                  <Heading as="h2" className="text-xl">
                    {ctaTitle}
                  </Heading>
                  <p className="mt-1 max-w-xl text-sm text-ink-500">{ctaDescription}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:shrink-0">
                <ButtonLink
                  href={`/student/${student.id}/dnla`}
                  variant="primary"
                  size="md"
                  className="flex items-center justify-center gap-2"
                >
                  {ctaTitle} <ArrowRight size={16} aria-hidden="true" />
                </ButtonLink>
                <ButtonLink
                  href={`/student/${student.id}/interview/technical`}
                  variant="soft"
                  size="md"
                  className="flex items-center justify-center gap-2"
                >
                  <ClipboardList size={16} aria-hidden="true" /> Technical interview
                </ButtonLink>
                <ButtonLink
                  href={`/student/${student.id}/fit-score`}
                  variant="ghost"
                  size="md"
                  className="flex items-center justify-center gap-2"
                >
                  <TrendingUp size={16} aria-hidden="true" /> Fit Score report
                </ButtonLink>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quadrant Column */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Card variant="default" className="relative h-full rounded-xl2 shadow-panel p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <Heading as="h2" className="text-xl flex items-center gap-2">
                    <Compass className="text-brand-500" size={20} aria-hidden="true" />
                    Strength vs. Development Quadrant
                  </Heading>
                  <p className="text-sm text-ink-500 mt-1">Technical vs Behavioural competencies matrix</p>
                </div>
              </div>

              {/* Score tiles */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <Stat label="Technical" value={fmt(techScore)} tone="brand" />
                <Stat label="Behavioural" value={fmt(behavScore)} tone="success" />
              </div>

              {/* 2x2 Matrix */}
              <div
                role="img"
                aria-label={`Strength vs. development quadrant: your technical score is ${fmt(techScore)} and behavioural score is ${fmt(behavScore)}, plotted against the batch average.`}
                className="relative w-full aspect-square max-h-[400px] border border-white/40 shadow-[inset_0_0_30px_rgba(0,0,0,0.02)] rounded-xl2 bg-white/40 overflow-hidden backdrop-blur-md group hover:bg-white/50 transition-colors duration-500"
              >
                {/* Axes */}
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-ink-300/80 to-transparent" />
                <div className="absolute top-0 left-1/2 w-[2px] h-full bg-gradient-to-b from-transparent via-ink-300/80 to-transparent" />

                {/* Labels */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/60 backdrop-blur-sm rounded-full text-[10px] font-extrabold text-ink-500 uppercase tracking-widest shadow-sm border border-white/50">High Tech</div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/60 backdrop-blur-sm rounded-full text-[10px] font-extrabold text-ink-500 uppercase tracking-widest shadow-sm border border-white/50">Low Tech</div>
                <div className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 -rotate-90 px-1.5 py-0.5 sm:px-3 sm:py-1 bg-white/60 backdrop-blur-sm rounded-full text-[8px] sm:text-[10px] font-extrabold text-ink-500 uppercase tracking-widest shadow-sm border border-white/50 origin-center z-10">Low Behav</div>
                <div className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 rotate-90 px-1.5 py-0.5 sm:px-3 sm:py-1 bg-white/60 backdrop-blur-sm rounded-full text-[8px] sm:text-[10px] font-extrabold text-ink-500 uppercase tracking-widest shadow-sm border border-white/50 origin-center z-10">High Behav</div>

                {/* Quadrant Backgrounds */}
                <div className="absolute top-0 left-1/2 w-1/2 h-1/2 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 backdrop-blur-[2px] transition-colors hover:bg-emerald-500/20" />
                <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-bl from-brand-500/10 to-brand-500/5 backdrop-blur-[2px] transition-colors hover:bg-brand-500/20" />
                <div className="absolute top-1/2 left-1/2 w-1/2 h-1/2 bg-gradient-to-tl from-amber-500/10 to-amber-500/5 backdrop-blur-[2px] transition-colors hover:bg-amber-500/20" />
                <div className="absolute top-1/2 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-rose-500/10 to-rose-500/5 backdrop-blur-[2px] transition-colors hover:bg-rose-500/20" />

                {/* Data Points */}
                {techScore >= 0 && behavScore >= 0 && (
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
                  <div className="absolute inset-0 bg-brand-500 rounded-full animate-ping opacity-30 group-hover:opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-400 to-brand-600 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.7)] border-2 border-white" />

                  {/* Tooltip */}
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-ink-900/95 backdrop-blur-xl border border-white/10 text-white text-xs font-semibold px-4 py-2 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100 shadow-2xl pointer-events-none origin-bottom">
                    You (Tech: {techScore}, Behav: {behavScore})
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-ink-900/95 border-r border-b border-white/10 rotate-45" />
                  </div>
                </motion.div>
                )}

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
                  <div className="absolute inset-0 bg-ink-400 rounded-full animate-ping opacity-20" />
                  <div className="absolute inset-0 bg-gradient-to-br from-ink-400 to-ink-500 rounded-full shadow-[0_0_15px_rgba(148,163,184,0.5)] border-2 border-white" />

                  {/* Tooltip */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-ink-800/95 backdrop-blur-xl border border-white/10 text-ink-100 text-[11px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100 shadow-xl pointer-events-none origin-bottom">
                    Batch Avg
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-ink-800/95 border-r border-b border-white/10 rotate-45" />
                  </div>
                </motion.div>
              </div>
            </Card>
          </motion.div>

          {/* Actionable Gaps & Recommendations */}
          <motion.div variants={itemVariants} className="flex flex-col gap-6">
            <Card variant="default" className="rounded-xl2 shadow-panel p-6 relative overflow-hidden">
              <Eyebrow className="mb-4 flex items-center gap-2">
                <Target size={16} aria-hidden="true" /> Batch-Level Gaps
              </Eyebrow>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.4)]" />
                  <div>
                    <p className="text-sm font-semibold text-ink-800">System Design Articulation</p>
                    <p className="text-xs text-ink-500 mt-1">68% of cohort struggles with trade-off framing.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                  <div>
                    <p className="text-sm font-semibold text-ink-800">Behavioural Storytelling</p>
                    <p className="text-xs text-ink-500 mt-1">STAR method often lacks metric-driven results.</p>
                  </div>
                </li>
              </ul>
            </Card>

            <Card variant="default" className="rounded-xl2 shadow-panel p-6 flex-1 bg-brand-50/70 border-brand-200">
              <Eyebrow className="mb-4 flex items-center gap-2 text-brand-600">
                <Zap size={16} aria-hidden="true" /> Learning Recommendations
              </Eyebrow>
              <div className="space-y-3">
                <button
                  type="button"
                  aria-label="Open micro-module: System Trade-offs (15 minute read plus interactive drill)"
                  onClick={() => toast("Micro-module: System Trade-offs is coming soon.", "info")}
                  className="group block w-full rounded-xl2 border border-white/80 bg-white/60 p-3 text-left transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-ink-800">Micro-module: System Trade-offs</p>
                    <ArrowRight size={14} aria-hidden="true" className="text-ink-500 group-hover:text-brand-500 transition-colors" />
                  </div>
                  <p className="text-xs text-ink-500 mt-1">15 min read + interactive drill</p>
                </button>
                <button
                  type="button"
                  aria-label="Open STAR Story Builder interactive worksheet"
                  onClick={() => toast("STAR Story Builder is coming soon.", "info")}
                  className="group block w-full rounded-xl2 border border-white/80 bg-white/60 p-3 text-left transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-ink-800">STAR Story Builder</p>
                    <ArrowRight size={14} aria-hidden="true" className="text-ink-500 group-hover:text-brand-500 transition-colors" />
                  </div>
                  <p className="text-xs text-ink-500 mt-1">Interactive worksheet</p>
                </button>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Behavioural competencies (DNLA) */}
        <motion.div variants={itemVariants} className="mt-12">
          <Card variant="default" className="rounded-xl2 shadow-panel p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Heading as="h2" className="flex items-center gap-2 text-xl">
                  <Brain className="text-brand-500" size={20} aria-hidden="true" />
                  Behavioural competencies (DNLA)
                </Heading>
                <p className="mt-1 text-sm text-ink-500">
                  Snapshot of your DNLA psychometric profile, scored 1–7 against the
                  top-performer benchmark.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="warn">Sample DNLA data</Badge>
                <ButtonLink
                  href={`/student/${student.id}/dnla`}
                  variant="soft"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  Full report <ArrowRight size={14} aria-hidden="true" />
                </ButtonLink>
              </div>
            </div>

            {dnlaTop.length === 0 ? (
              <p className="text-sm text-ink-500">
                No behavioural competency data yet. Scores will appear here once the
                licensed DNLA provider import is connected.
              </p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <ul className="space-y-4">
                  {dnlaTop.map((d) => (
                    <li key={d.competency}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-ink-800">
                          {d.competency}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-500">
                          {d.score} / 7
                          <span className="text-ink-400"> · bm {d.benchmark}</span>
                        </span>
                      </div>
                      <div className="mt-2">
                        <Bar value={d.score} max={7} tone={dnlaBarTone(d.score)} />
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="grid content-start gap-4">
                  {strongest && (
                    <div className="rounded-xl2 border border-emerald-200 bg-emerald-50/50 p-4">
                      <Eyebrow className="text-emerald-700">Strongest</Eyebrow>
                      <p className="mt-1 text-sm font-bold text-ink-900">
                        {strongest.competency}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        {strongest.group} · {strongest.score} / 7
                      </p>
                    </div>
                  )}
                  {weakest && weakest !== strongest && (
                    <div className="rounded-xl2 border border-amber-200 bg-amber-50/50 p-4">
                      <Eyebrow className="text-amber-700">Development focus</Eyebrow>
                      <p className="mt-1 text-sm font-bold text-ink-900">
                        {weakest.competency}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        {weakest.group} · {weakest.score} / 7
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Coaching Support */}
        <motion.div variants={itemVariants} className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <Heading as="h2" className="flex items-center gap-2">
              <User className="text-brand-500" size={24} aria-hidden="true" />
              Coaching Support
            </Heading>
            <Button type="button" variant="link" size="sm" className="flex items-center gap-1">
              View all <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>

          {coaches.length === 0 ? (
            <Card variant="default" className="rounded-xl2 shadow-panel p-6">
              <p className="text-sm text-ink-500">No coaches are available right now. Check back soon.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {coaches.map((coach, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -5 }}
                >
                  <Card variant="default" className="rounded-xl2 shadow-panel p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                        {coach.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-ink-900">{coach.name}</h4>
                        <p className="text-xs text-ink-500">{coach.role}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs font-medium text-amber-600">
                          <Star size={12} fill="currentColor" aria-hidden="true" />
                          {coach.rating} <span className="text-ink-500">({coach.sessions} sessions)</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-ink-100 flex items-center justify-between">
                      <Badge tone="neutral">{coach.focus}</Badge>
                      <Button type="button" variant="soft" size="sm" aria-label={`Book a session with ${coach.name}`}>
                        Book
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
    </DashboardShell>
  );
}
