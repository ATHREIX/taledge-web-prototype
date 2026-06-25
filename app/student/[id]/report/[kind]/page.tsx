"use client";

import { notFound, useParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ScoreRing, Bar } from "@/components/score-ring";
import { getStudent } from "@/lib/data";
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

/**
 * Per-interview report. The same /api/generate-fit-score generator is reused but
 * scoped to a SINGLE round's transcript, so each interview gets its own report:
 *   - kind "ai"   → the AI (technical) interview  → technical + resume components
 *   - kind "dnla" → the DNLA behavioural interview → behavioural + resume components
 * Results are cached at taledge:report:{id}:{kind} so the comparison report can
 * diff them without re-generating. See /comparison.
 */
const KINDS = {
  ai: {
    label: "AI Interview",
    eyebrow: "AI Interview Report",
    transcriptKey: (id: string) => `taledge:interview:${id}:technical`,
    primary: "technical" as const,
    desc: "Structured evaluation of the AI (skills) interview - grounded in your transcript and resume signals.",
  },
  dnla: {
    label: "DNLA Interview",
    eyebrow: "DNLA Interview Report",
    transcriptKey: (id: string) => `taledge:interview:${id}:dnla`,
    primary: "behavioural" as const,
    desc: "Structured evaluation of the DNLA behavioural interview - psychometric and conduct signals from your transcript.",
  },
} as const;

type Kind = keyof typeof KINDS;

const emptyReport: GenReport = {
  technical_score: -1,
  behavioural_score: -1,
  fit_score: -1,
  success_probability: -1,
  verdict: "Awaiting evidence",
  narrative: "",
  technical_breakdown: [],
  resume_breakdown: [],
  behavioural_breakdown: [],
  cross_flags: [],
};

function normalizeReport(raw: Partial<GenReport> | null | undefined): GenReport {
  const r = raw ?? {};
  return {
    technical_score: typeof r.technical_score === "number" ? r.technical_score : -1,
    behavioural_score: typeof r.behavioural_score === "number" ? r.behavioural_score : -1,
    fit_score: typeof r.fit_score === "number" ? r.fit_score : -1,
    success_probability: typeof r.success_probability === "number" ? r.success_probability : -1,
    verdict: r.verdict || "Awaiting verdict",
    narrative: r.narrative || "",
    technical_breakdown: Array.isArray(r.technical_breakdown) ? r.technical_breakdown : [],
    resume_breakdown: Array.isArray(r.resume_breakdown) ? r.resume_breakdown : [],
    behavioural_breakdown: Array.isArray(r.behavioural_breakdown) ? r.behavioural_breakdown : [],
    cross_flags: Array.isArray(r.cross_flags) ? r.cross_flags : [],
  };
}

