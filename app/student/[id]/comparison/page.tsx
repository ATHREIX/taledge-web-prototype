"use client";

import { notFound, useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bar } from "@/components/score-ring";
import { getStudent } from "@/lib/data";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  ButtonLink,
  Badge,
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

type Status = "idle" | "loading" | "ready" | "error";

/**
 * Comparison report. Loads the two per-interview reports (AI interview + DNLA
 * interview), generating either if it is missing, then diffs them side by side:
 * primary score per round, fit, success probability, resume-alignment
 * consistency (both derive from the same resume, so a wide gap is a signal), the
 * stronger round, and the union of each round's consistency flags. Reuses the
 * same /api/generate-fit-score generator scoped to one transcript per round.
 */
const ROUNDS = {
  ai: {
    label: "AI Interview",
    short: "AI (skills)",
    transcriptKey: (id: string) => `taledge:interview:${id}:technical`,
    primary: "technical" as const,
    interviewMode: "technical",
  },
  dnla: {
    label: "DNLA Interview",
    short: "DNLA (behavioural)",
    transcriptKey: (id: string) => `taledge:interview:${id}:dnla`,
    primary: "behavioural" as const,
    interviewMode: "dnla",
  },
} as const;

type RoundKey = keyof typeof ROUNDS;

function normalizeReport(raw: Partial<GenReport> | null | undefined): GenReport {
  const r = raw ?? {};
  return {
    technical_score: typeof r.technical_score === "number" ? r.technical_score : -1,
    behavioural_score: typeof r.behavioural_score === "number" ? r.behavioural_score : -1,
    fit_score: typeof r.fit_score === "number" ? r.fit_score : -1,
    success_probability: typeof r.success_probability === "number" ? r.success_probability : -1,
    verdict: r.verdict || "—",
    narrative: r.narrative || "",
    technical_breakdown: Array.isArray(r.technical_breakdown) ? r.technical_breakdown : [],
    resume_breakdown: Array.isArray(r.resume_breakdown) ? r.resume_breakdown : [],
    behavioural_breakdown: Array.isArray(r.behavioural_breakdown) ? r.behavioural_breakdown : [],
    cross_flags: Array.isArray(r.cross_flags) ? r.cross_flags : [],
  };
}

function resumeAvg(report: GenReport): number | null {
  const rows = report.resume_breakdown.flatMap((g) => g?.rows ?? []);
  if (rows.length === 0) return null;
  return Math.round(rows.reduce((a, r) => a + (Number(r?.[1]) || 0), 0) / rows.length);
}

function primaryScore(report: GenReport, round: RoundKey): number {
  return ROUNDS[round].primary === "technical" ? report.technical_score : report.behavioural_score;
}

