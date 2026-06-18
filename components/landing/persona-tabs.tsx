"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ButtonLink, Badge } from "@/components/ui";
import { EASE } from "@/lib/motion";

type Persona = {
  key: string;
  label: string;
  headline: string;
  outcome: string;
  points: string[];
  href: string;
  cta: string;
};

const PERSONAS: Persona[] = [
  {
    key: "student",
    label: "Candidate",
    headline: "See exactly why you're a fit - and what to fix.",
    outcome: "A live Fit Score from AI interviews + DNLA psychometrics, with a coaching pathway to close every gap.",
    points: ["AI technical + behavioural interviews", "DNLA competency radar", "Personalised development plan"],
    href: "/student/candidate-001",
    cta: "Open candidate workspace",
  },
  {
    key: "recruiter",
    label: "Recruiter",
    headline: "Shortlist on evidence, not résumé keywords.",
    outcome: "Ranked, verified candidates with technical, behavioural and success-probability signals - published with consent.",
    points: ["Role-matched candidate pool", "Verified interview evidence", "Shareable success reports"],
    href: "/recruiter/recruiter-001",
    cta: "Open recruiter workspace",
  },
  {
    key: "coach",
    label: "Coach",
    headline: "Walk into every session knowing the gap.",
    outcome: "Session queues prioritised by risk, with each candidate's strengths, gaps and progress in one place.",
    points: ["Risk-ranked session queue", "Per-candidate goals & outcomes", "Progress tracking over time"],
    href: "/coach/coach-001",
    cta: "Open coach workspace",
  },
  {
    key: "institute",
    label: "Institute",
    headline: "Make the whole cohort interview-ready.",
    outcome: "Batch readiness heatmaps, at-risk lists and intervention tracking across your entire placement pipeline.",
    points: ["Cohort readiness heatmaps", "At-risk early-warning lists", "Intervention impact tracking"],
    href: "/institute/institute-placement",
    cta: "Open institute workspace",
  },
];

export function PersonaTabs() {
  const [active, setActive] = useState(0);
  const p = PERSONAS[active];

  return (
    <div className="w-full">
      <div role="tablist" aria-label="Choose your role" className="flex flex-wrap gap-2">
        {PERSONAS.map((persona, i) => {
          const selected = i === active;
          return (
            <button
              key={persona.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(i)}
              className={
                "rounded-full px-5 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 " +
                (selected
                  ? "bg-brand-600 text-white shadow-panel"
                  : "border border-ink-200/70 bg-white/70 text-ink-600 hover:bg-white hover:text-ink-900")
              }
            >
              {persona.label}
            </button>
          );
        })}
      </div>

      <div className="relative mt-6 min-h-[18rem]">
        <AnimatePresence mode="wait">
          <motion.div
            key={p.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="panel p-8 sm:p-10"
          >
            <Badge tone="brand" className="mb-4">
              {p.label} outcome
            </Badge>
            <h3 className="h-headline text-2xl sm:text-3xl text-ink-900">{p.headline}</h3>
            <p className="mt-3 max-w-2xl text-ink-500">{p.outcome}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {p.points.map((pt) => (
                <li key={pt} className="flex items-start gap-2.5 text-sm font-medium text-ink-700">
                  <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                  {pt}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <ButtonLink href={p.href} className="rounded-full">
                {p.cta}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </ButtonLink>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
