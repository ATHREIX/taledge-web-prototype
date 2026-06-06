"use client";

import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ScoreRing, Bar } from "@/components/score-ring";
import { getStudent } from "@/lib/data";

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

export default function FitScorePage() {
  const params = useParams();
  const id = String(params.id);
  const s = getStudent(id);
  if (!s) notFound();

  const emptyReport: GenReport = {
    technical_score: 0,
    behavioural_score: 0,
    fit_score: 0,
    success_probability: 0,
    verdict: "Awaiting evidence",
    narrative:
      "Complete the technical and behavioural interviews to generate a Fit Score grounded in captured assessment evidence. DNLA will be included only after the provider import is connected.",
    technical_breakdown: [],
    resume_breakdown: [],
    behavioural_breakdown: [],
    cross_flags: [],
  };

  const [report, setReport] = useState<GenReport>(emptyReport);
  const [status, setStatus] = useState<GenStatus>("idle");
  const [source, setSource] = useState<string>("not-generated");
  const [genError, setGenError] = useState<string>("");
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  const readTranscripts = useCallback(() => {
    try {
      const tech = localStorage.getItem(`taledge:interview:${id}:technical`);
      const behav = localStorage.getItem(`taledge:interview:${id}:behavioural`);
      const dnlaCache = localStorage.getItem(`taledge:dnla:${id}`);
      return {
        technical: tech ? (JSON.parse(tech) as Msg[]) : [],
        behavioural: behav ? (JSON.parse(behav) as Msg[]) : [],
        dnla: dnlaCache ? JSON.parse(dnlaCache).report : null,
      };
    } catch {
      return { technical: [] as Msg[], behavioural: [] as Msg[], dnla: null };
    }
  }, [id]);

  const readWorkspaceProfile = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem("taledge:workspace-profile") || "{}");
    } catch {
      return {};
    }
  }, []);

  const generate = useCallback(async () => {
    setStatus("generating");
    setGenError("");
    const { technical, behavioural, dnla } = readTranscripts();
    const profile = readWorkspaceProfile();
    try {
      const r = await fetch("/api/generate-fit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: id,
          candidateName: profile.fullName || s.name,
          targetRole: profile.targetRole || s.targetRole,
          resumeSummary: [
            profile.resumeSummary || s.resumeSummary,
            profile.aspiration ? `Career aspiration: ${profile.aspiration}` : "",
          ].filter(Boolean).join("\n"),
          resumeSkills: profile.resumeSkills?.length ? profile.resumeSkills : s.skills,
          resumeProjects: profile.resumeProjects?.length ? profile.resumeProjects : s.projects,
          technicalQA: technical,
          behaviouralQA: behavioural,
          dnla: dnla?.dnla || [],
          dnlaStrengths: dnla?.strengths || [],
          dnlaDevelopmentAreas: dnla?.developmentAreas || [],
          dnlaRisks: dnla?.risks || [],
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setStatus("error");
        setGenError(data?.error || "Couldn't generate the report.");
        return;
      }
      setReport(data.generated);
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
  }, [id, s, readTranscripts, readWorkspaceProfile]);

  useEffect(() => {
    setStatus("checking");
    let hydrated = false;
    try {
      const cached = localStorage.getItem(`taledge:fit-score:${id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.report?.fit_score != null) {
          setReport(parsed.report);
          setSource(parsed.source || "gemini-2.5-flash");
          setGeneratedAt(parsed.ts || null);
          setStatus("generated");
          hydrated = true;
        }
      }
    } catch {
      /* fall through to auto-generate */
    }
    if (!hydrated) {
      const { technical, behavioural } = readTranscripts();
      const userAnswers =
        technical.filter((m) => m.role === "user").length +
        behavioural.filter((m) => m.role === "user").length;
      if (userAnswers > 0) {
        void generate();
      } else {
        setStatus("idle");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="relative overflow-x-hidden">
      
      {/* Jaw-dropping animated background */}
      <div className="fixed inset-0 -z-20 min-h-screen bg-slate-50 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-amber-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
      </div>
{/* HERO */}
      <section className="relative border-b border-white/40 pt-8 pb-8 sm:pt-12 sm:pb-10">
        <div className="container mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-500 uppercase rounded-full bg-indigo-50/50 border border-indigo-200/50 backdrop-blur-md shadow-sm animate-fade-in">
              <ScoreIcon /> Step 05 of 06 · Fit Score & Success Probability
            </div>
            <Link href={`/student/${s.id}`} className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 bg-white/40 border border-white/40 rounded-2xl hover:bg-white/80 hover:shadow-lg hover:shadow-slate-200/20 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md !py-2 text-xs">
              <ArrowLeft /> Back
            </Link>
          </div>

          {/* Sequence rail */}
          <div className="mt-5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
            {["Profile", "Technical", "DNLA", "Behavioural", "Fit Score", "Pathway"].map((label, i) => {
              const state = i < 4 ? "done" : i === 4 ? "active" : "todo";
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <span
                    className={
                      state === "done"
                        ? "rounded-full bg-ink-900 px-2.5 py-1 text-white"
                        : state === "active"
                        ? "rounded-full border border-ink-900 bg-white px-2.5 py-1 text-ink-900"
                        : "rounded-full border border-ink-200 bg-white px-2.5 py-1 text-ink-400"
                    }
                  >
                    0{i + 1} · {label}
                  </span>
                  {i < 5 && <span className="text-slate-300">·</span>}
                </div>
              );
            })}
          </div>

          <h1 className="mt-7 max-w-4xl text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
            Structured feedback report for {s.name.split(" ")[0]}
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-500 sm:text-base">
            Composite Fit Score synthesized from technical interview, behavioural
            interview, resume signals, and cross-component checks. DNLA remains pending until import is connected.
          </p>

          {/* Generation status banner */}
          <GenStatusBanner
            status={status}
            source={source}
            error={genError}
            generatedAt={generatedAt}
            onRegenerate={generate}
          />
        </div>
      </section>

      <div className="container mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {/* HEADLINE NUMBERS */}
        <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 p-5 sm:p-7">
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
            <div className="flex justify-center lg:col-span-3">
              <ScoreRing
                value={report.success_probability}
                size={188}
                stroke={14}
                label="Success Probability"
                sub={status === "generated" ? `Fit Score · ${report.fit_score}` : "Awaiting report"}
                tone="dark"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:col-span-6 sm:grid-cols-3">
              <HeadlineStat label="Technical Score" value={report.technical_score} hint="Tech interview + coding" />
              <HeadlineStat label="Behavioural Score" value={report.behavioural_score} hint="Behavioural interview; DNLA after import" />
              <HeadlineStat label="Fit Score" value={report.fit_score} hint="Weighted composite" />
              <HeadlineStat label="Success Probability" value={`${report.success_probability}%`} hint="Likelihood of placement success" />
              <HeadlineStat label="Risk flags" value={report.cross_flags.filter(f => f.tone !== "ok").length} hint={report.cross_flags.some(f => f.tone === "danger") ? "Action required" : "Watch list"} tone={report.cross_flags.some(f => f.tone === "danger") ? "warn" : "ok"} />
              <HeadlineStat label="Verdict" value={report.verdict} hint={`Threshold ${report.fit_score >= 70 ? "met" : "below 70"}`} tone={report.fit_score >= 70 ? "ok" : "warn"} />
            </div>
            <div className="space-y-2 lg:col-span-3">
              <button className="relative inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 hover:shadow-xl hover:shadow-slate-900/20 hover:-translate-y-0.5 active:scale-95 overflow-hidden ring-1 ring-white/10 w-full">
                Publish to empanelled recruiters
                <ArrowRight />
              </button>
              <Link
                href={`/student/${s.id}/interview/technical`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 bg-white/40 border border-white/40 rounded-2xl hover:bg-white/80 hover:shadow-lg hover:shadow-slate-200/20 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md w-full"
              >
                Reattempt the assessment
              </Link>
              <Link
                href={`/student/${s.id}/development`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 bg-white/40 border border-white/40 rounded-2xl hover:bg-white/80 hover:shadow-lg hover:shadow-slate-200/20 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md w-full"
              >
                Continue to Development Pathway
              </Link>
            </div>
          </div>
        </div>

        {/* Narrative summary */}
        {report.narrative && (
          <div className="mt-6 rounded-2xl border border-white/40 bg-slate-50 p-5 sm:p-7">
            <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Executive summary</div>
            <p className="mt-3 text-base leading-relaxed text-slate-800">
              {report.narrative}
            </p>
          </div>
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
          score={0}
          groups={report.resume_breakdown}
        />

        {/* COMPONENT 3 · DNLA */}
        <section className="mt-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-500 uppercase rounded-full bg-indigo-50/50 border border-indigo-200/50 backdrop-blur-md shadow-sm">
                <BrainIcon /> Component 03
              </div>
              <h2 className="mt-4 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
                DNLA Social Competence
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Per PRD §9.3 · DNLA remains pending until the official provider
                import is connected. No placeholder psychometric scores are shown.
              </p>
            </div>
            <Link href={`/student/${s.id}/dnla`} className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 bg-white/40 border border-white/40 rounded-2xl hover:bg-white/80 hover:shadow-lg hover:shadow-slate-200/20 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md !py-2 text-xs">
              View full DNLA report
              <ArrowRight />
            </Link>
          </div>
          <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 p-5">
            <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
              Awaiting DNLA import
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
              DNLA competencies will appear only after verified external import.
              Until then, behavioural scoring is based on interview evidence only.
            </p>
          </div>
        </section>

        {/* COMPONENT 4 · BEHAVIOURAL INTERVIEW */}
        <RubricSection
          tag="Component 04"
          title="Behavioural Interview features"
          desc="Per PRD §9.4 · communication, content quality, ownership, consistency checks, and cultural fit indicators."
          score={report.behavioural_score}
          groups={report.behavioural_breakdown}
        />

        {/* COMPONENT 5 · CROSS COMPONENT FLAGS */}
        <section className="mt-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-500 uppercase rounded-full bg-indigo-50/50 border border-indigo-200/50 backdrop-blur-md shadow-sm">
                <FlagIcon /> Component 05
              </div>
              <h2 className="mt-4 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
                Cross-component features
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Per PRD §9.5 · gap analysis between resume claims and tech performance,
                confidence vs accuracy, and behaviour vs psychometric alignment.
              </p>
            </div>
          </div>
          <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 overflow-x-auto p-0">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-12 border-b border-white/40 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                <div className="col-span-4">Check</div>
                <div className="col-span-6">Verdict</div>
                <div className="col-span-2 text-right">Signal</div>
              </div>
              {report.cross_flags.length === 0 && (
                <div className="px-5 py-6 text-sm text-slate-500">
                  Cross-component findings will be generated after the report is ready.
                </div>
              )}
              {report.cross_flags.map((f) => (
                <div
                  key={f.label}
                  className="grid grid-cols-12 items-center border-b border-slate-100 px-5 py-3.5 text-sm last:border-0"
                >
                  <div className="col-span-4 font-medium text-slate-900">{f.label}</div>
                  <div className="col-span-6 text-slate-700">{f.verdict}</div>
                  <div className="col-span-2 text-right">
                    <span
                      className={
                        f.tone === "ok" ? "inline-flex items-center px-3 py-1 text-xs font-semibold text-emerald-600 bg-emerald-50/50 border border-emerald-200/50 rounded-full backdrop-blur-sm shadow-[0_0_15px_rgba(16,185,129,0.1)]" : f.tone === "warn" ? "inline-flex items-center px-3 py-1 text-xs font-semibold text-amber-600 bg-amber-50/50 border border-amber-200/50 rounded-full backdrop-blur-sm shadow-[0_0_15px_rgba(245,158,11,0.1)]" : "inline-flex items-center px-3 py-1 text-xs font-semibold text-rose-600 bg-rose-50/50 border border-rose-200/50 rounded-full backdrop-blur-sm shadow-[0_0_15px_rgba(244,63,94,0.1)]"
                      }
                    >
                      {f.tone === "ok" ? "All clear" : f.tone === "warn" ? "Watch" : "Red flag"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PUBLISH OR REATTEMPT */}
        <section className="mt-12">
          <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-xl">
                <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Decision point · Per PRD §4.3</div>
                <h2 className="mt-2 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
                  Publish your Fit Score or reattempt the assessment
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Publishing makes your score visible to all empanelled organizations
                  through the recruiter portal. Reattempting resets the assessment so you
                  can improve your score after a coaching sprint.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/student/${s.id}/interview/technical`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 bg-white/40 border border-white/40 rounded-2xl hover:bg-white/80 hover:shadow-lg hover:shadow-slate-200/20 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md"
                >
                  Reattempt
                </Link>
                <button className="relative inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 hover:shadow-xl hover:shadow-slate-900/20 hover:-translate-y-0.5 active:scale-95 overflow-hidden ring-1 ring-white/10">
                  Publish to recruiters
                  <ArrowRight />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* NEXT STEP */}
        <section className="mt-12">
          <div className="rounded-2xl border border-white/40 bg-slate-50 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Step 05 complete</div>
                <div className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">
                  Continue to your personalized Development Pathway
                </div>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Step 06 translates these scores into a 6-week coach-matched sprint plan
                  with role-pivot pathways and longitudinal tracking.
                </p>
              </div>
              <Link
                href={`/student/${s.id}/development`}
                className="relative inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 hover:shadow-xl hover:shadow-slate-900/20 hover:-translate-y-0.5 active:scale-95 overflow-hidden ring-1 ring-white/10"
              >
                Next · Step 06 · Development Pathway
                <ArrowRight />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ----- Generation status banner ----- */

function GenStatusBanner({
  status,
  source,
  error,
  generatedAt,
  onRegenerate,
}: {
  status: GenStatus;
  source: string;
  error: string;
  generatedAt: number | null;
  onRegenerate: () => void;
}) {
  if (status === "idle" || status === "checking") {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/40 bg-white px-4 py-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
          No Fit Score report has been generated yet. Complete an interview, then
          return here to generate your personalized report with Gemini 2.5 Flash.
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="text-xs font-medium text-slate-900 underline-offset-4 hover:underline"
        >
          Generate now
        </button>
      </div>
    );
  }
  if (status === "generating") {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/40 bg-white px-4 py-3 text-xs text-slate-700">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-slate-900" />
        Synthesizing your final report with Gemini 2.5 Flash across captured
        assessment evidence...
      </div>
    );
  }
  if (status === "generated") {
    const ago =
      generatedAt != null
        ? `${Math.max(1, Math.round((Date.now() - generatedAt) / 1000))}s ago`
        : "just now";
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-xs backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Personalized Fit Score report generated by{" "}
          <span className="font-semibold">{source}</span> · {ago}
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="text-xs font-medium text-slate-900 underline-offset-4 hover:underline"
        >
          Regenerate
        </button>
      </div>
    );
  }
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-xs backdrop-blur-xl shadow-sm">
      <div className="flex items-center gap-2 text-slate-800">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
        {error}
      </div>
      <button
        type="button"
        onClick={onRegenerate}
        className="text-xs font-medium text-slate-900 underline-offset-4 hover:underline"
      >
        Retry
      </button>
    </div>
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
  return (
    <section className="mt-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-500 uppercase rounded-full bg-indigo-50/50 border border-indigo-200/50 backdrop-blur-md shadow-sm">
            <CheckCircle /> {tag}
          </div>
          <h2 className="mt-4 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">{desc}</p>
        </div>
        <div className="rounded-xl border border-white/40 bg-white px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Component score
          </div>
          <div className="mt-1 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">{score}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.length === 0 && (
          <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 p-5 text-sm leading-relaxed text-slate-600 md:col-span-2 xl:col-span-3">
            No generated sub-scores yet. Complete the interviews and generate the
            report to populate this component.
          </div>
        )}
        {groups.map((g) => (
          <div key={g.group} className="relative bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 p-5">
            <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">{g.group}</div>
            <div className="mt-3 space-y-2.5">
              {g.rows.map(([label, value]) => {
                const v = Math.max(0, Math.min(100, Number(value)));
                return (
                  <div key={String(label)}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-700">{label}</span>
                      <span className="tabular-nums font-semibold text-slate-900">{v}</span>
                    </div>
                    <Bar
                      value={v}
                      tone={v >= 75 ? "success" : v >= 55 ? "dark" : "warn"}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
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
      ? "border-emerald-200"
      : tone === "warn"
      ? "border-amber-200"
      : "border-ink-200";
  return (
    <div className={`rounded-xl border ${accent} bg-white p-4`}>
      <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">{label}</div>
      <div className="mt-2 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
        {value}
      </div>
      <div className="mt-0.5 text-xs text-slate-500">{hint}</div>
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
function ScoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5z" />
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
