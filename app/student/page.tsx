"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { PageShell, PageHeader, Card, Badge, ButtonLink } from "@/components/ui";
import { students } from "@/lib/data";
import { containerVariants, itemVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";

type StudentStatus = (typeof students)[number]["status"];

const STATUS_TONE: Record<StudentStatus, "neutral" | "brand" | "success" | "warn"> = {
  "Not started": "neutral",
  "In progress": "warn",
  "Interview-ready": "success",
  Published: "brand",
};

function fitTone(fit: number): "success" | "brand" | "warn" {
  if (fit >= 78) return "success";
  if (fit >= 60) return "brand";
  return "warn";
}

export default function StudentDirectory() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.branch.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <PageShell className="pb-20">
      {/* Header Nav */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 border border-ink-200/60 backdrop-blur-md text-ink-600 hover:text-ink-900 hover:bg-white/80 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm font-bold">Back to Dashboard</span>
        </Link>
      </motion.div>

      <PageHeader
        eyebrow="Candidate Directory"
        title={
          <>
            Candidate <span className="text-gradient-brand">Directory</span>
          </>
        }
        description="Browse seeded pilot candidates and drill into any profile to view their psychometric, technical, and fit readiness."
        actions={
          <Badge tone="neutral" className="hidden sm:inline-flex">
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            {students.length} candidates
          </Badge>
        }
      />

      {/* Search */}
      <div className="relative mb-8 max-w-md">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, branch, or status"
          aria-label="Search candidates"
          className="w-full rounded-full border border-ink-200/70 bg-white/70 backdrop-blur-md py-3 pl-11 pr-4 text-sm font-medium text-ink-900 placeholder:text-ink-400 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:border-brand-300"
        />
      </div>

      {/* Directory Grid */}
      {filtered.length === 0 ? (
        <Card variant="flat" className="rounded-xl2 p-8 text-center">
          <p className="text-sm font-medium text-ink-500">
            No candidates match "{query}".
          </p>
        </Card>
      ) : (
        <motion.div
          key={query}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {filtered.map((s) => (
            <motion.div key={s.id} variants={itemVariants}>
              <Link
                href={`/student/${s.id}`}
                className="block h-full rounded-xl2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <Card
                  variant="frosted"
                  hover
                  className="group h-full p-5 flex flex-col"
                >
                  <div className="flex items-center gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-full bg-gradient-to-tr from-brand-600 to-accent-500 text-white flex items-center justify-center font-black text-sm shadow-md">
                      {s.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-bold text-ink-900 truncate">
                        {s.name}
                      </h2>
                      <p className="text-xs font-medium text-ink-500 truncate">
                        {s.branch}
                      </p>
                    </div>
                    <ChevronRight
                      className="w-5 h-5 text-ink-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-500"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                    <span
                      className={cn(
                        "text-xs font-bold tabular-nums",
                        fitTone(s.fit.fit) === "success" && "text-emerald-600",
                        fitTone(s.fit.fit) === "brand" && "text-brand-600",
                        fitTone(s.fit.fit) === "warn" && "text-amber-600"
                      )}
                    >
                      Fit {s.fit.fit}
                    </span>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="mt-10">
        <ButtonLink href="/student/candidate-001" variant="ghost">
          Open pilot candidate
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </ButtonLink>
      </div>
    </PageShell>
  );
}
