"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { type DnlaScore, type Student } from "@/lib/data";
import {
  PageShell,
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  ButtonLink,
  Badge,
  Stat,
  Heading,
  Eyebrow,
  Label,
  Breadcrumbs,
} from "@/components/ui";
import { Bar } from "@/components/score-ring";
import { cn } from "@/lib/utils";
import { useDnlaLive, type DnlaLive } from "@/hooks/useDnlaLive";

type Tone = "neutral" | "brand" | "success" | "warn" | "danger";

/** Score (1-7) → semantic tone. >=6 success, 4-5 brand, <4 amber/rose. */
function scoreTone(score: number): Tone {
  if (score >= 6) return "success";
  if (score >= 4) return "brand";
  if (score >= 3) return "warn";
  return "danger";
}

const barTone: Record<Tone, "success" | "dark" | "warn" | "danger" | "muted"> = {
  success: "success",
  brand: "dark",
  neutral: "muted",
  warn: "warn",
  danger: "danger",
};

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Radar (spider) chart of competency scores vs benchmark on a 1-7 scale. */
function CompetencyRadar({ items }: { items: DnlaScore[] }) {
  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 56;
  const maxScore = 7;
  const n = items.length;
  if (n < 3) return null;

  const point = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (Math.max(0, Math.min(maxScore, value)) / maxScore) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const toPath = (accessor: (d: DnlaScore) => number) =>
    items.map((d, i) => point(i, accessor(d)).join(",")).join(" ");

  const rings = [2, 4, 6, 7];
  const ariaLabel = `Radar chart of ${n} DNLA competencies on a 1 to 7 scale. ${items
    .map((d) => `${d.competency} ${d.score} versus benchmark ${d.benchmark}`)
    .join("; ")}.`;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto w-full max-w-[420px]"
      role="img"
      aria-label={ariaLabel}
    >
      {/* grid rings */}
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={Array.from({ length: n }, (_, i) =>
            point(i, ring).join(",")
          ).join(" ")}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      ))}
      {/* spokes + labels */}
      {items.map((d, i) => {
        const [x, y] = point(i, maxScore);
        const [lx, ly] = point(i, maxScore + 1.15);
        const anchor =
          Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
        return (
          <g key={d.competency}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#eef2f7" strokeWidth={1} />
            <text
              x={lx}
              y={ly}
              textAnchor={anchor as "start" | "middle" | "end"}
              dominantBaseline="middle"
              className="fill-ink-500"
              style={{ fontSize: 9.5, fontWeight: 600 }}
            >
              {d.competency}
            </text>
          </g>
        );
      })}
      {/* benchmark polygon */}
      <polygon
        points={toPath((d) => d.benchmark)}
        fill="none"
        stroke="#a5b4fc"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      {/* score polygon */}
      <polygon
        points={toPath((d) => d.score)}
        fill="rgba(79,70,229,0.16)"
        stroke="#4f46e5"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {items.map((d, i) => {
        const [x, y] = point(i, d.score);
        return <circle key={d.competency} cx={x} cy={y} r={3.2} fill="#4f46e5" />;
      })}
    </svg>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Live DNLA control: starts the partner questionnaire, deep-links the candidate
 * to it, and reflects the pending/error/not-configured state. Hidden entirely
 * once results are in (`complete`) or while the first status poll is loading.
 */
