"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Loader2,
  LayoutDashboard,
  BarChart3,
  UserCircle,
  Users,
  Building2,
  GraduationCap,
  Rocket,
  ArrowRight,
  Check,
  CircleDot,
  Lock,
  FileText,
  Trophy,
  HelpCircle,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { PageShell, Card, Heading, Badge, Avatar, CountUp, Tooltip, ButtonLink } from "@/components/ui";
import { DashboardHeader } from "@/components/dashboard";
import { containerVariants } from "@/lib/motion";
import { roleDef, workspaceId, workspacePath, type Role } from "@/lib/roles";
import { isTechnicalRole } from "@/lib/role-classification";

type Tile = { title: string; desc: string; href: string; icon: React.ReactNode; primary?: boolean };

function tilesFor(role: Role, uid?: string | null): Tile[] {
  const ws = workspacePath(role, uid);
  const profile: Tile = { title: "My Profile", desc: "View and edit your account details.", href: "/profile", icon: <UserCircle className="h-5 w-5" /> };

  if (role === "candidate") {
    return [
      { title: "My Workspace", desc: "Your assessment funnel and progress.", href: ws, icon: <LayoutDashboard className="h-5 w-5" /> },
      { title: "Start Assessment", desc: "Pick your track, upload your résumé, then take the proctored AI interview.", href: "/onboarding", icon: <Rocket className="h-5 w-5" />, primary: true },
      { title: "DNLA Report", desc: "Your psychometric competency profile.", href: `${ws}/dnla`, icon: <BarChart3 className="h-5 w-5" /> },
      { title: "Fit Score", desc: "Your defensible placement readiness score.", href: `${ws}/fit-score`, icon: <BarChart3 className="h-5 w-5" /> },
      profile,
    ];
  }
  if (role === "recruiter") {
    return [
      { title: "Recruiter Workspace", desc: "Shortlist candidates on verified evidence.", href: ws, icon: <Users className="h-5 w-5" /> },
      profile,
    ];
  }
  if (role === "coach") {
    return [
      { title: "Coaching Workspace", desc: "Run risk-ranked coaching sessions.", href: ws, icon: <GraduationCap className="h-5 w-5" /> },
      profile,
    ];
  }
  // institute — two clear entries, one per track, opening the matching tab on
  // the institute dashboard (Placement / Exam are never mixed).
  return [
    { title: "Placement cohort", desc: "Job & internship candidates: readiness, student list and recruiter sharing.", href: `${ws}?track=placement`, icon: <Building2 className="h-5 w-5" />, primary: true },
    { title: "Exam cohort", desc: "Competitive-exam aspirants: success potential and interventions.", href: `${ws}?track=exam`, icon: <GraduationCap className="h-5 w-5" /> },
    profile,
  ];
}

// Rehydrate the LOCAL workspace profile from the durable Firestore user doc.
// The résumé/profile a candidate enters at onboarding is persisted to
// users/{uid}, but every downstream page reads it from localStorage — so on a
// fresh session / new device / cleared storage it looked like nothing was
// uploaded and the candidate had to re-upload. This copies the durable copy
// back into localStorage so the résumé survives across sessions. It only fills
// in when the local copy is MISSING its résumé (never clobbers a newer local
// upload the user just made this session).
function hydrateWorkspaceProfileFromDoc(
  d: {
    name?: string;
    resumeSummary?: string;
    resumeSkills?: string[];
    resumeProjects?: string[];
    resumeCgpa?: string;
    resumeExperience?: string;
    targetRole?: string;
    institution?: string;
    yearCohort?: string;
    aspiration?: string;
  },
  user: { email?: string | null } | null
) {
  try {
    const hasDurableResume = !!(d.resumeSummary || d.resumeSkills?.length || d.resumeProjects?.length || d.targetRole);
    if (!hasDurableResume) return;

    let local: Record<string, unknown> = {};
    try {
      local = JSON.parse(localStorage.getItem("taledge:workspace-profile") || "{}") || {};
    } catch {
      local = {};
    }
    const localHasResume = !!(local.resumeSummary || (Array.isArray(local.resumeSkills) && local.resumeSkills.length) || (Array.isArray(local.resumeProjects) && local.resumeProjects.length) || local.targetRole);
    if (localHasResume) return; // local is already populated (fresh upload) — leave it

    const merged = {
      ...local,
      fullName: local.fullName || d.name || "",
      email: local.email || user?.email || "",
      institution: local.institution || d.institution || "",
      yearCohort: local.yearCohort || d.yearCohort || "",
      aspiration: local.aspiration || d.aspiration || "",
      targetRole: local.targetRole || d.targetRole || "",
      resumeSummary: d.resumeSummary || "",
      resumeSkills: d.resumeSkills || [],
      resumeProjects: d.resumeProjects || [],
      resumeCgpa: local.resumeCgpa || d.resumeCgpa || "",
      resumeExperience: local.resumeExperience || d.resumeExperience || "",
    };
    localStorage.setItem("taledge:workspace-profile", JSON.stringify(merged));
  } catch {
    /* non-fatal: hydration is best-effort */
  }
}

