"use client";

import { Section } from "@/components/glass";
import { Bar, ScoreRing } from "@/components/score-ring";
import { recruiterPool } from "@/lib/data";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from "@/components/motion";
import { motion, AnimatePresence } from "framer-motion";
import {
  PageShell,
  PageHeader,
  Card,
  CardBody,
  Button,
  ButtonLink,
  Badge,
  Heading,
  Eyebrow,
  Stat,
} from "@/components/ui";

type Segment = "all" | "freshers" | "oneToThree";
type JobType = "all" | "job" | "internship";
type DnlaStatus = "all" | "available" | "pending";
type SortKey = "fit" | "success" | "technical" | "behavioural" | "recent";
type AdvancedChip = "interviewReady" | "highSuccess" | "dnlaReady" | "noRedFlags";

const activeJobs: {
  id: string;
  title: string;
  type: "job" | "internship";
  segment: string;
  location: string;
  reqs: number;
  applicants: number;
  shortlisted: number;
  minFit: number;
  status: string;
}[] = [];

const candidateMeta: Record<
  string,
  {
    experience: "Fresher" | "1-3 years";
    jobType: "Job" | "Internship";
    activeJobId: string;
    roleFit: string;
    interview: "Complete" | "Technical complete" | "Pending behavioural";
    dnla: "Available" | "Pending";
    dnlaSignals: string[];
    availability: string;
    notice: string;
    lastUpdated: string;
  }
> = {};

const advancedFilters: { id: AdvancedChip; label: string }[] = [
  { id: "interviewReady", label: "Interview-ready" },
  { id: "highSuccess", label: "Success >= 75%" },
  { id: "dnlaReady", label: "DNLA available" },
  { id: "noRedFlags", label: "No red flags" },
];

const topInstitutes: [string, string, string][] = [];

