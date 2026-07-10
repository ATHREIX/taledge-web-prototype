"use client";

import { notFound, useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ScoreRing, Bar } from "@/components/score-ring";
import { getStudent, SAMPLE_DNLA } from "@/lib/data";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  ButtonLink,
  Badge,
  Stat,
  Heading,
  Eyebrow,
  Breadcrumbs,
} from "@/components/ui";
import { authedFetch } from "@/lib/api-client";
import { useDnlaLive } from "@/hooks/useDnlaLive";
import { containerVariants, itemVariants } from "@/lib/motion";

type Msg = { role: "assistant" | "user"; content: string };
type Row = [string, number];
type RubricGroup = { group: string; rows: Row[] };
type CrossFlag = { label: string; verdict: string; tone: "ok" | "warn" | "danger" };

type GenReport = {
  technical_score: number;
  behavioural_score: number;
  fit_score: number;
  success_probability: number;
  verdict: string;
  narrative: string;
  technical_breakdown: RubricGroup[];
  resume_breakdown: RubricGroup[];
  behavioural_breakdown: RubricGroup[];
  cross_flags: CrossFlag[];
};

type GenStatus = "idle" | "checking" | "generating" | "generated" | "error";

const ROLE_JDS: Record<string, string> = {
  "Full-stack Software Engineer": "React, Next.js, Node.js, TypeScript, SQL databases, REST APIs, WebSockets, system architecture, performance optimization, and front-to-back testing. Experience building responsive web applications and designing end-to-end features.",
  "Backend Engineer": "Server-side languages (Node.js/Go/Python/Java), databases (SQL, Redis, MongoDB), system design, microservices, API architecture, performance tuning, and message queues. Experience with cloud infrastructure (AWS/GCP), CI/CD, and scaling distributed backend systems.",
  "Frontend Engineer": "JavaScript/TypeScript, React, Next.js, HTML5, CSS3, TailwindCSS. Solid understanding of responsive design, web performance, component architecture, accessibility, browser APIs, and modern state management. Strong design sense.",
  "Data / ML Engineer": "Python, SQL. Experience with machine learning frameworks (TensorFlow, PyTorch, Scikit-learn), libraries (Pandas, NumPy), data pipelines, neural networks, and model deployment. Knowledge of NLP/LLMs, computer vision, data engineering (Spark, Kafka).",
  "Product Manager": "Product lifecycle management, defining product roadmaps, evaluating technical and product trade-offs, writing PRDs, analyzing analytics metrics, and leading cross-functional engineering teams. Strong communication, product sense, problem decomposition, and customer empathy.",
  "Consultant · Strategy": "Analytical reasoning, problem-solving, structured case interview frameworks, market entry analysis, financial modeling, slide deck creation, business strategy. Ability to interface with clients, manage stakeholders, and design organizational growth playbooks."
};

// Demo (pilot) mode: when auth is NOT enforced, the seeded persona's DNLA may be
// folded into the demo candidate's score. In enforced mode every candidate is a
// real, distinct user — never borrow the sample persona's psychometrics.
const DEMO = process.env.NEXT_PUBLIC_AUTH_ENFORCED !== "true";

// Stable, module-level defaults so empty-state resets keep a referentially
// stable object (avoids re-creating the empty report on every render).
const emptyReportDefaults: GenReport = {
  technical_score: -1,
  behavioural_score: -1,
  fit_score: -1,
  success_probability: -1,
  verdict: "Awaiting evidence",
  narrative:
    "Complete the technical and behavioural interviews to generate a Fit Score grounded in captured assessment evidence, combined with your DNLA psychometric profile.",
  technical_breakdown: [],
  resume_breakdown: [],
  behavioural_breakdown: [],
  cross_flags: [],
};

/**
 * Normalize a (possibly partial / malformed) generated report so every array
 * field and numeric field the UI maps over is guaranteed present. Prevents the
 * page from crashing on `undefined.map(...)` if the API returns a shape that is
 * missing breakdown groups or flags.
 */
function normalizeReport(raw: Partial<GenReport> | null | undefined): GenReport {
  const r = raw ?? {};
  return {
    technical_score: typeof r.technical_score === "number" ? r.technical_score : -1,
    behavioural_score: typeof r.behavioural_score === "number" ? r.behavioural_score : -1,
    fit_score: typeof r.fit_score === "number" ? r.fit_score : -1,
    success_probability:
      typeof r.success_probability === "number" ? r.success_probability : -1,
    verdict: r.verdict || emptyReportDefaults.verdict,
    narrative: r.narrative || "",
    technical_breakdown: Array.isArray(r.technical_breakdown) ? r.technical_breakdown : [],
    resume_breakdown: Array.isArray(r.resume_breakdown) ? r.resume_breakdown : [],
    behavioural_breakdown: Array.isArray(r.behavioural_breakdown)
      ? r.behavioural_breakdown
      : [],
    cross_flags: Array.isArray(r.cross_flags) ? r.cross_flags : [],
  };
}

type PublishState = "idle" | "publishing" | "published" | "error";

