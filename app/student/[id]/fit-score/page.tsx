"use client";

import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const ROLE_JDS: Record<string, string> = {
  "Full-stack Software Engineer": "React, Next.js, Node.js, TypeScript, SQL databases, REST APIs, WebSockets, system architecture, performance optimization, and front-to-back testing. Experience building responsive web applications and designing end-to-end features.",
  "Backend Engineer": "Server-side languages (Node.js/Go/Python/Java), databases (SQL, Redis, MongoDB), system design, microservices, API architecture, performance tuning, and message queues. Experience with cloud infrastructure (AWS/GCP), CI/CD, and scaling distributed backend systems.",
  "Frontend Engineer": "JavaScript/TypeScript, React, Next.js, HTML5, CSS3, TailwindCSS. Solid understanding of responsive design, web performance, component architecture, accessibility, browser APIs, and modern state management. Strong design sense.",
  "Data / ML Engineer": "Python, SQL. Experience with machine learning frameworks (TensorFlow, PyTorch, Scikit-learn), libraries (Pandas, NumPy), data pipelines, neural networks, and model deployment. Knowledge of NLP/LLMs, computer vision, data engineering (Spark, Kafka).",
  "Product Manager": "Product lifecycle management, defining product roadmaps, evaluating technical and product trade-offs, writing PRDs, analyzing analytics metrics, and leading cross-functional engineering teams. Strong communication, product sense, problem decomposition, and customer empathy.",
  "Consultant · Strategy": "Analytical reasoning, problem-solving, structured case interview frameworks, market entry analysis, financial modeling, slide deck creation, business strategy. Ability to interface with clients, manage stakeholders, and design organizational growth playbooks."
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } }
};