export default function InterviewReportPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = String(params.id);
  const kindParam = String(params.kind);
  if (kindParam !== "ai" && kindParam !== "dnla") notFound();
  const kind = kindParam as Kind;
  const cfg = KINDS[kind];

  const s = getStudent(id);
  if (!s) notFound();

  const isExam = !!pathname && pathname.startsWith("/exam");
  const flowBase = isExam ? "/exam" : "/student";
  const track: "placement" | "exam" = isExam ? "exam" : "placement";

  const [report, setReport] = useState<GenReport>(emptyReport);
  const [status, setStatus] = useState<GenStatus>("idle");
  const [genError, setGenError] = useState<string>("");
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  const cacheKey = `taledge:report:${id}:${kind}`;

  const readTranscript = useCallback((): Msg[] => {
    try {
      const raw = localStorage.getItem(cfg.transcriptKey(id));
      return raw ? (JSON.parse(raw) as Msg[]) : [];
    } catch {
      return [];
    }
  }, [id, cfg]);

  const readWorkspaceProfile = useCallback(() => {
    try {
      const stored =
        localStorage.getItem("taledge:workspace-profile") ||
        localStorage.getItem("taledge:demo-profile");
      return JSON.parse(stored || "{}");
    } catch {
      return {};
    }
  }, []);

  const generate = useCallback(async () => {
    setStatus("generating");
    setGenError("");
    const transcript = readTranscript();
    const profile = readWorkspaceProfile();
    // Scope the shared generator to this round: send only this interview's
    // transcript in the matching slot, leaving the other slot empty (-> -1/pending).
    const technicalQA = cfg.primary === "technical" ? transcript : [];
    const behaviouralQA = cfg.primary === "behavioural" ? transcript : [];
    try {
      const r = await authedFetch("/api/generate-fit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: id,
          track,
          candidateName: profile.fullName || s.name,
          targetRole: profile.targetRole || s.targetRole,
          resumeSummary: [
            profile.resumeSummary || s.resumeSummary,
            profile.aspiration ? `Career aspiration: ${profile.aspiration}` : "",
          ].filter(Boolean).join("\n"),
          resumeSkills: profile.resumeSkills?.length ? profile.resumeSkills : s.skills,
          resumeProjects: profile.resumeProjects?.length ? profile.resumeProjects : s.projects,
          technicalQA,
          behaviouralQA,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setStatus("error");
        setGenError(data?.error || "Couldn't generate this report.");
        return;
      }
      const normalized = normalizeReport(data.generated);
      setReport(normalized);
      setGeneratedAt(Date.now());
      setStatus("generated");
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ report: data.generated, source: data.source, ts: Date.now() })
        );
      } catch {
        /* non-fatal */
      }
    } catch (e: any) {
      setStatus("error");
      setGenError(e?.message || "Network error while generating.");
    }
  }, [id, s, track, cfg, cacheKey, readTranscript, readWorkspaceProfile]);

  useEffect(() => {
    setStatus("checking");
    let hydrated = false;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const lastUpdate = Number(
          localStorage.getItem(`${cfg.transcriptKey(id)}:updatedAt`) || 0
        );
        if (parsed?.report && parsed.ts > lastUpdate) {
          setReport(normalizeReport(parsed.report));
          setGeneratedAt(parsed.ts || null);
          setStatus("generated");
          hydrated = true;
        }
      }
    } catch {
      /* fall through */
    }
    if (!hydrated) {
      const answers = readTranscript().filter((m) => m.role === "user").length;
      if (answers > 0) void generate();
      else setStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind]);

  const profile = readWorkspaceProfile();
  const candidateName: string = (profile.fullName && String(profile.fullName).trim()) || s.name;
  const candidateFirst = candidateName.split(" ")[0];

  const primaryScore = cfg.primary === "technical" ? report.technical_score : report.behavioural_score;
  const primaryBreakdown = cfg.primary === "technical" ? report.technical_breakdown : report.behavioural_breakdown;
  const primaryLabel = cfg.primary === "technical" ? "Skills Score" : "Behavioural Score";

  return (
    <PageShell>
      <motion.section initial="hidden" animate="visible" variants={containerVariants}>
        <motion.div variants={itemVariants} className="mb-8">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Workspace", href: `${flowBase}/${s.id}` },
              { label: "Assessment", href: `${flowBase}/${s.id}/dnla` },
              { label: cfg.label },
            ]}
          />
          <PageHeader
            eyebrow={cfg.eyebrow}
            title={`${cfg.label} report for ${candidateFirst}`}
            description={cfg.desc}
            actions={
              <div className="flex items-center gap-2 print:hidden">
                <Button type="button" variant="ghost" size="sm" onClick={() => window.print()}>
                  Print / PDF
                </Button>
                <ButtonLink href={`${flowBase}/${s.id}/comparison`} variant="ghost" size="sm">
                  Comparison report
                </ButtonLink>
              </div>
            }
          />

          {/* status line */}
          {status === "generated" && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-emerald-200/50 bg-emerald-50/60 px-5 py-3 text-xs">
              <span className="flex items-center gap-2 text-ink-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Generated by <span className="font-bold text-ink-900">TalEdge AI</span>
                {generatedAt ? ` · ${Math.max(1, Math.round((Date.now() - generatedAt) / 1000))}s ago` : ""}
              </span>
              <Button type="button" onClick={generate} variant="ghost" size="sm">Regenerate</Button>
            </div>
          )}
          {status === "error" && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-rose-200 bg-rose-50/60 px-5 py-3 text-xs">
              <span className="font-medium text-rose-700">{genError}</span>
              <Button type="button" onClick={generate} variant="danger" size="sm">Retry</Button>
            </div>
          )}
        </motion.div>

        {status === "generating" || status === "checking" ? (
          <Card variant="default" className="rounded-xl2 p-12 text-center">
            <p className="text-sm text-ink-500">Synthesizing your {cfg.label} report…</p>
          </Card>
        ) : status === "idle" ? (
          <motion.div variants={itemVariants}>
            <Card variant="default" className="rounded-xl2 p-10 text-center">
              <Eyebrow className="text-brand-500">No interview evidence yet</Eyebrow>
              <Heading as="h2" className="mt-3">Complete the {cfg.label} to unlock this report</Heading>
              <p className="mx-auto mt-3 max-w-lg text-sm text-ink-600">
                We could not find a captured {cfg.label} transcript for {candidateFirst}.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <ButtonLink
                  href={`${flowBase}/${s.id}/interview/${kind === "ai" ? "technical" : "dnla"}`}
                  variant="primary"
                  size="lg"
                >
                  Start the {cfg.label}
                </ButtonLink>
                <Button type="button" onClick={generate} variant="ghost" size="lg">Generate now</Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Headline */}
            <motion.div variants={itemVariants}>
              <Card variant="default" className="rounded-xl2 p-6 sm:p-8">
                <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
                  <div className="flex justify-center lg:col-span-3">
                    <ScoreRing
                      value={primaryScore === -1 ? 0 : primaryScore}
                      size={180}
                      stroke={14}
                      label={primaryLabel}
                      sub={`Fit · ${report.fit_score === -1 ? "-" : `${report.fit_score}%`}`}
                      tone={primaryScore === -1 ? "muted" : primaryScore >= 75 ? "success" : primaryScore >= 55 ? "warn" : "danger"}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-9">
                    <HeadlineStat label={primaryLabel} value={primaryScore === -1 ? "Pending" : `${primaryScore}%`} hint={`${cfg.label} performance`} />
                    <HeadlineStat label="Resume Alignment" value={resumeAvg(report) == null ? "Pending" : `${resumeAvg(report)}%`} hint="Resume vs target role" />
                    <HeadlineStat label="Fit Score" value={report.fit_score === -1 ? "Pending" : `${report.fit_score}%`} hint="This round's composite" />
                    <HeadlineStat label="Success Probability" value={report.success_probability === -1 ? "Pending" : `${report.success_probability}%`} hint="Placement likelihood" />
                    <HeadlineStat label="Verdict" value={report.verdict} hint="One-line assessment" tone={report.fit_score >= 70 ? "ok" : "warn"} />
                    <HeadlineStat label="Flags" value={report.cross_flags.filter((f) => f.tone !== "ok").length} hint="Items to watch" tone={report.cross_flags.some((f) => f.tone === "danger") ? "warn" : "ok"} />
                  </div>
                </div>
              </Card>
            </motion.div>

            {report.narrative && (
              <motion.div variants={itemVariants}>
                <Card variant="default" className="rounded-xl2 p-6 sm:p-8">
                  <Eyebrow>Executive summary</Eyebrow>
                  <p className="mt-3 text-base font-medium leading-relaxed text-ink-800">{report.narrative}</p>
                </Card>
              </motion.div>
            )}

            <RubricSection
              title={cfg.primary === "technical" ? "Skills interview features" : "Behavioural interview features"}
              desc={cfg.primary === "technical" ? "Accuracy, depth, problem-solving and delivery signals from the AI interview." : "Communication, conduct, conflict, and psychometric signals from the DNLA interview."}
              score={primaryScore}
              groups={primaryBreakdown}
            />

            <RubricSection
              title="Resume & profile features"
              desc="Skill match against the target role, project quality, and resume signal density."
              score={resumeAvg(report) ?? 0}
              groups={report.resume_breakdown}
            />

            {report.cross_flags.length > 0 && (
              <motion.section variants={itemVariants}>
                <div className="mb-4">
                  <Eyebrow className="text-brand-500">Consistency checks</Eyebrow>
                  <Heading className="mt-2 sm:text-2xl">Cross-component findings</Heading>
                </div>
                <Card variant="default" className="rounded-xl2 p-0 overflow-x-auto">
                  <div className="min-w-[560px]">
                    {report.cross_flags.map((f) => (
                      <div key={f.label} className="grid grid-cols-12 items-center border-b border-ink-100 px-6 py-4 text-sm last:border-0">
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
            )}

            {/* Next step */}
            <motion.section variants={itemVariants}>
              <div className="rounded-xl2 border border-brand-200 bg-brand-50/70 p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <Eyebrow className="text-brand-500">Next</Eyebrow>
                    <Heading className="mt-1 sm:text-2xl">
                      {kind === "ai" ? "Continue to the DNLA interview report" : "Compare both interviews"}
                    </Heading>
                    <p className="mt-2 max-w-xl text-sm text-ink-600">
                      {kind === "ai"
                        ? "Then view the comparison report that diffs your AI and DNLA rounds side by side."
                        : "See how your AI (skills) round and DNLA (behavioural) round line up."}
                    </p>
                  </div>
                  <ButtonLink
                    href={kind === "ai" ? `${flowBase}/${s.id}/report/dnla` : `${flowBase}/${s.id}/comparison`}
                    variant="primary"
                    size="lg"
                  >
                    {kind === "ai" ? "DNLA interview report" : "View comparison report"}
                  </ButtonLink>
                </div>
              </div>
            </motion.section>
          </div>
        )}
      </motion.section>
    </PageShell>
  );
}

