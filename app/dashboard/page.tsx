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
  Circle,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { PageShell, Card, Heading, Badge, Avatar, CountUp, Tooltip, ButtonLink } from "@/components/ui";
import { DashboardHeader } from "@/components/dashboard";
import { containerVariants } from "@/lib/motion";
import { roleDef, workspaceId, workspacePath, type Role } from "@/lib/roles";

type Tile = { title: string; desc: string; href: string; icon: React.ReactNode };

function tilesFor(role: Role, uid?: string | null): Tile[] {
  const ws = workspacePath(role, uid);
  const profile: Tile = { title: "My Profile", desc: "View and edit your account details.", href: "/profile", icon: <UserCircle className="h-5 w-5" /> };

  if (role === "candidate") {
    return [
      { title: "My Workspace", desc: "Your assessment funnel and progress.", href: ws, icon: <LayoutDashboard className="h-5 w-5" /> },
      { title: "Start Assessment", desc: "Pick your track, upload your résumé, then take the proctored AI interview.", href: "/onboarding", icon: <Rocket className="h-5 w-5" /> },
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
  // institute
  return [
    { title: "Institute Dashboard", desc: "Cohort readiness, KPIs and student lists.", href: ws, icon: <Building2 className="h-5 w-5" /> },
    profile,
  ];
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
          const d = snap.data() as { role?: Role; name?: string };
          setRole((d.role as Role) || "candidate");
          setName(d.name || user.displayName || "");
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
    } catch {
      /* ignore */
    }
    // Derive progress from the keys the interview flow ACTUALLY writes
    // (`taledge:interview:${id}:{technical,dnla,final}`). The old keys
    // (`taledge:dnla:*`, `:behavioural`) are never written by the real funnel,
    // so the pipeline froze and "Next step" pointed at off-funnel rounds.
    setProgress({
      profile: profileDone,
      technical: has(`taledge:interview:${id}:technical`),
      final: has(`taledge:interview:${id}:final`),
      fit: has(`taledge:fit-score:${id}`),
    });
  }, [state, role, user?.uid]);

  const def = roleDef(role);
  const ws = workspacePath(role, user?.uid);

  const stages: Stage[] = useMemo(() => {
    if (role !== "candidate") return [];
    return [
      { key: "profile", label: "Profile & Résumé", href: "/onboarding", done: !!progress.profile },
      { key: "technical", label: "Technical Interview", href: `${ws}/interview/technical`, done: !!progress.technical },
      { key: "final", label: "Final Interview", href: `${ws}/interview/final`, done: !!progress.final },
      { key: "fit", label: "Fit Score", href: `${ws}/fit-score`, done: !!progress.fit },
    ];
  }, [role, ws, progress]);

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

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
                  <ol className="grid gap-3 sm:grid-cols-5">
                    {stages.map((s, i) => {
                      const isNext = !s.done && (i === 0 || stages[i - 1].done);
                      return (
                        <li key={s.key}>
                          <Link
                            href={s.href}
                            className={
                              "group flex items-start gap-2.5 rounded-lg border p-3 transition-all " +
                              (s.done
                                ? "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300"
                                : isNext
                                ? "border-brand-300 bg-white hover:border-brand-400 hover:shadow-sm"
                                : "border-ink-200/70 bg-white hover:border-ink-300")
                            }
                          >
                            <span className="mt-0.5 shrink-0">
                              {s.done ? (
                                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                                  <Check className="h-3 w-3" />
                                </span>
                              ) : isNext ? (
                                <CircleDot className="h-5 w-5 text-brand-600" />
                              ) : (
                                <Circle className="h-5 w-5 text-ink-300" />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-500">Step {i + 1}</span>
                              <span className={"block text-[13px] font-semibold leading-tight " + (s.done ? "text-emerald-800" : isNext ? "text-brand-700" : "text-ink-700")}>
                                {s.label}
                              </span>
                            </span>
                          </Link>
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
              {tiles.map((t) => (
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
              ))}
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
            <Card className="p-6">
              <div className="flex items-center gap-1.5">
                <SectionLabel>Assessment progress</SectionLabel>
                <Tooltip label="Profile · Technical · Final · Fit Score">
                  <button type="button" aria-label="What counts as a step" className="grid h-4 w-4 place-items-center rounded-full bg-ink-100 text-[10px] font-bold text-ink-500 hover:bg-ink-200">
                    i
                  </button>
                </Tooltip>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-3xl font-extrabold tracking-tight text-ink-900">
                  <CountUp value={completedCount} />
                  <span className="text-lg font-bold text-ink-400">/{stages.length}</span>
                </span>
                <span className="text-xs font-semibold text-ink-500">steps complete</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-all duration-500"
                  style={{ width: `${(completedCount / stages.length) * 100}%` }}
                />
              </div>
            </Card>
          )}
        </motion.aside>
      </div>
    </PageShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">{children}</h2>
  );
}
