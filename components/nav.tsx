"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { Users, Building2, Briefcase, GraduationCap, Sparkles, LogOut, LayoutDashboard, UserRound, type LucideIcon } from "lucide-react";
import { Logo } from "./logo";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";

const SHOW_PHASE_2 = false;

type NavLink = { href: string; label: string; icon: LucideIcon };

const phaseOneLinks: NavLink[] = [
  { href: "/student/candidate-001", label: "Candidates", icon: Users },
  { href: "/institute/institute-placement", label: "Institutes", icon: Building2 },
  { href: "/recruiter/recruiter-001", label: "Recruiters", icon: Briefcase },
  { href: "/coach/coach-001", label: "Coaches", icon: GraduationCap },
];

// Phase 2 stays in the codebase but is hidden from production navigation.
const phaseTwoLinks: NavLink[] = [{ href: "/coach-ai", label: "AI Coach · P2", icon: Sparkles }];
const links = SHOW_PHASE_2 ? [...phaseOneLinks, ...phaseTwoLinks] : phaseOneLinks;

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [pathname]);

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

  // Hide the global marketing nav on the focused candidate assessment flow
  // and on the landing page (which uses its own ClaimKeys-style split layout).
  const hideNav =
    pathname === "/" ||
    pathname === "/onboarding" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/profile" ||
    pathname?.startsWith("/student/") ||
    // Singleton dashboards + immersive screens ship their own in-page header;
    // hide the global marketing nav there to avoid stacked double headers.
    pathname === "/recruiter/recruiter-001" ||
    pathname === "/coach/coach-001" ||
    pathname === "/institute/institute-placement" ||
    pathname === "/institute/exam" ||
    pathname?.startsWith("/exam/") ||
    pathname?.startsWith("/interview");
  if (hideNav) return null;

  const topSegment = (p?: string | null) => p?.split("/").filter(Boolean)[0] ?? "";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-ink-200/50 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex items-center gap-2 sm:gap-5">
          <Link href="/dashboard" className="flex items-center text-ink-900 transition-opacity hover:opacity-80" aria-label="Taledge home">
            <Logo />
          </Link>
          <span aria-hidden className="hidden h-6 w-px bg-ink-200/70 md:block" />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = topSegment(pathname) === topSegment(l.href);
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200",
                    active
                      ? "bg-brand-50 text-brand-700 shadow-sm"
                      : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-brand-600" : "text-ink-400")} aria-hidden />
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            // Signed-in: ERP/Coursera-style account dropdown (My Profile + Logout).
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full border border-ink-200 bg-white py-1 pl-1 pr-2.5 text-sm font-bold text-ink-800 transition hover:border-brand-300 hover:shadow-sm"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-xs font-black text-white">
                  {initial}
                </span>
                <span className="hidden max-w-[120px] truncate sm:inline">{user.displayName || user.email}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className={menuOpen ? "rotate-180 transition-transform" : "transition-transform"}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl2 border border-ink-200/70 bg-white py-1.5 shadow-panel">
                  <div className="border-b border-ink-100 px-4 py-2.5">
                    <p className="truncate text-sm font-bold text-ink-900">{user.displayName || "Your account"}</p>
                    <p className="truncate text-xs text-ink-500">{user.email}</p>
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
                className="hidden text-sm font-bold text-ink-600 transition hover:text-ink-900 sm:inline-flex"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-700 hover:shadow-md sm:px-5"
              >
                Get Started
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
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
            className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-900 hover:bg-ink-50 md:hidden transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav-menu" className="border-t border-ink-100 bg-white md:hidden">
          <div className="mx-auto max-w-7xl px-5 py-3">
            <div className="grid grid-cols-2 gap-2">
              {links.map((l) => {
                const active = topSegment(pathname) === topSegment(l.href);
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                      active ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-50 hover:text-ink-900"
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
                  className="col-span-2 mt-2 rounded-xl bg-brand-600 px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-brand-700 transition-colors"
                >
                  Get Started
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
