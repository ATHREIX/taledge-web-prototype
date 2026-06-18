"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { PageShell, Card, Heading, Badge, Eyebrow } from "@/components/ui";
import { roleDef, workspacePath, type Role } from "@/lib/roles";

type Tile = { title: string; desc: string; href: string; icon: React.ReactNode };

function tilesFor(role: Role): Tile[] {
  const ws = workspacePath(role);
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

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<Role>("candidate");
  const [name, setName] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "anon">("loading");

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

  if (loading || state === "loading") {
    return (
      <PageShell width="wide">
        <div className="flex min-h-[50vh] items-center justify-center text-ink-400">
          <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading dashboard" />
        </div>
      </PageShell>
    );
  }

  if (state === "anon") {
    return (
      <PageShell width="narrow">
        <Card variant="frosted" className="mx-auto max-w-md p-10 text-center">
          <Heading as="h1" className="text-2xl">Sign in to continue</Heading>
          <p className="mt-3 text-sm text-ink-500">Your dashboard is private to your account.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login" className="btn-primary">Sign in</Link>
            <Link href="/register" className="btn-ghost">Create account</Link>
          </div>
        </Card>
      </PageShell>
    );
  }

  const def = roleDef(role);
  const tiles = tilesFor(role);
  const first = (name || "there").split(" ")[0];

  return (
    <PageShell width="wide">
      <div className="mb-8">
        <Eyebrow>Dashboard</Eyebrow>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Heading as="h1" className="text-3xl">Welcome back, {first} 👋</Heading>
          <Badge tone="brand">{def.label}</Badge>
        </div>
        <p className="mt-2 text-sm text-ink-500">Pick up where you left off, or jump into any of your tools below.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.title}
            href={t.href}
            className="group flex flex-col rounded-xl2 border border-ink-200/70 bg-white/80 p-6 shadow-panel backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-brand-200 hover:shadow-panel-hover"
          >
            <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl2 border border-brand-100 bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
              {t.icon}
            </span>
            <h3 className="text-lg font-bold text-ink-900">{t.title}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-500">{t.desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-700">
              Open
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
