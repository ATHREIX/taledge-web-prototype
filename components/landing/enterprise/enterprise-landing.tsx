"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/logo";
import { SmoothScroll } from "./smooth-scroll";

/* ------------------------------------------------------------------ *
 * Enterprise landing for Taledge.
 *
 * EVERY string below is drawn from the real product surface (hero,
 * features, pipeline, services, persona tabs, FAQ, footer). No invented
 * statistics, customers, certifications or logos. Visuals are schematic
 * representations of the real product structure (Fit Score, the four DNLA
 * axes, the four-step pipeline, the four workspaces).
 * ------------------------------------------------------------------ */

const EASE = [0.16, 1, 0.3, 1] as const;

/* ----------------------------- helpers ---------------------------- */

function Reveal({
  children,
  delay = 0,
  y = 26,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#0057FF]">
      <span aria-hidden className="h-px w-6 bg-[#0057FF]/50" />
      {children}
    </span>
  );
}

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ------------------------------- data ----------------------------- */

const MODULES = [
  {
    title: "AI voice interviews",
    body: "Proctored technical and behavioural interviews run by a live voice agent, transcribed and scored against a rubric.",
    serves: "Candidate assessment",
    path: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3",
  },
  {
    title: "DNLA psychometrics",
    body: "Competency intelligence across achievement, interpersonal, execution and resilience - benchmarked to top performers.",
    serves: "Competency intelligence",
    path: "M3 3v18h18M7 14l4-4 3 3 5-6",
  },
  {
    title: "The Fit Score",
    body: "One defensible number fusing skills, interview evidence and psychometrics into a success probability.",
    serves: "Decision signal",
    path: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 5v5l3 3",
  },
  {
    title: "Coaching pathways",
    body: "Every gap becomes a tracked development plan with risk-ranked coaching sessions and measurable progress.",
    serves: "Development",
    path: "M12 20h9M3 20h2M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  },
  {
    title: "Recruiter visibility",
    body: "Verified, role-matched candidates published with consent - shortlist on evidence, not keywords.",
    serves: "Recruiter pipeline",
    path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 .01M23 21v-2a4 4 0 0 0-3-3.87",
  },
  {
    title: "Institute analytics",
    body: "Cohort readiness heatmaps, at-risk early-warning lists, and intervention impact tracking across batches.",
    serves: "Cohort oversight",
    path: "M3 3v18h18M8 17V9M13 17V5M18 17v-6",
  },
];

const ARCHITECTURE = [
  {
    n: "01",
    title: "AI technical interview",
    body: "Upload a résumé or job description, then a proctored voice AI runs an adaptive technical interview grounded in the candidate's skills, projects and target role - transcribed and rubric-scored live.",
    chips: ["Résumé / JD", "Adaptive", "Proctored"],
  },
  {
    n: "02",
    title: "DNLA psychometrics",
    body: "The candidate completes the DNLA questionnaire (administered by our licensed partner in Germany), mapping behavioural competencies across achievement, interpersonal, execution and resilience.",
    chips: ["Motivation", "Resilience", "Execution"],
  },
  {
    n: "03",
    title: "AI behavioural interview",
    body: "A second AI round, tailored to the DNLA report, probes the candidate's development areas with situational and adversarial follow-ups - again transcribed and scored.",
    chips: ["Behavioural", "DNLA-targeted", "Scored"],
  },
  {
    n: "04",
    title: "The Fit Score, crystallised",
    body: "Interview evidence, DNLA and résumé signals fuse into one defensible Fit Score and success probability - then fan out to recruiters on consent.",
    chips: ["Fit Score", "Success %", "Published"],
  },
];

const DNLA_AXES = ["Achievement", "Interpersonal", "Execution", "Resilience"];

const GOVERNANCE = [
  {
    title: "Owner-scoped by default",
    body: "Your profile and reports are owner-scoped and only shared with recruiters when you explicitly publish them.",
    path: "M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4Z",
  },
  {
    title: "Access enforced at the database",
    body: "Security rules enforce access at the database level - not just in the application layer.",
    path: "M5 11V7a7 7 0 0 1 14 0v4M5 11h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9Z",
  },
  {
    title: "Consent-based publishing",
    body: "Verified candidates are published to recruiters only with consent - the candidate stays in control of who sees their evidence.",
    path: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  },
  {
    title: "Proctored, rubric-scored",
    body: "Interviews are proctored and scored against a structured rubric - consistent for everyone, with no human bias.",
    path: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  },
];

const WHY_ROWS = [
  {
    dimension: "Shortlisting basis",
    traditional: "Résumé keywords and gut feel",
    taledge: "Verified interview evidence and a defensible Fit Score",
  },
  {
    dimension: "Evaluation consistency",
    traditional: "Varies by interviewer; human bias",
    taledge: "One structured rubric, consistent for everyone",
  },
  {
    dimension: "Interview capacity",
    traditional: "Manual rounds, limited by schedules",
    taledge: "Proctored AI voice interviews, transcribed and scored",
  },
  {
    dimension: "The decision signal",
    traditional: "A subjective yes / no",
    taledge: "A 0–100 Fit Score and success probability",
  },
  {
    dimension: "After the assessment",
    traditional: "Feedback rarely closes the loop",
    taledge: "Every gap becomes a tracked coaching pathway",
  },
];

const FAQ = [
  {
    q: "What is a Fit Score?",
    a: "A single 0–100 score that fuses your résumé context, AI interview performance and DNLA psychometrics into a defensible measure of role readiness and success probability.",
  },
  {
    q: "Who is Taledge for?",
    a: "Four audiences on one platform: candidates getting assessed, recruiters shortlisting on evidence, coaches running development sessions, and institutes tracking cohort readiness.",
  },
  {
    q: "How do the AI interviews work?",
    a: "A live voice agent conducts proctored technical and behavioural interviews. Each question adapts to your last answer, the round runs about 10-15 minutes, responses are transcribed and scored against a structured rubric - no human bias, consistent for everyone.",
  },
  {
    q: "What is the DNLA assessment?",
    a: "DNLA is a validated psychometric framework from established European assessment science. It profiles the human competencies behind real-world performance - achievement dynamics, interpersonal skills, execution and stress resilience - each scored 1-7 against a top-performer benchmark. It measures how you work, not just what you know.",
  },
  {
    q: "How is my score actually calculated?",
    a: "The AI rates each answer against a rubric, always grounded in your own words. Your headline Fit Score is then recomputed by fixed server code from those evidence-based sub-scores - never a single number the AI guessed - and the full evidence trail is stored so any score can be explained.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Your profile and reports are owner-scoped and only shared with recruiters when you explicitly publish them. Security rules enforce access at the database level.",
  },
  {
    q: "What are the two tracks?",
    a: "Placement Success (job readiness for students) and Competitive Exam Success (UPSC/JEE/NEET/CAT preparation with success-potential and resilience signals).",
  },
  {
    q: "How do I get started?",
    a: "Create a free account, pick your role, and you're routed straight into your workspace. Candidates start with a résumé upload that powers the assessment.",
  },
];

/* ---- stakeholders (candidate is the primary audience) ---- */

const STAKEHOLDERS = [
  {
    tag: "For candidates & students",
    title: "Prove what you can do — and see exactly how to improve.",
    body: "You are the centre of Taledge. Take AI voice interviews and a DNLA psychometric assessment, get one honest Fit Score built from your own answers, and receive a step-by-step plan to close every gap. Your evidence is yours — recruiters only see it when you choose to publish.",
    points: [
      "Adaptive AI voice interviews — technical + behavioural",
      "A DNLA profile of how you actually work",
      "One Fit Score with a full, quotable evidence trail",
      "A personalised coaching pathway for every gap",
      "Publish to recruiters only when you decide to",
    ],
    cta: { href: "/register", label: "Start free as a candidate" },
  },
  {
    tag: "For recruiters",
    title: "Shortlist on evidence, not résumé keywords.",
    body: "Browse a role-matched pool of candidates who have already been interviewed and psychometrically profiled. Every candidate carries verified technical, behavioural and success-probability signals — published to you only with the candidate's consent.",
    points: ["Role-matched, pre-assessed candidate pool", "Verified interview + psychometric evidence", "Success-probability ranking", "Consent-based, shareable reports"],
  },
  {
    tag: "For institutes & universities",
    title: "See your whole cohort's readiness at a glance.",
    body: "Track every student's assessment progress, spot at-risk learners early with readiness heatmaps, plan targeted interventions, and share shortlisted, consented candidates with your recruiter partners.",
    points: ["Cohort readiness heatmaps", "Early-warning at-risk lists", "Intervention planning + impact tracking", "Consent-scoped recruiter sharing"],
  },
  {
    tag: "For coaches",
    title: "Coach against real, measured gaps.",
    body: "Every coaching sprint is anchored to a candidate's actual Fit Score gaps and DNLA development areas — so sessions target what genuinely moves the number, and progress is measurable over time.",
    points: ["Gap-anchored coaching sessions", "DNLA development areas surfaced", "Risk-ranked priorities", "Measurable progress over time"],
  },
];

/* ---- AI interview deep-dive ---- */

const INTERVIEW_FEATURES = [
  { title: "Adaptive, never scripted", body: "Each question builds on the candidate's last answer and climbs in difficulty as they succeed. A struggling candidate is met where they are, not piled on." },
  { title: "Two focused rounds", body: "A technical / skills round grounded in the résumé and target role, then a behavioural round tuned to the candidate's DNLA profile." },
  { title: "Real, run-it-live coding", body: "For technical roles the candidate writes and executes code in an in-browser compiler; whether it compiles and produces correct output feeds the score." },
  { title: "Live-proctored throughout", body: "Face verification and environment checks run for the whole session, so every result is defensible and consistent for everyone." },
  { title: "Scored on quoted evidence", body: "Every answer is rated against a rubric with the candidate's own words as proof; headline numbers are recomputed by fixed code, never guessed by the AI." },
  { title: "~10–15 minutes", body: "Adaptive length — long enough for genuine signal, short enough to finish comfortably in one sitting." },
];

/* ---- DNLA assessment deep-dive ---- */

const DNLA_GROUPS = [
  { group: "Achievement Dynamics", blurb: "Drive, intrinsic motivation and self-confidence — the engine behind getting things finished.", items: ["Drive for Results", "Initiative"] },
  { group: "Interpersonal Skills", blurb: "Collaboration, empathy and how feedback lands — how a person works with others.", items: ["Collaboration", "Feedback Reception"] },
  { group: "Execution", blurb: "Turning intent into finished, correct work under real-world constraints.", items: ["Problem Solving", "Attention to Detail"] },
  { group: "Stress & Resilience", blurb: "Composure under pressure and adaptability when the ground shifts.", items: ["Composure", "Adaptability"] },
];

/* ------------------------------- nav ------------------------------ */

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#who", label: "Who it's for" },
  { href: "#interview", label: "AI interview" },
  { href: "#dnla", label: "DNLA" },
  { href: "#faq", label: "FAQ" },
];

function EntNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
      <header className="relative mx-auto flex h-14 max-w-[80rem] items-center justify-between gap-6 rounded-full border border-slate-200/70 bg-white/85 px-3 shadow-[0_10px_34px_-18px_rgba(16,24,40,0.18)] backdrop-blur-xl transition-all duration-300 sm:px-4">
        <Link href="/" aria-label="Taledge home" className="shrink-0 pl-1.5">
          <Logo />
        </Link>
        <nav
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex"
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3.5 py-2 text-[14px] font-medium text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-[#081A3A]"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden rounded-md px-3.5 py-2 text-[14px] font-semibold text-[#081A3A] transition-colors hover:bg-slate-100/80 sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="group inline-flex items-center gap-1.5 rounded-full bg-[#0057FF] px-4 py-2 text-[14px] font-semibold text-white shadow-sm transition-all hover:bg-[#0F4CFF] hover:shadow-md"
          >
            Get started
            <Arrow className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-[#081A3A] lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
            </svg>
          </button>
        </div>
      </header>
      {open && (
        <div className="mx-auto mt-2 max-w-[80rem] rounded-2xl border border-slate-200/70 bg-white/95 p-2 shadow-lg backdrop-blur-xl lg:hidden">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-100"
            >
              {l.label}
            </a>
          ))}
          <a href="/login" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-[15px] font-semibold text-[#0057FF]">
            Sign in
          </a>
        </div>
      )}
    </div>
  );
}

