"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Stat,
  Heading,
  Eyebrow,
} from "@/components/ui";
import { containerVariants, itemVariants } from "@/lib/motion";

// Mock data for Candidate Heatmap
// Tech Accuracy (X-axis: 0-100) vs Behavioural Resilience (Y-axis: 0-100)
const candidates = [
  { id: 1, name: "Alice Chen", tech: 85, res: 90, role: "Frontend", img: "A" },
  { id: 2, name: "Bob Smith", tech: 92, res: 75, role: "Backend", img: "B" },
  { id: 3, name: "Charlie Doe", tech: 70, res: 85, role: "Fullstack", img: "C" },
  { id: 4, name: "Diana Prince", tech: 95, res: 95, role: "Data Scientist", img: "D" },
  { id: 5, name: "Evan Wright", tech: 60, res: 50, role: "DevOps", img: "E" },
  { id: 6, name: "Fiona Gallagher", tech: 80, res: 60, role: "Frontend", img: "F" },
  { id: 7, name: "George Mason", tech: 45, res: 70, role: "QA", img: "G" },
  { id: 8, name: "Hannah Abbott", tech: 88, res: 82, role: "Backend", img: "H" },
];

const topStats = [
  { label: "Active Candidates", value: "1,204", trend: "+12%" },
  { label: "High Resilience", value: "342", trend: "+5%" },
  { label: "Avg Tech Accuracy", value: "76%", trend: "+2.4%" },
];

