"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eyebrow } from "@/components/ui";
import { EASE } from "@/lib/motion";

const QA = [
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
    a: "A live voice agent conducts proctored technical and behavioural interviews. Responses are transcribed and scored against a structured rubric - no human bias, consistent for everyone.",
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

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24">
      <div className="text-center">
        <Eyebrow>Questions</Eyebrow>
        <h2 className="mt-3 h-headline text-3xl sm:text-4xl text-ink-900">Frequently asked</h2>
      </div>

      <div className="mt-10 space-y-3">
        {QA.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className="overflow-hidden rounded-xl2 border border-ink-200/70 bg-white/80">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-bold text-ink-900">{item.q}</span>
                <span
                  aria-hidden
                  className={"grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-600 transition-transform " + (isOpen ? "rotate-45 bg-brand-600 text-white" : "")}
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
                    <p className="px-5 pb-5 text-sm leading-relaxed text-ink-500">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