/* ---------------------- product visualization --------------------- */

function FitScoreGauge({ value = 82, size = 132 }: { value?: number; size?: number }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F5" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#fsg)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <defs>
        <linearGradient id="fsg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0057FF" />
          <stop offset="100%" stopColor="#0F4CFF" />
        </linearGradient>
      </defs>
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fontSize="30" fontWeight="800" fill="#081A3A">
        {value}
      </text>
      <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="600" fill="#64748B">
        FIT SCORE
      </text>
    </svg>
  );
}

function DnlaRadar({ values = [0.82, 0.64, 0.74, 0.58], size = 180 }: { values?: number[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 26;
  const pt = (i: number, scale: number) => {
    const angle = (Math.PI / 2) * i - Math.PI / 2;
    return [cx + radius * scale * Math.cos(angle), cy + radius * scale * Math.sin(angle)];
  };
  const ring = (scale: number) =>
    [0, 1, 2, 3].map((i) => pt(i, scale).join(",")).join(" ");
  const shape = values.map((v, i) => pt(i, v).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {[0.4, 0.7, 1].map((s) => (
        <polygon key={s} points={ring(s)} fill="none" stroke="#E2E8F5" strokeWidth="1" />
      ))}
      {[0, 1, 2, 3].map((i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E2E8F5" strokeWidth="1" />;
      })}
      <polygon points={shape} fill="rgba(0,87,255,0.14)" stroke="#0057FF" strokeWidth="2" />
      {values.map((v, i) => {
        const [x, y] = pt(i, v);
        return <circle key={i} cx={x} cy={y} r="3.2" fill="#0057FF" />;
      })}
    </svg>
  );
}

function DashboardMock() {
  const pipeline = [
    { label: "Technical interview", done: true },
    { label: "DNLA psychometrics", done: true },
    { label: "Behavioural interview", done: true },
    { label: "Fit Score published", done: false },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_-40px_rgba(8,26,58,0.45)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-slate-200" />
        <span className="h-3 w-3 rounded-full bg-slate-200" />
        <span className="h-3 w-3 rounded-full bg-slate-200" />
        <span className="ml-3 text-[12px] font-medium text-slate-400">Taledge · Candidate workspace</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
        {/* Fit score */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <FitScoreGauge />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Success probability</p>
            <p className="mt-1 text-2xl font-bold text-[#081A3A]">High</p>
            <p className="mt-2 max-w-[150px] text-[12px] leading-snug text-slate-500">
              Skills, interview evidence and psychometrics, fused into one number.
            </p>
          </div>
        </div>
        {/* DNLA radar */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">DNLA competencies</p>
          <div className="mt-1 flex items-center justify-center">
            <DnlaRadar />
          </div>
          <div className="-mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {DNLA_AXES.map((a) => (
              <span key={a} className="text-[11px] font-medium text-slate-500">{a}</span>
            ))}
          </div>
        </div>
        {/* Pipeline */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:col-span-2">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Assessment pipeline</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {pipeline.map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-200 p-3">
                <span
                  className={
                    "grid h-6 w-6 place-items-center rounded-full " +
                    (s.done ? "bg-[#0057FF] text-white" : "border border-slate-300 text-slate-300")
                  }
                >
                  {s.done ? <Check /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
                </span>
                <p className="mt-2 text-[12.5px] font-semibold leading-snug text-[#081A3A]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Live proctored-interview mock for the assessment section. Distinct from the
 * Fit Score dashboard used in the hero - it shows the real product surface:
 * an AI interviewer turn, the candidate answering live, and the always-on
 * integrity checks that make the assessment defensible.
 */
function InterviewMock() {
  const checks = ["Face visible", "No second device", "Tab focused", "Quiet environment"];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_-40px_rgba(8,26,58,0.45)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-slate-200" />
        <span className="h-3 w-3 rounded-full bg-slate-200" />
        <span className="h-3 w-3 rounded-full bg-slate-200" />
        <span className="ml-3 text-[12px] font-medium text-slate-400">Taledge · Live interview</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-slate-400">12:48</span>
      </div>
      <div className="space-y-4 p-4 sm:p-6">
        {/* AI question */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#0057FF]">AI interviewer</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#081A3A]">
            Walk me through how you&apos;d design a rate limiter for a high-traffic API.
          </p>
        </div>
        {/* candidate answer */}
        <div className="ml-auto max-w-[85%] rounded-xl bg-[#0057FF] p-4 text-white">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
            You
            <span className="inline-flex gap-0.5" aria-hidden>
              <span className="h-1 w-1 rounded-full bg-white/80" />
              <span className="h-1 w-1 rounded-full bg-white/60" />
              <span className="h-1 w-1 rounded-full bg-white/40" />
            </span>
            speaking
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed">
            I&apos;d keep a token bucket per client key in Redis, refilled at a fixed rate…
          </p>
        </div>
        {/* live integrity checks */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Live security checks</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {checks.map((c) => (
              <span key={c} className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-600">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-2.5 w-2.5" />
                </span>
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- sections --------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200/70 bg-white">
      {/* faint enterprise grid + soft blue wash, no heavy gradients */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(8,26,58,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(8,26,58,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#0057FF]/5 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-[80rem] items-start gap-14 px-5 pt-10 pb-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-14 lg:pb-24">
        <div>
          <Reveal>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#0057FF]/20 bg-[#0057FF]/[0.06] px-3 py-1 text-[12px] font-semibold text-[#0057FF]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0057FF]" /> Phase 1 · Live · Dual-track
              </span>
              <span className="text-[12px] font-medium text-slate-500">Talent Intelligence &amp; Success Platform</span>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="mt-6 text-[2.7rem] font-extrabold leading-[1.04] tracking-[-0.025em] text-[#081A3A] sm:text-[3.4rem]">
              Turn potential into{" "}
              <span className="relative whitespace-nowrap text-[#0057FF]">
                proof
                <span aria-hidden className="absolute inset-x-0 -bottom-1 h-[3px] rounded-full bg-[#0057FF]/30" />
              </span>
              .
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-6 max-w-xl text-[1.075rem] leading-relaxed text-slate-600">
              Taledge measures, predicts and improves human potential - fusing AI
              interviews, DNLA psychometrics and human coaching into one defensible
              score across placement and competitive-exam success.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-md bg-[#0057FF] px-6 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-[#0F4CFF] hover:shadow-lg"
              >
                Get started free
                <Arrow className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/student/candidate-001"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-6 py-3.5 text-[15px] font-semibold text-[#081A3A] transition-all hover:border-[#0057FF]/40 hover:bg-slate-50"
              >
                Explore a live workspace
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-slate-200 pt-7">
              {[
                { v: "2", l: "Tracks", s: "Placement · Exam" },
                { v: "4", l: "Stakeholders", s: "Candidate → Institute" },
                { v: "4", l: "DNLA axes", s: "Competency groups" },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="text-3xl font-extrabold tracking-tight text-[#081A3A]">{s.v}</dt>
                  <dd className="mt-1 text-[13px] font-semibold text-[#0057FF]">{s.l}</dd>
                  <dd className="text-[12px] text-slate-500">{s.s}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <Reveal delay={0.16} y={36}>
          <div className="relative">
            <DashboardMock />
            <p className="mt-3 text-center text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Representative product preview
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Credibility() {
  const items = [
    { k: "Status", v: "Phase 1 · Live", d: "A working, deployed platform - not a concept." },
    { k: "Coverage", v: "Two tracks", d: "Placement Success and Competitive Exam Success." },
    { k: "Stakeholders", v: "Four workspaces", d: "Candidate, recruiter, coach and institute." },
    { k: "Method", v: "Proctored & rubric-scored", d: "Consistent evaluation, no human bias." },
  ];
  return (
    <section className="border-b border-slate-200/70 bg-slate-50/60">
      <div className="mx-auto max-w-[80rem] px-5 py-16 sm:px-8">
        <Reveal>
          <p className="text-center text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Built for placement and competitive-exam success - UPSC, JEE, NEET and CAT
          </p>
        </Reveal>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <Reveal key={it.k} delay={i * 0.05}>
              <div className="h-full bg-white p-6">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#0057FF]">{it.k}</p>
                <p className="mt-2 text-lg font-bold text-[#081A3A]">{it.v}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{it.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Architecture() {
  return (
    <section id="how" className="scroll-mt-24 bg-white">
      <div className="mx-auto max-w-[80rem] px-5 py-24 sm:px-8">
        <Reveal className="max-w-2xl">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-4 text-[2.1rem] font-extrabold tracking-[-0.02em] text-[#081A3A] sm:text-[2.6rem]">
            From résumé to Fit Score in four steps
          </h2>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-600">
            A new candidate goes through four sequential stages. Each one produces real
            evidence — and feeds the next — so the final Fit Score is earned, not guessed.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-4">
          {ARCHITECTURE.map((a, i) => (
            <Reveal key={a.n} delay={i * 0.06}>
              <div className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-[#0057FF]/40 hover:shadow-[0_20px_50px_-30px_rgba(8,26,58,0.4)]">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#0057FF] text-[15px] font-extrabold text-white">
                    {a.n}
                  </span>
                  {i < ARCHITECTURE.length - 1 && (
                    <Arrow className="hidden text-slate-300 transition-colors group-hover:text-[#0057FF] lg:block" />
                  )}
                </div>
                <h3 className="mt-5 text-[1.05rem] font-bold text-[#081A3A]">{a.title}</h3>
                <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-slate-500">{a.body}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {a.chips.map((c) => (
                    <span key={c} className="rounded-full bg-[#0057FF]/[0.07] px-2.5 py-1 text-[11px] font-semibold text-[#0057FF]">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Modules() {
  return (
    <section id="modules" className="scroll-mt-24 border-y border-slate-200/70 bg-slate-50/60">
      <div className="mx-auto max-w-[80rem] px-5 py-24 sm:px-8">
        <Reveal className="max-w-2xl">
          <SectionLabel>Platform modules</SectionLabel>
          <h2 className="mt-4 text-[2.1rem] font-extrabold tracking-[-0.02em] text-[#081A3A] sm:text-[2.6rem]">
            Everything to measure &amp; grow human potential
          </h2>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-600">
            Six modules, one platform. Each turns a raw signal into an outcome a
            stakeholder can act on.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <Reveal key={m.title} delay={(i % 3) * 0.06}>
              <article className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-7 transition-all hover:-translate-y-1 hover:border-[#0057FF]/40 hover:shadow-[0_24px_60px_-34px_rgba(8,26,58,0.45)]">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-[#0057FF]/15 bg-[#0057FF]/[0.06] text-[#0057FF] transition-colors group-hover:bg-[#0057FF] group-hover:text-white">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={m.path} />
                  </svg>
                </span>
                <h3 className="mt-5 text-[1.15rem] font-bold text-[#081A3A]">{m.title}</h3>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-slate-500">{m.body}</p>
                <p className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#0057FF]">
                  <span className="h-px w-4 bg-[#0057FF]/40" /> {m.serves}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stakeholders() {
  const [primary, ...rest] = STAKEHOLDERS;
  return (
    <section id="who" className="scroll-mt-24 bg-white">
      <div className="mx-auto max-w-[80rem] px-5 py-24 sm:px-8">
        <Reveal className="max-w-2xl">
          <SectionLabel>Who it&apos;s for</SectionLabel>
          <h2 className="mt-4 text-[2.1rem] font-extrabold tracking-[-0.02em] text-[#081A3A] sm:text-[2.6rem]">
            One platform, built around the candidate
          </h2>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-600">
            Everything starts with the person being assessed. Recruiters, institutes and
            coaches all act on the evidence the candidate produces — and only ever with
            the candidate&apos;s consent.
          </p>
        </Reveal>

        {/* Primary: candidate — full-width feature card */}
        <Reveal delay={0.06}>
          <div className="mt-12 grid gap-8 overflow-hidden rounded-2xl border border-[#0057FF]/20 bg-[#0057FF]/[0.03] p-8 sm:p-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#0057FF] px-3 py-1 text-[12px] font-semibold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" /> {primary.tag}
              </span>
              <h3 className="mt-5 text-[1.6rem] font-extrabold leading-tight tracking-[-0.01em] text-[#081A3A] sm:text-[1.9rem]">
                {primary.title}
              </h3>
              <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-slate-600">{primary.body}</p>
              {primary.cta && (
                <Link
                  href={primary.cta.href}
                  className="group mt-7 inline-flex items-center gap-2 rounded-md bg-[#0057FF] px-6 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-[#0F4CFF] hover:shadow-lg"
                >
                  {primary.cta.label}
                  <Arrow className="transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </div>
            <ul className="grid content-start gap-3">
              {primary.points.map((p) => (
                <li key={p} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-[14px] font-medium text-slate-700">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0057FF]/[0.08] text-[#0057FF]"><Check /></span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* Supporting stakeholders */}
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {rest.map((s, i) => (
            <Reveal key={s.tag} delay={i * 0.06}>
              <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-7">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#0057FF]">{s.tag}</p>
                <h3 className="mt-2 text-[1.2rem] font-bold leading-snug text-[#081A3A]">{s.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">{s.body}</p>
                <ul className="mt-5 grid gap-2.5 border-t border-slate-100 pt-5">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[13px] font-medium text-slate-700">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#0057FF]/[0.08] text-[#0057FF]"><Check className="h-2.5 w-2.5" /></span>
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function AiInterview() {
  return (
    <section id="interview" className="scroll-mt-24 border-y border-slate-200/70 bg-slate-50/60">
      <div className="mx-auto max-w-[80rem] px-5 py-24 sm:px-8">
        <Reveal className="max-w-2xl">
          <SectionLabel>The Taledge AI interview</SectionLabel>
          <h2 className="mt-4 text-[2.1rem] font-extrabold tracking-[-0.02em] text-[#081A3A] sm:text-[2.6rem]">
            A real interview, run by a live voice AI
          </h2>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-600">
            Not a multiple-choice test. A spoken, adaptive interview that listens to each
            answer, follows up like a seasoned interviewer, and turns the whole
            conversation into scored, quotable evidence.
          </p>
        </Reveal>

        <div className="mt-14 grid items-start gap-12 lg:grid-cols-2">
          <Reveal y={34}>
            <InterviewMock />
            <p className="mt-3 text-center text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Representative interview surface
            </p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {INTERVIEW_FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 2) * 0.06}>
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="text-[1rem] font-bold text-[#081A3A]">{f.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DnlaDeepDive() {
  return (
    <section id="dnla" className="scroll-mt-24 bg-white">
      <div className="mx-auto max-w-[80rem] px-5 py-24 sm:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <Reveal>
            <SectionLabel>The DNLA assessment</SectionLabel>
            <h2 className="mt-4 text-[2.1rem] font-extrabold tracking-[-0.02em] text-[#081A3A] sm:text-[2.6rem]">
              Not just what you know — how you actually work
            </h2>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-600">
              DNLA (Discovering Natural Latent Abilities) is a validated psychometric
              framework from established European assessment science. Where the interview
              measures skill, DNLA measures the human competencies that decide whether
              someone thrives in a real team — motivation, collaboration, execution and
              resilience.
            </p>
            <div className="mt-6 grid gap-3">
              {[
                ["Benchmarked, not absolute", "Each competency is scored on a 1–7 scale against a top-performer benchmark, so a result means something concrete."],
                ["Feeds the behavioural round", "Your DNLA development areas steer the AI behavioural interview, so it probes exactly what matters for you."],
                ["Private by design", "Sensitive competency data stays owner-scoped and is never shared without explicit consent."],
              ].map(([t, b]) => (
                <div key={t} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0057FF]/[0.08] text-[#0057FF]"><Check /></span>
                  <p className="text-[13.5px] leading-relaxed text-slate-600"><span className="font-bold text-[#081A3A]">{t}.</span> {b}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08} y={30}>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_30px_80px_-46px_rgba(8,26,58,0.45)] sm:p-8">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Four competency groups</p>
                <span className="rounded-full bg-[#0057FF]/[0.07] px-2.5 py-1 text-[11px] font-semibold text-[#0057FF]">Scored 1–7 vs benchmark</span>
              </div>
              <div className="mt-4 flex justify-center">
                <DnlaRadar />
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {DNLA_GROUPS.map((g) => (
                  <div key={g.group} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-[13.5px] font-bold text-[#081A3A]">{g.group}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{g.blurb}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {g.items.map((it) => (
                        <span key={it} className="rounded-full bg-[#0057FF]/[0.07] px-2 py-0.5 text-[11px] font-semibold text-[#0057FF]">{it}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function WhyTaledge() {
  return (
    <section className="border-y border-slate-200/70 bg-[#081A3A]">
      <div className="mx-auto max-w-[80rem] px-5 py-24 sm:px-8">
        <Reveal className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#7DA3FF]">
            <span aria-hidden className="h-px w-6 bg-[#7DA3FF]/60" /> Why Taledge
          </span>
          <h2 className="mt-4 text-[2.1rem] font-extrabold tracking-[-0.02em] text-white sm:text-[2.6rem]">
            A measured decision, where there used to be a guess
          </h2>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-300">
            Traditional recruitment and generic assessment tools stop at a résumé and a
            subjective verdict. Taledge replaces the guess with evidence.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-12 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-1 bg-white/[0.04] text-[12px] font-semibold uppercase tracking-wide text-slate-400 sm:grid-cols-[1.1fr_1fr_1.2fr]">
              <div className="px-6 py-4">Dimension</div>
              <div className="hidden px-6 py-4 sm:block">Traditional approach</div>
              <div className="px-6 py-4 text-[#7DA3FF]">With Taledge</div>
            </div>
            {WHY_ROWS.map((r) => (
              <div key={r.dimension} className="grid grid-cols-1 border-t border-white/10 sm:grid-cols-[1.1fr_1fr_1.2fr]">
                <div className="px-6 py-5 text-[14px] font-bold text-white">{r.dimension}</div>
                <div className="px-6 pb-4 pt-0 text-[13.5px] text-slate-400 sm:py-5">
                  <span className="sm:hidden text-[11px] uppercase tracking-wide text-slate-500">Traditional: </span>
                  {r.traditional}
                </div>
                <div className="flex items-start gap-2.5 px-6 py-5 text-[13.5px] font-medium text-white">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0057FF] text-white"><Check /></span>
                  {r.taledge}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section id="security" className="scroll-mt-24 bg-white">
      <div className="mx-auto max-w-[80rem] px-5 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <SectionLabel>Trust &amp; governance</SectionLabel>
            <h2 className="mt-4 text-[2.1rem] font-extrabold tracking-[-0.02em] text-[#081A3A] sm:text-[2.6rem]">
              Privacy and access, enforced by design
            </h2>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-600">
              Candidate evidence is sensitive. Taledge keeps records owner-scoped and
              shares them only on explicit consent - with access enforced at the data
              layer, not just the app.
            </p>
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Placeholder - to be published</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">
                Formal compliance certifications, data-residency details and a security
                whitepaper are not yet stated on the site. Reserve this space for them -
                no claims should appear here until they are verified.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {GOVERNANCE.map((g, i) => (
              <Reveal key={g.title} delay={(i % 2) * 0.06}>
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#0057FF]/[0.06] text-[#0057FF]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={g.path} />
                    </svg>
                  </span>
                  <h3 className="mt-4 text-[1rem] font-bold text-[#081A3A]">{g.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{g.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-24 border-t border-slate-200/70 bg-slate-50/60">
      <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <Reveal className="text-center">
          <SectionLabel>Questions</SectionLabel>
          <h2 className="mt-4 text-[2.1rem] font-extrabold tracking-[-0.02em] text-[#081A3A] sm:text-[2.6rem]">
            Frequently asked
          </h2>
        </Reveal>
        <div className="mt-12 space-y-3">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 0.03}>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-[15px] font-semibold text-[#081A3A]">{item.q}</span>
                    <span
                      aria-hidden
                      className={
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full transition-all " +
                        (isOpen ? "rotate-45 bg-[#0057FF] text-white" : "bg-slate-100 text-slate-500")
                      }
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                      >
                        <p className="px-6 pb-6 text-[14px] leading-relaxed text-slate-600">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[80rem] px-5 py-24 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-[#081A3A] px-8 py-16 text-center sm:px-16 sm:py-20">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
              <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-[#0057FF]/30 blur-[120px]" />
            </div>
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-semibold text-[#7DA3FF]">
                Start in under a minute
              </span>
              <h2 className="mx-auto mt-6 max-w-2xl text-[2.2rem] font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-[3rem]">
                Turn potential into a number you can defend.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[1.05rem] text-slate-300">
                Create your account, pick your role, and land straight in your workspace.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2 rounded-md bg-[#0057FF] px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg transition-all hover:bg-[#0F4CFF]"
                >
                  Create your account
                  <Arrow className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-7 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-white/10"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      { label: "Architecture", href: "#architecture" },
      { label: "Platform", href: "#modules" },
      { label: "Assessment", href: "#assessment" },
      { label: "Security", href: "#security" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Workspaces",
    links: [
      { label: "Candidate", href: "/student/candidate-001" },
      { label: "Recruiter", href: "/recruiter/recruiter-001" },
      { label: "Coach", href: "/coach/coach-001" },
      { label: "Institute", href: "/institute/institute-placement" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/register" },
      { label: "Start onboarding", href: "/onboarding" },
    ],
  },
];

function EntFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-[80rem] gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-slate-500">
            Measuring, predicting and improving human potential across careers and
            competitive pursuits.
          </p>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.title}>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[14px] font-medium text-slate-600 transition-colors hover:text-[#0057FF]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-[80rem] flex-col items-center justify-between gap-3 px-5 py-6 text-[12.5px] text-slate-400 sm:flex-row sm:px-8">
          <span>© 2026 Taledge · Talent Intelligence &amp; Success Platform</span>
          <span className="flex gap-5">
            <Link href="/login" className="hover:text-slate-700">Privacy</Link>
            <Link href="/login" className="hover:text-slate-700">Terms</Link>
            <Link href="/register" className="hover:text-slate-700">Get started</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------- root ----------------------------- */

export function EnterpriseLanding() {
  return (
    <SmoothScroll>
      <div
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
        className="min-h-screen bg-white text-[#081A3A] antialiased"
      >
        <EntNav />
        <main>
          <Hero />
          <Credibility />
          <Architecture />
          <Stakeholders />
          <AiInterview />
          <DnlaDeepDive />
          <Modules />
          <WhyTaledge />
          <Security />
          <FaqSection />
          <FinalCta />
        </main>
        <EntFooter />
      </div>
    </SmoothScroll>
  );
}
