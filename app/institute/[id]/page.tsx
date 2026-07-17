import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { adminAuth, isAdminConfigured } from "@/lib/firebase-admin";
import { AUTH_ENFORCED } from "@/lib/flags";
import { Section } from "@/components/glass";
import { Bar } from "@/components/score-ring";
import { DashboardHeader, KPIGrid, EmptyState, type Kpi } from "@/components/dashboard";
import {
  getInstitute,
  type ExamAspirant,
  type Institute,
  type Student,
} from "@/lib/data";
import { resolveInstituteForView, listCandidatesByInstitute, listExamAspirants, listInterventions, canAdministerInstitute, ensureOwnInstituteForAdmin } from "@/lib/talent-store";
import { InterventionsPanel } from "./InterventionsPanel";
import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from "@/components/motion";
import { MotionDiv } from "./ClientMotion";
import { HeaderActions } from "./HeaderActions";
import { CohortManager, type CohortStudent } from "./CohortManager";
import {
  PageShell,
  Card,
  Button,
  ButtonLink,
  Badge,
  Heading,
  Eyebrow,
  Label,
  Stat,
} from "@/components/ui";

type BarTone = "dark" | "success" | "warn" | "danger" | "muted";
type BadgeTone = "neutral" | "brand" | "success" | "warn" | "danger" | "dark";