export default function RecruiterPortal() {
  const candidateList = Array.isArray(candidates) ? candidates : [];

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-canvas font-sans text-ink-900">
      {/* Sidebar Mock */}
      <div className="relative z-10 hidden w-64 flex-col border-r border-ink-200/60 bg-white/60 p-6 shadow-panel backdrop-blur-xl md:flex">
        <div className="mb-12 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 font-bold text-white shadow-md">
            R
          </div>
          <span className="text-lg font-bold tracking-tight">Recruiter<br/>Portal</span>
        </div>
        <nav className="flex-1 space-y-3">
          {["Dashboard", "Jobs", "Candidates", "Interviews", "Analytics"].map((item, i) => (
            <div
              key={item}
              className={`cursor-pointer rounded-xl2 px-4 py-3 text-sm font-bold transition-all ${
                i === 0
                  ? "border border-brand-100 bg-brand-50 text-brand-700 shadow-sm"
                  : "border border-transparent text-ink-500 hover:bg-white/60 hover:text-ink-900"
              }`}
            >
              {item}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl2 border border-ink-200/60 bg-white/60 px-4 py-3 shadow-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">JP</div>
          <div className="text-xs font-bold text-ink-700">Jane Premium</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex h-screen flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <PageShell width="wide" className="w-full">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-10"
          >
            {/* Header */}
            <motion.div variants={itemVariants}>
              <PageHeader
                title={
                  <>
                    Talent <span className="text-gradient-brand">Intelligence</span>
                  </>
                }
                description="Evaluate candidates across technical accuracy and behavioural resilience."
                actions={
                  <>
                    <Button type="button" variant="ghost" className="rounded-full">
                      Filter
                    </Button>
                    <Button type="button" variant="primary" className="rounded-full">
                      New Requisition
                    </Button>
                  </>
                }
              />
            </motion.div>

            {/* Top Stats */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {topStats.map((stat, i) => (
                <Card key={i} variant="frosted" hover className="rounded-xl3 p-6">
                  <Stat
                    label={stat.label}
                    value={stat.value}
                    sub={
                      <span className="font-bold text-emerald-600">{stat.trend}</span>
                    }
                  />
                </Card>
              ))}
            </motion.div>

            {/* Candidate Heatmap Section */}
            <motion.div variants={itemVariants} className="mt-8">
              <Card variant="frosted" className="rounded-xl3 p-8 shadow-panel lg:p-12">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <Eyebrow className="mb-2">Talent Map</Eyebrow>
                    <Heading as="h2" className="mb-1 text-2xl">Candidate Heatmap</Heading>
                    <p className="text-sm font-medium text-ink-500">Tech Accuracy vs Behavioural Resilience</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-ink-500">
                    <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm" aria-hidden="true" /> Ideal Fit</div>
                    <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-400 shadow-sm" aria-hidden="true" /> Trainable</div>
                    <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-rose-400 shadow-sm" aria-hidden="true" /> High Risk</div>
                  </div>
                </div>

                {candidateList.length === 0 ? (
                  /* Graceful empty state */
                  <Card variant="flat" className="rounded-xl3 p-12 text-center">
                    <Heading as="h3" className="mb-2 text-lg">No candidates yet</Heading>
                    <p className="text-sm text-ink-500">
                      Candidates will appear on the heatmap once they complete an evaluation.
                    </p>
                  </Card>
                ) : (
                  /* Heatmap Graph */
                  <div
                    role="img"
                    aria-label="Scatter plot of candidates by technical accuracy (horizontal axis) and behavioural resilience (vertical axis)."
                    className="relative aspect-video w-full rounded-xl3 border border-ink-200/60 bg-ink-50/50 p-6 sm:p-10"
                  >
                    {/* Y-Axis Label */}
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-bold uppercase tracking-widest text-ink-500">
                      Behavioural Resilience
                    </div>
                    {/* X-Axis Label */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-widest text-ink-500">
                      Tech Accuracy
                    </div>

                    {/* Grid Lines */}
                    <div className="absolute inset-8 flex flex-col justify-between border-b-2 border-l-2 border-ink-300/50 pb-0 pl-0 sm:inset-12">
                      <div className="absolute top-1/4 h-px w-full bg-ink-300/50" />
                      <div className="absolute top-2/4 h-px w-full bg-ink-300/50" />
                      <div className="absolute top-3/4 h-px w-full bg-ink-300/50" />
                      <div className="absolute left-1/4 h-full w-px bg-ink-300/50" />
                      <div className="absolute left-2/4 h-full w-px bg-ink-300/50" />
                      <div className="absolute left-3/4 h-full w-px bg-ink-300/50" />

                      {/* Quadrant Backgrounds (Soft) */}
                      <div className="absolute right-0 top-0 h-1/2 w-1/2 rounded-tr-xl2 bg-emerald-400/5" />
                      <div className="absolute bottom-0 left-0 h-1/2 w-1/2 rounded-bl-xl bg-rose-400/5" />

                      {/* Data Points */}
                      {candidateList.map((c, i) => {
                        const left = `${c.tech}%`;
                        const bottom = `${c.res}%`;
                        const isIdeal = c.tech >= 75 && c.res >= 75;
                        const isRisk = c.tech < 60 && c.res < 60;
                        const colorClass = isIdeal ? "bg-emerald-400 text-emerald-900 border-emerald-200 shadow-emerald-500/40"
                                         : isRisk ? "bg-rose-400 text-rose-900 border-rose-200 shadow-rose-500/40"
                                         : "bg-amber-400 text-amber-900 border-amber-200 shadow-amber-500/40";
                        const fitLabel = isIdeal ? "Ideal Fit" : isRisk ? "High Risk" : "Trainable";

                        return (
                          <motion.div
                            key={c.id}
                            className="group absolute z-10 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
                            style={{ left, bottom, transform: "translate(-50%, 50%)" }}
                            tabIndex={0}
                            role="img"
                            aria-label={`${c.name}, ${c.role}. Tech accuracy ${c.tech}, behavioural resilience ${c.res}. ${fitLabel}.`}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
                            whileHover={{ scale: 1.2, zIndex: 50 }}
                          >
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold shadow-lg backdrop-blur-md transition-colors sm:h-10 sm:w-10 sm:text-sm ${colorClass}`}>
                              {c.img}
                            </div>
                            {/* Tooltip */}
                            <div className="pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                              <div className="whitespace-nowrap rounded-xl bg-ink-900 px-3 py-2 text-xs font-medium text-white shadow-xl">
                                <div className="mb-0.5 text-sm font-bold">{c.name}</div>
                                <div className="text-ink-300">{c.role}</div>
                                <div className="mt-1 flex gap-2">
                                  <span className="text-accent-300">Tech: {c.tech}</span>
                                  <span className="text-brand-300">Res: {c.res}</span>
                                </div>
                              </div>
                              <div className="absolute left-1/2 top-full -mt-1 -translate-x-1/2 border-4 border-transparent border-t-ink-900" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>

          </motion.div>
        </PageShell>
      </div>
    </div>
  );
}