export default function ComparisonReportPage() {
  const params = useParams();
  const pathname = usePathname();
  const id = String(params.id);
  const s = getStudent(id);
  if (!s) notFound();

  const isExam = !!pathname && pathname.startsWith("/exam");
  const flowBase = isExam ? "/exam" : "/student";
  const track: "placement" | "exam" = isExam ? "exam" : "placement";

  const [reports, setReports] = useState<Record<RoundKey, GenReport | null>>({ ai: null, dnla: null });
  const [missing, setMissing] = useState<RoundKey[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

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

  const readTranscript = useCallback((round: RoundKey): Msg[] => {
    try {
      const raw = localStorage.getItem(ROUNDS[round].transcriptKey(id));
      return raw ? (JSON.parse(raw) as Msg[]) : [];
    } catch {
      return [];
    }
  }, [id]);

  // Generate one round's report via the shared scoped generator, cache it, return it.
  const generateRound = useCallback(async (round: RoundKey): Promise<GenReport | null> => {
    const cfg = ROUNDS[round];
    const transcript = readTranscript(round);
    if (transcript.filter((m) => m.role === "user").length === 0) return null;
    const profile = readWorkspaceProfile();
    const technicalQA = cfg.primary === "technical" ? transcript : [];
    const behaviouralQA = cfg.primary === "behavioural" ? transcript : [];
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
    if (!r.ok || !data.ok) throw new Error(data?.error || `Couldn't generate the ${cfg.label} report.`);
    try {
      localStorage.setItem(
        `taledge:report:${id}:${round}`,
        JSON.stringify({ report: data.generated, source: data.source, ts: Date.now() })
      );
    } catch {
      /* non-fatal */
    }
    return normalizeReport(data.generated);
  }, [id, s, track, readTranscript, readWorkspaceProfile]);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    const out: Record<RoundKey, GenReport | null> = { ai: null, dnla: null };
    const missingRounds: RoundKey[] = [];
    try {
      for (const round of ["ai", "dnla"] as RoundKey[]) {
        // Prefer a fresh cached report; otherwise generate it on the fly.
        let report: GenReport | null = null;
        try {
          const cached = localStorage.getItem(`taledge:report:${id}:${round}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            const lastUpdate = Number(localStorage.getItem(`${ROUNDS[round].transcriptKey(id)}:updatedAt`) || 0);
            if (parsed?.report && parsed.ts > lastUpdate) report = normalizeReport(parsed.report);
          }
        } catch {
          /* fall through to generate */
        }
        if (!report) report = await generateRound(round);
        if (!report) missingRounds.push(round);
        out[round] = report;
      }
      setReports(out);
      setMissing(missingRounds);
      setStatus("ready");
    } catch (e: any) {
      setError(e?.message || "Could not build the comparison report.");
      setStatus("error");
    }
  }, [id, generateRound]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const profile = readWorkspaceProfile();
  const candidateFirst = ((profile.fullName && String(profile.fullName).trim()) || s.name).split(" ")[0];

  const ai = reports.ai;
  const dnla = reports.dnla;
  const bothReady = !!ai && !!dnla;

  const analysis = useMemo(() => {
    if (!ai || !dnla) return null;
    const aiP = primaryScore(ai, "ai");
    const dnlaP = primaryScore(dnla, "dnla");
    const aiResume = resumeAvg(ai);
    const dnlaResume = resumeAvg(dnla);

    const flags: CrossFlag[] = [];
    // Both reports score the SAME resume — a wide gap means low signal stability.
    if (aiResume != null && dnlaResume != null) {
      const d = Math.abs(aiResume - dnlaResume);
      flags.push({
        label: "Resume-signal consistency",
        verdict: d <= 10
          ? `Resume alignment read consistently across both rounds (${aiResume}% vs ${dnlaResume}%).`
          : `Resume alignment diverged between rounds (${aiResume}% vs ${dnlaResume}%) — interpret round scores with that variance in mind.`,
        tone: d <= 10 ? "ok" : d <= 20 ? "warn" : "danger",
      });
    }
    // Skills vs behaviour balance.
    if (aiP >= 0 && dnlaP >= 0) {
      const d = Math.abs(aiP - dnlaP);
      const stronger = aiP >= dnlaP ? "AI (skills)" : "DNLA (behavioural)";
      const weaker = aiP >= dnlaP ? "DNLA (behavioural)" : "AI (skills)";
      flags.push({
        label: "Skills vs behaviour balance",
        verdict: d <= 10
          ? `Balanced profile — skills and behavioural performance are within ${d} pts.`
          : `${stronger} clearly outperformed ${weaker} by ${d} pts; prioritise developing the ${weaker} round.`,
        tone: d <= 10 ? "ok" : d <= 20 ? "warn" : "danger",
      });
    }
    // Surface the most serious flags raised inside each round.
    [["AI", ai] as const, ["DNLA", dnla] as const].forEach(([tag, rep]) => {
      rep.cross_flags
        .filter((f) => f.tone !== "ok")
        .slice(0, 2)
        .forEach((f) => flags.push({ label: `${tag} · ${f.label}`, verdict: f.verdict, tone: f.tone }));
    });

    const strongerKey: RoundKey | "tie" = aiP === dnlaP ? "tie" : aiP > dnlaP ? "ai" : "dnla";
    return { aiP, dnlaP, aiResume, dnlaResume, flags, strongerKey };
  }, [ai, dnla]);

  return (
    <PageShell>
      <motion.section initial="hidden" animate="visible" variants={containerVariants}>
        <motion.div variants={itemVariants} className="mb-8">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Workspace", href: `${flowBase}/${s.id}` },
              { label: "Assessment", href: `${flowBase}/${s.id}/dnla` },
              { label: "Comparison" },
            ]}
          />
          <PageHeader
            eyebrow="Interview Comparison Report"
            title={`AI vs DNLA interview comparison for ${candidateFirst}`}
            description="Side-by-side diff of the AI (skills) interview and the DNLA (behavioural) interview, with consistency checks across the two rounds."
            actions={
              <div className="flex items-center gap-2 print:hidden">
                <ButtonLink href={`${flowBase}/${s.id}/report/ai`} variant="ghost" size="sm">AI report</ButtonLink>
                <ButtonLink href={`${flowBase}/${s.id}/report/dnla`} variant="ghost" size="sm">DNLA report</ButtonLink>
                <ButtonLink href={`${flowBase}/${s.id}/fit-score`} variant="ghost" size="sm">Combined Fit Score</ButtonLink>
              </div>
            }
          />
        </motion.div>

        {status === "loading" || status === "idle" ? (
          <Card variant="default" className="rounded-xl2 p-12 text-center">
            <p className="text-sm text-ink-500">Building your comparison report (generating any missing per-interview reports)…</p>
          </Card>
        ) : status === "error" ? (
          <Card variant="default" className="rounded-xl2 p-10 text-center border-rose-200">
            <Heading as="h2" className="text-rose-700">Couldn’t build the comparison</Heading>
            <p className="mx-auto mt-3 max-w-lg text-sm text-ink-600">{error}</p>
            <div className="mt-6"><Button type="button" onClick={load} variant="danger" size="lg">Retry</Button></div>
          </Card>
        ) : !bothReady ? (
          <Card variant="default" className="rounded-xl2 p-10 text-center">
            <Eyebrow className="text-brand-500">Both interviews required</Eyebrow>
            <Heading as="h2" className="mt-3">Complete both rounds to compare</Heading>
            <p className="mx-auto mt-3 max-w-lg text-sm text-ink-600">
              A comparison needs both interviews captured. Missing:{" "}
              {missing.map((mr) => ROUNDS[mr].label).join(" and ")}.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {missing.map((mr) => (
                <ButtonLink key={mr} href={`${flowBase}/${s.id}/interview/${ROUNDS[mr].interviewMode}`} variant="primary" size="lg">
                  Start {ROUNDS[mr].label}
                </ButtonLink>
              ))}
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Side-by-side headline */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <RoundCard round="ai" report={ai!} highlight={analysis?.strongerKey === "ai"} flowBase={flowBase} sid={s.id} />
              <RoundCard round="dnla" report={dnla!} highlight={analysis?.strongerKey === "dnla"} flowBase={flowBase} sid={s.id} />
            </motion.div>

            {/* Verdict line */}
            {analysis && (
              <motion.div variants={itemVariants}>
                <Card variant="default" className="rounded-xl2 p-6 sm:p-8">
                  <Eyebrow>Comparison summary</Eyebrow>
                  <p className="mt-3 text-base font-medium leading-relaxed text-ink-800">
                    {analysis.strongerKey === "tie"
                      ? `${candidateFirst} performed evenly across both rounds (AI ${analysis.aiP}% vs DNLA ${analysis.dnlaP}%) — a balanced profile with no single weak round to prioritise.`
                      : `${candidateFirst}'s ${analysis.strongerKey === "ai" ? "AI (skills)" : "DNLA (behavioural)"} round was the stronger of the two (AI ${analysis.aiP}% vs DNLA ${analysis.dnlaP}%). The ${analysis.strongerKey === "ai" ? "DNLA (behavioural)" : "AI (skills)"} round is the clearer development priority.`}
                  </p>
                </Card>
              </motion.div>
            )}

            {/* Metric diff table */}
            <motion.div variants={itemVariants}>
              <Card variant="default" className="rounded-xl2 p-0 overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="grid grid-cols-12 border-b border-ink-200/40 bg-ink-50/60 px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                    <div className="col-span-4">Metric</div>
                    <div className="col-span-3 text-right">AI interview</div>
                    <div className="col-span-3 text-right">DNLA interview</div>
                    <div className="col-span-2 text-right">Δ</div>
                  </div>
                  <DiffRow label="Round score" a={ai ? primaryScore(ai, "ai") : -1} b={dnla ? primaryScore(dnla, "dnla") : -1} />
                  <DiffRow label="Fit score" a={ai?.fit_score ?? -1} b={dnla?.fit_score ?? -1} />
                  <DiffRow label="Success probability" a={ai?.success_probability ?? -1} b={dnla?.success_probability ?? -1} />
                  <DiffRow label="Resume alignment" a={analysis?.aiResume ?? -1} b={analysis?.dnlaResume ?? -1} />
                </div>
              </Card>
            </motion.div>

            {/* Consistency flags */}
            {analysis && analysis.flags.length > 0 && (
              <motion.section variants={itemVariants}>
                <div className="mb-4">
                  <Eyebrow className="text-brand-500">Cross-round checks</Eyebrow>
                  <Heading className="mt-2 sm:text-2xl">Consistency & development signals</Heading>
                </div>
                <Card variant="default" className="rounded-xl2 p-0 overflow-x-auto">
                  <div className="min-w-[560px]">
                    {analysis.flags.map((f, i) => (
                      <div key={`${f.label}-${i}`} className="grid grid-cols-12 items-center border-b border-ink-100 px-6 py-4 text-sm last:border-0">
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
                    <Eyebrow className="text-brand-500">Assessment complete</Eyebrow>
                    <Heading className="mt-1 sm:text-2xl">View your combined Fit Score & development plan</Heading>
                    <p className="mt-2 max-w-xl text-sm text-ink-600">
                      The combined Fit Score folds both rounds, your resume, and DNLA into one placement-ready report.
                    </p>
                  </div>
                  <ButtonLink href={`${flowBase}/${s.id}/fit-score`} variant="primary" size="lg">
                    Combined Fit Score
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

function RoundCard({
  round,
  report,
  highlight,
  flowBase,
  sid,
}: {
  round: RoundKey;
  report: GenReport;
  highlight?: boolean;
  flowBase: string;
  sid: string;
}) {
  const cfg = ROUNDS[round];
  const p = primaryScore(report, round);
  const tone = p === -1 ? "muted" : p >= 75 ? "success" : p >= 55 ? "warn" : "danger";
  const ring = tone === "success" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "danger" ? "text-rose-600" : "text-ink-400";
  return (
    <Card variant="default" className={`rounded-xl2 p-6 ${highlight ? "border-emerald-300 ring-1 ring-emerald-200" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>{cfg.label}</Eyebrow>
        {highlight && <Badge tone="success">Stronger round</Badge>}
      </div>
      <div className="mt-4 flex items-end gap-3">
        <span className={`text-5xl font-bold tabular-nums ${ring}`}>{p === -1 ? "—" : `${p}%`}</span>
        <span className="mb-1.5 text-xs font-semibold text-ink-500">{cfg.short} score</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="Fit" value={report.fit_score === -1 ? "—" : `${report.fit_score}%`} />
        <MiniStat label="Success prob." value={report.success_probability === -1 ? "—" : `${report.success_probability}%`} />
      </div>
      <div className="mt-3">
        <Badge tone={report.fit_score >= 70 ? "success" : "warn"}>{report.verdict}</Badge>
      </div>
      {report.narrative && <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-ink-500">{report.narrative}</p>}
      <ButtonLink href={`${flowBase}/${sid}/report/${round}`} variant="ghost" size="sm" className="mt-4">
        Full {cfg.label} report
      </ButtonLink>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-200/60 bg-white/45 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-ink-900">{value}</div>
    </div>
  );
}

function DiffRow({ label, a, b }: { label: string; a: number; b: number }) {
  const delta = a === -1 || b === -1 ? null : a - b;
  return (
    <div className="grid grid-cols-12 items-center border-b border-ink-100 px-6 py-4 text-sm last:border-0">
      <div className="col-span-4 font-medium text-ink-800">{label}</div>
      <div className="col-span-3 text-right font-bold tabular-nums text-ink-900">{a === -1 ? "—" : `${a}%`}</div>
      <div className="col-span-3 text-right font-bold tabular-nums text-ink-900">{b === -1 ? "—" : `${b}%`}</div>
      <div className={`col-span-2 text-right font-semibold tabular-nums ${delta == null ? "text-ink-400" : delta === 0 ? "text-ink-500" : delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>
        {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
      </div>
    </div>
  );
}
