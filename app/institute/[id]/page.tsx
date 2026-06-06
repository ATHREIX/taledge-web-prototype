import { notFound } from "next/navigation";
import Link from "next/link";
import { Section } from "@/components/glass";
import { ScoreRing, Bar } from "@/components/score-ring";
import {
  examAspirants,
  getInstitute,
  students,
  type ExamAspirant,
  type Institute,
  type Student,
} from "@/lib/data";
import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from "@/components/motion";
import { MotionDiv } from "./ClientMotion";

type BarTone = "dark" | "success" | "warn" | "danger" | "muted";

type PlacementAnalytics = {
  readinessPct: number;
  interventionLoad: number;
  recruitableCount: number;
  batchRows: {
    name: string;
    group: string;
    year: string;
    size: number;
    avgTech: number;
    avgBehav: number;
    avgFit: number;
    readinessIndex: number;
    topGap: string;
    action: string;
    tone: BarTone;
  }[];
  topGaps: { label: string; count: number; tone: BarTone }[];
  interventions: Intervention[];
  heatmapCompetencies: string[];
  heatmapRows: {
    id: string;
    name: string;
    context: string;
    status: Student["status"];
    scores: { competency: string; score: number }[];
    average: number;
  }[];
};

type ExamAnalytics = {
  onTrackPct: number;
  highStressCount: number;
  avgStress: number;
  avgConsistency: number;
  consistencyDelta: number;
  weeklyConsistency: number[];
  stressBuckets: { label: string; count: number; pct: number; tone: BarTone }[];
  atRisk: ExamAspirant[];
  interventions: Intervention[];
  progressRows: {
    id: string;
    name: string;
    context: string;
    successPotential: number;
    consistency: number;
    resilience: number;
    stressIndex: number;
    trendDelta: number;
    studyHours: number;
    action: string;
  }[];
};

type Intervention = {
  title: string;
  audience: string;
  owner: string;
  cadence: string;
  metric: string;
  tone: BarTone;
};

