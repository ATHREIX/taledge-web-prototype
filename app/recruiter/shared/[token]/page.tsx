"use client";

import { use, useEffect, useState } from "react";
import { PageShell, Card, Heading, Eyebrow, Badge, Stat, ButtonLink } from "@/components/ui";
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
      <Card variant="frosted" className="rounded-xl3 p-6 sm:p-8 mb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Badge tone="brand" className="uppercase tracking-widest">Shared recruiter access</Badge>
            <Heading as="h1" className="mt-3 text-2xl sm:text-3xl">{institute?.name ?? "Candidate pool"}</Heading>
            <p className="mt-2 text-sm text-ink-500">
              A scoped, read-only view shared by the institute. {institute?.kind === "exam" ? "Competitive-exam cohort." : "Placement cohort."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <Stat label="Candidates" value={`${rows.length}`} />
            <Stat label="Avg Fit" value={`${avgFit}`} />
            <Stat label="Shortlist-ready" value={`${ready}`} />
          </div>
        </div>
      </Card>

      <Card variant="frosted" className="rounded-xl3 overflow-hidden">
        <div className="border-b border-ink-200/60 px-6 py-4">
          <Eyebrow>Candidate pool</Eyebrow>
        </div>
        {sorted.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-500">No candidates have completed assessments in this cohort yet.</div>
        ) : (
          <div className="divide-y divide-ink-200/50">
            <div className="hidden grid-cols-12 gap-2 px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-400 md:grid">
              <div className="col-span-4">Candidate</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-1 text-center">Fit</div>
              <div className="col-span-1 text-center">Tech</div>
              <div className="col-span-1 text-center">Behav</div>
              <div className="col-span-1 text-center">Success</div>
              <div className="col-span-2 text-center">DNLA</div>
            </div>
            {sorted.map((r) => (
              <div key={r.studentId} className="grid grid-cols-2 items-center gap-2 px-6 py-4 md:grid-cols-12">
                <div className="col-span-2 flex items-center gap-3 md:col-span-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-xs font-bold text-white">{r.avatar}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-ink-900">{r.name}</div>
                    <div className="truncate text-xs text-ink-500">{r.college}</div>
                  </div>
                </div>
                <div className="hidden truncate text-sm text-ink-600 md:col-span-2 md:block">{r.role}</div>
                <div className="md:col-span-1 md:flex md:justify-center"><ScoreRing value={r.fit} size={40} /></div>
                <div className="hidden text-center text-sm font-semibold text-ink-700 md:col-span-1 md:block">{r.tech}</div>
                <div className="hidden text-center text-sm font-semibold text-ink-700 md:col-span-1 md:block">{r.behav}</div>
                <div className="hidden text-center text-sm font-semibold text-ink-700 md:col-span-1 md:block">{r.success}%</div>
                <div className="hidden md:col-span-2 md:flex md:justify-center">
                  <Badge tone={r.dnlaReady ? "success" : "neutral"}>{r.dnlaReady ? "Available" : "Pending"}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="mt-4 text-center text-xs text-ink-400">Shared securely by the institute · access expires automatically.</p>
    </PageShell>
  );
}