function FitScorePageInner() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // External read-only view: a recruiter ("View") or an institute admin ("Drill
  // down") opens this report with ?view=recruiter / ?view=institute. In that mode
  // we render ONLY the candidate's persisted Fit Score report - no candidate
  // self-actions (Publish / Reattempt / Generate / Regenerate / "Start
  // assessment") - and we NEVER trigger a Gemini generation (read the stored
  // server copy only, which is free).
  const viewParam = searchParams.get("view");
  const instituteView = viewParam === "institute";
  // Any external viewer = read-only. `recruiterView` keeps its name as the gate
  // for that behaviour across the page; institute-specific copy keys off
  // `instituteView`.
  const recruiterView = viewParam === "recruiter" || instituteView;
  const id = String(params.id);
  const s = getStudent(id);
  if (!s) notFound();

  // Shared by both tracks. Under /exam/[id]/fit-score this is an exam aspirant's
  // readiness report; keep in-page navigation within that namespace and tell the
  // generator to frame the report around exam preparation rather than a job role.
  const isExam = !!pathname && pathname.startsWith("/exam");
  const flowBase = isExam ? "/exam" : "/student";
  const track: "placement" | "exam" = isExam ? "exam" : "placement";

  // Live DNLA result (owner-scoped). When present, the Fit Score is computed on
  // the candidate's REAL psychometric profile instead of the demo seed.
  const dnlaLive = useDnlaLive(id);

  const emptyReport: GenReport = emptyReportDefaults;

  const [report, setReport] = useState<GenReport>(emptyReport);
  const [status, setStatus] = useState<GenStatus>("idle");
  const [source, setSource] = useState<string>("not-generated");
  const [genError, setGenError] = useState<string>("");
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishError, setPublishError] = useState<string>("");
  // Candidate's real name, resolved from the durable record (recruiter view only -
  // the recruiter's own localStorage profile would otherwise mislabel the report).
  const [recruiterName, setRecruiterName] = useState<string>("");

  // Publish the Fit Score report to the recruiter portal. Confirms intent,
  // shows a loading state, and surfaces a success / error result.
  const publishToRecruiters = useCallback(async () => {
    if (publishState === "publishing") return;
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            "Publish your Fit Score report to all empanelled recruiters? Your score will become visible in the recruiter portal."
          );
    if (!confirmed) return;

    setPublishState("publishing");
    setPublishError("");
    try {
      const r = await authedFetch("/api/reports/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: id,
          reportType: "fit-score",
          audience: "recruiters",
          consent: true,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setPublishState("error");
        setPublishError(data?.error || "Couldn't publish the report.");
        return;
      }
      setPublishState("published");
    } catch (e: any) {
      setPublishState("error");
      setPublishError(e?.message || "Network error while publishing.");
    }
  }, [id, publishState]);

  // Reattempt: a true restart. Clear every cached assessment artifact for this
  // candidate (interview transcripts + timestamps, fit-score report, workspace
  // transcript keys) before navigating back to the DNLA stage, so stale results
  // never bleed into the new attempt.
  const reattempt = useCallback(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key.startsWith(`taledge:interview:${id}:`) ||
          key === `taledge:fit-score:${id}` ||
          key.startsWith(`taledge:workspace:${id}:`) ||
          key.startsWith(`taledge:workspace-transcript:${id}`)
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* non-fatal: navigate even if cache clearing fails */
    }
    router.push(`${flowBase}/${id}/dnla`);
  }, [id, router, flowBase]);

  const readTranscripts = useCallback(() => {
    // Parse each round INDEPENDENTLY: one corrupted transcript must not discard
    // the others (a single shared try/catch previously wiped all three rounds,
    // silently scoring everything "Pending" off a real, completed interview).
    const readOne = (...keys: string[]): Msg[] => {
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed as Msg[];
        } catch {
          /* corrupted entry for this key - try the next, then give up */
        }
      }
      return [];
    };
    // The guided funnel routes the behavioural round to /interview/dnla, so it
    // persists the transcript under the `:dnla` key. Prefer the standalone
    // `:behavioural` key when present, otherwise fall back to the funnel's
    // `:dnla` transcript - this is the key mismatch that previously left the
    // behavioural score permanently "Pending".
    // The "final" round IS the behavioural interview (the dashboard's "Final
    // Interview" step): a legacy `:final` transcript is the candidate's
    // behavioural evidence when no behavioural/dnla one exists. Only when a
    // real behavioural transcript is ALSO present does `:final` stay a separate
    // holistic round — never send the same transcript as both.
    const behavioural = readOne(
      `taledge:interview:${id}:behavioural`,
      `taledge:interview:${id}:dnla`
    );
    const finalT = readOne(`taledge:interview:${id}:final`);
    return {
      technical: readOne(`taledge:interview:${id}:technical`),
      behavioural: behavioural.length ? behavioural : finalT,
      final: behavioural.length ? finalT : [],
    };
  }, [id]);

  const readWorkspaceProfile = useCallback(() => {
    try {
      let stored = localStorage.getItem("taledge:workspace-profile");
      if (!stored) {
        stored = localStorage.getItem("taledge:demo-profile");
      }
      return JSON.parse(stored || "{}");
    } catch {
      return {};
    }
  }, []);

  const generate = useCallback(async () => {
    setStatus("generating");
    setGenError("");
    const { technical, behavioural, final } = readTranscripts();
    const profile = readWorkspaceProfile();
    // Prefer the candidate's LIVE DNLA result; fall back to the demo seed only
    // for the demo persona. Live scores are 0–100, so convert to the 1–7 scale
    // the generator's rubric/prompt expects.
    const liveDnla = dnlaLive.phase === "complete" && dnlaLive.data ? dnlaLive.data : null;
    const demoSeed = DEMO && id === "candidate-001";
    const dnlaItems = liveDnla
      ? liveDnla.dnla.map((d) => ({
          competency: d.competency,
          group: d.group,
          score: Math.round((d.score / 100) * 7 * 10) / 10,
          benchmark: Math.round((d.benchmark / 100) * 7 * 10) / 10,
          insight: d.insight,
        }))
      : demoSeed
        ? s.dnla || []
        : [];
    const dnlaStrengths = liveDnla ? liveDnla.strengths : demoSeed ? s.strengths || [] : [];
    const dnlaDevelopmentAreas = liveDnla
      ? liveDnla.developmentAreas
      : demoSeed
        ? s.developmentAreas || []
        : [];
    const dnlaRisks = liveDnla ? liveDnla.risks : demoSeed ? s.risks || [] : [];
    try {
      const r = await authedFetch("/api/generate-fit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: id,
          track,
          candidateName: profile.fullName || s.name,
          targetRole: profile.targetRole || s.targetRole,
          // Off-campus invite linkage: send the invite TOKEN; the server resolves
          // the recruiter/job binding from it (never trusts a client recruiterId).
          inviteToken: profile.inviteToken || undefined,
          college: profile.institution || undefined,
          resumeSummary: [
            profile.resumeSummary || s.resumeSummary,
            profile.aspiration ? `Career aspiration: ${profile.aspiration}` : "",
          ].filter(Boolean).join("\n"),
          resumeSkills: profile.resumeSkills?.length ? profile.resumeSkills : s.skills,
          resumeProjects: profile.resumeProjects?.length ? profile.resumeProjects : s.projects,
          technicalQA: technical,
          behaviouralQA: behavioural,
          finalQA: final,
          // Live DNLA result when the candidate has completed it (see above);
          // otherwise the demo seed for the demo persona only, never borrowed for
          // a real/invited candidate (that would leak one person's DNLA to
          // everyone and contaminate their score).
          dnla: dnlaItems,
          dnlaStrengths,
          dnlaDevelopmentAreas,
          dnlaRisks,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setStatus("error");
        setGenError(data?.error || "Couldn't generate the report.");
        return;
      }
      setReport(normalizeReport(data.generated));
      setSource(data.source || "gemini-2.5-flash");
      setGeneratedAt(Date.now());
      setStatus("generated");
      try {
        localStorage.setItem(
          `taledge:fit-score:${id}`,
          JSON.stringify({ report: data.generated, source: data.source, ts: Date.now() })
        );
      } catch {
        /* non-fatal */
      }
    } catch (e: any) {
      setStatus("error");
      setGenError(e?.message || "Network error while generating.");
    }
  }, [id, s, track, readTranscripts, readWorkspaceProfile, dnlaLive.phase, dnlaLive.data]);

  useEffect(() => {
    setStatus("checking");
    // Recruiter read-only view: load ONLY the candidate's persisted server report
    // (free, cross-device). Never read this device's localStorage (it's the
    // recruiter's, not the candidate's) and never auto-generate (no Gemini cost).
    if (recruiterView) {
      void (async () => {
        try {
          const r = await authedFetch(`/api/generate-fit-score?studentId=${encodeURIComponent(id)}`);
          if (r.ok) {
            const d = await r.json();
            if (d?.name) setRecruiterName(String(d.name));
            // 1) A full, detailed LLM report exists - show it verbatim.
            if (d?.ok && d.report?.fit_score != null) {
              setReport(normalizeReport(d.report));
              setSource(d.source || "stored");
              setGeneratedAt(Number(d.ts) || null);
              setStatus("generated");
              return;
            }
            // 2) No detailed report, but the candidate HAS headline scores (seed /
            // pre-detailed). Render those real numbers - the recruiter pool already
            // shows them - instead of a misleading "no report" state. We never call
            // the generator here, so there is no Gemini cost.
            const f = d?.summary?.fit;
            const hasScores =
              f && (Number(f.fit) > 0 || Number(f.technical) > 0 || Number(f.behavioural) > 0);
            if (hasScores) {
              const fitN = Number(f.fit) || -1;
              setReport(
                normalizeReport({
                  technical_score: Number(f.technical) || -1,
                  behavioural_score: Number(f.behavioural) || -1,
                  fit_score: fitN,
                  success_probability: Number(f.successProbability) || -1,
                  verdict: fitN >= 70 ? "Interview-ready" : "Below interview-readiness threshold",
                  narrative:
                    "Headline Fit Score summary from this candidate's assessment results. The full component-level breakdown (technical, resume, behavioural, and cross-component checks) appears here once the candidate generates and publishes their detailed report.",
                  technical_breakdown: [],
                  resume_breakdown: [],
                  behavioural_breakdown: [],
                  cross_flags: [],
                })
              );
              setSource("summary");
              setStatus("generated");
              return;
            }
          }
        } catch {
          /* fall through to the read-only empty state */
        }
        setStatus("idle");
      })();
      return;
    }
    // Freshness baseline: the newest interview round on THIS device. A stored
    // report (local OR server) is trusted only if generated AFTER this, so
    // retaking any round still forces a regenerate.
    const lastTechUpdate = Number(localStorage.getItem(`taledge:interview:${id}:technical:updatedAt`) || 0);
    // Behavioural round can land under either key; take the freshest of both
    // plus the final round so retaking ANY round invalidates a stale report.
    const lastBehavUpdate = Math.max(
      Number(localStorage.getItem(`taledge:interview:${id}:behavioural:updatedAt`) || 0),
      Number(localStorage.getItem(`taledge:interview:${id}:dnla:updatedAt`) || 0)
    );
    const lastFinalUpdate = Number(localStorage.getItem(`taledge:interview:${id}:final:updatedAt`) || 0);
    const lastUpdate = Math.max(lastTechUpdate, lastBehavUpdate, lastFinalUpdate);

    let hydrated = false;
    try {
      const cached = localStorage.getItem(`taledge:fit-score:${id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Auto-regenerate if a new interview has been taken since the report was generated
        if (parsed?.report?.fit_score != null && parsed.ts > lastUpdate) {
          setReport(normalizeReport(parsed.report));
          setSource(parsed.source || "gemini-2.5-flash");
          setGeneratedAt(parsed.ts || null);
          setStatus("generated");
          hydrated = true;
        }
      }
    } catch {
      /* fall through to server / auto-generate */
    }

    if (!hydrated) {
      void (async () => {
        // No fresh LOCAL report (new device / cleared storage): try the durable
        // SERVER copy before regenerating - it's free (no LLM call) and works
        // cross-device. Accept it only if it's fresher than the latest round.
        try {
          const r = await authedFetch(`/api/generate-fit-score?studentId=${encodeURIComponent(id)}`);
          if (r.ok) {
            const d = await r.json();
            if (d?.ok && d.report?.fit_score != null && (Number(d.ts) || 0) > lastUpdate) {
              setReport(normalizeReport(d.report));
              setSource(d.source || "stored");
              setGeneratedAt(Number(d.ts) || null);
              setStatus("generated");
              try {
                localStorage.setItem(
                  `taledge:fit-score:${id}`,
                  JSON.stringify({ report: d.report, source: d.source || "stored", ts: Number(d.ts) || Date.now() })
                );
              } catch {
                /* non-fatal */
              }
              return;
            }
          }
        } catch {
          /* fall through to local regenerate */
        }
        const { technical, behavioural, final } = readTranscripts();
        const userAnswers =
          technical.filter((m) => m.role === "user").length +
          behavioural.filter((m) => m.role === "user").length +
          final.filter((m) => m.role === "user").length;
        if (userAnswers > 0) {
          void generate();
        } else {
          setStatus("idle");
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, recruiterView]);

  const profile = readWorkspaceProfile();
  // Prefer the candidate's real onboarding profile name over the seeded demo
  // student record - everyone browses under the same demo id (candidate-001),
  // so s.name would otherwise label every report with the seeded persona. In the
  // recruiter view we have no candidate-local profile, so use the name resolved
  // from the durable record (never the recruiter's own localStorage profile).
  const candidateName: string = recruiterView
    ? (recruiterName || s.name)
    : (profile.fullName && String(profile.fullName).trim()) || s.name;
  const candidateFirst = candidateName.split(" ")[0];

  return (
    <PageShell>
      <motion.section
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-10">
          <Breadcrumbs
            items={
              recruiterView
                ? [
                    { label: instituteView ? "Institute" : "Recruiter", href: "/dashboard" },
                    { label: instituteView ? "Student report" : "Candidate report" },
                  ]
                : [
                    { label: "Dashboard", href: "/dashboard" },
                    { label: "Workspace", href: `${flowBase}/${s.id}` },
                    { label: "Fit Score" },
                  ]
            }
          />
          <PageHeader
            eyebrow={
              recruiterView
                ? instituteView
                  ? "Student Fit Score Report"
                  : "Candidate Fit Score Report"
                : "Fit Score & Success Probability"
            }
            title={
              recruiterView
                ? `Fit Score report · ${candidateName}`
                : `Structured feedback report for ${candidateFirst}`
            }
            description="Composite Fit Score synthesized from technical interview, behavioural interview, DNLA psychometrics, resume signals, and cross-component checks."
            actions={
              <div className="flex items-center gap-2 print:hidden">
                <Button type="button" variant="ghost" size="sm" onClick={() => window.print()} aria-label="Print or save report as PDF">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>
                  Print / PDF
                </Button>
                {recruiterView ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => router.back()} aria-label={instituteView ? "Back to cohort" : "Back to recruiter pipeline"}>
                    <ArrowLeft /> {instituteView ? "Back to cohort" : "Back to pipeline"}
                  </Button>
                ) : (
                  <ButtonLink href={`${flowBase}/${s.id}`} variant="ghost" size="sm" aria-label="Back to student dashboard">
                    <ArrowLeft /> Back to Dashboard
                  </ButtonLink>
                )}
              </div>
            }
          />

          {/* Generation status banner */}
          <GenStatusBanner
            status={status}
            source={source}
            error={genError}
            generatedAt={generatedAt}
            onRegenerate={generate}
            readOnly={recruiterView}
          />
        </motion.div>

        {status === "generating" ? (
          <ReportSkeleton />
        ) : status === "idle" ? (
          /* Empty state: no captured transcript yet - show a clear prompt
             instead of a blank/Pending score grid. */
          <motion.div variants={itemVariants}>
            <Card variant="default" className="rounded-xl2 overflow-hidden p-8 text-center sm:p-12">
              <Eyebrow className="text-brand-500">No Fit Score report yet</Eyebrow>
              <Heading as="h2" className="mt-3">
                {recruiterView
                  ? `This ${instituteView ? "student" : "candidate"} hasn't completed a Fit Score report yet`
                  : "Complete an interview to unlock your Fit Score"}
              </Heading>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-600">
                {recruiterView
                  ? `${candidateName} has not completed the assessment, so there is no Fit Score report to display yet. It will appear here once they finish their interviews.`
                  : `We could not find a captured assessment for ${candidateFirst}. Complete the AI technical and behavioural interviews to generate a personalized Fit Score report grounded in your responses.`}
              </p>
              {!recruiterView && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <ButtonLink
                    href={`${flowBase}/${s.id}/dnla`}
                    variant="primary"
                    size="lg"
                  >
                    Start assessment
                    <ArrowRight />
                  </ButtonLink>
                  <Button type="button" onClick={generate} variant="ghost" size="lg">
                    Generate now
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-10">
            {/* HEADLINE NUMBERS */}
            <motion.div variants={itemVariants}>
              <Card variant="default" className="rounded-xl2 overflow-hidden p-6 sm:p-8">
                <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
                  <div className="flex justify-center lg:col-span-3">
                    <ScoreRing
                      value={report.success_probability}
                      size={188}
                      stroke={14}
                      label="Success Probability"
                      sub={status === "generated" ? `Fit Score · ${report.fit_score}%` : "Awaiting report"}
                      tone={report.success_probability === -1 ? "muted" : report.success_probability >= 75 ? "success" : report.success_probability >= 55 ? "warn" : "danger"}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 lg:col-span-6 sm:grid-cols-3">
                    <HeadlineStat
                      label="Technical Score"
                      value={report.technical_score === -1 ? "Pending" : `${report.technical_score}%`}
                      hint="Tech interview + coding"
                    />
                    <HeadlineStat
                      label="Behavioural Score"
                      value={report.behavioural_score === -1 ? "Pending" : `${report.behavioural_score}%`}
                      hint="Behavioural interview + DNLA"
                    />
                    <HeadlineStat
                      label="Fit Score"
                      value={report.fit_score === -1 ? "Pending" : `${report.fit_score}%`}
                      hint="Weighted composite"
                    />
                    <HeadlineStat
                      label="Success Probability"
                      value={report.success_probability === -1 ? "Pending" : `${report.success_probability}%`}
                      hint="Likelihood of placement success"
                    />
                    <HeadlineStat
                      label="Risk flags"
                      value={report.cross_flags.filter(f => f.tone !== "ok").length}
                      hint={report.cross_flags.some(f => f.tone === "danger") ? "Action required" : "Watch list"}
                      tone={report.cross_flags.some(f => f.tone === "danger") ? "warn" : "ok"}
                    />
                    <HeadlineStat
                      label="Verdict"
                      value={report.verdict}
                      hint={`Threshold ${report.fit_score >= 70 ? "met" : "below 70"}`}
                      tone={report.fit_score >= 70 ? "ok" : "warn"}
                    />
                  </div>
                  {!recruiterView && (
                  <div className="space-y-2.5 lg:col-span-3">
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      onClick={publishToRecruiters}
                      disabled={publishState === "publishing" || publishState === "published"}
                    >
                      {publishState === "publishing"
                        ? "Publishing..."
                        : publishState === "published"
                        ? "Published to recruiters"
                        : "Publish to recruiters"}
                      {publishState === "idle" || publishState === "error" ? <ArrowRight /> : null}
                    </Button>
                    {publishState === "error" && (
                      <p className="text-xs font-medium text-rose-600">{publishError}</p>
                    )}
                    <Button
                      type="button"
                      onClick={reattempt}
                      variant="ghost"
                      size="lg"
                      className="w-full"
                    >
                      Reattempt assessment
                    </Button>
                    <ButtonLink
                      href={`${flowBase}/${s.id}/development`}
                      variant="ghost"
                      size="lg"
                      className="w-full"
                    >
                      Development Pathway
                    </ButtonLink>
                  </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Narrative summary */}
            {report.narrative && (
              <motion.div variants={itemVariants}>
                <Card variant="default" className="rounded-xl2 p-6 sm:p-8">
                  <Eyebrow>Executive summary</Eyebrow>
                  <p className="mt-3 text-base leading-relaxed text-ink-800 font-medium">
                    {report.narrative}
                  </p>
                </Card>
              </motion.div>
            )}

            {/* COMPONENT 1 · TECHNICAL INTERVIEW */}
            <RubricSection
              tag="Component 01"
              title="Technical Interview features"
              desc="Per PRD §9.1 · accuracy, depth, thinking quality, coding, and behavioural signals during the tech interview."
              score={report.technical_score}
              groups={report.technical_breakdown}
            />

            {/* COMPONENT 2 · RESUME / PROFILE */}
            <RubricSection
              tag="Component 02"
              title="Resume & profile features"
              desc="Per PRD §9.2 · skill matching against the JD, project quality, academic signals, and resume quality."
              score={(() => {
                const rows = report.resume_breakdown.flatMap(g => g?.rows ?? []);
                if (rows.length === 0) return 0;
                const sum = rows.reduce((acc, r) => acc + (Number(r?.[1]) || 0), 0);
                return Math.round(sum / rows.length);
              })()}
              groups={report.resume_breakdown}
            />

            {/* JD VS RESUME MATCH ANALYSIS */}
            {status === "generated" && (
              <motion.div variants={itemVariants}>
                <Card variant="default" className="rounded-xl2 overflow-hidden p-6 sm:p-8 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200/50 pb-4 mb-5">
                    <div>
                      <Eyebrow className="text-brand-500">Comparative Fit Analysis</Eyebrow>
                      <Heading as="h3" className="text-lg mt-1">Job Description (JD) vs. Resume Alignment</Heading>
                    </div>
                    <Badge tone="brand">
                      Target Role: {profile.targetRole || s.targetRole}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* JD Column */}
                    <Card variant="flat" className="p-5">
                      <Eyebrow className="mb-2.5">Target JD Core Requirements</Eyebrow>
                      <p className="text-sm leading-relaxed text-ink-700 font-medium">
                        {ROLE_JDS[profile.targetRole || s.targetRole] || `Required foundational skills, core engineering competencies, communication, and target role expertise.`}
                      </p>
                    </Card>

                    {/* Resume Column */}
                    <Card variant="flat" className="p-5">
                      <Eyebrow className="mb-2.5">Ingested Resume Profile</Eyebrow>
                      {profile.resumeSummary || s.resumeSummary ? (
                        <p className="text-sm leading-relaxed text-ink-700">
                          {profile.resumeSummary || s.resumeSummary}
                        </p>
                      ) : (
                        <p className="text-sm italic text-ink-500">
                          No resume uploaded. Ingested profile is currently empty.
                        </p>
                      )}
                      {((profile.resumeSkills && profile.resumeSkills.length > 0) || (s.skills && s.skills.length > 0)) && (
                        <div className="mt-4 pt-3 border-t border-ink-200/50">
                          <Eyebrow className="mb-2">Parsed Skills</Eyebrow>
                          <div className="flex flex-wrap gap-1.5">
                            {(profile.resumeSkills?.length ? profile.resumeSkills : s.skills).map((skill: string) => (
                              <Badge key={skill} tone="neutral" className="rounded-md">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* COMPONENT 3 · DNLA */}
            <motion.section variants={itemVariants} className="mt-12 w-full">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <Eyebrow className="flex items-center gap-1.5 text-brand-500">
                    <span aria-hidden="true"><BrainIcon /></span> Component 03
                  </Eyebrow>
                  <Heading className="mt-3 sm:text-3xl">
                    DNLA Social Competence
                  </Heading>
                  <p className="mt-2 max-w-2xl text-sm text-ink-500">
                    Psychometric competency profile, scored 1–7 against the
                    top-performer benchmark. Demo profile shown pending the verified
                    DNLA provider import.
                  </p>
                </div>
                <ButtonLink href={`${flowBase}/${s.id}/dnla`} variant="ghost" size="sm">
                  View full DNLA report
                  <ArrowRight />
                </ButtonLink>
              </div>
              <Card variant="default" className="w-full rounded-xl2 overflow-hidden p-6">
                {(s.dnla?.length ? s.dnla : SAMPLE_DNLA).length === 0 ? (
                  <>
                    <Eyebrow>DNLA profile</Eyebrow>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600">
                      No DNLA competencies on file for this candidate yet.
                    </p>
                  </>
                ) : (
                  <ul className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                    {[...(s.dnla?.length ? s.dnla : SAMPLE_DNLA)]
                      .sort((a, b) => b.score - a.score)
                      .map((d) => (
                        <li key={d.competency}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-semibold text-ink-800">{d.competency}</span>
                            <span className="shrink-0 text-xs font-medium text-ink-500 tabular-nums">
                              {d.score} / 7<span className="text-ink-400"> · bm {d.benchmark}</span>
                            </span>
                          </div>
                          <div className="mt-1.5">
                            <Bar
                              value={d.score}
                              max={7}
                              tone={d.score >= 6 ? "success" : d.score >= 4 ? "dark" : d.score >= 3 ? "warn" : "danger"}
                            />
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </Card>
            </motion.section>

            {/* COMPONENT 4 · BEHAVIOURAL INTERVIEW */}
            <RubricSection
              tag="Component 04"
              title="Behavioural Interview features"
              desc="Per PRD §9.4 · communication, content quality, ownership, consistency checks, and cultural fit indicators."
              score={report.behavioural_score}
              groups={report.behavioural_breakdown}
            />

            {/* COMPONENT 5 · CROSS COMPONENT FLAGS */}
            <motion.section variants={itemVariants} className="mt-12 w-full">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <Eyebrow className="flex items-center gap-1.5 text-brand-500">
                    <span aria-hidden="true"><FlagIcon /></span> Component 05
                  </Eyebrow>
                  <Heading className="mt-3 sm:text-3xl">
                    Cross-component features
                  </Heading>
                  <p className="mt-2 max-w-2xl text-sm text-ink-500">
                    Per PRD §9.5 · gap analysis between resume claims and tech performance,
                    confidence vs accuracy, and behaviour vs psychometric alignment.
                  </p>
                </div>
              </div>
              <Card variant="default" className="w-full rounded-xl2 overflow-hidden overflow-x-auto p-0">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-12 border-b border-ink-200/40 bg-ink-50/60 px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                    <div className="col-span-4">Check</div>
                    <div className="col-span-6">Verdict</div>
                    <div className="col-span-2 text-right">Signal</div>
                  </div>
                  {report.cross_flags.length === 0 && (
                    <div className="px-6 py-6 text-sm text-ink-500">
                      Cross-component findings will be generated after the report is ready.
                    </div>
                  )}
                  {report.cross_flags.map((f) => (
                    <div
                      key={f.label}
                      className="grid grid-cols-12 items-center border-b border-ink-100 px-6 py-4.5 text-sm last:border-0 hover:bg-ink-50/30 transition-colors"
                    >
                      <div className="col-span-4 font-bold text-ink-900">{f.label}</div>
                      <div className="col-span-6 text-ink-700">{f.verdict}</div>
                      <div className="col-span-2 text-right">
                        <Badge tone={f.tone === "ok" ? "success" : f.tone === "warn" ? "warn" : "danger"}>
                          {f.tone === "ok" ? "All clear" : f.tone === "warn" ? "Watch" : "Red flag"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.section>

            {/* PUBLISH OR REATTEMPT - candidate self-actions, hidden in the
                recruiter read-only view. */}
            {!recruiterView && (
            <motion.section variants={itemVariants} className="mt-12">
              <Card variant="default" className="rounded-xl2 overflow-hidden p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="max-w-xl">
                    <Eyebrow>Decision point · Per PRD §4.3</Eyebrow>
                    <Heading className="mt-2 sm:text-3xl">
                      Publish your Fit Score or reattempt the assessment
                    </Heading>
                    <p className="mt-2 text-sm text-ink-500 leading-relaxed">
                      Publishing makes your score visible to all empanelled organizations
                      through the recruiter portal. Reattempting resets the assessment so you
                      can improve your score after a coaching sprint.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={reattempt}
                        variant="ghost"
                        size="lg"
                      >
                        Reattempt
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        onClick={publishToRecruiters}
                        disabled={publishState === "publishing" || publishState === "published"}
                      >
                        {publishState === "publishing"
                          ? "Publishing..."
                          : publishState === "published"
                          ? "Published to recruiters"
                          : "Publish to recruiters"}
                        {publishState === "idle" || publishState === "error" ? <ArrowRight /> : null}
                      </Button>
                    </div>
                    {publishState === "published" && (
                      <p className="text-xs font-medium text-emerald-600">
                        Published to recruiters. Your score is now visible in the recruiter portal.
                      </p>
                    )}
                    {publishState === "error" && (
                      <p className="text-xs font-medium text-rose-600">{publishError}</p>
                    )}
                  </div>
                </div>
              </Card>
            </motion.section>
            )}

            {/* NEXT STEP - candidate's onward path, hidden for recruiters. */}
            {!recruiterView && (
            <motion.section variants={itemVariants} className="mt-12">
              <div className="rounded-xl2 border border-brand-200 bg-brand-50/70 p-6 sm:p-8 shadow-panel">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <Eyebrow className="text-brand-500">Assessment Complete</Eyebrow>
                    <Heading className="mt-1 sm:text-3xl">
                      Continue to your personalized Development Pathway
                    </Heading>
                    <p className="mt-2 max-w-2xl text-sm text-ink-600 leading-relaxed">
                      Translate these scores into a 6-week coach-matched sprint plan
                      with role-pivot pathways and longitudinal tracking.
                    </p>
                  </div>
                  <ButtonLink
                    href={`${flowBase}/${s.id}/development`}
                    variant="primary"
                    size="lg"
                  >
                    Continue to Development Pathway
                    <ArrowRight />
                  </ButtonLink>
                </div>
              </div>
            </motion.section>
            )}
          </div>
        )}
      </motion.section>
    </PageShell>
  );
}

/**
 * Suspense boundary required by Next.js 15 for `useSearchParams()` in a client
 * component. The fallback mirrors the report's loading shell.
 */
export default function FitScorePage() {
  return (
    <Suspense fallback={<PageShell><ReportSkeleton /></PageShell>}>
      <FitScorePageInner />
    </Suspense>
  );
}

/* ----- Rubric section helper ----- */

function RubricSection({
  tag,
  title,
  desc,
  score,
  groups,
}: {
  tag: string;
  title: string;
  desc: string;
  score: number;
  groups: { group: string; rows: (string | number)[][] }[];
}) {
  // Resilience: never assume `groups` (or any group's `rows`) is present.
  const safeGroups = Array.isArray(groups) ? groups : [];
  return (
    <motion.section variants={itemVariants} className="mt-12 w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow className="flex items-center gap-1.5 text-brand-500">
            <span aria-hidden="true"><CheckCircle /></span> {tag}
          </Eyebrow>
          <Heading className="mt-3 sm:text-3xl">
            {title}
          </Heading>
          <p className="mt-2 max-w-2xl text-sm text-ink-500">{desc}</p>
        </div>
        <Card variant="default" className="rounded-xl px-4 py-3">
          <Eyebrow>
            Component score
          </Eyebrow>
          <div className="mt-1 h-headline text-4xl sm:text-5xl md:text-6xl">
            {score === -1 ? "Pending" : `${score}%`}
          </div>
        </Card>
      </div>
      <div className={`w-full grid gap-4 ${
        safeGroups.length === 1
          ? "grid-cols-1"
          : safeGroups.length === 2
          ? "grid-cols-1 md:grid-cols-2"
          : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      }`}>
        {safeGroups.length === 0 && (
          <Card variant="default" className="w-full rounded-xl2 overflow-hidden p-6 text-sm leading-relaxed text-ink-600 md:col-span-2 xl:col-span-3">
            No generated sub-scores yet. Complete the interviews and generate the
            report to populate this component.
          </Card>
        )}
        {safeGroups.map((g) => (
          <motion.div
            key={g.group}
            whileHover={{ y: -4 }}
          >
            <Card variant="default" hover className="w-full rounded-xl2 overflow-hidden p-6">
              <Eyebrow>{g.group}</Eyebrow>
              <div className="mt-4 space-y-3">
                {(Array.isArray(g.rows) ? g.rows : []).map(([label, value]) => {
                  const v = Math.max(0, Math.min(100, Number(value)));
                  return (
                    <div key={String(label)}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-ink-700 font-medium">{label}</span>
                        <span className="tabular-nums font-bold text-ink-900">{v}%</span>
                      </div>
                      <Bar
                        value={v}
                        tone={v >= 75 ? "success" : v >= 55 ? "dark" : "warn"}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

/* ----- Headline stat ----- */

function HeadlineStat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "default" | "ok" | "warn";
}) {
  const accent =
    tone === "ok"
      ? "border-emerald-200/50 bg-emerald-500/[0.04]"
      : tone === "warn"
      ? "border-amber-200/50 bg-amber-500/[0.04]"
      : "border-ink-200/60 bg-white/45";

  const isText = typeof value === "string" && /[a-zA-Z]/.test(value);
  const statTone = tone === "ok" ? "success" : tone === "warn" ? "warn" : "neutral";

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -3, boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}
      className={`rounded-xl2 border ${accent} backdrop-blur-md p-5 flex flex-col justify-between min-h-[144px] transition-all duration-300 shadow-panel`}
    >
      <Stat
        label={label}
        tone={statTone}
        value={
          <span
            className={
              isText
                ? "text-base sm:text-lg md:text-xl leading-snug"
                : "text-3xl sm:text-4xl md:text-5xl"
            }
          >
            {value}
          </span>
        }
      />
      <div className="mt-2 text-[10px] text-ink-500 leading-tight">{hint}</div>
    </motion.div>
  );
}

/* ----- Generation status banner ----- */

function GenStatusBanner({
  status,
  source,
  error,
  generatedAt,
  onRegenerate,
  readOnly = false,
}: {
  status: GenStatus;
  source: string;
  error: string;
  generatedAt: number | null;
  onRegenerate: () => void;
  readOnly?: boolean;
}) {
  if (status === "idle" || status === "checking") {
    // Read-only (recruiter) view: the empty state is rendered by the page body
    // with a recruiter-appropriate message - no "generate" prompt here.
    if (readOnly) return null;
    return (
      <Card variant="default" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl2 px-5 py-4 text-xs">
        <div className="flex items-center gap-2.5 text-ink-600">
          <span className="inline-block h-2 w-2 rounded-full bg-ink-400" />
          <span>No Fit Score report has been generated yet. Complete an interview, then return here to generate your personalized report with TalEdge AI.</span>
        </div>
        <Button type="button" onClick={onRegenerate} variant="primary" size="sm" className="bg-ink-900 hover:bg-ink-800">
          Generate now
        </Button>
      </Card>
    );
  }
  if (status === "generating") {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl2 border border-brand-100 bg-brand-50/60 backdrop-blur-xl px-5 py-4 text-xs text-brand-900 shadow-panel relative overflow-hidden w-full">
        <LoaderIcon className="w-4 h-4 text-brand-600 animate-spin shrink-0" />
        <div>
          <span className="font-bold">Synthesizing personalized Fit Score report... </span>
          <span className="text-brand-700/80">Grounding narrative, technical, and behavioural insights in your interview responses using TalEdge AI.</span>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-100/50">
          <motion.div
            className="h-full bg-brand-600"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            style={{ width: "50%" }}
          />
        </div>
      </div>
    );
  }
  if (status === "generated") {
    const ago =
      generatedAt != null
        ? `${Math.max(1, Math.round((Date.now() - generatedAt) / 1000))}s ago`
        : "just now";
    // The "summary" source is a headline fallback (aggregate scores only), not a
    // full LLM generation - label it honestly rather than "generated by AI".
    const isSummary = source === "summary";
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl2 border border-emerald-200/50 bg-emerald-50/60 backdrop-blur-xl px-5 py-3.5 text-xs shadow-panel">
        <div className="flex items-center gap-2.5 text-ink-800">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          {isSummary ? (
            <span>
              Headline Fit Score summary from assessment results ·{" "}
              <span className="font-semibold text-emerald-700">detailed report pending</span>
            </span>
          ) : (
            <span>
              Personalized Fit Score report generated by{" "}
              <span className="font-bold text-ink-900">TalEdge AI</span> · <span className="font-semibold text-emerald-700">{ago}</span>
            </span>
          )}
        </div>
        {!readOnly && (
          <Button type="button" onClick={onRegenerate} variant="ghost" size="sm">
            Regenerate Report
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl2 border border-rose-200 bg-rose-50/60 backdrop-blur-xl px-5 py-3.5 text-xs shadow-panel">
      <div className="flex items-center gap-2.5 text-rose-800">
        <span className="inline-block h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-pulse" />
        <span className="font-medium">{error}</span>
      </div>
      <Button type="button" onClick={onRegenerate} variant="danger" size="sm">
        Retry
      </Button>
    </div>
  );
}

/* ----- Icons ----- */

function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M19 12H5M11 19l-7-7 7-7" />
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
function CheckCircle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function BrainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
      <path d="M9 13a4.5 4.5 0 0 0 3-4"/>
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-8">
      {/* Skeleton Headline */}
      <div className="bg-white/40 border border-ink-200/60 rounded-xl2 p-6 sm:p-8 flex flex-col lg:flex-row items-center gap-8 animate-pulse shadow-panel">
        <div className="w-44 h-44 rounded-full bg-ink-200/50 flex items-center justify-center shrink-0">
          <LoaderIcon className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
        <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-ink-200/30 rounded-xl2 p-4 h-36 flex flex-col justify-between">
              <div className="h-3 bg-ink-300/50 rounded w-2/3" />
              <div className="h-8 bg-ink-300/60 rounded w-1/2" />
              <div className="h-2.5 bg-ink-300/30 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton Narrative */}
      <div className="bg-ink-200/20 border border-ink-200/20 rounded-xl2 p-6 h-36 animate-pulse flex flex-col justify-between shadow-panel">
        <div className="h-3 bg-ink-300/50 rounded w-1/6" />
        <div className="space-y-2">
          <div className="h-3 bg-ink-300/40 rounded w-full" />
          <div className="h-3 bg-ink-300/40 rounded w-5/6" />
          <div className="h-3 bg-ink-300/40 rounded w-4/5" />
        </div>
      </div>

      {/* Skeleton Rubric */}
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-ink-200/40 rounded-xl w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-ink-200/20 border border-ink-200/20 rounded-xl2 p-6 h-48 flex flex-col justify-between">
              <div className="h-3 bg-ink-300/50 rounded w-1/3" />
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-2.5 bg-ink-300/40 rounded w-full" />
                    <div className="h-1.5 bg-ink-200/30 rounded w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoaderIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  );
}