export default async function InstitutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inst = getInstitute(id);
  if (!inst) notFound();

  const isExam = inst.kind === "exam";
  const placementAnalytics = !isExam ? buildPlacementAnalytics(inst, students) : null;
  const examAnalytics = isExam ? buildExamAnalytics(inst, examAspirants) : null;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAFAFA] text-slate-700 font-sans selection:bg-fuchsia-500/30 selection:text-fuchsia-100">
      {/* Animated Background Mesh */}
      <MotionDiv animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-violet-900/30 blur-[140px] mix-blend-screen pointer-events-none" />
      <MotionDiv animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-fuchsia-900/30 blur-[140px] mix-blend-screen pointer-events-none" />
      <MotionDiv animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 5 }} className="absolute top-[30%] left-[50%] w-[40vw] h-[40vw] rounded-full bg-cyan-900/20 blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FAFAFA]/50 to-[#FAFAFA] pointer-events-none" />
      <section className="relative overflow-hidden border-b border-slate-200 bg-white/40 backdrop-blur-3xl shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
        
        <div className="mx-auto max-w-7xl px-5 pb-8 pt-8 sm:px-8 sm:pb-10 sm:pt-12">
          <FadeIn delay={0.1} className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
                <IconInstitute /> {isExam ? "Competitive Exam Institute" : "Placement Institute"}
              </div>
              <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 sm:text-5xl md:text-6xl drop-shadow-sm">
                {inst.name}
                <br />
                {isExam ? "Aspirant Success Command Center" : "Placement Readiness Command Center"}
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-slate-500 sm:text-base">
                Production view for <span className="font-semibold text-slate-900">{inst.cohort}</span> learners across{" "}
                <span className="font-semibold text-slate-900">{inst.batches.length}</span> active groups. Current priority:
                {" "}
                <span className="font-semibold text-slate-900">{inst.topGap}</span>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/60 px-6 py-3 text-sm font-semibold text-slate-900 border border-slate-200 backdrop-blur-md transition-all duration-300 hover:bg-slate-100/60 hover:border-slate-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                <IconDownload /> Export cohort CSV
              </button>
              {!isExam ? (
                <Link href="/recruiter/recruiter-001" className="group relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-6 py-3 text-sm font-bold text-slate-900 shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(139,92,246,0.6)] before:absolute before:inset-0 before:bg-white/20 before:opacity-0 hover:before:opacity-100 before:transition-opacity">
                  Recruiter share
                  <IconArrow />
                </Link>
              ) : (
                <button className="group relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-6 py-3 text-sm font-bold text-slate-900 shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(139,92,246,0.6)] before:absolute before:inset-0 before:bg-white/20 before:opacity-0 hover:before:opacity-100 before:transition-opacity">
                  Plan interventions
                  <IconArrow />
                </button>
              )}
            </div>
          </FadeIn>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {!isExam && placementAnalytics && (
          <PlacementKpis inst={inst} analytics={placementAnalytics} />
        )}
        {isExam && examAnalytics && <ExamKpis inst={inst} analytics={examAnalytics} />}

        <Section className="mt-12">
          <SlideUp delay={0.3} className="mb-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
              <IconSparkles /> Cohort Signals
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 sm:text-2xl md:text-3xl">
              Decision Queue
            </h2>
          </SlideUp>
          <StaggerContainer delay={0.4} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {inst.insights.map((insight, index) => (
              <StaggerItem key={insight.label}>
                <MotionDiv whileHover={{ scale: 1.02, y: -5 }} className={`h-full rounded-[2rem] border p-5 sm:p-6 ${
                    insight.severity === "danger"
                      ? "border-rose-500/30 bg-rose-500/10 backdrop-blur-xl shadow-[0_0_30px_rgba(225,29,72,0.15)]"
                      : insight.severity === "warn"
                        ? "border-amber-500/30 bg-amber-500/10 backdrop-blur-xl shadow-[0_0_30px_rgba(245,158,11,0.15)]"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={severityChip(insight.severity)}>
                      {insight.severity === "danger" ? "Escalate" : insight.severity === "warn" ? "Review" : "Monitor"}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 tracking-[0.2em]">Signal {String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <p className="mt-4 text-base font-semibold leading-snug text-slate-900">{insight.label}</p>
                </MotionDiv>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Section>

        {!isExam && placementAnalytics && (
          <PlacementDashboard inst={inst} analytics={placementAnalytics} cohort={students} />
        )}
        {isExam && examAnalytics && (
          <ExamDashboard inst={inst} analytics={examAnalytics} aspirants={examAspirants} />
        )}
      </div>
    </div>
  );
}

function PlacementKpis({
  inst,
  analytics,
}: {
  inst: Institute;
  analytics: PlacementAnalytics;
}) {
  return (
    <SlideUp delay={0.2} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4">
          <ScoreRing value={analytics.readinessPct} size={92} stroke={10} tone="dark" label="Ready" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 tracking-[0.2em]">Batch readiness</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {inst.interviewReady}/{inst.cohort}
            </div>
            <div className="text-xs text-slate-500">Fit threshold: 70+</div>
          </div>
        </div>
        <KPI label="Average Fit Score" value={`${inst.avgFit}`} delta="+3 vs last cycle" />
        <KPI label="Intervention load" value={`${analytics.interventionLoad}`} sub="Groups below readiness threshold" tone="warn" />
        <KPI label="Recruiter-visible pool" value={`${analytics.recruitableCount}`} sub="Eligible for shared access" />
      </div>
    </SlideUp>
  );
}

function ExamKpis({
  inst,
  analytics,
}: {
  inst: Institute;
  analytics: ExamAnalytics;
}) {
  return (
    <SlideUp delay={0.2} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4">
          <ScoreRing
            value={analytics.onTrackPct}
            size={92}
            stroke={10}
            tone={analytics.onTrackPct >= 70 ? "success" : analytics.onTrackPct >= 50 ? "warn" : "danger"}
            label="On track"
          />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 tracking-[0.2em]">Success trajectory</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{inst.avgFit}</div>
            <div className="text-xs text-slate-500">Average success potential</div>
          </div>
        </div>
        <KPI label="High-stress cases" value={`${analytics.highStressCount}`} sub="Require counsellor review" tone="danger" />
        <KPI label="Avg consistency" value={`${analytics.avgConsistency}%`} sub={deltaLabel(analytics.consistencyDelta)} tone={analytics.consistencyDelta < 0 ? "warn" : "default"} />
        <KPI label="Avg stress index" value={`${analytics.avgStress}`} sub="Lower is better" tone={analytics.avgStress > 60 ? "danger" : "default"} />
      </div>
    </SlideUp>
  );
}

function PlacementDashboard({
  inst,
  analytics,
  cohort,
}: {
  inst: Institute;
  analytics: PlacementAnalytics;
  cohort: Student[];
}) {
  return (
    <>
      <Section className="mt-12">
        <SlideUp delay={0.4} className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
              <IconGrid /> Department, Year, Group Analytics
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 sm:text-2xl md:text-3xl">
              Batch Readiness
            </h2>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-100/60 text-slate-700 border border-slate-300 backdrop-blur-md shadow-sm">Placement track only</span>
        </SlideUp>
        <SlideUp delay={0.5} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 overflow-x-auto p-0">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-12 border-b border-slate-200 bg-white/60 px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 backdrop-blur-md shadow-sm border-b border-slate-200">
              <div className="col-span-3">Group</div>
              <div className="col-span-1 text-right">Size</div>
              <div className="col-span-2">Technical</div>
              <div className="col-span-2">Behavioural</div>
              <div className="col-span-1 text-right">Fit</div>
              <div className="col-span-1 text-right">Ready</div>
              <div className="col-span-2 text-right">Next action</div>
            </div>
            {analytics.batchRows.map((batch) => (
              <div
                key={batch.name}
                className="grid grid-cols-12 items-center border-b border-slate-200 px-5 py-4 text-sm transition-colors last:border-0 hover:bg-white/80"
              >
                <div className="col-span-3 min-w-0">
                  <div className="truncate font-semibold text-slate-900">{batch.group}</div>
                  <div className="text-[11px] text-slate-500">{batch.year} - top gap: {batch.topGap}</div>
                </div>
                <div className="col-span-1 text-right tabular-nums text-slate-700">{batch.size}</div>
                <div className="col-span-2"><Bar value={batch.avgTech} tone={scoreTone(batch.avgTech)} showVal /></div>
                <div className="col-span-2"><Bar value={batch.avgBehav} tone={scoreTone(batch.avgBehav)} showVal /></div>
                <div className="col-span-1 text-right text-2xl font-black tracking-tight text-slate-900 ">{batch.avgFit}</div>
                <div className="col-span-1 text-right"><span className={toneChip(batch.tone)}>{batch.readinessIndex}%</span></div>
                <div className="col-span-2 text-right text-xs font-medium text-slate-400">{batch.action}</div>
              </div>
            ))}
          </div>
        </SlideUp>
      </Section>

      <Section className="mt-12">
        <SlideUp delay={0.5} className="mb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
            <IconHeatmap /> Competency Heatmap
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 sm:text-2xl md:text-3xl">
            Student-Level Competency Signals
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Deterministic heatmap from existing assessment records. Low cells become the coaching backlog.
          </p>
        </SlideUp>
        <SlideUp delay={0.6} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 overflow-x-auto p-5 sm:p-6">
          <div className="min-w-[1080px]">
            <div
              className="grid gap-1 text-[10px] uppercase tracking-wider text-slate-500"
              style={{ gridTemplateColumns: `180px repeat(${analytics.heatmapCompetencies.length}, minmax(72px, 1fr)) 64px` }}
            >
              <div className="px-2 py-1.5 font-semibold">Student</div>
              {analytics.heatmapCompetencies.map((competency) => (
                <div key={competency} className="px-2 py-1.5 font-semibold">
                  {shortCompetency(competency)}
                </div>
              ))}
              <div className="px-2 py-1.5 text-right font-semibold">Avg</div>
              {analytics.heatmapRows.map((row) => (
                <HeatmapRow key={row.id} row={row} competencies={analytics.heatmapCompetencies} />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <Legend color="#be123c" label="Needs intervention" />
              <Legend color="#b45309" label="Developing" />
              <Legend color="#047857" label="Ready range" />
            </div>
          </div>
        </SlideUp>
      </Section>

      <Section className="mt-12">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SlideUp delay={0.6} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 p-5 sm:p-6 lg:col-span-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
              <IconTarget /> Top Gaps
            </div>
            <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Priority Backlog</h2>
            <div className="mt-5 space-y-4">
              {analytics.topGaps.map((gap, index) => (
                <div key={gap.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{gap.label}</div>
                      <div className="text-[11px] text-slate-500">Priority weight {gap.count}</div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 tracking-[0.2em]">0{index + 1}</span>
                  </div>
                  <Bar value={gap.count} max={analytics.topGaps[0]?.count || 1} tone={gap.tone} />
                </div>
              ))}
            </div>
          </SlideUp>

          <SlideUp delay={0.7} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 p-5 sm:p-6 lg:col-span-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
              <IconCalendar /> Intervention Recommendations
            </div>
            <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Operating Plan
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {analytics.interventions.map((item) => (
                <InterventionCard key={item.title} item={item} />
              ))}
            </div>
          </SlideUp>
        </div>
      </Section>

      <Section className="mt-12">
        <SlideUp delay={0.8} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 p-5 sm:p-6 lg:col-span-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
              <IconLink /> Recruiter Shared Link
            </div>
            <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Scoped Employer Access
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Share only eligible candidate profiles, Fit Scores, interview summaries, and publish status with approved recruiters.
            </p>
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-white/50 p-4 text-xs font-medium text-slate-400">
              /recruiter/recruiter-001?institute={inst.id}
            </div>
            <Link href="/recruiter/recruiter-001" className="group relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-6 py-3 text-sm font-bold text-slate-900 shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(139,92,246,0.6)] mt-5 w-full before:absolute before:inset-0 before:bg-white/20 before:opacity-0 hover:before:opacity-100 before:transition-opacity">
              Open recruiter view
            </Link>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 p-2 sm:p-3 lg:col-span-2">
            <div className="px-3 pb-2 pt-3 sm:px-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
                <IconUsers /> Cohort Roster
              </div>
            </div>
            <div className="space-y-1">
              {cohort.map((student) => (
                <Link
                  key={student.id}
                  href={`/student/${student.id}`}
                  className="group relative flex overflow-hidden items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-white/80 sm:px-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-white text-xs font-semibold text-slate-900 transition-transform group-hover:scale-105">
                      {student.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-slate-400">{student.name}</div>
                      <div className="truncate text-[11px] text-slate-500">{student.branch} - {student.year}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <span className="hidden text-xs text-slate-500 sm:inline">Fit {student.fit.fit}</span>
                    <span className={student.status === "Interview-ready" || student.status === "Published" ? "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] backdrop-blur-md" : "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)] backdrop-blur-md"}>
                      {student.status}
                    </span>
                    <IconChevron />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </SlideUp>
      </Section>
    </>
  );
}

function ExamDashboard({
  inst,
  analytics,
  aspirants,
}: {
  inst: Institute;
  analytics: ExamAnalytics;
  aspirants: ExamAspirant[];
}) {
  return (
    <>
      <Section className="mt-12">
        <SlideUp delay={0.4} className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
              <IconShield /> Stress And Consistency
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 sm:text-2xl md:text-3xl">
              Exam Cohort Health
            </h2>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-100/60 text-slate-700 border border-slate-300 backdrop-blur-md shadow-sm">Candidate and institute visibility</span>
        </SlideUp>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SlideUp delay={0.5} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 p-5 sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 tracking-[0.2em]">Stress distribution</div>
            <div className="mt-5 space-y-4">
              {analytics.stressBuckets.map((bucket) => (
                <div key={bucket.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">{bucket.label}</span>
                    <span className={toneChip(bucket.tone)}>{bucket.count} cases</span>
                  </div>
                  <Bar value={bucket.pct} tone={bucket.tone} />
                </div>
              ))}
            </div>
          </SlideUp>

          <SlideUp delay={0.6} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 p-5 sm:p-6 lg:col-span-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 tracking-[0.2em]">Consistency trend</div>
            <div className="mt-4">
              <InlineSparkline data={analytics.weeklyConsistency} tone={analytics.consistencyDelta < 0 ? "warn" : "success"} height={96} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniStat label="Current average" value={`${analytics.avgConsistency}%`} />
              <MiniStat label="12-week movement" value={deltaLabel(analytics.consistencyDelta)} tone={analytics.consistencyDelta < 0 ? "warn" : "success"} />
              <MiniStat label="Tracked profiles" value={`${aspirants.length}`} />
            </div>
          </SlideUp>
        </div>
      </Section>

      <Section className="mt-12">
        <SlideUp delay={0.5} className="mb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
            <IconGrid /> Batch Analytics
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 sm:text-2xl md:text-3xl">
            Exam Group Performance
          </h2>
        </SlideUp>
        <SlideUp delay={0.6} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 overflow-x-auto p-0">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-12 border-b border-slate-200 bg-white/60 px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 backdrop-blur-md shadow-sm border-b border-slate-200">
              <div className="col-span-4">Group</div>
              <div className="col-span-1 text-right">Size</div>
              <div className="col-span-3">Resilience / Behaviour</div>
              <div className="col-span-2 text-right">Potential</div>
              <div className="col-span-2 text-right">Top gap</div>
            </div>
            {inst.batches.map((batch) => (
              <div
                key={batch.name}
                className="grid grid-cols-12 items-center border-b border-slate-200 px-5 py-4 text-sm transition-colors last:border-0 hover:bg-white/80"
              >
                <div className="col-span-4 font-semibold text-slate-900">{batch.name}</div>
                <div className="col-span-1 text-right tabular-nums text-slate-700">{batch.size}</div>
                <div className="col-span-3"><Bar value={batch.avgBehav} tone={scoreTone(batch.avgBehav)} showVal /></div>
                <div className="col-span-2 text-right text-2xl font-black tracking-tight text-slate-900 ">{batch.avgFit}</div>
                <div className="col-span-2 text-right text-xs text-slate-400">{batch.topGap}</div>
              </div>
            ))}
          </div>
        </SlideUp>
      </Section>

      <Section className="mt-12">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SlideUp delay={0.6} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 p-5 sm:p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
              <IconUsers /> At-Risk Students
            </div>
            <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Counsellor Queue
            </h2>
            <div className="mt-5 space-y-2">
              {analytics.atRisk.length ? (
                analytics.atRisk.map((aspirant) => (
                  <Link
                    key={aspirant.id}
                    href={`/exam/${aspirant.id}`}
                    className="group relative flex overflow-hidden items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-white/80"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-white text-xs font-semibold text-slate-900">
                        {aspirant.avatar}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{aspirant.name}</div>
                        <div className="truncate text-[11px] text-slate-500">{aspirant.exam} - stress {aspirant.stressIndex}</div>
                      </div>
                    </div>
                    <span className={aspirant.stressIndex >= 65 ? "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(225,29,72,0.2)] backdrop-blur-md" : "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)] backdrop-blur-md"}>{aspirant.risks.length || 1} flags</span>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-xl shadow-[0_0_30px_rgba(16,185,129,0.15)] p-4 text-sm text-slate-700">
                  No active high-risk student records.
                </div>
              )}
            </div>
          </SlideUp>

          <SlideUp delay={0.7} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 p-5 sm:p-6 lg:col-span-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
              <IconCalendar /> Intervention Planning
            </div>
            <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Action Plan
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {analytics.interventions.map((item) => (
                <InterventionCard key={item.title} item={item} />
              ))}
            </div>
          </SlideUp>
        </div>
      </Section>

      <Section className="mt-12">
        <SlideUp delay={0.8} className="mb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 border border-violet-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.15)] uppercase tracking-widest relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:animate-pulse">
            <IconLine /> Progress Tracking
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 sm:text-2xl md:text-3xl">
            Aspirant Trajectories
          </h2>
        </SlideUp>
        <SlideUp delay={0.9} className="relative overflow-hidden rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/80 hover:border-slate-300 hover:shadow-violet-500/20 overflow-x-auto p-0">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-12 border-b border-slate-200 bg-white/60 px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 backdrop-blur-md shadow-sm border-b border-slate-200">
              <div className="col-span-3">Aspirant</div>
              <div className="col-span-1 text-right">Potential</div>
              <div className="col-span-2">Consistency</div>
              <div className="col-span-1 text-right">Stress</div>
              <div className="col-span-2 text-right">12-week move</div>
              <div className="col-span-1 text-right">Hours</div>
              <div className="col-span-2 text-right">Next action</div>
            </div>
            {analytics.progressRows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-12 items-center border-b border-slate-200 px-5 py-4 text-sm transition-colors last:border-0 hover:bg-white/80"
              >
                <div className="col-span-3 min-w-0">
                  <div className="truncate font-semibold text-slate-900">{row.name}</div>
                  <div className="truncate text-[11px] text-slate-500">{row.context}</div>
                </div>
                <div className="col-span-1 text-right text-2xl font-black tracking-tight text-slate-900 ">{row.successPotential}</div>
                <div className="col-span-2"><Bar value={row.consistency} tone={scoreTone(row.consistency)} showVal /></div>
                <div className="col-span-1 text-right"><span className={row.stressIndex >= 65 ? "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(225,29,72,0.2)] backdrop-blur-md" : row.stressIndex >= 50 ? "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)] backdrop-blur-md" : "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] backdrop-blur-md"}>{row.stressIndex}</span></div>
                <div className="col-span-2 text-right"><span className={row.trendDelta < 0 ? "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)] backdrop-blur-md" : "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] backdrop-blur-md"}>{deltaLabel(row.trendDelta)}</span></div>
                <div className="col-span-1 text-right tabular-nums text-slate-700">{row.studyHours}h</div>
                <div className="col-span-2 text-right text-xs font-medium text-slate-400">{row.action}</div>
              </div>
            ))}
          </div>
        </SlideUp>
      </Section>
    </>
  );
}

function KPI({
  label,
  value,
  delta,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: string;
  sub?: string;
  tone?: "default" | "danger" | "warn";
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/[0.05] to-transparent border border-slate-200 shadow-inner transition-all duration-300 hover:border-slate-200 p-5 sm:p-6 hover:shadow-[0_0_20px_rgba(139,92,246,0.1)]">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 tracking-[0.2em]">{label}</div>
      <div
        className={`mt-2 text-2xl font-bold tracking-tight sm:text-3xl ${
          tone === "danger" ? "text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.5)]" : tone === "warn" ? "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      {delta && <div className="mt-1 text-xs font-medium text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">{delta}</div>}
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warn";
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/[0.05] to-transparent border border-slate-200 shadow-inner transition-all duration-300 hover:border-slate-200 p-5 hover:shadow-[0_0_20px_rgba(139,92,246,0.1)]">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 tracking-[0.2em]">{label}</div>
      <div className={`mt-2 text-xl font-bold tracking-tight ${tone === "success" ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" : tone === "warn" ? "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}

function HeatmapRow({
  row,
  competencies,
}: {
  row: PlacementAnalytics["heatmapRows"][number];
  competencies: string[];
}) {
  return (
    <>
      <div className="min-w-0 px-2 py-2">
        <div className="truncate text-xs font-semibold normal-case tracking-normal text-slate-900">{row.name}</div>
        <div className="truncate text-[10px] normal-case tracking-normal text-slate-500">{row.context}</div>
      </div>
      {competencies.map((competency) => {
        const score = row.scores.find((item) => item.competency === competency)?.score || 0;
        return (
          <div
            key={`${row.id}-${competency}`}
            className="grid h-10 place-items-center rounded text-xs font-bold tabular-nums text-slate-900"
            style={{ background: heatColor(score) }}
            title={`${competency}: ${score.toFixed(1)}`}
          >
            {score.toFixed(1)}
          </div>
        );
      })}
      <div
        className="grid h-10 place-items-center rounded text-xs font-bold tabular-nums text-slate-900"
        style={{ background: heatColor(row.average) }}
      >
        {row.average.toFixed(1)}
      </div>
    </>
  );
}

function InterventionCard({ item }: { item: Intervention }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-xl shadow-lg hover:shadow-violet-500/10 transition-all p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
          <div className="mt-1 text-xs text-slate-500">{item.audience}</div>
        </div>
        <span className={toneChip(item.tone)}>{item.owner}</span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-slate-400 sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 tracking-[0.2em]">Cadence</div>
          <div className="mt-1 font-medium text-slate-200">{item.cadence}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 tracking-[0.2em]">Success metric</div>
          <div className="mt-1 font-medium text-slate-200">{item.metric}</div>
        </div>
      </div>
    </div>
  );
}

function InlineSparkline({
  data,
  tone,
  height = 72,
}: {
  data: number[];
  tone: BarTone;
  height?: number;
}) {
  const width = 520;
  const safeData = data.length ? data : [0];
  const max = Math.max(...safeData);
  const min = Math.min(...safeData);
  const range = max - min || 1;
  const points = safeData
    .map((value, index) => {
      const x = safeData.length === 1 ? 0 : (index / (safeData.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");
  const stroke = tone === "danger" ? "#e11d48" : tone === "warn" ? "#f59e0b" : tone === "success" ? "#10b981" : "#0a0a0a";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded" style={{ background: color }} />
      {label}
    </div>
  );
}

function buildPlacementAnalytics(inst: Institute, cohort: Student[]): PlacementAnalytics {
  const batchRows = inst.batches.map((batch) => {
    const readinessIndex = Math.round((batch.avgTech * 0.4) + (batch.avgBehav * 0.35) + (batch.avgFit * 0.25));
    const { group, year } = splitBatchName(batch.name);
    const tone = scoreTone(readinessIndex);
    return {
      ...batch,
      group,
      year,
      readinessIndex,
      action: placementBatchAction(batch.avgFit, batch.topGap),
      tone,
    };
  });

  const gapCounts = new Map<string, number>();
  inst.batches.forEach((batch) => addGap(gapCounts, batch.topGap, Math.max(2, Math.round(batch.size / 28))));
  cohort.forEach((student) => {
    student.developmentAreas.forEach((gap) => addGap(gapCounts, normalizeGap(gap), 1));
    student.risks.forEach((risk) => addGap(gapCounts, normalizeGap(risk), 1));
  });

  const topGaps = Array.from(gapCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count], index) => ({
      label,
      count,
      tone: index === 0 ? "danger" as BarTone : index < 3 ? "warn" as BarTone : "dark" as BarTone,
    }));

  const heatmapCompetencies = Array.from(new Set(cohort.flatMap((student) => student.dnla.map((score) => score.competency))));
  const heatmapRows = cohort.map((student) => {
    const scores = heatmapCompetencies.map((competency) => ({
      competency,
      score: student.dnla.find((item) => item.competency === competency)?.score || 0,
    }));
    return {
      id: student.id,
      name: student.name,
      context: `${student.branch} - ${student.year}`,
      status: student.status,
      scores,
      average: roundAvg(scores.map((score) => score.score), 1),
    };
  });

  const fallbackGap = topGaps[0]?.label || inst.topGap;
  return {
    readinessPct: pct(inst.interviewReady, inst.cohort),
    interventionLoad: batchRows.filter((batch) => batch.avgFit < 70).length,
    recruitableCount: inst.interviewReady,
    batchRows,
    topGaps: topGaps.length ? topGaps : [{ label: fallbackGap, count: 1, tone: "warn" }],
    interventions: buildPlacementInterventions(topGaps.length ? topGaps.map((gap) => gap.label) : [fallbackGap]),
    heatmapCompetencies,
    heatmapRows,
  };
}

function buildExamAnalytics(inst: Institute, aspirants: ExamAspirant[]): ExamAnalytics {
  const cohort = aspirants.filter((aspirant) => aspirant.institute === inst.name);
  const tracked = cohort.length ? cohort : aspirants;
  const highStressCount = tracked.filter((aspirant) => aspirant.stressIndex >= 65).length;
  const mediumStressCount = tracked.filter((aspirant) => aspirant.stressIndex >= 50 && aspirant.stressIndex < 65).length;
  const lowStressCount = tracked.filter((aspirant) => aspirant.stressIndex < 50).length;
  const atRisk = tracked.filter((aspirant) => aspirant.risks.length > 0 || aspirant.stressIndex >= 60 || aspirant.consistency < 60);
  const weeklyConsistency = averageTrend(tracked.map((aspirant) => aspirant.consistencyTrend));
  const consistencyDelta = trendDelta(weeklyConsistency);

  return {
    onTrackPct: pct(tracked.filter((aspirant) => aspirant.successPotential >= 65 && aspirant.stressIndex < 65).length, tracked.length),
    highStressCount,
    avgStress: roundAvg(tracked.map((aspirant) => aspirant.stressIndex)),
    avgConsistency: roundAvg(tracked.map((aspirant) => aspirant.consistency)),
    consistencyDelta,
    weeklyConsistency,
    stressBuckets: [
      { label: "High stress", count: highStressCount, pct: pct(highStressCount, tracked.length), tone: "danger" },
      { label: "Moderate stress", count: mediumStressCount, pct: pct(mediumStressCount, tracked.length), tone: "warn" },
      { label: "Stable", count: lowStressCount, pct: pct(lowStressCount, tracked.length), tone: "success" },
    ],
    atRisk,
    interventions: buildExamInterventions(atRisk, consistencyDelta),
    progressRows: tracked.map((aspirant) => ({
      id: aspirant.id,
      name: aspirant.name,
      context: `${aspirant.exam} - ${aspirant.attempt}`,
      successPotential: aspirant.successPotential,
      consistency: aspirant.consistency,
      resilience: aspirant.resilience,
      stressIndex: aspirant.stressIndex,
      trendDelta: trendDelta(aspirant.consistencyTrend),
      studyHours: aspirant.studyHoursTrend[aspirant.studyHoursTrend.length - 1] || 0,
      action: examNextAction(aspirant),
    })),
  };
}

function buildPlacementInterventions(gaps: string[]): Intervention[] {
  const selected = gaps.slice(0, 4);
  return selected.map((gap) => {
    const lower = gap.toLowerCase();
    if (lower.includes("assert") || lower.includes("self-advocacy")) {
      return {
        title: "Stakeholder assertiveness lab",
        audience: "Students with low push-back and ownership signals",
        owner: "Career team",
        cadence: "2 labs per week for 3 weeks",
        metric: "+8 behavioural score lift",
        tone: "warn",
      };
    }
    if (lower.includes("communication") || lower.includes("collaborative")) {
      return {
        title: "Interview communication sprint",
        audience: "Groups with unclear articulation or blunt responses",
        owner: "Coach pod",
        cadence: "Weekly drills and recorded mock reviews",
        metric: "70% clear-answer benchmark",
        tone: "danger",
      };
    }
    if (lower.includes("tech") || lower.includes("sql") || lower.includes("analytics")) {
      return {
        title: "Role-specific technical bridge",
        audience: "Candidates below target role depth",
        owner: "Faculty lead",
        cadence: "Two project reviews plus timed drills",
        metric: "+6 technical score lift",
        tone: "dark",
      };
    }
    if (lower.includes("feedback") || lower.includes("defensive")) {
      return {
        title: "Feedback handling simulation",
        audience: "Students flagged for defensive responses",
        owner: "Behaviour coach",
        cadence: "Scenario practice every Friday",
        metric: "Zero critical feedback flags",
        tone: "danger",
      };
    }
    return {
      title: `${gap} improvement track`,
      audience: "Students matching this gap cluster",
      owner: "Placement cell",
      cadence: "Weekly small-group intervention",
      metric: "Move group average above 70",
      tone: "warn",
    };
  });
}

function buildExamInterventions(atRisk: ExamAspirant[], consistencyDelta: number): Intervention[] {
  const highStress = atRisk.filter((aspirant) => aspirant.stressIndex >= 65).length;
  return [
    {
      title: "Counsellor triage block",
      audience: `${highStress} high-stress aspirants`,
      owner: "Counsellor",
      cadence: "48-hour review until stable",
      metric: "Stress index below 60",
      tone: highStress > 0 ? "danger" : "dark",
    },
    {
      title: "Consistency reset plan",
      audience: consistencyDelta < 0 ? "Declining weekly consistency cohort" : "Maintenance cohort",
      owner: "Mentor",
      cadence: "Daily study checkpoint for 14 days",
      metric: "+10 consistency recovery",
      tone: consistencyDelta < 0 ? "warn" : "success",
    },
    {
      title: "Mock performance review",
      audience: "Aspirants below success potential threshold",
      owner: "Faculty",
      cadence: "Weekly mock analysis",
      metric: "Stable attempt strategy",
      tone: "dark",
    },
    {
      title: "Parent or guardian update",
      audience: "Only severe sustained risk cases",
      owner: "Institute admin",
      cadence: "Consent-led escalation",
      metric: "Documented support plan",
      tone: "warn",
    },
  ];
}

function addGap(map: Map<string, number>, label: string, amount: number) {
  const key = label.trim();
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function normalizeGap(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("feedback") || lower.includes("defensive")) return "Feedback handling";
  if (lower.includes("assert") || lower.includes("self-advocacy")) return "Assertiveness";
  if (lower.includes("communication") || lower.includes("collaborative")) return "Communication";
  if (lower.includes("empathy") || lower.includes("team dynamics")) return "Empathy";
  if (lower.includes("technical") || lower.includes("sql") || lower.includes("analytics")) return "Tech depth";
  return label;
}

function splitBatchName(name: string) {
  const [group, year] = name.split(" - ");
  if (year) return { group, year };
  const parts = name.split("\u00b7").map((part) => part.trim());
  return {
    group: parts[0] || name,
    year: parts[1] || "Active cohort",
  };
}

function placementBatchAction(avgFit: number, topGap: string) {
  if (avgFit >= 72) return "Publish top profiles";
  if (avgFit >= 65) return `Mock interviews for ${topGap}`;
  return `Intervention sprint: ${topGap}`;
}

function examNextAction(aspirant: ExamAspirant) {
  if (aspirant.stressIndex >= 65) return "Counsellor triage";
  if (aspirant.consistency < 60) return "Daily consistency reset";
  if (aspirant.successPotential < 65) return "Faculty review";
  return "Maintain cadence";
}

function averageTrend(trends: number[][]) {
  const longest = Math.max(0, ...trends.map((trend) => trend.length));
  return Array.from({ length: longest }).map((_, index) =>
    roundAvg(trends.map((trend) => trend[index]).filter((value): value is number => typeof value === "number"))
  );
}

function trendDelta(data: number[]) {
  if (data.length < 2) return 0;
  return Math.round(data[data.length - 1] - data[0]);
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function roundAvg(values: number[], decimals = 0) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  const factor = 10 ** decimals;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * factor) / factor;
}

function scoreTone(value: number): BarTone {
  if (value >= 72) return "success";
  if (value >= 60) return "warn";
  return "danger";
}

function severityChip(severity: "info" | "warn" | "danger") {
  if (severity === "danger") return "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(225,29,72,0.2)] backdrop-blur-md";
  if (severity === "warn") return "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)] backdrop-blur-md";
  return "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-100/60 text-slate-700 border border-slate-300 backdrop-blur-md shadow-sm";
}

function toneChip(tone: BarTone) {
  if (tone === "danger") return "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(225,29,72,0.2)] backdrop-blur-md";
  if (tone === "warn") return "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)] backdrop-blur-md";
  if (tone === "success") return "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] backdrop-blur-md";
  if (tone === "muted") return "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-100/60 text-slate-700 border border-slate-300 backdrop-blur-md shadow-sm";
  return "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-violet-500/20 text-violet-300 border border-violet-500/30 backdrop-blur-md";
}

function heatColor(score: number) {
  if (score < 4) return "#be123c";
  if (score < 5) return "#b45309";
  return "#047857";
}

function shortCompetency(competency: string) {
  const labels: Record<string, string> = {
    "Self-confidence": "Confidence",
    "Systematic mentality": "Systems",
    "Feedback reaction": "Feedback",
  };
  return labels[competency] || competency;
}

function deltaLabel(delta: number) {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function IconInstitute() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V10l7-5 7 5v11" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.7L20 10l-5 4 1.5 6L12 17l-4.5 3L9 14l-5-4 6.1-1.3z" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function IconHeatmap() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function IconLine() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-8" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600 transition-transform group-hover:translate-x-1">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
