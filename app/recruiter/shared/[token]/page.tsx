"use client";

import { use, useEffect, useState } from "react";
import { PageShell, Card, Heading, Eyebrow, Badge, ButtonLink } from "@/components/ui";
import { ScoreRing } from "@/components/score-ring";
import { useAuth } from "@/components/AuthProvider";

type Row = {
  studentId: string;
  name: string;
  avatar: string;
  college: string;
  role: string;
  experience: "fresher" | "1-3";
  fit: number;
  tech: number;
  behav: number;
  success: number;
  dnlaReady: boolean;
  flags: string[];
  status: string;
};

/**
 * Read-only recruiter view of an institute's candidate pool, opened via a
 * scoped, expiring share link the institute generated (PRD §4.6). A recruiter
 * must create/sign in to a recruiter account first (gate below) - then the token
 * authorises access to THIS institute's pool.
 */
export default function SharedRecruiterView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [institute, setInstitute] = useState<{ name: string; kind: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  // Where /register and /login return the recruiter after they authenticate.
  const nextUrl = `/recruiter/shared/${token}`;

  useEffect(() => {
    // Only load the pool once the recruiter has an account/session.
    if (authLoading || !user) return;
    fetch(`/api/shared/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setInstitute(d.institute);
          setRows(Array.isArray(d.candidates) ? d.candidates : []);
          setState("ok");
        } else {
          setState("error");
        }
      })
      .catch(() => setState("error"));
  }, [token, user, authLoading]);

  // Derived values computed on EVERY render (before any early return) so the
  // hook order never changes between the gated and ungated states - `rows`
  // starts [] so these are safe even while gated. (Rules of Hooks.)
  const sorted = [...rows].sort((a, b) => b.fit - a.fit);
  const avgFit = rows.length ? Math.round(rows.reduce((s, r) => s + r.fit, 0) / rows.length) : 0;
  const ready = rows.filter((r) => r.fit >= 72 && r.success >= 70).length;

  // ── Account gate: the recruiter must create an account / sign in first. ──
  if (authLoading) {
    return (
      <PageShell>
        <Card variant="frosted" className="rounded-xl3 p-10 text-center">
          <p className="text-sm text-ink-500">Checking your access…</p>
        </Card>
      </PageShell>
    );
  }
  if (!user) {
    return (
      <PageShell>
        <Card variant="frosted" className="mx-auto max-w-lg rounded-xl3 p-8 text-center sm:p-10">
          <Badge tone="brand" className="uppercase tracking-widest">Recruiter access</Badge>
          <Heading as="h1" className="mt-4 text-2xl">Create a recruiter account to view this pool</Heading>
          <p className="mt-3 text-sm text-ink-500">
            An institute shared this candidate pool with you. Create a free recruiter account (or sign in) to open it - it takes a minute, and you&apos;ll come straight back here.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href={`/register?next=${encodeURIComponent(nextUrl)}`} variant="primary" size="lg" className="w-full sm:w-auto">
              Create recruiter account
            </ButtonLink>
            <ButtonLink href={`/login?next=${encodeURIComponent(nextUrl)}`} variant="ghost" size="lg" className="w-full sm:w-auto">
              I already have an account
            </ButtonLink>
          </div>
        </Card>
      </PageShell>
    );
  }

  if (state === "loading") {
    return (
      <PageShell>
        <Card variant="frosted" className="rounded-xl3 p-10 text-center">
          <p className="text-sm text-ink-500">Loading shared candidate pool…</p>
        </Card>
      </PageShell>
    );
  }

  if (state === "error") {
    return (
      <PageShell>
        <Card variant="frosted" className="rounded-xl3 p-10 text-center max-w-lg mx-auto">
          <div aria-hidden className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-2xl">⚠</div>
          <Heading as="h1" className="text-xl mb-2">Link invalid or expired</Heading>
          <p className="text-sm text-ink-500">This recruiter access link is no longer valid. Ask the institute to generate a fresh link.</p>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* ── Header ── */}
      <div className="mb-8">
        <Badge tone="brand" className="uppercase tracking-widest">Shared recruiter access</Badge>
        <Heading as="h1" className="mt-3 text-3xl sm:text-4xl">{institute?.name ?? "Candidate pool"}</Heading>
        <p className="mt-2 max-w-2xl text-sm text-ink-500">
          A scoped, read-only view shared by the institute. {institute?.kind === "exam" ? "Competitive-exam cohort." : "Placement cohort."} Open any candidate to read their full, evidence-grounded Fit Score report.
        </p>
      </div>

      {/* ── Summary stats ── */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Candidates</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900">{rows.length}</p>
          <p className="mt-0.5 text-[12px] text-ink-500">Consented &amp; assessed</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Average Fit</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900">{avgFit}<span className="text-lg text-ink-400">%</span></p>
          <p className="mt-0.5 text-[12px] text-ink-500">Across this cohort</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Shortlist-ready</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-emerald-600">{ready}</p>
          <p className="mt-0.5 text-[12px] text-ink-500">Fit 72+ · Success 70+</p>
        </Card>
      </div>

      {/* ── Candidate cards ── */}
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow>Candidate pool</Eyebrow>
        <span className="text-xs text-ink-400">Ranked by Fit Score</span>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-12 text-center text-sm text-ink-500">No candidates have completed assessments in this cohort yet.</Card>
      ) : (
        <div className="grid gap-4">
          {sorted.map((r) => (
            <Card key={r.studentId} className="p-5 transition-shadow hover:shadow-panel-hover">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Identity */}
                <div className="flex items-center gap-4">
                  <ScoreRing value={r.fit} size={60} stroke={6} tone={r.fit >= 72 ? "success" : r.fit >= 55 ? "warn" : "danger"} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base font-bold text-ink-900">{r.name}</span>
                      <Badge tone={r.dnlaReady ? "success" : "neutral"}>{r.dnlaReady ? "DNLA ready" : "DNLA pending"}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-ink-500">{r.role} · {r.college}</div>
                    {r.flags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.flags.slice(0, 3).map((f) => (
                          <span key={f} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Scores + action */}
                <div className="flex flex-wrap items-center gap-5 lg:justify-end">
                  <ScoreCell label="Fit" value={`${r.fit}%`} strong />
                  <ScoreCell label="Technical" value={`${r.tech}%`} />
                  <ScoreCell label="Behavioural" value={`${r.behav}%`} />
                  <ScoreCell label="Success" value={`${r.success}%`} />
                  <ButtonLink
                    href={`/student/${r.studentId}/fit-score?view=recruiter`}
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                  >
                    View full report
                  </ButtonLink>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="mt-6 text-center text-xs text-ink-400">Shared securely by the institute · access expires automatically.</p>
    </PageShell>
  );
}

// Compact labelled score used in each candidate card's score strip.
function ScoreCell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="text-center">
      <div className={strong ? "text-lg font-extrabold text-ink-900" : "text-base font-bold text-ink-700"}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}
