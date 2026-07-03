"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/logo";

/* ------------------------------------------------------------------ *
 * Shared enterprise authentication kit. On the product brand: white
 * surfaces, brand-600 (indigo) primary, ink-900 text, Sora (inherited),
 * consistent radii / shadows / motion. Reused by Sign In and Get Started.
 * ------------------------------------------------------------------ */

export const EASE = [0.16, 1, 0.3, 1] as const;

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={"animate-spin " + className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

/* ------------------------------ inputs ---------------------------- */

export function EntField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  icon,
  trailing,
  inputMode,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  inputMode?: "text" | "email" | "numeric";
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink-900">
        {label}
      </label>
      <div className="group relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 transition-colors group-focus-within:text-brand-600">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          inputMode={inputMode}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={
            "w-full rounded-lg border border-ink-300 bg-white py-3 text-[15px] text-ink-900 shadow-sm outline-none transition-all placeholder:text-ink-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/12 " +
            (icon ? "pl-11 " : "pl-4 ") +
            (trailing ? "pr-11" : "pr-4")
          }
        />
        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
    </div>
  );
}

export function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
    </svg>
  );
}
export function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/* ------------------------------ SSO ------------------------------- */

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.83Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
export function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}

export function SsoButton({
  onClick,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-ink-300 bg-white px-4 py-3 text-[14px] font-semibold text-ink-900 shadow-sm transition-all hover:border-ink-400 hover:bg-ink-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icon}
      {children}
    </button>
  );
}

/* -------------------- split-screen brand panel -------------------- */

// The candidate → Fit Score pipeline, presented as a quiet editorial workflow
// (structured information architecture, not floating cards). All real product.
const PANEL_PROCESS = [
  { n: "01", t: "AI technical interview", d: "Proctored, adaptive, rubric-scored" },
  { n: "02", t: "DNLA psychometrics", d: "Four behavioural competency axes" },
  { n: "03", t: "AI behavioural interview", d: "Targeted to development areas" },
  { n: "04", t: "The Fit Score", d: "One defensible success probability" },
];

const PANEL_STATS = [
  { v: "2", l: "Assessment tracks" },
  { v: "4", l: "Stakeholder workspaces" },
  { v: "4", l: "DNLA competency axes" },
];

export function BrandPanel({
  heading,
  sub,
}: {
  heading: string;
  sub: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="relative hidden min-h-screen overflow-hidden bg-ink-900 text-white lg:flex">
      <div className="relative flex h-full w-full flex-col px-14 py-10 xl:px-20 xl:py-14">
        {/* Top - identity */}
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Taledge home" className="inline-flex">
            <Logo inverted />
          </Link>
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-400">Enterprise</span>
        </div>

        {/* Center - executive statement, workflow, and proof points as ONE
            cohesive block, vertically centered (no dead space between them). */}
        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="max-w-lg">
            <p className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-brand-300">
              <span aria-hidden className="h-px w-8 bg-brand-300/50" /> Talent Intelligence &amp; Success Platform
            </p>
            <h2 className="mt-5 text-[2.45rem] font-extrabold leading-[1.06] tracking-[-0.03em] [text-wrap:balance] xl:text-[2.95rem]">
              {heading}
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-300">{sub}</p>

            <div className="mt-9 space-y-1">
              {PANEL_PROCESS.map((p, i) => (
                <motion.div
                  key={p.n}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE, delay: 0.25 + i * 0.08 }}
                  className="flex items-baseline gap-6 py-2.5"
                >
                  <span className="text-[13px] font-semibold tabular-nums text-brand-300">{p.n}</span>
                  <span className="flex-1 text-[15px] font-medium text-ink-100">{p.t}</span>
                  <span className="hidden text-[12.5px] text-ink-400 xl:block">{p.d}</span>
                </motion.div>
              ))}
            </div>

            <div className="mt-9 grid grid-cols-3 gap-8">
              {PANEL_STATS.map((s) => (
                <div key={s.l}>
                  <p className="text-[1.7rem] font-extrabold leading-none tracking-tight text-white">{s.v}</p>
                  <p className="mt-2 text-[12px] leading-snug text-ink-400">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom - copyright pinned to the floor */}
        <p className="text-[12px] text-ink-500">© 2026 Taledge · Talent Intelligence &amp; Success Platform</p>
      </div>
    </div>
  );
}

/** Split-screen auth shell: brand panel (left) + contained card (right). */
export function EnterpriseAuthShell({
  heading,
  sub,
  children,
}: {
  heading: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-white text-ink-900 antialiased lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel heading={heading} sub={sub} />
      <div className="relative flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <Link href="/" aria-label="Taledge home" className="absolute left-6 top-6 inline-flex lg:hidden">
          <Logo />
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="w-full max-w-[420px]"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

/** Small reusable show/hide control for password fields. */
export function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={shown ? "Hide password" : "Show password"}
      className="grid h-8 w-8 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
    >
      {shown ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68M6.6 6.6A13.3 13.3 0 0 0 2 12s3 8 10 8a9.3 9.3 0 0 0 5.4-1.6M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
      )}
      <span className="sr-only">{hover ? "" : ""}</span>
    </button>
  );
}