type PlacementAnalytics = {
  readinessPct: number;
  interventionLoad: number;
  recruitableCount: number;
  cohortSize: number;
  readyCount: number;
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ track?: string }>;
}) {
  const { id } = await params;
  const { track: trackParam } = await searchParams;
  // `id` may be an institute doc-id (demo) or a logged-in user's uid (enforced
  // mode routes nav to /institute/<uid>). Resolve to the actual institute and use
  // ITS id for every downstream query - otherwise a uid would query empty cohorts.
  let inst = await resolveInstituteForView(id);
  if (!inst) notFound();

  // AUTHORIZATION (enforced mode). This server component renders a whole cohort's
  // PII + fit scores + DNLA. Middleware only checks that SOME credential exists,
  // so without this gate any signed-in user (a candidate, a recruiter, another
  // institute's admin) could open /institute/<any-id> and read that tenant's
  // cohort. Require the caller to admin the resolved institute (exact adminUids).
  if (AUTH_ENFORCED && isAdminConfigured && adminAuth) {
    const token = (await cookies()).get("firebaseIdToken")?.value;
    let callerUid: string | null = null;
    if (token) {
      try {
        callerUid = (await adminAuth.verifyIdToken(token)).uid;
      } catch {
        /* invalid/expired token → unauthenticated */
      }
    }
    let authorized = callerUid ? await canAdministerInstitute(inst.id, callerUid, false) : false;
    // Not an admin of the RESOLVED tenant — typically an unbound institute
    // account whose uid fell back to the seed placement tenant. Land them on
    // their OWN tenant instead of 404ing: the bound one if it exists, else a
    // freshly self-provisioned EMPTY tenant (institute-role accounts only; see
    // ensureOwnInstituteForAdmin). This was the "university login, click
    // placement, thrown out repeatedly" bug.
    if (!authorized && callerUid) {
      const own = await ensureOwnInstituteForAdmin(callerUid);
      if (own) {
        inst = own;
        authorized = true;
      }
    }
    if (!authorized) notFound();
  }
  const instituteId = inst.id;

  const isExam = inst.kind === "exam";
  // Durable data from the talent store (seed today; live candidate results once
  // they complete the interview flow). We load BOTH cohorts for every institute:
  // an institute can run placement AND competitive-exam prep, and the dashboard
  // ALWAYS splits them into two tabs (Placement / Exam) so they're never mixed.
  const candidates = await listCandidatesByInstitute(instituteId);
  // SCOPE to THIS institute — listExamAspirants() returns the whole collection, so
  // rendering/exporting it unfiltered leaked every institute's aspirants (the
  // "Export cohort CSV" cross-tenant PII leak). Match the same key the exam
  // analytics use (institute display name) plus a stored instituteId when present.
  const aspirants = (await listExamAspirants()).filter(
    (a) => a.institute === inst.name || (a as { instituteId?: string }).instituteId === instituteId
  );

  const hasPlacement = candidates.length > 0;
  const hasExam = aspirants.length > 0;
  // Which single track this page shows. The Home dashboard's Placement / Exam
  // cards link here with ?track=…; without it, fall back to the institute's own
  // kind (or whichever side actually has learners). No on-page tab switcher —
  // the Home cards ARE the switch.
  let activeTrack: "placement" | "exam" =
    trackParam === "exam" || trackParam === "placement"
      ? trackParam
      : isExam
        ? "exam"
        : "placement";
  if (activeTrack === "placement" && !hasPlacement && hasExam) activeTrack = "exam";
  if (activeTrack === "exam" && !hasExam && hasPlacement) activeTrack = "placement";

  // Analytics only for a track that has data (the build fns divide by cohort
  // size — an empty cohort shows a guidance empty state instead).
  const placementAnalytics = hasPlacement ? buildPlacementAnalytics(inst, candidates) : null;
  const examAnalytics = hasExam ? buildExamAnalytics(inst, aspirants) : null;
  const interventions = await listInterventions(instituteId);
  // CSV-ready cohort rows for the "Export cohort CSV" action (primary track).
  const cohortRows: Record<string, unknown>[] = isExam
    ? aspirants.map((a) => ({
        Name: a.name, Exam: a.exam, Attempt: a.attempt, "Months preparing": a.monthsPreparing,
        "Success potential": a.successPotential, Motivation: a.motivation, Consistency: a.consistency,
        Resilience: a.resilience, "Stress index": a.stressIndex, Institute: a.institute,
      }))
    : candidates.map((c) => ({
        Name: c.name, College: c.college, Branch: c.branch, Dept: c.dept ?? c.branch, Semester: c.semester ?? "",
        CGPA: c.cgpa, "Target role": c.targetRole, Fit: c.fit.fit, Technical: c.fit.technical,
        Behavioural: c.fit.behavioural, "Success %": c.fit.successProbability, Status: c.status,
      }));

  // Serialisable cohort list for the interactive CohortManager (students list +
  // 20-60-20 distribution + filters + drill-down + upload).
  const cohortStudents: CohortStudent[] = !hasPlacement
    ? []
    : candidates.map((c) => ({
        id: c.id,
        name: c.name,
        branch: c.branch,
        dept: c.dept ?? c.branch,
        year: c.year,
        semester: c.semester ?? null,
        fit: c.fit?.fit ?? 0,
        status: c.status ?? "",
        published: (c as { publishedToRecruiters?: boolean }).publishedToRecruiters ?? false,
        targetRole: c.targetRole ?? "",
      }));

  // ── Track section trees (server-rendered, toggled by the tab island) ──
  const placementSections = placementAnalytics ? (
    <>
      <PlacementKpis inst={inst} analytics={placementAnalytics} />
      <Section className="mt-12">
        <SlideUp delay={0.3} className="mb-5">
          <Eyebrow className="inline-flex items-center gap-2">
            <IconInstitute /> Cohort Management
          </Eyebrow>
          <Heading className="mt-2">Students, distribution & intake</Heading>
          <p className="mt-1 text-sm text-ink-500">
            Complete cohort list with a 20·60·20 performance split, filtering, drill-down, and bulk/manual student upload.
          </p>
        </SlideUp>
        <CohortManager
          instituteId={inst.id}
          students={cohortStudents}
          // campusDrives is static, code-defined reference data - read it from
          // lib/data, NOT the persisted store record (which may predate the field).
          campusDrives={getInstitute(inst.id)?.campusDrives ?? inst.campusDrives ?? []}
        />
      </Section>
      <PlacementDashboard inst={inst} analytics={placementAnalytics} cohort={candidates} />
    </>
  ) : (
    <Section className="mt-4">
      <EmptyState
        icon={<IconInstitute />}
        title="No placement candidates yet"
        description="Invite students or upload a cohort to start tracking placement readiness and share it with recruiters."
      />
    </Section>
  );

  const examSections = examAnalytics ? (
    <>
      <ExamKpis inst={inst} analytics={examAnalytics} />
      <ExamDashboard inst={inst} analytics={examAnalytics} aspirants={aspirants} />
    </>
  ) : (
    <Section className="mt-4">
      <EmptyState
        icon={<IconSparkles />}
        title="No exam aspirants yet"
        description="Once competitive-exam aspirants join this institute and complete their assessment, their success-potential dashboard appears here."
      />
    </Section>
  );

  // Institute-level signals + interventions are shared across both tracks.
  const sharedSections = (
    <>
      <Section className="mt-12">
        <SlideUp delay={0.3} className="mb-5">
          <Eyebrow className="inline-flex items-center gap-2">
            <IconSparkles /> Cohort Signals
          </Eyebrow>
          <Heading className="mt-4 text-gradient-brand">
            Decision Queue
          </Heading>
        </SlideUp>
        {inst.insights?.length ? (
          <StaggerContainer delay={0.4} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {inst.insights.map((insight, index) => (
              <StaggerItem key={insight.label}>
                <MotionDiv whileHover={{ scale: 1.02, y: -5 }} className={`h-full rounded-xl2 border p-5 sm:p-6 transition-all ${
                    insight.severity === "danger"
                      ? "border-rose-200 bg-rose-50"
                      : insight.severity === "warn"
                        ? "border-amber-200 bg-amber-50"
                        : "border-ink-200/70 bg-white shadow-panel"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={severityTone(insight.severity)}>
                      {insight.severity === "danger" ? "Escalate" : insight.severity === "warn" ? "Review" : "Monitor"}
                    </Badge>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-400">Signal {String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <p className="mt-4 text-base font-semibold leading-snug text-ink-900">{insight.label}</p>
                </MotionDiv>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <EmptyState
            icon={<IconSparkles />}
            title="No cohort signals to review"
            description="New signals appear here as assessments are processed."
          />
        )}
      </Section>

      <div id="interventions" className="mt-12 scroll-mt-24 sm:mt-16">
        <InterventionsPanel instituteId={inst.id} isExam={isExam} initial={interventions} />
      </div>
    </>
  );

  return (
    <PageShell>
      {/* Unified compact dashboard header - matches the other three dashboards.
          Institute name is the h1; the "Command Center" descriptor + cohort
          summary live in the smaller description (previously an oversized
          four-line gradient hero). */}
      <FadeIn delay={0.1}>
        <DashboardHeader
          eyebrow={activeTrack === "exam" ? "Institute · Exam" : "Institute · Placement"}
          title={inst.name}
          actions={<HeaderActions isExam={isExam} cohort={placementAnalytics?.cohortSize ?? inst.cohort} instituteId={inst.id} cohortRows={cohortRows} />}
        />
      </FadeIn>

      <div>
        {activeTrack === "exam" ? examSections : placementSections}

        {sharedSections}
      </div>
    </PageShell>
  );
}

function PlacementKpis({
  inst,
  analytics,
}: {
  inst: Institute;
  analytics: PlacementAnalytics;
}) {
  const items: Kpi[] = [
    {
      label: "Batch readiness",
      value: `${analytics.readinessPct}%`,
      hint: `${analytics.readyCount}/${analytics.cohortSize} interview-ready · fit 70+`,
      tone: analytics.readinessPct >= 70 ? "success" : analytics.readinessPct >= 50 ? "warn" : "danger",
      icon: <IconTarget />,
    },
    {
      label: "Average Fit Score",
      value: `${inst.avgFit}`,
      trend: "+3 vs last cycle",
      tone: "brand",
      icon: <IconSparkles />,
    },
    {
      label: "Intervention load",
      value: `${analytics.interventionLoad}`,
      hint: "Groups below readiness threshold",
      tone: "warn",
      icon: <IconCalendar />,
    },
    {
      label: "Recruiter-visible pool",
      value: `${analytics.recruitableCount}`,
      hint: "Eligible for shared access",
      tone: "neutral",
      icon: <IconUsers />,
    },
  ];
  return (
    <SlideUp delay={0.2}>
      <KPIGrid items={items} />
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
  const items: Kpi[] = [
    {
      label: "On track",
      value: `${analytics.onTrackPct}%`,
      hint: `Avg success potential ${inst.avgFit}`,
      tone: analytics.onTrackPct >= 70 ? "success" : analytics.onTrackPct >= 50 ? "warn" : "danger",
      icon: <IconTarget />,
    },
    {
      label: "High-stress cases",
      value: `${analytics.highStressCount}`,
      hint: "Require counsellor review",
      tone: "danger",
      icon: <IconShield />,
    },
    {
      label: "Avg consistency",
      value: `${analytics.avgConsistency}%`,
      trend: deltaLabel(analytics.consistencyDelta),
      tone: analytics.consistencyDelta < 0 ? "warn" : "neutral",
      icon: <IconLine />,
    },
    {
      label: "Avg stress index",
      value: `${analytics.avgStress}`,
      hint: "Lower is better",
      tone: analytics.avgStress > 60 ? "danger" : "neutral",
      icon: <IconHeatmap />,
    },
  ];
  return (
    <SlideUp delay={0.2}>
      <KPIGrid items={items} />
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
            <Eyebrow className="inline-flex items-center gap-2">
              <IconGrid /> Department, Year, Group Analytics
            </Eyebrow>
            <Heading className="mt-4 text-gradient-brand">
              Batch Readiness
            </Heading>
          </div>
          <Badge tone="neutral" className="uppercase tracking-widest">Placement track only</Badge>
        </SlideUp>
        <SlideUp delay={0.5}>
          {analytics.batchRows?.length ? (
            <>
              {/* Below md: stacked cards (the 12-col grid is unreadable on phones) */}
              <div className="space-y-3 md:hidden">
                {analytics.batchRows.map((batch) => (
                  <Card key={batch.name} variant="frosted" className="rounded-xl2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink-900">{batch.group}</div>
                        <div className="text-[11px] text-ink-500">{batch.year} - top gap: {batch.topGap}</div>
                      </div>
                      <Badge tone={toneBadge(batch.tone)}>{batch.readinessIndex}%</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-500">Technical</div>
                        <Bar value={batch.avgTech} tone={scoreTone(batch.avgTech)} showVal />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-500">Behavioural</div>
                        <Bar value={batch.avgBehav} tone={scoreTone(batch.avgBehav)} showVal />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-600">
                      <span>Size {batch.size} · Fit <span className="font-black text-ink-900">{batch.avgFit}</span></span>
                      <span className="font-medium">{batch.action}</span>
                    </div>
                  </Card>
                ))}
              </div>
              {/* md+: full table, scrolls horizontally inside the card */}
              <Card variant="frosted" hover className="hidden overflow-x-auto rounded-xl3 md:block">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-12 border-b border-ink-200 px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-ink-500">
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
                      className="grid grid-cols-12 items-center border-b border-ink-200 px-5 py-4 text-sm transition-colors last:border-0 hover:bg-ink-50/60"
                    >
                      <div className="col-span-3 min-w-0">
                        <div className="truncate font-semibold text-ink-900">{batch.group}</div>
                        <div className="text-[11px] text-ink-500">{batch.year} - top gap: {batch.topGap}</div>
                      </div>
                      <div className="col-span-1 text-right tabular-nums text-ink-700">{batch.size}</div>
                      <div className="col-span-2"><Bar value={batch.avgTech} tone={scoreTone(batch.avgTech)} showVal /></div>
                      <div className="col-span-2"><Bar value={batch.avgBehav} tone={scoreTone(batch.avgBehav)} showVal /></div>
                      <div className="col-span-1 text-right text-2xl font-black tracking-tight text-ink-900 ">{batch.avgFit}</div>
                      <div className="col-span-1 text-right"><Badge tone={toneBadge(batch.tone)}>{batch.readinessIndex}%</Badge></div>
                      <div className="col-span-2 text-right text-xs font-medium text-ink-600">{batch.action}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <EmptyState
              icon={<IconGrid />}
              title="No batches configured"
              description="Batch readiness appears here once cohort batches are set up."
            />
          )}
        </SlideUp>
      </Section>

      <Section className="mt-12">
        <SlideUp delay={0.5} className="mb-5">
          <Eyebrow className="inline-flex items-center gap-2">
            <IconHeatmap /> Competency Heatmap
          </Eyebrow>
          <Heading className="mt-4 text-gradient-brand">
            Student-Level Competency Signals
          </Heading>
          <p className="mt-2 max-w-2xl text-sm text-ink-500">
            Deterministic heatmap from existing assessment records. Low cells become the coaching backlog.
          </p>
        </SlideUp>
        <SlideUp delay={0.6}>
          {analytics.heatmapRows?.length && analytics.heatmapCompetencies?.length ? (
            <>
              {/* Below md: one card per student with competency chips (the wide grid
                  is impossible to read on a phone) */}
              <div className="space-y-3 md:hidden">
                {analytics.heatmapRows.map((row) => (
                  <Card key={row.id} variant="frosted" className="rounded-xl2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink-900">{row.name}</div>
                        <div className="truncate text-[11px] text-ink-500">{row.context}</div>
                      </div>
                      <span
                        className="grid h-8 min-w-[2.5rem] place-items-center rounded px-2 text-xs font-bold tabular-nums text-white"
                        style={{ background: heatColor(row.average) }}
                      >
                        {row.average.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      {analytics.heatmapCompetencies.map((competency) => {
                        const score = row.scores.find((item) => item.competency === competency)?.score || 0;
                        return (
                          <div
                            key={competency}
                            className="flex items-center justify-between gap-2 rounded px-2 py-1 text-[11px]"
                            style={{ background: heatColor(score) }}
                            title={`${competency}: ${score.toFixed(1)}`}
                          >
                            <span className="truncate text-white/90">{shortCompetency(competency)}</span>
                            <span className="font-bold tabular-nums text-white">{score.toFixed(1)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
                <div className="flex flex-wrap items-center gap-4 text-xs text-ink-500">
                  <Legend color="#be123c" label="Needs intervention" />
                  <Legend color="#b45309" label="Developing" />
                  <Legend color="#047857" label="Ready range" />
                </div>
              </div>
              {/* md+: full heatmap, scrolls horizontally inside the card */}
              <Card variant="frosted" hover className="hidden overflow-x-auto rounded-xl3 p-5 sm:p-6 md:block">
                <div className="min-w-[1080px]">
                  <div
                    role="img"
                    aria-label={`Competency heatmap across ${analytics.heatmapCompetencies.length} competencies for ${analytics.heatmapRows.length} students; darker red cells indicate competencies needing intervention.`}
                    className="grid gap-1 text-[10px] uppercase tracking-wider text-ink-500"
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
                  <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-ink-500">
                    <Legend color="#be123c" label="Needs intervention" />
                    <Legend color="#b45309" label="Developing" />
                    <Legend color="#047857" label="Ready range" />
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <EmptyState
              icon={<IconHeatmap />}
              title="No assessment records yet"
              description="The competency heatmap builds from student assessment records as they complete."
            />
          )}
        </SlideUp>
      </Section>

      <Section className="mt-12">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SlideUp delay={0.6} className="lg:col-span-1">
            <Card variant="frosted" hover className="rounded-xl3 p-5 sm:p-6">
              <Eyebrow className="inline-flex items-center gap-2">
                <IconTarget /> Top Gaps
              </Eyebrow>
              <Heading as="h3" className="mt-4 text-lg sm:text-xl">Priority Backlog</Heading>
              <div className="mt-5 space-y-4">
                {analytics.topGaps.map((gap, index) => (
                  <div key={gap.label}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink-900">{gap.label}</div>
                        <div className="text-[11px] text-ink-500">Priority weight {gap.count}</div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-400">0{index + 1}</span>
                    </div>
                    <Bar value={gap.count} max={analytics.topGaps[0]?.count || 1} tone={gap.tone} />
                  </div>
                ))}
              </div>
            </Card>
          </SlideUp>

          <SlideUp delay={0.7} className="lg:col-span-2">
            <Card variant="frosted" hover className="rounded-xl3 p-5 sm:p-6">
              <Eyebrow className="inline-flex items-center gap-2">
                <IconCalendar /> Intervention Recommendations
              </Eyebrow>
              <Heading as="h3" className="mt-4 text-lg sm:text-xl">
                Operating Plan
              </Heading>
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                {analytics.interventions?.length ? (
                  analytics.interventions.map((item) => (
                    <InterventionCard key={item.title} item={item} />
                  ))
                ) : (
                  <Card variant="flat" className="p-4 text-sm text-ink-500 md:col-span-2">
                    No interventions recommended right now.
                  </Card>
                )}
              </div>
            </Card>
          </SlideUp>
        </div>
      </Section>

      <Section className="mt-12">
        <SlideUp delay={0.8} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card variant="frosted" hover className="rounded-xl3 p-5 sm:p-6 lg:col-span-1">
            <Eyebrow className="inline-flex items-center gap-2">
              <IconLink /> Recruiter Shared Link
            </Eyebrow>
            <Heading as="h3" className="mt-4 text-lg sm:text-xl">
              Scoped Employer Access
            </Heading>
            <p className="mt-3 text-sm leading-6 text-ink-500">
              Share only consented candidate profiles, Fit Scores, interview summaries, and publish status with approved recruiters - via a scoped, expiring link.
            </p>
            <div className="mt-5 rounded-xl border border-dashed border-ink-200 bg-ink-50/60 p-4 text-xs font-medium text-ink-600">
              Use <b>“Generate recruiter link”</b> in the header to mint a tokenised,
              account-gated link to this cohort. The recruiter opens it at
              <span className="text-ink-800"> /recruiter/shared/&lt;token&gt;</span> - no
              other institute’s candidates are ever exposed.
            </div>
          </Card>

          <Card variant="frosted" hover className="rounded-xl3 p-2 sm:p-3 lg:col-span-2">
            <div className="px-3 pb-2 pt-3 sm:px-4">
              <Eyebrow className="inline-flex items-center gap-2">
                <IconUsers /> Cohort Roster
              </Eyebrow>
            </div>
            <div className="space-y-1">
              {cohort?.length ? (
                cohort.map((student) => (
                  <Link
                    key={student.id}
                    href={`/student/${student.id}`}
                    className="group relative flex overflow-hidden items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-ink-50/60 sm:px-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-900 text-white text-xs font-semibold transition-transform group-hover:scale-105">
                        {student.avatar}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink-900 transition-colors group-hover:text-brand-700">{student.name}</div>
                        <div className="truncate text-[11px] text-ink-500">{student.branch} - {student.year}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                      <span className="hidden text-xs text-ink-500 sm:inline">Fit {student.fit.fit}</span>
                      <Badge tone={student.status === "Interview-ready" || student.status === "Published" ? "success" : "warn"}>
                        {student.status}
                      </Badge>
                      <IconChevron />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="px-3 py-6 text-sm text-ink-500 sm:px-4">
                  No students in this cohort yet.
                </div>
              )}
            </div>
          </Card>
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
            <Eyebrow className="inline-flex items-center gap-2">
              <IconShield /> Stress And Consistency
            </Eyebrow>
            <Heading className="mt-4 text-gradient-brand">
              Exam Cohort Health
            </Heading>
          </div>
          <Badge tone="neutral" className="uppercase tracking-widest">Candidate and institute visibility</Badge>
        </SlideUp>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SlideUp delay={0.5}>
            <Card variant="frosted" hover className="rounded-xl3 p-5 sm:p-6">
              <Label className="block">Stress distribution</Label>
              <div className="mt-5 space-y-4">
                {analytics.stressBuckets?.length ? (
                  analytics.stressBuckets.map((bucket) => (
                    <div key={bucket.label}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-ink-900">{bucket.label}</span>
                        <Badge tone={toneBadge(bucket.tone)}>{bucket.count} cases</Badge>
                      </div>
                      <Bar value={bucket.pct} tone={bucket.tone} />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink-500">No stress data available yet.</p>
                )}
              </div>
            </Card>
          </SlideUp>

          <SlideUp delay={0.6} className="lg:col-span-2">
            <Card variant="frosted" hover className="rounded-xl3 p-5 sm:p-6">
              <Label className="block">Consistency trend</Label>
              <div className="mt-4">
                <InlineSparkline data={analytics.weeklyConsistency} tone={analytics.consistencyDelta < 0 ? "warn" : "success"} height={96} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MiniStat label="Current average" value={`${analytics.avgConsistency}%`} />
                <MiniStat label="12-week movement" value={deltaLabel(analytics.consistencyDelta)} tone={analytics.consistencyDelta < 0 ? "warn" : "success"} />
                <MiniStat label="Tracked profiles" value={`${aspirants.length}`} />
              </div>
            </Card>
          </SlideUp>
        </div>
      </Section>

      <Section className="mt-12">
        <SlideUp delay={0.5} className="mb-5">
          <Eyebrow className="inline-flex items-center gap-2">
            <IconGrid /> Batch Analytics
          </Eyebrow>
          <Heading className="mt-4 text-gradient-brand">
            Exam Group Performance
          </Heading>
        </SlideUp>
        <SlideUp delay={0.6}>
          {inst.batches?.length ? (
            <>
              {/* Below md: stacked cards */}
              <div className="space-y-3 md:hidden">
                {inst.batches.map((batch) => (
                  <Card key={batch.name} variant="frosted" className="rounded-xl2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 font-semibold text-ink-900">{batch.name}</div>
                      <span className="text-2xl font-black tracking-tight text-ink-900">{batch.avgFit}</span>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-500">Resilience / Behaviour</div>
                      <Bar value={batch.avgBehav} tone={scoreTone(batch.avgBehav)} showVal />
                    </div>
                    <div className="mt-3 text-xs text-ink-600">Size {batch.size} · Top gap: {batch.topGap}</div>
                  </Card>
                ))}
              </div>
              {/* md+: full table, scrolls horizontally inside the card */}
              <Card variant="frosted" hover className="hidden overflow-x-auto rounded-xl3 md:block">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-12 border-b border-ink-200 px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-ink-500">
                    <div className="col-span-4">Group</div>
                    <div className="col-span-1 text-right">Size</div>
                    <div className="col-span-3">Resilience / Behaviour</div>
                    <div className="col-span-2 text-right">Potential</div>
                    <div className="col-span-2 text-right">Top gap</div>
                  </div>
                  {inst.batches.map((batch) => (
                    <div
                      key={batch.name}
                      className="grid grid-cols-12 items-center border-b border-ink-200 px-5 py-4 text-sm transition-colors last:border-0 hover:bg-ink-50/60"
                    >
                      <div className="col-span-4 font-semibold text-ink-900">{batch.name}</div>
                      <div className="col-span-1 text-right tabular-nums text-ink-700">{batch.size}</div>
                      <div className="col-span-3"><Bar value={batch.avgBehav} tone={scoreTone(batch.avgBehav)} showVal /></div>
                      <div className="col-span-2 text-right text-2xl font-black tracking-tight text-ink-900 ">{batch.avgFit}</div>
                      <div className="col-span-2 text-right text-xs text-ink-600">{batch.topGap}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <EmptyState
              icon={<IconGrid />}
              title="No exam batches configured"
              description="Group performance appears here once exam batches are set up."
            />
          )}
        </SlideUp>
      </Section>

      <Section className="mt-12">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SlideUp delay={0.6}>
            <Card variant="frosted" hover className="rounded-xl3 p-5 sm:p-6">
              <Eyebrow className="inline-flex items-center gap-2">
                <IconUsers /> At-Risk Students
              </Eyebrow>
              <Heading as="h3" className="mt-4 text-lg sm:text-xl">
                Counsellor Queue
              </Heading>
              <div className="mt-5 space-y-2">
                {analytics.atRisk?.length ? (
                  analytics.atRisk.map((aspirant) => (
                    <Link
                      key={aspirant.id}
                      href={`/exam/${aspirant.id}`}
                      className="group relative flex overflow-hidden items-center justify-between gap-3 rounded-xl border border-ink-200 p-3 transition hover:bg-ink-50/60"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-900 text-white text-xs font-semibold">
                          {aspirant.avatar}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink-900">{aspirant.name}</div>
                          <div className="truncate text-[11px] text-ink-500">{aspirant.exam} - stress {aspirant.stressIndex}</div>
                        </div>
                      </div>
                      <Badge tone={aspirant.stressIndex >= 65 ? "danger" : "warn"}>{aspirant.risks.length || 1} flags</Badge>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-ink-700">
                    No active high-risk student records.
                  </div>
                )}
              </div>
            </Card>
          </SlideUp>

          <SlideUp delay={0.7} className="lg:col-span-2">
            <Card variant="frosted" hover className="rounded-xl3 p-5 sm:p-6">
              <Eyebrow className="inline-flex items-center gap-2">
                <IconCalendar /> Intervention Planning
              </Eyebrow>
              <Heading as="h3" className="mt-4 text-lg sm:text-xl">
                Action Plan
              </Heading>
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                {analytics.interventions?.length ? (
                  analytics.interventions.map((item) => (
                    <InterventionCard key={item.title} item={item} />
                  ))
                ) : (
                  <Card variant="flat" className="p-4 text-sm text-ink-500 md:col-span-2">
                    No interventions planned right now.
                  </Card>
                )}
              </div>
            </Card>
          </SlideUp>
        </div>
      </Section>

      <Section className="mt-12">
        <SlideUp delay={0.8} className="mb-5">
          <Eyebrow className="inline-flex items-center gap-2">
            <IconLine /> Progress Tracking
          </Eyebrow>
          <Heading className="mt-4 text-gradient-brand">
            Aspirant Trajectories
          </Heading>
        </SlideUp>
        <SlideUp delay={0.9}>
          {analytics.progressRows?.length ? (
            <>
              {/* Below md: stacked cards */}
              <div className="space-y-3 md:hidden">
                {analytics.progressRows.map((row) => (
                  <Card key={row.id} variant="frosted" className="rounded-xl2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink-900">{row.name}</div>
                        <div className="truncate text-[11px] text-ink-500">{row.context}</div>
                      </div>
                      <span className="text-2xl font-black tracking-tight text-ink-900">{row.successPotential}</span>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-500">Consistency</div>
                      <Bar value={row.consistency} tone={scoreTone(row.consistency)} showVal />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone={row.stressIndex >= 65 ? "danger" : row.stressIndex >= 50 ? "warn" : "success"}>Stress {row.stressIndex}</Badge>
                      <Badge tone={row.trendDelta < 0 ? "warn" : "success"}>{deltaLabel(row.trendDelta)} · 12wk</Badge>
                      <span className="text-xs tabular-nums text-ink-700">{row.studyHours}h</span>
                    </div>
                    <div className="mt-2 text-xs font-medium text-ink-600">{row.action}</div>
                  </Card>
                ))}
              </div>
              {/* md+: full table, scrolls horizontally inside the card */}
              <Card variant="frosted" hover className="hidden overflow-x-auto rounded-xl3 md:block">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-12 border-b border-ink-200 px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-ink-500">
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
                      className="grid grid-cols-12 items-center border-b border-ink-200 px-5 py-4 text-sm transition-colors last:border-0 hover:bg-ink-50/60"
                    >
                      <div className="col-span-3 min-w-0">
                        <div className="truncate font-semibold text-ink-900">{row.name}</div>
                        <div className="truncate text-[11px] text-ink-500">{row.context}</div>
                      </div>
                      <div className="col-span-1 text-right text-2xl font-black tracking-tight text-ink-900 ">{row.successPotential}</div>
                      <div className="col-span-2"><Bar value={row.consistency} tone={scoreTone(row.consistency)} showVal /></div>
                      <div className="col-span-1 text-right"><Badge tone={row.stressIndex >= 65 ? "danger" : row.stressIndex >= 50 ? "warn" : "success"}>{row.stressIndex}</Badge></div>
                      <div className="col-span-2 text-right"><Badge tone={row.trendDelta < 0 ? "warn" : "success"}>{deltaLabel(row.trendDelta)}</Badge></div>
                      <div className="col-span-1 text-right tabular-nums text-ink-700">{row.studyHours}h</div>
                      <div className="col-span-2 text-right text-xs font-medium text-ink-600">{row.action}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <EmptyState
              icon={<IconLine />}
              title="No aspirant trajectories yet"
              description="Progress tracking appears here as aspirants complete assessments."
            />
          )}
        </SlideUp>
      </Section>
    </>
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
    <Card variant="flat" hover className="p-5">
      <Stat
        label={label}
        value={value}
        tone={tone === "success" ? "success" : tone === "warn" ? "warn" : "neutral"}
      />
    </Card>
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
        <div className="truncate text-xs font-semibold normal-case tracking-normal text-ink-900">{row.name}</div>
        <div className="truncate text-[10px] normal-case tracking-normal text-ink-500">{row.context}</div>
      </div>
      {competencies.map((competency) => {
        const score = row.scores.find((item) => item.competency === competency)?.score || 0;
        return (
          <div
            key={`${row.id}-${competency}`}
            className="grid h-10 place-items-center rounded text-xs font-bold tabular-nums text-white"
            style={{ background: heatColor(score) }}
            title={`${competency}: ${score.toFixed(1)}`}
          >
            {score.toFixed(1)}
          </div>
        );
      })}
      <div
        className="grid h-10 place-items-center rounded text-xs font-bold tabular-nums text-white"
        style={{ background: heatColor(row.average) }}
      >
        {row.average.toFixed(1)}
      </div>
    </>
  );
}

function InterventionCard({ item }: { item: Intervention }) {
  return (
    <Card variant="default" hover className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900">{item.title}</div>
          <div className="mt-1 text-xs text-ink-500">{item.audience}</div>
        </div>
        <Badge tone={toneBadge(item.tone)}>{item.owner}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-ink-500 sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">Cadence</div>
          <div className="mt-1 font-medium text-ink-700">{item.cadence}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">Success metric</div>
          <div className="mt-1 font-medium text-ink-700">{item.metric}</div>
        </div>
      </div>
    </Card>
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
  const first = safeData[0];
  const last = safeData[safeData.length - 1];
  const direction = last > first ? "rising" : last < first ? "declining" : "flat";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-24 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Weekly consistency sparkline, ${direction} from ${first} to ${last} over ${safeData.length} weeks.`}
    >
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
    // NULL-SAFE: a freshly-upserted candidate (e.g. mid-assessment) may not yet
    // have these arrays - never let one incomplete record crash the dashboard.
    (student.developmentAreas ?? []).forEach((gap) => addGap(gapCounts, normalizeGap(gap), 1));
    (student.risks ?? []).forEach((risk) => addGap(gapCounts, normalizeGap(risk), 1));
  });

  const topGaps = Array.from(gapCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count], index) => ({
      label,
      count,
      tone: index === 0 ? "danger" as BarTone : index < 3 ? "warn" as BarTone : "dark" as BarTone,
    }));

  const heatmapCompetencies = Array.from(new Set(cohort.flatMap((student) => (student.dnla ?? []).map((score) => score.competency))));
  const heatmapRows = cohort.map((student) => {
    const scores = heatmapCompetencies.map((competency) => ({
      competency,
      score: (student.dnla ?? []).find((item) => item.competency === competency)?.score || 0,
    }));
    return {
      id: student.id,
      name: student.name,
      context: `${student.branch ?? "-"} - ${student.year ?? "-"}`,
      status: student.status,
      scores,
      average: roundAvg(scores.map((score) => score.score), 1),
    };
  });

  const fallbackGap = topGaps[0]?.label || inst.topGap;
  // Derive readiness from the SAME cohort array the heatmap/roster render, so the
  // KPI strip reconciles with the lists below it (previously the KPIs used the
  // hardcoded inst.cohort/interviewReady, e.g. 168/320, while the lists showed 40).
  const cohortSize = cohort.length;
  const readyCount = cohort.filter(
    (s) => s.status === "Interview-ready" || s.status === "Published"
  ).length;
  return {
    readinessPct: cohortSize ? pct(readyCount, cohortSize) : 0,
    interventionLoad: batchRows.filter((batch) => batch.avgFit < 70).length,
    // "Recruiter-visible" must mean actually consented/published - not merely
    // interview-ready (the two are different; a ready student may not have opted in).
    recruitableCount: cohort.filter((s) => (s as { publishedToRecruiters?: boolean }).publishedToRecruiters).length,
    cohortSize,
    readyCount,
    batchRows,
    topGaps: topGaps.length ? topGaps : [{ label: fallbackGap, count: 1, tone: "warn" }],
    interventions: buildPlacementInterventions(topGaps.length ? topGaps.map((gap) => gap.label) : [fallbackGap]),
    heatmapCompetencies,
    heatmapRows,
  };
}

function buildExamAnalytics(inst: Institute, aspirants: ExamAspirant[]): ExamAnalytics {
  const DEMO = process.env.NEXT_PUBLIC_AUTH_ENFORCED !== "true";
  const cohort = aspirants.filter((aspirant) => aspirant.institute === inst.name);
  // The whole-seed fallback fabricates a cohort (no seed aspirant matches any
  // institute name), so only borrow it in DEMO. In enforced mode an unmatched
  // tenant gets an empty `tracked` and renders the clean empty states below.
  const tracked = cohort.length ? cohort : (DEMO ? aspirants : []);
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
  const parts = name.split("·").map((part) => part.trim());
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

function severityTone(severity: "info" | "warn" | "danger"): BadgeTone {
  if (severity === "danger") return "danger";
  if (severity === "warn") return "warn";
  return "neutral";
}

function toneBadge(tone: BarTone): BadgeTone {
  if (tone === "danger") return "danger";
  if (tone === "warn") return "warn";
  if (tone === "success") return "success";
  if (tone === "muted") return "neutral";
  return "brand";
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
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V10l7-5 7 5v11" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.7L20 10l-5 4 1.5 6L12 17l-4.5 3L9 14l-5-4 6.1-1.3z" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function IconHeatmap() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function IconLine() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-8" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-400 transition-transform group-hover:translate-x-1">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