export default function Recruiter() {
  const [q, setQ] = useState("");
  const [minFit, setMinFit] = useState(65);
  const [minSuccess, setMinSuccess] = useState(60);
  const [segment, setSegment] = useState<Segment>("all");
  const [jobType, setJobType] = useState<JobType>("all");
  const [selectedJob, setSelectedJob] = useState("all");
  const [dnlaStatus, setDnlaStatus] = useState<DnlaStatus>("all");
  const [sort, setSort] = useState<SortKey>("fit");
  const [chips, setChips] = useState<AdvancedChip[]>([]);

  const enrichedPool = useMemo(() => {
    return (recruiterPool ?? []).map((candidate) => {
      const flags = candidate.flags ?? [];
      const meta = candidateMeta[candidate.studentId] ?? {};
      // Derive sensible per-row meta from the existing recruiterPool fields so
      // the table always renders even when candidateMeta has no entry.
      const interview: string =
        meta.interview ??
        (candidate.tech > 0 && candidate.behav > 0
          ? "Complete"
          : candidate.tech > 0
            ? "Technical complete"
            : "Pending behavioural");
      const dnla: string = meta.dnla ?? (candidate.fit >= 70 ? "Available" : "Pending");
      const experience: string =
        meta.experience ?? (candidate.success >= 75 ? "1-3 years" : "Fresher");
      const jobType: string =
        meta.jobType ?? (candidate.role.toLowerCase().includes("intern") ? "Internship" : "Job");
      const roleFit: string =
        meta.roleFit ??
        (candidate.fit >= 80
          ? "Strong role match"
          : candidate.fit >= 65
            ? "Solid role match"
            : "Emerging match");

      return {
        ...candidate,
        ...meta,
        flags,
        interview,
        dnla,
        experience,
        jobType,
        roleFit,
        activeJobId: meta.activeJobId ?? "all",
        dnlaSignals: meta.dnlaSignals ?? [],
        availability: meta.availability ?? "Available now",
        notice: meta.notice ?? "Immediate",
        lastUpdated: meta.lastUpdated ?? "Today",
      };
    });
  }, []);

  const rows = useMemo(() => {
    return enrichedPool
      .filter((r) => r.fit >= minFit)
      .filter((r) => r.success >= minSuccess)
      .filter((r) => {
        if (!q) return true;
        const roleFit = r.roleFit ?? "";
        const dnlaSignals = r.dnlaSignals ?? [];
        return `${r.name} ${r.college} ${r.role} ${roleFit} ${dnlaSignals.join(" ")}`
          .toLowerCase()
          .includes(q.toLowerCase());
      })
      .filter((r) => {
        const experience = r.experience ?? "Fresher";
        if (segment === "freshers") return experience === "Fresher";
        if (segment === "oneToThree") return experience === "1-3 years";
        return true;
      })
      .filter((r) => {
        const type = r.jobType ?? "Job";
        if (jobType === "job") return type === "Job";
        if (jobType === "internship") return type === "Internship";
        return true;
      })
      .filter((r) => (selectedJob === "all" ? true : (r.activeJobId ?? "all") === selectedJob))
      .filter((r) => {
        const dnla = r.dnla ?? "Pending";
        if (dnlaStatus === "available") return dnla === "Available";
        if (dnlaStatus === "pending") return dnla === "Pending";
        return true;
      })
      .filter((r) =>
        chips.includes("interviewReady") ? r.fit >= 70 && (r.interview ?? "Pending") === "Complete" : true
      )
      .filter((r) => (chips.includes("highSuccess") ? r.success >= 75 : true))
      .filter((r) => (chips.includes("dnlaReady") ? (r.dnla ?? "Pending") === "Available" : true))
      .filter((r) => (chips.includes("noRedFlags") ? (r.flags ?? []).length === 0 : true))
      .sort((a, b) => {
        if (sort === "technical") return b.tech - a.tech;
        if (sort === "behavioural") return b.behav - a.behav;
        if (sort === "success") return b.success - a.success;
        if (sort === "recent") return recencyScore(b.lastUpdated ?? "Today") - recencyScore(a.lastUpdated ?? "Today");
        return b.fit - a.fit;
      });
  }, [chips, dnlaStatus, enrichedPool, jobType, minFit, minSuccess, q, segment, selectedJob, sort]);

  const shortlisted = rows.filter((r) => r.fit >= 72 && r.success >= 70);
  const dnlaAvailable = enrichedPool.filter((r) => (r.dnla ?? "Pending") === "Available").length;
  const avgFit = enrichedPool.length
    ? Math.round(enrichedPool.reduce((sum, r) => sum + r.fit, 0) / enrichedPool.length)
    : 0;
  const avgSuccess = enrichedPool.length
    ? Math.round(enrichedPool.reduce((sum, r) => sum + r.success, 0) / enrichedPool.length)
    : 0;

  function toggleChip(chip: AdvancedChip) {
    setChips((current) =>
      current.includes(chip) ? current.filter((item) => item !== chip) : [...current, chip]
    );
  }

  return (
    <PageShell width="wide" className="pb-32">
      {/* Header Section */}
      <PageHeader
        className="mb-16"
        eyebrow="Recruiter Portal"
        title={<span className="text-gradient-brand">Hiring Intelligence</span>}
        description="Command center for jobs, internships, candidate pools, and deep analytics. Manage role fit and success probability effortlessly."
        actions={
          <>
            <Button type="button" variant="ghost" className="group">
              <IconUpload className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" /> Upload candidates
            </Button>
            <Button type="button" variant="primary" className="group bg-ink-900 hover:bg-ink-800">
              Post job / internship
              <IconArrow className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 mb-16">
        <KpiCard label="Active postings" value={`${activeJobs.length}`} hint="Post a job to start matching" icon={<IconPost className="w-6 h-6" />} delay={0.1} />
        <KpiCard label="Shortlist-ready" value={`${shortlisted.length}`} hint="Fit >= 72 and success >= 70%" icon={<IconTarget className="w-6 h-6" />} delay={0.2} />
        <KpiCard label="Avg Fit Score" value={`${avgFit}`} hint={`Avg success ${avgSuccess}%`} icon={<IconGauge className="w-6 h-6" />} delay={0.3} />
        <KpiCard label="DNLA imports" value={`${dnlaAvailable}/${enrichedPool.length}`} hint="Available after provider import" icon={<IconShield className="w-6 h-6" />} delay={0.4} />
      </div>

      {/* Jobs Section */}
      <motion.div
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        className="mb-16"
      >
        <div className="flex items-center justify-between mb-8">
          <Heading as="h2" className="text-2xl flex items-center gap-3">
            <span className="p-2 bg-brand-100 rounded-xl2 text-brand-600"><IconPost className="w-5 h-5"/></span>
            Hiring Demand Surface
          </Heading>
        </div>
        {activeJobs.length === 0 ? (
          <Card variant="frosted" className="p-10 text-center">
            <CardBody className="p-0">
              <Eyebrow className="justify-center">No active postings</Eyebrow>
              <p className="mt-2 text-sm text-ink-500">Post a job or internship to start matching candidates against your hiring demand.</p>
            </CardBody>
          </Card>
        ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {(activeJobs ?? []).map((job, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -4, scale: 1.01 }}
              key={job.id}
            >
              <Card variant="frosted" hover className="relative overflow-hidden p-6">
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div>
                    <Badge tone={job.status === "Live" ? "success" : "warn"}>{job.status}</Badge>
                    <h3 className="mt-3 text-lg font-bold text-ink-900">{job.title}</h3>
                    <p className="mt-1 text-sm font-medium text-ink-500">
                      {job.type === "job" ? "Full-time" : "Internship"} · {job.segment}
                    </p>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl2 bg-ink-100 text-sm font-bold text-ink-700 ring-1 ring-inset ring-ink-200">
                    {job.reqs}
                  </span>
                </div>
                <div className="space-y-3 mb-8">
                  <MetricRow label="Applicants" value={`${job.applicants}`} />
                  <MetricRow label="Shortlisted" value={`${job.shortlisted}`} />
                  <MetricRow label="Min Fit Score" value={`${job.minFit}`} />
                  <MetricRow label="Location" value={job.location} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="md" className="flex-1">Edit</Button>
                  <Button type="button" variant="primary" size="md" className="flex-1 bg-ink-900 hover:bg-ink-800">Invite</Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
        )}
      </motion.div>

      {/* Filters Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="mb-16"
      >
        <Card variant="frosted" className="rounded-xl3 p-6 sm:p-10">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <Heading as="h2" className="text-2xl flex items-center gap-3">
              <span className="p-2 bg-brand-100 rounded-xl2 text-brand-600"><IconFilter className="w-5 h-5"/></span>
              Candidate Discovery
            </Heading>
            <Button
              type="button"
              variant="link"
              onClick={() => { setQ(""); setMinFit(65); setMinSuccess(60); setSegment("all"); setJobType("all"); setSelectedJob("all"); setDnlaStatus("all"); setSort("fit"); setChips([]); }}
              className="text-ink-500 hover:text-ink-900"
            >
              Clear filters
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4 mb-8">
            <FilterField label="Search" htmlFor="recruiter-search">
              <input id="recruiter-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, college, role..." className="w-full rounded-xl2 border-0 bg-white/50 px-4 py-3 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200/50 backdrop-blur-xl focus:ring-2 focus:ring-brand-600 transition-all placeholder:text-ink-400" />
            </FilterField>
            <FilterField label="Posting" htmlFor="recruiter-posting">
              <select id="recruiter-posting" value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} className="w-full rounded-xl2 border-0 bg-white/50 px-4 py-3 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200/50 backdrop-blur-xl focus:ring-2 focus:ring-brand-600 transition-all">
                <option value="all">All postings</option>
                {activeJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
              </select>
            </FilterField>
            <FilterField label="Experience">
              <SegmentedControl ariaLabel="Experience" options={[["all", "All"], ["freshers", "Freshers"], ["oneToThree", "1-3 yrs"]]} value={segment} onChange={(v) => setSegment(v as Segment)} />
            </FilterField>
            <FilterField label="Opening Type">
              <SegmentedControl ariaLabel="Opening Type" options={[["all", "All"], ["job", "Jobs"], ["internship", "Interns"]]} value={jobType} onChange={(v) => setJobType(v as JobType)} />
            </FilterField>
            <FilterField label="Min Fit Score" htmlFor="recruiter-min-fit">
              <RangeControl id="recruiter-min-fit" ariaLabel="Min Fit Score" value={minFit} min={45} max={95} onChange={setMinFit} />
            </FilterField>
            <FilterField label="Min Success Prob" htmlFor="recruiter-min-success">
              <RangeControl id="recruiter-min-success" ariaLabel="Min Success Prob" value={minSuccess} min={45} max={95} onChange={setMinSuccess} suffix="%" />
            </FilterField>
            <FilterField label="DNLA Status">
              <SegmentedControl ariaLabel="DNLA Status" options={[["all", "All"], ["available", "Ready"], ["pending", "Pending"]]} value={dnlaStatus} onChange={(v) => setDnlaStatus(v as DnlaStatus)} />
            </FilterField>
            <FilterField label="Sort By" htmlFor="recruiter-sort">
              <select id="recruiter-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-full rounded-xl2 border-0 bg-white/50 px-4 py-3 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200/50 backdrop-blur-xl focus:ring-2 focus:ring-brand-600 transition-all">
                <option value="fit">Fit Score</option>
                <option value="success">Success Probability</option>
                <option value="technical">Technical</option>
                <option value="behavioural">Behavioural</option>
                <option value="recent">Recently Updated</option>
              </select>
            </FilterField>
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t border-ink-200/50">
            {advancedFilters.map((chip) => {
              const isActive = chips.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => toggleChip(chip.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${isActive ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20' : 'bg-white/50 text-ink-600 hover:bg-white ring-1 ring-inset ring-ink-200/50'}`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Table Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <Heading as="h2" className="text-2xl flex items-center gap-3">
            <span className="p-2 bg-emerald-100 rounded-xl2 text-emerald-600"><IconTarget className="w-5 h-5"/></span>
            {rows.length} Candidates Matching
          </Heading>
          <div className="flex gap-3">
            <Button type="button" variant="ghost"><IconDownload className="w-4 h-4"/> Export</Button>
            <Button type="button" variant="primary"><IconReport className="w-4 h-4"/> Group Report</Button>
          </div>
        </div>

        <Card variant="frosted" className="rounded-xl3 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1080px]">
              <div className="grid grid-cols-12 bg-ink-50/50 px-6 py-4 text-xs font-bold uppercase tracking-wider text-ink-500 border-b border-ink-200/50">
                <div className="col-span-3">Candidate</div>
                <div className="col-span-2">Opening / Segment</div>
                <div className="col-span-1">Fit</div>
                <div className="col-span-2">Interview Scores</div>
                <div className="col-span-1">Success</div>
                <div className="col-span-2">DNLA / Role Fit</div>
                <div className="col-span-1 text-right">Action</div>
              </div>
              <div className="divide-y divide-ink-100">
                <AnimatePresence>
                  {rows.map((r, idx) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      key={r.studentId + r.name}
                      className="grid grid-cols-12 items-center px-6 py-5 text-sm transition-colors hover:bg-white/80 group"
                    >
                      <div className="col-span-3 flex min-w-0 items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl2 bg-gradient-to-br from-brand-600 to-accent-500 text-sm font-bold text-white shadow-sm">
                          {initials(r.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-bold text-ink-900 group-hover:text-brand-600 transition-colors">{r.name}</div>
                          <div className="truncate text-xs font-medium text-ink-500">{r.college}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-600">{r.experience ?? "Fresher"}</span>
                            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-600">{r.availability ?? "Available now"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 pr-4">
                        <div className="font-bold text-ink-900 truncate">{r.role}</div>
                        <div className="mt-1 text-xs font-medium text-ink-500 truncate">{postingTitle(r.activeJobId ?? "all")}</div>
                      </div>
                      <div className="col-span-1">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl2 bg-white text-xl font-black text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200">
                          {r.fit}
                        </div>
                      </div>
                      <div className="col-span-2 space-y-2.5 pr-6">
                        <ScoreBarLine label="Tech" value={r.tech} />
                        <ScoreBarLine label="Behav" value={r.behav} />
                      </div>
                      <div className="col-span-1">
                        <span className={`inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs font-bold ${r.success >= 75 ? 'bg-emerald-100 text-emerald-700' : r.success >= 65 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                          {r.success}%
                        </span>
                      </div>
                      <div className="col-span-2 pr-4">
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${(r.dnla ?? 'Pending') === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            DNLA {r.dnla ?? 'Pending'}
                          </span>
                          {(r.flags ?? [])[0] && (
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${r.flags[0].toLowerCase().includes('flag') || r.flags[0].toLowerCase().includes('defensive') ? 'bg-rose-100 text-rose-700' : 'bg-brand-100 text-brand-700'}`}>
                              {r.flags[0]}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs font-bold text-ink-600">{r.roleFit ?? "Solid role match"}</div>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <ButtonLink
                          variant="ghost"
                          size="sm"
                          href={`/student/${r.studentId}`}
                          aria-label={`View ${r.name}'s profile`}
                        >
                          View
                        </ButtonLink>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {rows.length === 0 && (
                <div className="px-6 py-20 text-center">
                  <div className="mx-auto h-16 w-16 rounded-xl2 bg-ink-100 flex items-center justify-center text-ink-400 mb-4">
                    <IconFilter className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-ink-900">No candidates found</h3>
                  <p className="mt-2 text-sm text-ink-500">Try adjusting your filters or search terms.</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Bottom Modules */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BottomCard
          icon={<IconUpload className="w-6 h-6"/>} title="Private hiring assessment"
          desc="Upload external candidates, issue invite links, collect evidence, compare against shared pools."
          action="Create batch" secAction="Pricing" delay={0.1}
        >
          <div className="space-y-3 my-6">
            <WorkflowStep label="1" title="Upload CSV / resumes" detail="Candidate details, role, email, experience." />
            <WorkflowStep label="2" title="Confirm credits" detail="Payment-gated invites before interviews." />
            <WorkflowStep label="3" title="Send secure links" detail="Unique links per candidate with expiry." />
          </div>
        </BottomCard>

        <BottomCard
          icon={<IconReport className="w-6 h-6"/>} title="Reports & Shortlisting"
          desc="Generate comprehensive analytics from your current filtered views."
          action="Generate report" delay={0.2}
        >
          <div className="flex items-center gap-5 my-6">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-brand-50">
              <svg
                role="img"
                aria-label={`${Math.round((shortlisted.length / Math.max(rows.length, 1)) * 100)}% of matching candidates are shortlist-ready`}
                className="absolute inset-0 h-full w-full -rotate-90 transform"
                viewBox="0 0 100 100"
              >
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-brand-100" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-brand-600" strokeDasharray={`${Math.round((shortlisted.length / Math.max(rows.length, 1)) * 100) * 2.51} 251`} strokeLinecap="round" />
              </svg>
              <div className="text-2xl font-black text-brand-900">{Math.round((shortlisted.length / Math.max(rows.length, 1)) * 100)}%</div>
            </div>
            <div>
              <div className="text-3xl font-black text-ink-900">{shortlisted.length}</div>
              <div className="text-sm font-medium text-ink-500 leading-tight mt-1">Candidates in<br/>shortlist</div>
            </div>
          </div>
          <div className="space-y-2 mb-6">
            <MetricRow label="Evidence" value="Resume, Interview, DNLA" />
            <MetricRow label="Action" value="Share with hiring manager" />
          </div>
        </BottomCard>

        <BottomCard
          icon={<IconLink className="w-6 h-6"/>} title="Shared Institute Access"
          desc="Institutes share scoped recruiter links for selected batches, roles, and reports."
          action="Manage links" delay={0.3} secondaryBtn
        >
          <div className="space-y-3 my-6">
            {(topInstitutes ?? []).length === 0 ? (
              <div className="rounded-xl2 bg-white/50 p-4 ring-1 ring-inset ring-ink-200/50 text-sm text-ink-500">
                No institutes have shared access yet.
              </div>
            ) : (
              (topInstitutes ?? []).map(([name, score, note], i) => (
                <div key={i} className="flex items-center justify-between rounded-xl2 bg-white/50 p-3 shadow-sm ring-1 ring-inset ring-ink-200/50">
                  <div>
                    <div className="text-sm font-bold text-ink-900">{name}</div>
                    <div className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide mt-0.5">{note}</div>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-sm font-bold text-white shadow-sm">
                    {score}
                  </div>
                </div>
              ))
            )}
          </div>
        </BottomCard>
      </div>
    </PageShell>
  );
}

function KpiCard({ label, value, hint, icon, delay = 0 }: { label: string; value: string; hint: string; icon: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5, ease: "easeOut" }} whileHover={{ y: -5, scale: 1.02 }}
    >
      <Card variant="frosted" className="relative overflow-hidden p-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl2 bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-panel">
            {icon}
          </div>
          <Badge tone="success">Live</Badge>
        </div>
        <Stat label={label} value={value} sub={hint} />
      </Card>
    </motion.div>
  );
}

function FilterField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-500">{label}</label>
      {children}
    </div>
  );
}

