"use client";

import { motion } from "framer-motion";
import { ButtonLink, Eyebrow, Badge } from "@/components/ui";
import { ROLES } from "@/lib/roles";
import { EASE } from "@/lib/motion";

const TRACKS = [
  {
    tag: "Track 01",
    title: "Placement Success",
    body: "Résumé context → AI technical & behavioural interviews → DNLA → Fit Score → coaching pathway. Built for students entering the job market.",
    points: ["AI interviews & proctoring", "Fit Score & success probability", "Recruiter-ready reports"],
  },
  {
    tag: "Track 02",
    title: "Competitive Exam Success",
    body: "Exam context mapping, Success Potential, non-clinical risk signals and a counselling plan. Built for UPSC, JEE, NEET and CAT aspirants.",
    points: ["Success Potential index", "Consistency & resilience signals", "Counselling interventions"],
  },
];

const WORKSPACE_HREF: Record<string, string> = {
  candidate: "/student/candidate-001",
  recruiter: "/recruiter/recruiter-001",
  coach: "/coach/coach-001",
  institute: "/institute/institute-placement",
};

export function Services() {
  return (
    <section id="services" className="scroll-mt-24">
      <div className="text-center">
        <Eyebrow>Services</Eyebrow>
        <h2 className="mt-3 h-headline text-3xl sm:text-4xl text-ink-900">
          Two tracks. <span className="text-gradient-brand">Four workspaces.</span> One platform.
        </h2>
      </div>

      {/* Tracks */}
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {TRACKS.map((t, i) => (
          <motion.div
            key={t.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
            className="relative overflow-hidden rounded-xl3 border border-ink-200/70 bg-white/80 p-8 shadow-panel backdrop-blur-sm"
          >
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-400/10 blur-3xl" />
            <Badge tone="brand" className="mb-4">{t.tag}</Badge>
            <h3 className="text-2xl font-bold text-ink-900">{t.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-500">{t.body}</p>
            <ul className="mt-5 space-y-2">
              {t.points.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-sm font-medium text-ink-700">
                  <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-brand-50 text-brand-600">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <ButtonLink href="/register" className="rounded-full">Start this track</ButtonLink>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Workspaces */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => (
          <a
            key={r.key}
            href={WORKSPACE_HREF[r.key]}
            className="group rounded-xl2 border border-ink-200/70 bg-white/70 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-panel"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink-100 text-sm font-extrabold text-ink-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
              {r.initial}
            </span>
            <h4 className="mt-3 text-sm font-bold text-ink-900 group-hover:text-brand-700">{r.label} workspace</h4>
            <p className="mt-1 text-xs leading-snug text-ink-500">{r.blurb}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
