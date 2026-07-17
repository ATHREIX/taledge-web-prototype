"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  Users,
  Building2,
  Briefcase,
  GraduationCap,
  LogOut,
  LayoutDashboard,
  UserRound,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./logo";
import { Avatar } from "@/components/ui";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";
import { clearSessionCookie } from "@/lib/session-cookie";
import { clearWorkspaceData } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import { workspaceId, type Role } from "@/lib/roles";

type NavLink = { href: string; label: string; icon: LucideIcon };

// Demo / signed-out fallback: the role switcher (keeps seeded personas browsable
// without a real login). Real signed-in users get their ROLE-SPECIFIC nav below.
const demoLinks: NavLink[] = [
  { href: "/student/candidate-001", label: "Candidates", icon: Users },
  { href: "/institute/institute-placement", label: "Institutes", icon: Building2 },
  { href: "/recruiter/recruiter-001", label: "Recruiters", icon: Briefcase },
  { href: "/coach/coach-001", label: "Coaches", icon: GraduationCap },
];

// Per-stakeholder navigation - each role sees ONLY their own workspace links,
// so the four logins lead to four genuinely different top bars. Workspace ids
// come from workspaceId() so a real signed-in user lands on THEIR uid-keyed
// workspace under enforced auth (not the shared `recruiter-001` seed), while
// demo/pilot keeps the seeded persona ids.
function roleNav(role: Role, uid?: string | null): NavLink[] {
  const id = workspaceId(role, uid);
  switch (role) {
    case "candidate":
      return [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard },
        { href: `/student/${id}`, label: "My Workspace", icon: UserRound },
        { href: `/student/${id}/fit-score`, label: "Fit Score", icon: Gauge },
        { href: `/student/${id}/development`, label: "Development", icon: GraduationCap },
      ];
    case "recruiter":
      return [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard },
        { href: `/recruiter/${id}`, label: "Pipeline", icon: Briefcase },
      ];
    case "coach":
      return [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard },
        { href: `/coach/${id}`, label: "Coaching", icon: GraduationCap },
      ];
    case "institute":
      return [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard },
        { href: `/institute/${id}`, label: "Cohort", icon: Building2 },
      ];
  }
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
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

  // When the account menu opens, move focus to the first menuitem so it is
  // immediately keyboard-operable (WAI-ARIA menu button pattern).
  useEffect(() => {
    if (!menuOpen) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items?.[0]?.focus();
  }, [menuOpen]);

  // Roving focus + Escape/Home/End inside the account dropdown. Focus is moved
  // into the menu on open, so keydown bubbles here from whichever item is active.
  const focusMenuItem = (index: number) => {
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!items || items.length === 0) return;
    const clamped = ((index % items.length) + items.length) % items.length;
    items[clamped]?.focus();
  };
  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setMenuOpen(false);
        toggleRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        focusMenuItem(currentIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusMenuItem(currentIndex - 1);
        break;
      case "Home":
        e.preventDefault();
        focusMenuItem(0);
        break;
      case "End":
        e.preventDefault();
        focusMenuItem(items.length - 1);
        break;
    }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      if (auth) await signOut(auth);
    } catch {
      /* sign-out is best-effort; route away regardless */
    }
    // Clear the coarse-gate cookie and cached role SYNCHRONOUSLY before
    // navigating. The cookie is otherwise only cleared as a side-effect of the
    // async onIdTokenChanged listener, which isn't awaited here - so without
    // this, the enforced-mode middleware gate could still see a stale token and
    // the next nav could render role-aware chrome for the just-logged-out user.
    try {
      clearSessionCookie();
      // Purge this account's workspace data (résumé, transcripts, reports,
      // fit-scores, cached role) so the next account on this browser doesn't
      // inherit it - synchronously, before we navigate.
      clearWorkspaceData();
    } catch {
      /* best-effort */
    }
    router.push("/login");
  };

  // Hide the global nav on immersive/landing/auth flows and on the in-app
  // workspace pages that ship their own DashboardShell header.
  // Persistent app header EVERYWHERE except the public/auth flows and the
  // immersive proctored interview (any path containing an /interview segment -
  // the exam must stay full-screen with no chrome).
  const hideNav =
    pathname === "/" ||
    pathname === "/onboarding" ||
    pathname === "/login" ||
    pathname === "/register" ||
    // Public, token-scoped shared cohort view: it must stay chrome-free and
    // institute-branded - the global app bar (and the demo role switcher) must
    // NOT leak onto a shared link given to an external recruiter.
    !!pathname?.startsWith("/recruiter/shared") ||
    !!pathname?.includes("/interview");
  if (hideNav) return null;

  // Link resolution:
  //  - role known        -> that stakeholder's nav (the four logins diverge here)
  //  - signed in, role still resolving -> a clean neutral (Home) - NEVER the
  //    4-role demo switcher (that would mislabel a logged-in candidate)
  //  - signed out / demo  -> the role switcher so seeded personas stay browsable
  const loggedInNeutral: NavLink[] = [{ href: "/dashboard", label: "Home", icon: LayoutDashboard }];
  const links: NavLink[] =
    role ? roleNav(role, user?.uid) : user ? loggedInNeutral : demoLinks;
  // Highlight exactly ONE link: the exact route match, otherwise the single
  // longest link whose path is a prefix of the current route. This stops
  // sibling links that share a top segment (e.g. all /student/... links) from
  // all lighting up at once.
  const activeHref = (() => {
    if (!pathname) return null;
    let best: string | null = null;
    for (const l of links) {
      if (pathname === l.href) return l.href;
      if (l.href !== "/dashboard" && pathname.startsWith(l.href + "/")) {
        if (!best || l.href.length > best.length) best = l.href;
      }
    }
    return best;
  })();
  const isActive = (href: string) => href === activeHref;

  return (
    <div className="sticky top-0 z-50 px-3 pt-3 pb-2 sm:px-5 print:hidden before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-full before:bg-gradient-to-b before:from-canvas before:via-canvas/95 before:to-transparent">
      <header
        className={cn(
          "relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-full border px-3 backdrop-blur-xl transition-all duration-300 sm:px-4",
          scrolled
            ? "border-ink-200/80 bg-white/90 shadow-panel-hover"
            : "border-ink-200/60 bg-white/85 shadow-panel"
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
                  "flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
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
                ref={toggleRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-md border border-ink-200/70 bg-white py-1 pl-1 pr-2.5 text-sm font-bold text-ink-800 transition hover:border-brand-300 hover:bg-ink-50"
              >
                <Avatar name={user.displayName} email={user.email} size="xs" />
                <span className="hidden max-w-[120px] truncate sm:inline">{user.displayName || user.email}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden className={menuOpen ? "rotate-180 transition-transform" : "transition-transform"}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {menuOpen && (
                <div role="menu" onKeyDown={onMenuKeyDown} className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl2 border border-ink-200/70 bg-white py-1.5 shadow-panel">
                  <div className="border-b border-ink-100 px-4 py-2.5">
                    <p className="truncate text-sm font-bold text-ink-900">{user.displayName || "Your account"}</p>
                    <p className="truncate text-xs text-ink-500" title={user.email || undefined}>{user.email}</p>
                    {role ? <p className="mt-0.5 text-xs font-semibold capitalize text-brand-600">{role}</p> : null}
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
                className="hidden rounded-md px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900 sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-brand-700 hover:shadow-md sm:px-5"
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
            className="grid h-9 w-9 place-items-center rounded-md border border-ink-200/70 bg-white text-ink-900 transition-colors hover:bg-ink-50 md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile dropdown (floating card) */}
      {open && (
        <div id="mobile-nav-menu" className="mx-auto mt-2 max-w-6xl rounded-2xl border border-ink-200/70 bg-white/95 p-2 shadow-lg backdrop-blur-xl md:hidden">
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