function RangeControl({ id, ariaLabel, value, min, max, suffix = "", onChange }: { id?: string; ariaLabel?: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void; }) {
  return (
    <div className="flex items-center gap-4 bg-white/50 rounded-xl2 p-3 ring-1 ring-inset ring-ink-200/50 shadow-sm backdrop-blur-xl">
      <input id={id} aria-label={ariaLabel} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 h-2 bg-ink-200 rounded-lg appearance-none cursor-pointer accent-brand-600" />
      <span className="w-12 text-right text-lg font-black text-ink-900">{value}{suffix}</span>
    </div>
  );
}

function SegmentedControl({ options, value, onChange, ariaLabel }: { options: [string, string][]; value: string; onChange: (value: string) => void; ariaLabel?: string; }) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex rounded-xl2 bg-ink-200/50 p-1 backdrop-blur-xl ring-1 ring-inset ring-ink-200/50 shadow-inner">
      {options.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all ${value === id ? "bg-white text-brand-600 shadow-sm" : "text-ink-600 hover:text-ink-900"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function ScoreBarLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[44px_1fr_34px] items-center gap-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-200/50 shadow-inner">
        <motion.div initial={{ width: 0 }} whileInView={{ width: `${value}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500" />
      </div>
      <span className="text-right text-xs font-black text-ink-900">{value}</span>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm font-medium text-ink-500">{label}</span>
      <span className="text-sm font-bold text-ink-900">{value}</span>
    </div>
  );
}

function WorkflowStep({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div className="flex gap-4 rounded-xl2 bg-white/50 p-4 ring-1 ring-inset ring-ink-200/50 shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-black text-brand-600">
        {label}
      </span>
      <div>
        <div className="text-sm font-bold text-ink-900">{title}</div>
        <div className="mt-1 text-xs font-medium text-ink-500 leading-relaxed">{detail}</div>
      </div>
    </div>
  );
}

function BottomCard({ icon, title, desc, action, secAction, secondaryBtn, children, delay }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay }} className="h-full">
      <Card variant="frosted" className="flex flex-col h-full rounded-xl3 p-8 relative overflow-hidden">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl2 bg-ink-900 text-white shadow-panel mb-6">
          {icon}
        </div>
        <h3 className="text-xl font-bold text-ink-900">{title}</h3>
        <p className="mt-3 text-sm font-medium text-ink-600 leading-relaxed">{desc}</p>
        <div className="flex-1">{children}</div>
        <div className="mt-auto flex flex-wrap gap-3 pt-6">
          <Button
            type="button"
            variant={secondaryBtn ? "ghost" : "primary"}
            className={secondaryBtn ? "flex-1" : "flex-1 bg-ink-900 hover:bg-ink-800"}
          >
            {action}
          </Button>
          {secAction && (
            <Button type="button" variant="ghost">{secAction}</Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function initials(name: string) { return name.split(" ").map((p) => p[0]).join(""); }
function postingTitle(jobId: string) { return activeJobs.find((j) => j.id === jobId)?.title ?? "General pipeline"; }
function recencyScore(val: string) { if (val === "Today") return 4; if (val === "Yesterday") return 3; if (val.includes("2 days")) return 2; return 1; }

function IconBriefcase(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>; }
function IconUpload(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>; }
function IconTarget(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>; }
function IconLink(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>; }
function IconArrow(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>; }
function IconPost(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>; }
function IconGauge(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 14l4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>; }
function IconShield(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" /><path d="m9 12 2 2 4-4" /></svg>; }
function IconFilter(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" /></svg>; }
function IconDownload(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function IconReport(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>; }