type Stage = { key: string; label: string; href: string; done: boolean };

const EASE = [0.16, 1, 0.3, 1] as const;

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<Role>("candidate");
  const [name, setName] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "anon">("loading");
  const [today, setToday] = useState("");
  // Real, client-present progress (localStorage) - never fabricated.
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  // Target role drives the role-aware round-1 label (Technical vs Skills).
  const [targetRole, setTargetRole] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setState("anon");
      return;
    }
    let cancelled = false;
    (async () => {
      // Source of truth for the role is the user's Firestore doc, written at
      // register (client SDK). /api/profile can't read it in demo mode (no
      // service account) and would default everyone to "candidate".
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!cancelled && snap.exists()) {
          const d = snap.data() as {
            role?: Role;
            name?: string;
            resumeSummary?: string;
            resumeSkills?: string[];
            resumeProjects?: string[];
            resumeCgpa?: string;
            resumeExperience?: string;
            targetRole?: string;
            institution?: string;
            yearCohort?: string;
            aspiration?: string;
          };
          setRole((d.role as Role) || "candidate");
          setName(d.name || user.displayName || "");
          hydrateWorkspaceProfileFromDoc(d, user);
          setState("ready");
          return;
        }
      } catch {
        /* fall through to the API / displayName fallback */
      }
      if (!cancelled) {
        setName(user.displayName || "");
        setState("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  // Derive real assessment progress (client only → no SSR mismatch).
  useEffect(() => {
    if (state !== "ready") return;
    try {
      setToday(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
    } catch {
      /* date is decorative */
    }
    if (role !== "candidate") return;
    // Read progress under the SAME id the interview/fit-score flow writes. Under
    // enforced auth that is the user's uid (workspacePath -> /student/<uid>), not
    // the seeded demoId - otherwise the pipeline froze at 0/4 for every real user.
    const id = workspaceId(role, user?.uid);
    const has = (k: string) => {
      try {
        return !!localStorage.getItem(k);
      } catch {
        return false;
      }
    };
    let profileDone = false;
    try {
      const raw = localStorage.getItem("taledge:workspace-profile");
      const p = raw ? JSON.parse(raw) : null;
      profileDone = !!(p && (p.resumeSummary || (p.resumeSkills && p.resumeSkills.length) || p.targetRole));
      if (p?.targetRole) setTargetRole(String(p.targetRole));
    } catch {
      /* ignore */
    }
    // Derive progress from the keys the interview flow ACTUALLY writes.
    // The Final Interview IS the behavioural round (/interview/final aliases
    // it), so its transcript lands under `:behavioural` — with `:dnla` and
    // `:final` accepted as legacy keys from older funnels.
    setProgress({
      profile: profileDone,
      technical: has(`taledge:interview:${id}:technical`),
      final:
        has(`taledge:interview:${id}:behavioural`) ||
        has(`taledge:interview:${id}:dnla`) ||
        has(`taledge:interview:${id}:final`),
      fit: has(`taledge:fit-score:${id}`),
    });
  }, [state, role, user?.uid]);

  const def = roleDef(role);
  const ws = workspacePath(role, user?.uid);

  const stages: Stage[] = useMemo(() => {
    if (role !== "candidate") return [];
    // Round 1 is role-aware: "Technical Interview" for a technical target role,
    // "Skills Interview" for a non-technical one (MBA/BA/BCom/sales/…).
    const roundOne = isTechnicalRole(targetRole) ? "Technical Interview" : "Skills Interview";
    return [
      { key: "profile", label: "Profile & Résumé", href: "/onboarding", done: !!progress.profile },
      { key: "technical", label: roundOne, href: `${ws}/interview/technical`, done: !!progress.technical },
      { key: "final", label: "Final Interview · Behavioural", href: `${ws}/interview/final`, done: !!progress.final },
      { key: "fit", label: "Fit Score", href: `${ws}/fit-score`, done: !!progress.fit },
    ];
  }, [role, ws, progress, targetRole]);

  const completedCount = stages.filter((s) => s.done).length;
  const nextStage = stages.find((s) => !s.done) || null;

  // ── Loading: enterprise skeleton, not a bare spinner ──────────────────────
  if (loading || state === "loading") {
    return (
      <PageShell width="wide">
        <div className="animate-pulse">
          <div className="h-3 w-28 rounded bg-ink-100" />
          <div className="mt-3 h-8 w-64 rounded bg-ink-100" />
          <div className="mt-8 h-32 rounded-xl2 border border-ink-200/60 bg-ink-50/60" />
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl2 border border-ink-200/60 bg-ink-50/60" />
            ))}
          </div>
        </div>
        <span className="sr-only">
          <Loader2 className="animate-spin" aria-label="Loading dashboard" />
        </span>
      </PageShell>
    );
  }

  if (state === "anon") {
    return (
      <PageShell width="narrow">
        <Card className="mx-auto max-w-md p-10 text-center">
          <Heading as="h1" className="text-2xl">Sign in to continue</Heading>
          <p className="mt-3 text-sm text-ink-500">Your command center is private to your account.</p>
          <div className="mt-6 flex justify-center gap-3">
            <ButtonLink href="/login" size="lg">Sign in</ButtonLink>
            <ButtonLink href="/register" variant="ghost" size="lg">Create account</ButtonLink>
          </div>
        </Card>
      </PageShell>
    );
  }

  const tiles = tilesFor(role, user?.uid);
  const first = (name || "there").split(" ")[0];
  const pct = stages.length ? Math.round((completedCount / stages.length) * 100) : 0;

  return (
    <PageShell width="wide">
      {/* ───────── Command header ───────── */}
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        <DashboardHeader
          eyebrow="Talent Command Center"
          title={
            <span className="inline-flex flex-wrap items-center gap-3 align-middle">
              Welcome back, {first}
              <Badge tone="brand">{def.label}</Badge>
            </span>
          }
          description={def.blurb}
          actions={
            today ? (
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">Today</p>
                <p className="mt-1 text-sm font-semibold text-ink-700">{today}</p>
              </div>
            ) : undefined
          }
        />
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ───────── Main column ───────── */}
        <div className="space-y-6">
          {/* Requires your attention */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
          >
            <SectionLabel>Requires your attention</SectionLabel>

            {role === "candidate" ? (
              <Card className="mt-3 overflow-hidden">
                <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    {nextStage ? (
                      <>
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">Next step</p>
                        <h2 className="mt-1 text-xl font-bold text-ink-900">{nextStage.label}</h2>
                        <p className="mt-1 text-sm text-ink-500">
                          {completedCount} of {stages.length} steps complete. Continue your assessment to reach your Fit Score.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-emerald-600">Assessment complete</p>
                        <h2 className="mt-1 text-xl font-bold text-ink-900">Your Fit Score is ready</h2>
                        <p className="mt-1 text-sm text-ink-500">All {stages.length} steps are done. Review your defensible readiness score.</p>
                      </>
                    )}
                  </div>
                  <Link
                    href={nextStage ? nextStage.href : `${ws}/fit-score`}
                    className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md"
                  >
                    {nextStage ? `Continue` : "View Fit Score"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>

                {/* Real assessment pipeline */}
                <div className="border-t border-ink-200/60 bg-ink-50/40 px-4 py-4 sm:px-6">
                  <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {stages.map((s, i) => {
                      const isNext = !s.done && (i === 0 || stages[i - 1].done);
                      // LOCKED: a future step whose previous step isn't done yet.
                      // A first-time user must complete steps in order and can't
                      // click ahead — the step is shown but not navigable.
                      const isLocked = !s.done && !isNext;
                      const inner = (
                        <>
                          <span className="mt-0.5 shrink-0">
                            {s.done ? (
                              <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                                <Check className="h-3 w-3" />
                              </span>
                            ) : isNext ? (
                              <CircleDot className="h-5 w-5 text-brand-600" />
                            ) : (
                              <Lock className="h-4 w-4 text-ink-300" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-500">Step {i + 1}</span>
                            <span className={"block text-[13px] font-semibold leading-tight " + (s.done ? "text-emerald-800" : isNext ? "text-brand-700" : "text-ink-400")}>
                              {s.label}
                            </span>
                          </span>
                        </>
                      );
                      return (
                        <li key={s.key}>
                          {isLocked ? (
                            <div
                              aria-disabled="true"
                              title="Complete the previous step first"
                              className="flex cursor-not-allowed items-start gap-2.5 rounded-lg border border-ink-200/60 bg-ink-50/40 p-3 opacity-70"
                            >
                              {inner}
                            </div>
                          ) : (
                            <Link
                              href={s.href}
                              className={
                                "group flex items-start gap-2.5 rounded-lg border p-3 transition-all " +
                                (s.done
                                  ? "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300"
                                  : "border-brand-300 bg-white hover:border-brand-400 hover:shadow-sm")
                              }
                            >
                              {inner}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </Card>
            ) : (
              <Card className="mt-3 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">Your workspace</p>
                  <h2 className="mt-1 text-xl font-bold text-ink-900">Open your {def.label.toLowerCase()} workspace</h2>
                  <p className="mt-1 max-w-md text-sm text-ink-500">{def.blurb}</p>
                </div>
                <Link
                  href={ws}
                  className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md"
                >
                  Open workspace
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Card>
            )}
          </motion.section>

          {/* Your tools */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
          >
            <SectionLabel>Your workspace</SectionLabel>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {tiles.map((t) => {
                const isPrimary = (t as { primary?: boolean }).primary;
                if (isPrimary) {
                  return (
                    <Link
                      key={t.title}
                      href={t.href}
                      className="group relative flex items-start gap-4 overflow-hidden rounded-xl2 bg-gradient-to-br from-brand-600 to-[#0F4CFF] p-5 text-white shadow-[0_18px_44px_-20px_rgba(0,87,255,0.6)] ring-1 ring-brand-500/40 transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_56px_-22px_rgba(0,87,255,0.7)]"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl2 bg-white/20 text-white">
                        {t.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-[15px] font-bold text-white">
                            {t.title}
                            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">Start here</span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-white/80 transition-all group-hover:translate-x-0.5" />
                        </span>
                        <span className="mt-1 block text-[13px] leading-relaxed text-white/85">{t.desc}</span>
                      </span>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={t.title}
                    href={t.href}
                    className="group flex items-start gap-4 rounded-xl2 border border-ink-200/70 bg-white p-5 shadow-panel transition-all hover:border-brand-300 hover:shadow-panel-hover"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl2 border border-brand-100 bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                      {t.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-bold text-ink-900 group-hover:text-brand-700">{t.title}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-600" />
                      </span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-ink-500">{t.desc}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.section>
        </div>

        {/* ───────── Right rail ───────── */}
        <motion.aside
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
          className="space-y-6"
        >
          <Card className="p-6">
            <SectionLabel>Account</SectionLabel>
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={name} email={user?.email} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink-900">{name || "Your account"}</p>
                <p className="truncate text-xs text-ink-500">{user?.email}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-ink-200/60 pt-4">
              <span className="text-xs font-semibold text-ink-500">Role</span>
              <Badge tone="brand">{def.label}</Badge>
            </div>
            <Link href="/profile" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-900 transition-all hover:border-brand-300 hover:bg-brand-50">
              <UserCircle className="h-4 w-4" /> Manage profile
            </Link>
          </Card>

          {role === "candidate" && (
            <>
              {/* Progress ring — bigger, more substantial than the old thin bar */}
              <Card className="p-6">
                <div className="flex items-center gap-1.5">
                  <SectionLabel>Assessment progress</SectionLabel>
                  <Tooltip label="Profile · Technical · Final · Fit Score">
                    <button type="button" aria-label="What counts as a step" className="grid h-4 w-4 place-items-center rounded-full bg-ink-100 text-[10px] font-bold text-ink-500 hover:bg-ink-200">
                      i
                    </button>
                  </Tooltip>
                </div>
                <div className="mt-5 flex items-center gap-5">
                  <ProgressRing pct={pct} />
                  <div className="min-w-0">
                    <p className="text-2xl font-extrabold tracking-tight text-ink-900">
                      <CountUp value={completedCount} />
                      <span className="text-base font-bold text-ink-400">/{stages.length}</span>
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-ink-500">steps complete</p>
                    <p className="mt-2 text-[13px] leading-snug text-ink-500">
                      {nextStage ? <>Next up: <span className="font-semibold text-brand-700">{nextStage.label}</span></> : "All steps done. Your Fit Score is ready."}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Help — closes the rail so there's no empty tail */}
              <Card className="bg-gradient-to-br from-ink-50 to-white p-6">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
                    <HelpCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink-900">New here?</p>
                    <p className="mt-1 text-[13px] leading-snug text-ink-500">Start with <span className="font-semibold text-ink-700">Profile &amp; Résumé</span>. Every later step is tailored from it.</p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </motion.aside>
      </div>

      {/* ───────── Bottom band: how it works (fills the empty page tail) ───────── */}
      {role === "candidate" && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.16 }}
          className="mt-6"
        >
          <SectionLabel>How your Fit Score is built</SectionLabel>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <HowCard n={1} icon={<FileText className="h-5 w-5" />} title="Résumé + interviews" desc="You upload your résumé and take an adaptive, proctored AI interview plus a behavioural round." />
            <HowCard n={2} icon={<BarChart3 className="h-5 w-5" />} title="Evidence-scored" desc="Every answer is scored against a fixed rubric: evidence or excluded, never a guessed placeholder." />
            <HowCard n={3} icon={<Trophy className="h-5 w-5" />} title="One defensible score" desc="Headline numbers are recomputed in server code and logged, so your Fit Score holds up to scrutiny." />
          </div>
        </motion.section>
      )}
    </PageShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">{children}</h2>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const off = C - (pct / 100) * C;
  return (
    <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
        <circle cx="38" cy="38" r={R} fill="none" stroke="currentColor" strokeWidth="7" className="text-ink-100" />
        <circle
          cx="38"
          cy="38"
          r={R}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={off}
          className="transition-[stroke-dashoffset] duration-700"
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0057FF" />
            <stop offset="100%" stopColor="#00C2A8" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-sm font-extrabold text-ink-900">{pct}%</span>
    </div>
  );
}

function HowCard({ n, icon, title, desc }: { n: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="relative overflow-hidden p-6">
      <span className="pointer-events-none absolute -right-2 -top-3 text-6xl font-black text-ink-100/70 select-none">{n}</span>
      <span className="relative grid h-11 w-11 place-items-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600">{icon}</span>
      <h3 className="relative mt-4 text-[15px] font-bold text-ink-900">{title}</h3>
      <p className="relative mt-1 text-[13px] leading-relaxed text-ink-500">{desc}</p>
    </Card>
  );
}