export default function FitScorePage() {
  const params = useParams();
  const id = String(params.id);
  const s = getStudent(id);
  if (!s) notFound();

  const emptyReport: GenReport = {
    technical_score: -1,
    behavioural_score: -1,
    fit_score: -1,
    success_probability: -1,
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
        const lastTechUpdate = Number(localStorage.getItem(`taledge:interview:${id}:technical:updatedAt`) || 0);
        const lastBehavUpdate = Number(localStorage.getItem(`taledge:interview:${id}:behavioural:updatedAt`) || 0);
        const lastUpdate = Math.max(lastTechUpdate, lastBehavUpdate);
        
        // Auto-regenerate if a new interview has been taken since the report was generated
        if (parsed?.report?.fit_score != null && parsed.ts > lastUpdate) {
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

  const profile = readWorkspaceProfile();

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      
      {/* Animated background */}
      <div className="fixed inset-0 -z-20 min-h-screen bg-slate-50 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      <motion.section
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="container mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-600 uppercase rounded-full bg-indigo-50/80 border border-indigo-200/50 backdrop-blur-md shadow-sm">
              <ScoreIcon /> Fit Score & Success Probability
            </div>
            <Link 
              href={`/student/${s.id}`} 
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 transition-all duration-300 bg-white/60 border border-white/60 rounded-xl hover:bg-white/80 hover:shadow-lg hover:shadow-slate-200/20 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md"
            >
              <ArrowLeft /> Back to Dashboard
            </Link>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
            Structured feedback report for {s.name.split(" ")[0]}
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-600 sm:text-base">
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
        </motion.div>

        {status === "generating" ? (
          <ReportSkeleton />
        ) : (
          <div className="space-y-10">
            {/* HEADLINE NUMBERS */}
            <motion.div 
              variants={itemVariants}
              className="relative bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl overflow-hidden p-6 sm:p-8"
            >
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
                    hint="Behavioural interview; DNLA after import" 
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
                <div className="space-y-2.5 lg:col-span-3">
                  <button className="relative inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 hover:shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-0.5 active:scale-95 overflow-hidden ring-1 ring-white/10 w-full">
                    Publish to recruiters
                    <ArrowRight />
                  </button>
                  <Link
                    href={`/student/${s.id}/interview/technical`}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-slate-700 transition-all duration-300 bg-white/50 border border-white/60 rounded-2xl hover:bg-white/80 hover:shadow-lg hover:shadow-slate-200/20 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md w-full"
                  >
                    Reattempt assessment
                  </Link>
                  <Link
                    href={`/student/${s.id}/development`}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-slate-700 transition-all duration-300 bg-white/50 border border-white/60 rounded-2xl hover:bg-white/80 hover:shadow-lg hover:shadow-slate-200/20 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md w-full"
                  >
                    Development Pathway
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* Narrative summary */}
            {report.narrative && (
              <motion.div 
                variants={itemVariants}
                className="rounded-3xl border border-white/60 bg-white/50 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Executive summary</div>
                <p className="mt-3 text-base leading-relaxed text-slate-800 font-medium">
                  {report.narrative}
                </p>
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
                const rows = report.resume_breakdown.flatMap(g => g.rows);
                if (rows.length === 0) return 0;
                const sum = rows.reduce((acc, r) => acc + (r[1] || 0), 0);
                return Math.round(sum / rows.length);
              })()}
              groups={report.resume_breakdown}
            />

            {/* JD VS RESUME MATCH ANALYSIS */}
            {status === "generated" && (
              <motion.div 
                variants={itemVariants}
                className="relative bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden p-6 sm:p-8 animate-fade-in"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/50 pb-4 mb-5">
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.2em] text-indigo-500 uppercase">Comparative Fit Analysis</div>
                    <h3 className="text-lg font-bold text-slate-800 mt-1">Job Description (JD) vs. Resume Alignment</h3>
                  </div>
                  <div className="px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50/80 border border-indigo-200/50 rounded-full">
                    Target Role: {profile.targetRole || s.targetRole}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* JD Column */}
                  <div className="bg-white/30 border border-white/40 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-2.5">Target JD Core Requirements</div>
                    <p className="text-sm leading-relaxed text-slate-700 font-medium">
                      {ROLE_JDS[profile.targetRole || s.targetRole] || `Required foundational skills, core engineering competencies, communication, and target role expertise.`}
                    </p>
                  </div>
                  
                  {/* Resume Column */}
                  <div className="bg-white/30 border border-white/40 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-2.5">Ingested Resume Profile</div>
                    {profile.resumeSummary || s.resumeSummary ? (
                      <p className="text-sm leading-relaxed text-slate-700">
                        {profile.resumeSummary || s.resumeSummary}
                      </p>
                    ) : (
                      <p className="text-sm italic text-slate-500">
                        No resume uploaded. Ingested profile is currently empty.
                      </p>
                    )}
                    {((profile.resumeSkills && profile.resumeSkills.length > 0) || (s.skills && s.skills.length > 0)) && (
                      <div className="mt-4 pt-3 border-t border-slate-200/50">
                        <div className="text-[9px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-2">Parsed Skills</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(profile.resumeSkills?.length ? profile.resumeSkills : s.skills).map((skill: string) => (
                            <span key={skill} className="px-2 py-0.5 text-[10px] font-semibold text-slate-600 bg-white border border-slate-200/60 rounded-md">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* COMPONENT 3 · DNLA */}
            <motion.section variants={itemVariants} className="mt-12 w-full">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-600 uppercase rounded-full bg-indigo-50/80 border border-indigo-200/50 backdrop-blur-md shadow-sm">
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
                <Link href={`/student/${s.id}/dnla`} className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 bg-white/50 border border-white/60 rounded-2xl hover:bg-white/80 hover:shadow-lg hover:shadow-slate-200/20 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md !py-2 text-xs">
                  View full DNLA report
                  <ArrowRight />
                </Link>
              </div>
              <div className="w-full relative bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 p-6">
                <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                  Awaiting DNLA import
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-650">
                  DNLA competencies will appear only after verified external import.
                  Until then, behavioural scoring is based on interview evidence only.
                </p>
              </div>
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
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-600 uppercase rounded-full bg-indigo-50/80 border border-indigo-200/50 backdrop-blur-md shadow-sm">
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
              <div className="w-full relative bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 overflow-x-auto p-0">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-12 border-b border-white/40 bg-slate-50/60 px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <div className="col-span-4">Check</div>
                    <div className="col-span-6">Verdict</div>
                    <div className="col-span-2 text-right">Signal</div>
                  </div>
                  {report.cross_flags.length === 0 && (
                    <div className="px-6 py-6 text-sm text-slate-500">
                      Cross-component findings will be generated after the report is ready.
                    </div>
                  )}
                  {report.cross_flags.map((f) => (
                    <div
                      key={f.label}
                      className="grid grid-cols-12 items-center border-b border-slate-100 px-6 py-4.5 text-sm last:border-0 hover:bg-slate-50/30 transition-colors"
                    >
                      <div className="col-span-4 font-bold text-slate-900">{f.label}</div>
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
            </motion.section>

            {/* PUBLISH OR REATTEMPT */}
            <motion.section variants={itemVariants} className="mt-12">
              <div className="relative bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl overflow-hidden transition-all duration-300 p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="max-w-xl">
                    <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Decision point · Per PRD §4.3</div>
                    <h2 className="mt-2 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
                      Publish your Fit Score or reattempt the assessment
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                      Publishing makes your score visible to all empanelled organizations
                      through the recruiter portal. Reattempting resets the assessment so you
                      can improve your score after a coaching sprint.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/student/${s.id}/interview/technical`}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 bg-white/50 border border-white/65 rounded-2xl hover:bg-white/80 hover:shadow-lg hover:shadow-slate-200/20 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md"
                    >
                      Reattempt
                    </Link>
                    <button className="relative inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-650 hover:shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-0.5 active:scale-95 overflow-hidden ring-1 ring-white/10">
                      Publish to recruiters
                      <ArrowRight />
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* NEXT STEP */}
            <motion.section variants={itemVariants} className="mt-12">
              <div className="rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-500/10 to-blue-500/5 backdrop-blur-2xl p-6 sm:p-8 shadow-premium">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.2em] text-indigo-500 uppercase">Assessment Complete</div>
                    <div className="mt-1 text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 drop-shadow-sm">
                      Continue to your personalized Development Pathway
                    </div>
                    <p className="mt-2 max-w-2xl text-sm text-slate-650 leading-relaxed">
                      Translate these scores into a 6-week coach-matched sprint plan
                      with role-pivot pathways and longitudinal tracking.
                    </p>
                  </div>
                  <Link
                    href={`/student/${s.id}/development`}
                    className="relative inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-705 hover:from-indigo-500 hover:to-indigo-650 hover:shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-0.5 active:scale-95 overflow-hidden ring-1 ring-white/10"
                  >
                    Continue to Development Pathway
                    <ArrowRight />
                  </Link>
                </div>
              </div>
            </motion.section>
          </div>
        )}
      </motion.section>
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
    <motion.section variants={itemVariants} className="mt-12 w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-600 uppercase rounded-full bg-indigo-50/80 border border-indigo-200/50 backdrop-blur-md shadow-sm">
            <CheckCircle /> {tag}
          </div>
          <h2 className="mt-4 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">{desc}</p>
        </div>
        <div className="rounded-xl border border-white/40 bg-white/70 backdrop-blur-md px-4 py-3 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Component score
          </div>
          <div className="mt-1 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
            {score === -1 ? "Pending" : `${score}%`}
          </div>
        </div>
      </div>
      <div className={`w-full grid gap-4 ${
        groups.length === 1 
          ? "grid-cols-1" 
          : groups.length === 2 
          ? "grid-cols-1 md:grid-cols-2" 
          : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      }`}>
        {groups.length === 0 && (
          <div className="w-full relative bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 p-6 text-sm leading-relaxed text-slate-650 md:col-span-2 xl:col-span-3">
            No generated sub-scores yet. Complete the interviews and generate the
            report to populate this component.
          </div>
        )}
        {groups.map((g) => (
          <motion.div 
            key={g.group} 
            whileHover={{ y: -4 }}
            className="w-full relative bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 p-6"
          >
            <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">{g.group}</div>
            <div className="mt-4 space-y-3">
              {g.rows.map(([label, value]) => {
                const v = Math.max(0, Math.min(100, Number(value)));
                return (
                  <div key={String(label)}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-750 font-medium">{label}</span>
                      <span className="tabular-nums font-bold text-slate-900">{v}%</span>
                    </div>
                    <Bar
                      value={v}
                      tone={v >= 75 ? "success" : v >= 55 ? "dark" : "warn"}
                    />
                  </div>
                );
              })}
            </div>
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
      : "border-white/60 bg-white/45";

  const isText = typeof value === "string" && /[a-zA-Z]/.test(value);

  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ y: -3, boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}
      className={`rounded-3xl border ${accent} backdrop-blur-md p-5 flex flex-col justify-between min-h-[144px] transition-all duration-300 shadow-sm`}
    >
      <div>
        <div className="text-[9px] font-bold tracking-[0.2em] text-slate-450 uppercase">{label}</div>
        <div className={`mt-2 font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm ${
          isText ? "text-base sm:text-lg md:text-xl leading-snug font-bold" : "text-3xl sm:text-4xl md:text-5xl font-black"
        }`}>
          {value}
        </div>
      </div>
      <div className="mt-2 text-[10px] text-slate-500 leading-tight">{hint}</div>
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
}: {
  status: GenStatus;
  source: string;
  error: string;
  generatedAt: number | null;
  onRegenerate: () => void;
}) {
  if (status === "idle" || status === "checking") {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-xl px-5 py-4 text-xs shadow-md">
        <div className="flex items-center gap-2.5 text-slate-600">
          <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
          <span>No Fit Score report has been generated yet. Complete an interview, then return here to generate your personalized report with TalEdge AI.</span>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md hover:bg-slate-800 hover:-translate-y-0.5 transition-all"
        >
          Generate now
        </button>
      </div>
    );
  }
  if (status === "generating") {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 backdrop-blur-xl px-5 py-4 text-xs text-indigo-900 shadow-lg shadow-indigo-500/5 relative overflow-hidden w-full">
        <LoaderIcon className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
        <div>
          <span className="font-bold">Synthesizing personalized Fit Score report... </span>
          <span className="text-indigo-700/80">Grounding narrative, technical, and behavioural insights in your interview responses using TalEdge AI.</span>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-100/50">
          <motion.div 
            className="h-full bg-indigo-600"
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
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200/50 bg-emerald-50/60 backdrop-blur-xl px-5 py-3.5 text-xs shadow-md">
        <div className="flex items-center gap-2.5 text-slate-800">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          <span>
            Personalized Fit Score report generated by{" "}
            <span className="font-bold text-slate-900">TalEdge AI</span> · <span className="font-semibold text-emerald-700">{ago}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="px-4 py-2 border border-slate-200 bg-white/80 hover:bg-white text-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all hover:-translate-y-0.5"
        >
          Regenerate Report
        </button>
      </div>
    );
  }
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50/60 backdrop-blur-xl px-5 py-3.5 text-xs shadow-md">
      <div className="flex items-center gap-2.5 text-rose-800">
        <span className="inline-block h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-pulse" />
        <span className="font-medium">{error}</span>
      </div>
      <button
        type="button"
        onClick={onRegenerate}
        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all hover:-translate-y-0.5"
      >
        Retry
      </button>
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

function ReportSkeleton() {
  return (
    <div className="space-y-8">
      {/* Skeleton Headline */}
      <div className="bg-white/40 border border-white/60 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row items-center gap-8 animate-pulse shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="w-44 h-44 rounded-full bg-slate-200/50 flex items-center justify-center shrink-0">
          <LoaderIcon className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
        <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-200/30 rounded-2xl p-4 h-36 flex flex-col justify-between">
              <div className="h-3 bg-slate-350/50 rounded w-2/3" />
              <div className="h-8 bg-slate-350/60 rounded w-1/2" />
              <div className="h-2.5 bg-slate-350/30 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton Narrative */}
      <div className="bg-slate-200/20 border border-slate-200/20 rounded-3xl p-6 h-36 animate-pulse flex flex-col justify-between shadow-sm">
        <div className="h-3 bg-slate-300/50 rounded w-1/6" />
        <div className="space-y-2">
          <div className="h-3 bg-slate-300/40 rounded w-full" />
          <div className="h-3 bg-slate-300/40 rounded w-5/6" />
          <div className="h-3 bg-slate-300/40 rounded w-4/5" />
        </div>
      </div>

      {/* Skeleton Rubric */}
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200/40 rounded-xl w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-200/20 border border-slate-200/20 rounded-3xl p-6 h-48 flex flex-col justify-between">
              <div className="h-3 bg-slate-300/50 rounded w-1/3" />
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-2.5 bg-slate-300/40 rounded w-full" />
                    <div className="h-1.5 bg-slate-200/30 rounded w-full" />
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

function SparklesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.7L20 10l-5 4 1.5 6L12 17l-4.5 3L9 14l-5-4 6.1-1.3z" />
    </svg>
  );
}
