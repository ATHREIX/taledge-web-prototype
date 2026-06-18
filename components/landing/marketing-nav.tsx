"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#services", label: "Services" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <header
        className={cn(
          "relative mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border px-3 py-2 transition-all duration-300",
          scrolled
            ? "border-ink-200/70 bg-white/80 shadow-panel backdrop-blur-xl"
            : "border-white/60 bg-white/55 shadow-[0_4px_24px_-12px_rgba(16,24,40,0.18)] backdrop-blur-xl"
        )}
      >
        {/* Logo */}
        <Link href="/" aria-label="Taledge home" className="shrink-0 pl-1.5 transition-transform hover:scale-[1.02]">
          <Logo />
        </Link>

        {/* Center pill links */}
        <nav
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full md:flex"
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-900/5 hover:text-ink-900"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-900/5 hover:text-ink-900 sm:inline-flex"
          >
            Sign in
          </Link>
          <ButtonLink href="/register" size="sm" className="group rounded-full pr-3">
            Get started
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </ButtonLink>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="grid h-9 w-9 place-items-center rounded-full border border-ink-200/70 bg-white text-ink-900 transition-colors hover:bg-ink-50 md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile dropdown */}
      {open && (
        <div className="mx-auto mt-2 max-w-6xl rounded-3xl border border-ink-200/70 bg-white/90 p-2 shadow-panel backdrop-blur-xl md:hidden">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-2xl px-4 py-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-900/5 hover:text-ink-900"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="block rounded-2xl px-4 py-3 text-sm font-semibold text-ink-700 hover:bg-ink-900/5"
          >
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