/** Mean of all resume_breakdown rows, rounded; null when none. */
function resumeAvg(report: GenReport): number | null {
  const rows = report.resume_breakdown.flatMap((g) => g?.rows ?? []);
  if (rows.length === 0) return null;
  const sum = rows.reduce((acc, r) => acc + (Number(r?.[1]) || 0), 0);
  return Math.round(sum / rows.length);
}

function RubricSection({
  title,
  desc,
  score,
  groups,
}: {
  title: string;
  desc: string;
  score: number;
  groups: { group: string; rows: (string | number)[][] }[];
}) {
  const safeGroups = Array.isArray(groups) ? groups : [];
  return (
    <motion.section variants={itemVariants}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Heading className="sm:text-2xl">{title}</Heading>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">{desc}</p>
        </div>
        <Card variant="default" className="rounded-xl px-4 py-2.5">
          <Eyebrow>Component score</Eyebrow>
          <div className="mt-1 text-3xl font-bold sm:text-4xl">{score === -1 ? "Pending" : `${score}%`}</div>
        </Card>
      </div>
      <div className={`grid gap-4 ${safeGroups.length <= 1 ? "grid-cols-1" : safeGroups.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
        {safeGroups.length === 0 && (
          <Card variant="default" className="rounded-xl2 p-6 text-sm text-ink-600 md:col-span-2 xl:col-span-3">
            No generated sub-scores yet for this section.
          </Card>
        )}
        {safeGroups.map((g) => (
          <Card key={g.group} variant="default" hover className="rounded-xl2 p-6">
            <Eyebrow>{g.group}</Eyebrow>
            <div className="mt-4 space-y-3">
              {(Array.isArray(g.rows) ? g.rows : []).map(([label, value]) => {
                const v = Math.max(0, Math.min(100, Number(value)));
                return (
                  <div key={String(label)}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-700">{label}</span>
                      <span className="font-bold tabular-nums text-ink-900">{v}%</span>
                    </div>
                    <Bar value={v} tone={v >= 75 ? "success" : v >= 55 ? "dark" : "warn"} />
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </motion.section>
  );
}

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
    tone === "ok" ? "border-emerald-200/50 bg-emerald-500/[0.04]" : tone === "warn" ? "border-amber-200/50 bg-amber-500/[0.04]" : "border-ink-200/60 bg-white/45";
  const isText = typeof value === "string" && /[a-zA-Z]/.test(value);
  const statTone = tone === "ok" ? "success" : tone === "warn" ? "warn" : "neutral";
  return (
    <div className={`rounded-xl2 border ${accent} p-5 flex flex-col justify-between min-h-[132px] shadow-panel`}>
      <Stat
        label={label}
        tone={statTone}
        value={<span className={isText ? "text-base sm:text-lg leading-snug" : "text-3xl sm:text-4xl"}>{value}</span>}
      />
      <div className="mt-2 text-[10px] leading-tight text-ink-500">{hint}</div>
    </div>
  );
}
