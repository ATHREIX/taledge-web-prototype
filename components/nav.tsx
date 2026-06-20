"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  Users,
  Building2,
  Briefcase,
  GraduationCap,
  Sparkles,
  LogOut,
  LayoutDashboard,
  UserRound,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./logo";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/roles";

type NavLink = { href: string; label: string; icon: LucideIcon };

// Demo / signed-out fallback: the role switcher (keeps seeded personas browsable
// without a real login). Real signed-in users get their ROLE-SPECIFIC nav below.
const demoLinks: NavLink[] = [
  { href: "/student/candidate-001", label: "Candidates", icon: Users },
  { href: "/institute/institute-placement", label: "Institutes", icon: Building2 },
  { href: "/recruiter/recruiter-001", label: "Recruiters", icon: Briefcase },
  { href: "/coach/coach-001", label: "Coaches", icon: GraduationCap },
];

// Per-stakeholder navigation — each role sees ONLY their own workspace links,
// so the four logins lead to four genuinely different top bars.
const ROLE_NAV: Record<Role, NavLink[]> = {
  candidate: [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/student/candidate-001", label: "My Workspace", icon: UserRound },
    { href: "/student/candidate-001/fit-score", label: "Fit Score", icon: Gauge },
    { href: "/student/candidate-001/development", label: "Development", icon: Sparkles },
  ],
  recruiter: [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/recruiter/recruiter-001", label: "Pipeline", icon: Briefcase },
  ],
  coach: [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/coach/coach-001", label: "Coaching", icon: GraduationCap },
  ],
  institute: [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/institute/institute-placement", label: "Cohort", icon: Building2 },
  ],
};

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { user, role } = useAuth();

  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the account dropdown on any outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      if (auth) await signOut(auth);
    } catch {
      /* sign-out is best-effort; route away regardless */
    }
    router.push("/login");
  };

  const initial = (user?.displayName || user?.email || "U").trim().charAt(0).toUpperCase();

  // Hide the global nav on immersive/landing/auth flows and on the in-app
  // workspace pages that ship their own DashboardShell header.
  const hideNav =
    pathname === "/" ||
    pathname === "/onboarding" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/profile" ||
    pathname?.startsWith("/student/") ||
    pathname === "/recruiter/recruiter-001" ||
    pathname === "/coach/coach-001" ||
    pathname === "/institute/institute-placement" ||
    pathname === "/institute/exam" ||
    pathname?.startsWith("/exam/") ||
    pathname?.startsWith("/interview");
  if (hideNav) return null;

  // Link resolution:
  //  - role known        -> that stakeholder's nav (the four logins diverge here)
  //  - signed in, role still resolving -> a clean neutral (Home) — NEVER the
  //    4-role demo switcher (that would mislabel a logged-in candidate)
  //  - signed out / demo  -> the role switcher so seeded personas stay browsable
  const loggedInNeutral: NavLink[] = [{ href: "/dashboard", label: "Home", icon: LayoutDashboard }];
  const links: NavLink[] =
    role && ROLE_NAV[role] ? ROLE_NAV[role] : user ? loggedInNeutral : demoLinks;
  const topSegment = (p?: string | null) => p?.split("/").filter(Boolean)[0] ?? "";
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : topSegment(pathname) === topSegment(href);

  return (
    <div className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <header
        className={cn(
          "relative mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border px-3 py-2 transition-all duration-300",
          scrolled
            ? "border-ink-200/70 bg-white/85 shadow-panel backdrop-blur-xl"
            : "border-white/60 bg-white/60 shadow-[0_4px_24px_-12px_rgba(16,24,40,0.18)] backdrop-blur-xl"
        )}
      >
        <Link
          href="/dashboard"
          aria-label="Taledge home"
          className="shrink-0 pl-1.5 transition-transform hover:scale-[1.02]"
        >
          <Logo />
        </Link>

        {/* Center pill nav (role-aware) */}
        <nav
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
        >
          {links.map((l) => {
            const active = isActive(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-ink-600 hover:bg-ink-900/5 hover:text-ink-900"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/80 py-1 pl-1 pr-2.5 text-sm font-bold text-ink-800 transition hover:border-brand-300 hover:shadow-sm"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-xs font-black text-white">
                  {initial}
                </span>
                <span className="hidden max-w-[120px] truncate sm:inline">{user.displayName || user.email}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden className={menuOpen ? "rotate-180 transition-transform" : "transition-transform"}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl2 border border-ink-200/70 bg-white py-1.5 shadow-panel">
                  <div className="border-b border-ink-100 px-4 py-2.5">
                    <p className="truncate text-sm font-bold text-ink-900">{user.displayName || "Your account"}</p>
                    <p className="truncate text-xs text-ink-500">
                      {user.email}
                      {role ? <span className="ml-1 capitalize text-brand-600">· {role}</span> : null}
                    </p>
                  </div>
                  <Link href="/dashboard" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50 hover:text-ink-900">
                    <LayoutDashboard className="h-4 w-4 text-ink-400" aria-hidden /> Dashboard
                  </Link>
                  <Link href="/profile" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50 hover:text-ink-900">
                    <UserRound className="h-4 w-4 text-ink-400" aria-hidden /> My Profile
                  </Link>
                  <div className="my-1 border-t border-ink-100" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-900/5 hover:text-ink-900 sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-brand-700 hover:shadow-md sm:px-5"
              >
                Get started
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            aria-controls="mobile-nav-menu"
            className="grid h-9 w-9 place-items-center rounded-full border border-ink-200/70 bg-white text-ink-900 transition-colors hover:bg-ink-50 md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile dropdown (floating card) */}
      {open && (
        <div id="mobile-nav-menu" className="mx-auto mt-2 max-w-6xl rounded-3xl border border-ink-200/70 bg-white/95 p-2 shadow-panel backdrop-blur-xl md:hidden">
          {links.map((l) => {
            const active = isActive(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
                  active ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-900/5 hover:text-ink-900"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-brand-600" : "text-ink-400")} aria-hidden />
                {l.label}
              </Link>
            );
          })}
          {!user && (
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="mt-1 block rounded-2xl bg-brand-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-brand-700"
            >
              Get started
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