function DnlaLivePanel({
  live,
  onStart,
  onOpen,
}: {
  live: DnlaLive;
  onStart: () => void;
  onOpen: () => void;
}) {
  const { phase, error, starting, startUrl } = live;
  if (phase === "loading" || phase === "complete") return null;

  if (phase === "pending") {
    return (
      <Card className="mb-6 border-brand-200/70 bg-brand-50/40">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span aria-hidden className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <Heading as="h2" className="text-lg sm:text-xl">Assessment in progress</Heading>
              <p className="mt-1 max-w-xl text-sm leading-6 text-ink-600">
                Complete the DNLA questionnaire in the tab that opened. Your results
                appear here automatically once you finish - no need to refresh.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {startUrl && (
              <Button variant="ghost" size="sm" onClick={onOpen}>
                Open questionnaire
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => void live.refresh()}>
              Check now
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card className="mb-6 border-rose-200 bg-rose-50/50">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Eyebrow className="text-rose-600">Assessment error</Eyebrow>
            <Heading as="h2" className="mt-1 text-lg sm:text-xl">Could not start DNLA</Heading>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-600">
              {error || "Something went wrong. Please try again."}
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={onStart} disabled={starting}>
            {starting ? "Starting…" : "Try again"}
          </Button>
        </CardHeader>
      </Card>
    );
  }

  // "none" or "not-configured": offer to start (not-configured is surfaced after
  // a click, so we still show the CTA and the provider-pending note below).
  return (
    <Card className="mb-6 border-brand-200/70 bg-brand-50/40">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Eyebrow className="text-brand-500">DNLA behavioural assessment</Eyebrow>
          <Heading as="h2" className="mt-1 text-lg sm:text-xl">
            {phase === "not-configured" ? "Assessment not available yet" : "Start your DNLA assessment"}
          </Heading>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-600">
            {phase === "not-configured"
              ? "The DNLA provider isn't configured on this deployment yet. Sample scores are shown below in the meantime."
              : "DNLA is a licensed psychometric assessment (Germany). Starting opens the questionnaire in a new tab; your competency profile is scored and shown here when you finish."}
          </p>
        </div>
        {phase !== "not-configured" && (
          <Button
            variant="primary"
            size="lg"
            className="w-full shrink-0 sm:w-auto"
            onClick={onStart}
            disabled={starting}
          >
            {starting ? "Starting…" : "Start assessment"}
          </Button>
        )}
      </CardHeader>
    </Card>
  );
}

export default function DnlaClient({ student }: { student: Student }) {
  const params = useParams();
  const pathname = usePathname();
  const id = String(params.id);
  const s = student;
  const live = useDnlaLive(id);

  // Shared by both tracks; keep navigation within the current namespace
  // (/exam for competitive-exam aspirants, /student for placement candidates).
  const flowBase = pathname && pathname.startsWith("/exam") ? "/exam" : "/student";

  // ── Assessment-journey progress ──────────────────────────────────────────
  // Derived from the artifacts each stage persists to localStorage. Computed in
  // an effect (client-only) so server render + hydration stay consistent.
  const [journey, setJourney] = useState({
    resume: false,
    ai: false,
    dnla: false,
    final: false,
    reports: false,
  });
  useEffect(() => {
    const hasAnswers = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const msgs = JSON.parse(raw) as { role: string }[];
        return Array.isArray(msgs) && msgs.some((m) => m.role === "user");
      } catch {
        return false;
      }
    };
    let resumeDone = false;
    try {
      const stored =
        localStorage.getItem("taledge:workspace-profile") ||
        localStorage.getItem("taledge:demo-profile");
      const p = JSON.parse(stored || "{}");
      resumeDone = !!(
        p.resumeSummary ||
        (Array.isArray(p.resumeSkills) && p.resumeSkills.length) ||
        (Array.isArray(p.resumeProjects) && p.resumeProjects.length)
      );
    } catch {
      /* no profile yet */
    }
    const reportsDone =
      !!localStorage.getItem(`taledge:report:${id}:ai`) &&
      !!localStorage.getItem(`taledge:report:${id}:dnla`);
    setJourney({
      resume: resumeDone,
      ai: hasAnswers(`taledge:interview:${id}:technical`),
      dnla: hasAnswers(`taledge:interview:${id}:dnla`),
      final: hasAnswers(`taledge:interview:${id}:final`),
      reports: reportsDone,
    });
  }, [id]);

  // The six-stage flow shown as a guided stepper at the top of this page.
  const stages = [
    {
      key: "resume",
      title: "Resume analysis",
      desc: "Upload your résumé - it's parsed for skills, projects and target role and used to tailor every later stage.",
      href: "/onboarding",
      cta: journey.resume ? "Re-upload résumé" : "Upload résumé",
      done: journey.resume,
    },
    {
      key: "ai",
      title: "AI interview",
      desc: "Adaptive, proctored AI interview grounded in your résumé and target role.",
      href: `${flowBase}/${id}/interview/technical`,
      cta: journey.ai ? "Retake AI interview" : "Start AI interview",
      done: journey.ai,
    },
    {
      key: "dnla",
      title: "DNLA behavioural interview",
      desc: "A behavioural round targeting your DNLA competency axes - achievement drive, interpersonal skills, execution and resilience under pressure.",
      href: `${flowBase}/${id}/interview/dnla`,
      cta: journey.dnla ? "Retake DNLA interview" : "Start DNLA interview",
      done: journey.dnla,
    },
    {
      key: "final",
      title: "Combined final interview",
      desc: "A final round that builds on your AI interview.",
      href: `${flowBase}/${id}/interview/final`,
      cta: journey.final ? "Retake final interview" : "Start final interview",
      done: journey.final,
    },
    {
      key: "reports",
      title: "Interview report",
      desc: "A standalone, evidence-grounded report for your AI interview.",
      href: `${flowBase}/${id}/report/ai`,
      cta: "View AI interview report",
      done: journey.reports,
    },
    {
      key: "comparison",
      title: "Comparison report",
      desc: "Side-by-side diff of both interviews with cross-round consistency checks.",
      href: `${flowBase}/${id}/comparison`,
      cta: "View comparison report",
      done: journey.reports,
    },
  ];
  const activeIndex = stages.findIndex((st) => !st.done);

  // ── Live vs sample data source ────────────────────────────────────────────
  // When the partner result is in, render the candidate's REAL profile; the
  // normalized scores are 0–100, so map them onto the 1–7 scale this view uses.
  // Otherwise fall back to the seeded sample (demo / provider-not-configured).
  const isLiveComplete = live.phase === "complete" && !!live.data;
  const liveItems: DnlaScore[] = isLiveComplete
    ? live.data!.dnla.map((d) => ({
        competency: d.competency,
        group: d.group as DnlaScore["group"],
        score: Math.round((d.score / 100) * 7 * 10) / 10,
        benchmark: Math.round((d.benchmark / 100) * 7 * 10) / 10,
        insight: d.insight,
      }))
    : [];

  // Sample profile is shown for the demo/loading/none/not-configured phases;
  // pending & error show only the status panel (no misleading numbers).
  const showSample =
    live.phase === "loading" ||
    live.phase === "none" ||
    live.phase === "not-configured";
  const dnla: DnlaScore[] = isLiveComplete ? liveItems : showSample ? s.dnla ?? [] : [];
  const hasData = dnla.length > 0;

  // Group rollups — derived from the data itself so it works for both the sample
  // groups and the live DNLA axis labels (which differ).
  const groupNames = Array.from(new Set(dnla.map((d) => d.group)));
  const groupStats = groupNames
    .map((group) => {
      const items = dnla.filter((d) => d.group === group);
      const average = avg(items.map((d) => d.score));
      return { group, items, average };
    })
    .filter((g) => g.items.length > 0);

  const overallAvg = avg(dnla.map((d) => d.score)); // 1-7
  const behaviouralIndex = isLiveComplete
    ? Math.round(live.data!.baseline)
    : hasData
      ? Math.round((overallAvg / 7) * 100)
      : 0;

  // Whether to render the profile block (headline + radar + detail). Pending and
  // error render only the status panel above.
  const renderProfile = isLiveComplete || showSample;

  // Start the real DNLA questionnaire. Reserve the popup inside the click gesture
  // (before the await) so it isn't blocked, then point it at the returned URL.
  const handleStart = async () => {
    const parts = (s.name || "").trim().split(/\s+/).filter(Boolean);
    const firstname = parts[0] || undefined;
    const lastname = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
    const popup = window.open("about:blank", "dnla-assessment");
    const url = await live.start({ firstname, lastname });
    if (url) {
      if (popup) {
        try {
          popup.opener = null;
        } catch {
          /* cross-origin guard */
        }
        popup.location.replace(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } else if (popup) {
      popup.close();
    }
  };

  const openQuestionnaire = () => {
    if (live.startUrl) window.open(live.startUrl, "_blank", "noopener,noreferrer");
  };

  const sortedGroups = [...groupStats].sort((a, b) => b.average - a.average);
  const strongestGroup = sortedGroups[0];
  const developmentGroup = sortedGroups[sortedGroups.length - 1];

  return (
    <PageShell>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Workspace", href: `${flowBase}/${id}` },
          { label: "DNLA" },
        ]}
      />
      <PageHeader
        eyebrow="Assessment journey"
        title="Your TalEdge assessment"
        description={`Six guided stages - résumé analysis, the AI interview, the DNLA interview, a combined final round, a separate report for each interview, and a comparison report. ${s.name}'s DNLA behavioural competency profile is shown below the journey.`}
        actions={
          <div className="flex items-center gap-3">
            {live.phase === "complete" ? (
              <Badge tone="success">
                Live DNLA{live.data?.finishedAt ? ` · ${formatDate(live.data.finishedAt)}` : ""}
              </Badge>
            ) : live.phase === "pending" ? (
              <Badge tone="brand">Assessment in progress</Badge>
            ) : live.phase === "error" ? (
              <Badge tone="danger">Assessment error</Badge>
            ) : live.phase === "loading" ? (
              <Badge tone="neutral">Checking status…</Badge>
            ) : (
              <Badge tone="warn">Sample data · provider pending</Badge>
            )}
            <ButtonLink href={`${flowBase}/${id}`} variant="ghost">
              Back to workspace
            </ButtonLink>
          </div>
        }
      />

      {/* ── Guided assessment stepper ─────────────────────────────────────── */}
      <section className="mb-8">
        <div className="grid gap-3">
          {stages.map((st, i) => {
            const isActive = i === activeIndex;
            const state = st.done ? "done" : isActive ? "active" : "upcoming";
            return (
              <Card
                key={st.key}
                variant="default"
                className={cn(
                  "rounded-xl2 p-5 transition-colors",
                  state === "done" && "border-emerald-200 bg-emerald-50/40",
                  state === "active" && "border-brand-300 bg-brand-50/40 ring-1 ring-brand-200",
                  state === "upcoming" && "opacity-90"
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold",
                        state === "done" && "bg-emerald-500 text-white",
                        state === "active" && "bg-brand-600 text-white",
                        state === "upcoming" && "bg-ink-100 text-ink-500"
                      )}
                    >
                      {st.done ? "✓" : i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Label>{st.title}</Label>
                        <Badge tone={state === "done" ? "success" : state === "active" ? "brand" : "neutral"}>
                          {state === "done" ? "Complete" : state === "active" ? "Next up" : "Upcoming"}
                        </Badge>
                      </div>
                      <p className="mt-1 max-w-2xl text-sm text-ink-500">{st.desc}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    <ButtonLink
                      href={st.href}
                      variant={state === "active" ? "primary" : "ghost"}
                      size="sm"
                    >
                      {st.cta}
                    </ButtonLink>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Live DNLA status / start control ──────────────────────────────── */}
      <DnlaLivePanel live={live} onStart={handleStart} onOpen={openQuestionnaire} />

      {renderProfile && (
      <>
      <div className="mb-5 border-t border-ink-200/60 pt-6">
        <Eyebrow className="text-brand-500">DNLA behavioural competency profile</Eyebrow>
        <Heading as="h2" className="mt-1 text-lg sm:text-xl">
          {isLiveComplete ? "Your psychometric profile" : "Sample psychometric scores"}
        </Heading>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
          {isLiveComplete
            ? "These behavioural competency scores were administered and scored by the DNLA partner (Germany) from your completed questionnaire, mapped onto the four TalEdge competency axes."
            : "These behavioural competency scores are administered by the DNLA partner (Germany). The values shown are sample / dummy data for the pilot and will be replaced by your live result once you complete the assessment."}
        </p>
      </div>

      {!hasData ? (
        <Card variant="flat" className="mb-5">
          <CardHeader>
            <Eyebrow>No competency data</Eyebrow>
            <Heading as="h2" className="mt-1 text-lg sm:text-xl">
              DNLA report not available yet
            </Heading>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-600">
              There are no behavioural competency scores for {s.name} yet. Once the
              licensed DNLA provider import is connected, the full competency profile
              will appear here.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <>
          {/* Headline metrics */}
          <section className="mb-5 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <Stat
                  label="Behavioural index"
                  value={`${behaviouralIndex}`}
                  sub="Overall DNLA average, scaled to 100"
                  tone={
                    behaviouralIndex >= 80
                      ? "success"
                      : behaviouralIndex >= 57
                        ? "brand"
                        : "warn"
                  }
                />
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Stat
                  label="Strongest group"
                  value={strongestGroup?.group ?? "-"}
                  sub={
                    strongestGroup
                      ? `Avg ${strongestGroup.average.toFixed(1)} / 7`
                      : undefined
                  }
                  tone="success"
                />
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Stat
                  label="Development group"
                  value={developmentGroup?.group ?? "-"}
                  sub={
                    developmentGroup
                      ? `Avg ${developmentGroup.average.toFixed(1)} / 7`
                      : undefined
                  }
                  tone={
                    developmentGroup && developmentGroup.average < 4
                      ? "danger"
                      : "warn"
                  }
                />
              </CardHeader>
            </Card>
          </section>

          {/* Radar + group summary */}
          <section className="mb-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader>
                <Eyebrow>Competency profile</Eyebrow>
                <Heading as="h2" className="mt-1 text-lg sm:text-xl">
                  Score vs benchmark
                </Heading>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  Each axis is one competency on a 1–7 scale. The solid indigo shape
                  is {s.name}; the dashed outline is the top-performer benchmark.
                </p>
              </CardHeader>
              <CardBody>
                <CompetencyRadar items={dnla} />
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" aria-hidden />
                    Candidate
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-0 w-3 border-t-2 border-dashed border-brand-300"
                      aria-hidden
                    />
                    Benchmark
                  </span>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <Eyebrow>Group rollup</Eyebrow>
                <Heading as="h2" className="mt-1 text-lg sm:text-xl">
                  Behavioural groups
                </Heading>
              </CardHeader>
              <CardBody className="grid gap-3 sm:grid-cols-2">
                {groupStats.map((g) => {
                  const tone = scoreTone(g.average);
                  return (
                    <div
                      key={g.group}
                      className={cn(
                        "rounded-xl2 border p-4",
                        tone === "success" && "border-emerald-200 bg-emerald-50/50",
                        tone === "brand" && "border-brand-100 bg-brand-50/40",
                        tone === "warn" && "border-amber-200 bg-amber-50/50",
                        tone === "danger" && "border-rose-200 bg-rose-50/50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Label>{g.group}</Label>
                        <Badge tone={tone}>{g.average.toFixed(1)} / 7</Badge>
                      </div>
                      <div className="mt-3">
                        <Bar value={g.average} max={7} tone={barTone[tone]} />
                      </div>
                      <p className="mt-2 text-xs text-ink-500">
                        {g.items.length} competenc
                        {g.items.length === 1 ? "y" : "ies"}
                      </p>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          </section>

          {/* Per-competency detail grouped */}
          <section className="mb-5 grid gap-5 md:grid-cols-2">
            {groupStats.map((g) => (
              <Card key={g.group}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <Eyebrow>{g.group}</Eyebrow>
                    <Badge tone={scoreTone(g.average)}>
                      avg {g.average.toFixed(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardBody className="grid gap-4">
                  {g.items.map((d) => {
                    const tone = scoreTone(d.score);
                    return (
                      <div key={d.competency}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-ink-800">
                            {d.competency}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-ink-500">
                            {d.score} / 7
                            <span className="text-ink-400">
                              {" "}· bm {d.benchmark}
                            </span>
                          </span>
                        </div>
                        <div className="mt-2">
                          <Bar value={d.score} max={7} tone={barTone[tone]} />
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-ink-500">
                          {d.insight}
                        </p>
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            ))}
          </section>
        </>
      )}
      </>
      )}

      {/* CTA: jump to the next stage in the assessment journey above. */}
      <Card className="mb-5 border-brand-200/70 bg-brand-50/40">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Eyebrow>Continue your assessment</Eyebrow>
            <Heading as="h2" className="mt-1 text-lg sm:text-xl">
              {activeIndex === -1 ? "All stages complete" : stages[activeIndex].title}
            </Heading>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-600">
              {activeIndex === -1
                ? `Every stage is done for ${s.name}. Open the comparison report to see both interviews side by side.`
                : `Pick up where you left off: ${stages[activeIndex].desc}`}
            </p>
          </div>
          <ButtonLink
            href={activeIndex === -1 ? `${flowBase}/${id}/comparison` : stages[activeIndex].href}
            size="lg"
            className="w-full shrink-0 sm:w-auto"
          >
            {activeIndex === -1 ? "View comparison report" : stages[activeIndex].cta}
          </ButtonLink>
        </CardHeader>
      </Card>

      {/* Disclaimer */}
      <p className="text-xs leading-5 text-ink-400">
        {isLiveComplete
          ? "DNLA is a licensed external psychometric provider in Germany; its questionnaire and scoring are hosted by DNLA, not TalEdge. The scores above were computed by DNLA from your completed assessment and mapped onto the TalEdge competency axes."
          : "Sample data. DNLA is a licensed external psychometric provider in Germany; its questionnaire and scoring are not hosted in TalEdge. The competency scores above are placeholder values for the pilot and will be replaced by your live result once the assessment is completed."}
      </p>
    </PageShell>
  );
}
