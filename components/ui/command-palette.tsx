"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Global ⌘K / Ctrl+K command palette for quick navigation. Lists only REAL
 * in-app routes. Disabled on the public/auth flows and the proctored interview
 * so it never affects those surfaces. Open via the shortcut or by dispatching
 * a `taledge:command-open` window event (the nav search button does this).
 */
type Command = { label: string; group: string; href: string; keywords?: string };

// Role-agnostic destinations every signed-in user can safely reach. The
// dashboard already surfaces each user's own role-correct deep links, so these
// are the only nav entries we expose when auth is enforced.
const SAFE_COMMANDS: Command[] = [
  { label: "Dashboard", group: "Navigate", href: "/dashboard", keywords: "home overview command center" },
  { label: "My Profile", group: "Navigate", href: "/profile", keywords: "account settings name" },
  { label: "Start assessment", group: "Navigate", href: "/onboarding", keywords: "begin resume upload onboarding" },
];

// Seed-persona deep links — DEMO mode only. In enforced mode these would let a
// signed-in user jump straight into another persona's uid-keyed workspace
// (privacy / wrong data), so they are excluded.
const DEMO_COMMANDS: Command[] = [
  { label: "Candidate workspace", group: "Candidate", href: "/student/candidate-001", keywords: "student development analytics" },
  { label: "DNLA report", group: "Candidate", href: "/student/candidate-001/dnla", keywords: "psychometrics competencies behavioural" },
  { label: "Fit Score", group: "Candidate", href: "/student/candidate-001/fit-score", keywords: "report success probability score" },
  { label: "Development pathway", group: "Candidate", href: "/student/candidate-001/development", keywords: "coaching gaps learning" },
  { label: "Recruiter console", group: "Workspaces", href: "/recruiter/recruiter-001", keywords: "candidates pipeline hiring shortlist" },
  { label: "Institute dashboard", group: "Workspaces", href: "/institute/institute-placement", keywords: "cohort placement readiness" },
  { label: "Coach workspace", group: "Workspaces", href: "/coach/coach-001", keywords: "sessions coaching queue" },
];

const COMMANDS: Command[] =
  process.env.NEXT_PUBLIC_AUTH_ENFORCED === "true"
    ? SAFE_COMMANDS
    : [...SAFE_COMMANDS, ...DEMO_COMMANDS];

function disabledOn(p: string | null): boolean {
  return (
    !p ||
    p === "/" ||
    p === "/login" ||
    p === "/register" ||
    p === "/onboarding" ||
    p.includes("/interview")
  );
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const enabled = !disabledOn(pathname);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (!enabled) return;
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => {
      if (enabled) setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("taledge:command-open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("taledge:command-open", onOpen);
    };
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) =>
      `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => setActive(0), [query]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) go(r.href);
    }
  };

  if (!enabled) return null;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[150] flex items-start justify-center p-4 pt-[12vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Command menu"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-ink-200/70 px-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-400" aria-hidden>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages and actions…"
                className="w-full bg-transparent py-4 text-sm text-ink-900 outline-none placeholder:text-ink-400"
                aria-label="Search commands"
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={results.length ? optionId(active) : undefined}
              />
              <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[10px] font-bold text-ink-500">ESC</kbd>
            </div>
            <span aria-live="polite" className="sr-only">
              {results.length} {results.length === 1 ? "result" : "results"}
            </span>
            <div className="max-h-[50vh] overflow-y-auto p-2" role="listbox" id={listboxId} aria-label="Commands">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-ink-500">No matches found.</p>
              ) : (
                results.map((c, i) => (
                  <button
                    key={c.href}
                    type="button"
                    role="option"
                    id={optionId(i)}
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(c.href)}
                    className={
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors " +
                      (i === active ? "bg-brand-50" : "hover:bg-ink-50")
                    }
                  >
                    <span className="flex items-center gap-3">
                      <span className={"grid h-7 w-7 place-items-center rounded-md " + (i === active ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500")}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                      </span>
                      <span className="text-sm font-semibold text-ink-900">{c.label}</span>
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{c.group}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
