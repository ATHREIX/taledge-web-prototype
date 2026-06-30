"use client";

import { recruiterPool } from "@/lib/data";
import { type ReactNode, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Users,
  FileBarChart,
  Share2,
  LayoutGrid,
  Search,
  LifeBuoy,
} from "lucide-react";
import {
  Button,
  ButtonLink,
  useToast,
  Drawer,
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

// Left-rail workspace navigation. Pure in-page anchors — no routing/backend
// changes; each item scrolls to the matching section below.
const sideNav: { id: string; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "postings", label: "Postings", icon: Briefcase },
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "access", label: "Shared access", icon: Share2 },
];

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
  // ── Enterprise table UI state (presentation only) ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [quickView, setQuickView] = useState<any | null>(null);
  const [activeSection, setActiveSection] = useState("candidates");
  const { toast } = useToast();

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

  // ── Selection (bulk actions) ──
  const visibleIds = rows.map((r) => r.studentId);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visibleIds.some((id) => selected.has(id));
  const toggleAll = () =>
    setSelected(() => (allSelected ? new Set() : new Set(visibleIds)));
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // ── Sortable column headers (drive the existing `sort` state) ──
  const setSortKey = (key: SortKey) => setSort(key);

  // ── Active-filter chip summary (each chip resets just that filter) ──
  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (q) activeFilters.push({ key: "q", label: `Search: "${q}"`, clear: () => setQ("") });
  if (minFit !== 65) activeFilters.push({ key: "fit", label: `Fit ≥ ${minFit}`, clear: () => setMinFit(65) });
  if (minSuccess !== 60) activeFilters.push({ key: "succ", label: `Success ≥ ${minSuccess}%`, clear: () => setMinSuccess(60) });
  if (segment !== "all") activeFilters.push({ key: "seg", label: segment === "freshers" ? "Freshers" : "1–3 yrs", clear: () => setSegment("all") });
  if (jobType !== "all") activeFilters.push({ key: "jt", label: jobType === "job" ? "Jobs" : "Internships", clear: () => setJobType("all") });
  if (dnlaStatus !== "all") activeFilters.push({ key: "dnla", label: `DNLA: ${dnlaStatus === "available" ? "Ready" : "Pending"}`, clear: () => setDnlaStatus("all") });
  chips.forEach((c) => {
    const def = advancedFilters.find((a) => a.id === c);
    if (def) activeFilters.push({ key: c, label: def.label, clear: () => toggleChip(c) });
  });

  const clearAll = () => { setQ(""); setMinFit(65); setMinSuccess(60); setSegment("all"); setJobType("all"); setSelectedJob("all"); setDnlaStatus("all"); setSort("fit"); setChips([]); };

  const rowPad = density === "compact" ? "py-2.5" : "py-4";
  const avatarSize = density === "compact" ? "h-9 w-9" : "h-11 w-11";

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex w-full max-w-[88rem] gap-8 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        {/* ───────────────────────── Left rail ───────────────────────── */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">
            <p className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">
              Recruiter workspace
            </p>
            <nav className="mt-3 space-y-0.5" aria-label="Recruiter sections">
              {sideNav.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={() => setActiveSection(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-transparent text-ink-600 hover:bg-ink-100/70 hover:text-ink-900"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <div className="mt-6 rounded-xl border border-ink-200 bg-white p-4">
              <div className="flex items-center gap-2 text-ink-700">
                <LifeBuoy className="h-4 w-4" aria-hidden />
                <span className="text-sm font-bold">Need a hand?</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
                Our team can help you set up postings and import candidate pools.
              </p>
              <Button type="button" variant="ghost" size="sm" className="mt-3 w-full">
                Contact support
              </Button>
            </div>
          </div>
        </aside>

        {/* ───────────────────────── Main column ───────────────────────── */}
        <main className="min-w-0 flex-1">
          {/* Breadcrumb + header */}
          <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-ink-400">
            <span>Recruiter</span>
            <span aria-hidden>/</span>
            <span className="text-ink-700">Hiring Intelligence</span>
          </nav>

          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-200 pb-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Hiring Intelligence</h1>
              <p className="mt-1.5 max-w-xl text-sm text-ink-500">
                Command center for jobs, internships, candidate pools, and analytics — manage role fit and success probability in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button type="button" variant="ghost">
                <IconUpload className="h-4 w-4" /> Upload candidates
              </Button>
              <Button type="button" variant="primary">
                Post job / internship
                <IconArrow className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* ── Overview / KPIs ── */}
          <section id="overview" className="scroll-mt-24 pt-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiTile label="Active postings" value={`${activeJobs.length}`} hint="Post a job to start matching" icon={<IconPost className="h-[18px] w-[18px]" />} />
              <KpiTile label="Shortlist-ready" value={`${shortlisted.length}`} hint="Fit ≥ 72 and success ≥ 70%" icon={<IconTarget className="h-[18px] w-[18px]" />} />
              <KpiTile label="Avg Fit Score" value={`${avgFit}`} hint={`Avg success ${avgSuccess}%`} icon={<IconGauge className="h-[18px] w-[18px]" />} />
              <KpiTile label="DNLA imports" value={`${dnlaAvailable}/${enrichedPool.length}`} hint="Available after provider import" icon={<IconShield className="h-[18px] w-[18px]" />} />
            </div>
          </section>

          {/* ── Postings ── */}
          <section id="postings" className="scroll-mt-24 pt-12">
            <SectionTitle icon={<IconPost className="h-4 w-4" />}>Active postings</SectionTitle>
            {activeJobs.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-ink-300 bg-white p-10 text-center">
                <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-lg bg-ink-50 text-ink-400">
                  <IconPost className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-ink-900">No active postings</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
                  Post a job or internship to start matching candidates against your hiring demand.
                </p>
                <Button type="button" variant="primary" size="sm" className="mt-4">
                  Post job / internship
                </Button>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {activeJobs.map((job) => (
                  <div key={job.id} className="rounded-xl border border-ink-200 bg-white p-5 transition-colors hover:border-ink-300">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <StatusChip ok={job.status === "Live"}>{job.status}</StatusChip>
                        <h3 className="mt-2.5 text-base font-bold text-ink-900">{job.title}</h3>
                        <p className="mt-0.5 text-xs font-medium text-ink-500">
                          {job.type === "job" ? "Full-time" : "Internship"} · {job.segment}
                        </p>
                      </div>
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink-50 text-sm font-bold text-ink-700 ring-1 ring-inset ring-ink-200">
                        {job.reqs}
                      </span>
                    </div>
                    <div className="my-5 space-y-2.5 border-y border-ink-100 py-4">
                      <MetricRow label="Applicants" value={`${job.applicants}`} />
                      <MetricRow label="Shortlisted" value={`${job.shortlisted}`} />
                      <MetricRow label="Min Fit Score" value={`${job.minFit}`} />
                      <MetricRow label="Location" value={job.location} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" className="flex-1">Edit</Button>
                      <Button type="button" variant="primary" size="sm" className="flex-1">Invite</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Candidate discovery (filters) ── */}
          <section id="candidates" className="scroll-mt-24 pt-12">
            <div className="flex items-center justify-between">
              <SectionTitle icon={<Search className="h-4 w-4" />}>Candidate discovery</SectionTitle>
              <button type="button" onClick={clearAll} className="text-xs font-semibold text-ink-500 transition-colors hover:text-ink-900">
                Clear filters
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-ink-200 bg-white p-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <FilterField label="Search" htmlFor="recruiter-search">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
                    <input id="recruiter-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, college, role…" className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-ink-900 transition-colors placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                  </div>
                </FilterField>
                <FilterField label="Posting" htmlFor="recruiter-posting">
                  <select id="recruiter-posting" value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                    <option value="all">All postings</option>
                    {activeJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                  </select>
                </FilterField>
                <FilterField label="Experience">
                  <SegmentedControl ariaLabel="Experience" options={[["all", "All"], ["freshers", "Freshers"], ["oneToThree", "1-3 yrs"]]} value={segment} onChange={(v) => setSegment(v as Segment)} />
                </FilterField>
                <FilterField label="Opening type">
                  <SegmentedControl ariaLabel="Opening type" options={[["all", "All"], ["job", "Jobs"], ["internship", "Interns"]]} value={jobType} onChange={(v) => setJobType(v as JobType)} />
                </FilterField>
                <FilterField label="Min Fit Score" htmlFor="recruiter-min-fit">
                  <RangeControl id="recruiter-min-fit" ariaLabel="Min Fit Score" value={minFit} min={45} max={95} onChange={setMinFit} />
                </FilterField>
                <FilterField label="Min Success Prob" htmlFor="recruiter-min-success">
                  <RangeControl id="recruiter-min-success" ariaLabel="Min Success Prob" value={minSuccess} min={45} max={95} onChange={setMinSuccess} suffix="%" />
                </FilterField>
                <FilterField label="DNLA status">
                  <SegmentedControl ariaLabel="DNLA status" options={[["all", "All"], ["available", "Ready"], ["pending", "Pending"]]} value={dnlaStatus} onChange={(v) => setDnlaStatus(v as DnlaStatus)} />
                </FilterField>
                <FilterField label="Sort by" htmlFor="recruiter-sort">
                  <select id="recruiter-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                    <option value="fit">Fit Score</option>
                    <option value="success">Success Probability</option>
                    <option value="technical">Technical</option>
                    <option value="behavioural">Behavioural</option>
                    <option value="recent">Recently Updated</option>
                  </select>
                </FilterField>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-5">
                {advancedFilters.map((chip) => {
                  const isActive = chips.includes(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => toggleChip(chip.id)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${isActive ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200" : "bg-white text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"}`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── Candidate table ── */}
          <div className="pt-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-sm font-bold text-ink-900">
                {rows.length} candidate{rows.length === 1 ? "" : "s"} matching
              </h3>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5" role="group" aria-label="Row density">
                  {(["comfortable", "compact"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDensity(d)}
                      aria-pressed={density === d}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${density === d ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:text-ink-900"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => toast(`Exported ${rows.length} candidates (demo)`, "info")}><IconDownload className="h-4 w-4" /> Export</Button>
                <Button type="button" variant="primary" size="sm" onClick={() => toast(`Generated group report for ${rows.length} candidates (demo)`, "info")}><IconReport className="h-4 w-4" /> Group report</Button>
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Active</span>
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={f.clear}
                    className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-900"
                  >
                    {f.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
              <div className="overflow-x-auto">
                <div className="min-w-[1080px]">
                  <div className="grid grid-cols-12 border-b border-ink-200 bg-ink-50 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                    <div className="col-span-3 flex items-center gap-3">
                      <input
                        type="checkbox"
                        aria-label="Select all candidates"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-ink-300 accent-brand-600"
                      />
                      Candidate
                    </div>
                    <div className="col-span-2">Opening / Segment</div>
                    <div className="col-span-1">
                      <SortHeader label="Fit" active={sort === "fit"} onClick={() => setSortKey("fit")} />
                    </div>
                    <div className="col-span-2">
                      <SortHeader label="Interview" active={sort === "technical"} onClick={() => setSortKey("technical")} />
                    </div>
                    <div className="col-span-1">
                      <SortHeader label="Success" active={sort === "success"} onClick={() => setSortKey("success")} />
                    </div>
                    <div className="col-span-2">DNLA / Role fit</div>
                    <div className="col-span-1 text-right">Action</div>
                  </div>
                  <div className="divide-y divide-ink-100">
                    <AnimatePresence initial={false}>
                      {rows.map((r) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          key={r.studentId + r.name}
                          className={`group grid grid-cols-12 items-center px-5 ${rowPad} text-sm transition-colors ${selected.has(r.studentId) ? "bg-brand-50/60" : "hover:bg-ink-50"}`}
                        >
                          <div className="col-span-3 flex min-w-0 items-center gap-3">
                            <input
                              type="checkbox"
                              aria-label={`Select ${r.name}`}
                              checked={selected.has(r.studentId)}
                              onChange={() => toggleOne(r.studentId)}
                              className="h-4 w-4 shrink-0 rounded border-ink-300 accent-brand-600"
                            />
                            <div className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-700`}>
                              {initials(r.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-ink-900">{r.name}</div>
                              <div className="truncate text-xs text-ink-500">{r.college}</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600">{r.experience ?? "Fresher"}</span>
                                <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600">{r.availability ?? "Available now"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-2 pr-4">
                            <div className="truncate font-semibold text-ink-900">{r.role}</div>
                            <div className="mt-0.5 truncate text-xs text-ink-500">{postingTitle(r.activeJobId ?? "all")}</div>
                          </div>
                          <div className="col-span-1 pr-4">
                            <div className="text-lg font-bold tabular-nums text-ink-900">{r.fit}</div>
                            <div className="mt-1 h-1 w-full max-w-[52px] overflow-hidden rounded-full bg-ink-100">
                              <div className="h-full rounded-full bg-brand-600" style={{ width: `${r.fit}%` }} />
                            </div>
                          </div>
                          <div className="col-span-2 space-y-2 pr-6">
                            <ScoreBarLine label="Tech" value={r.tech} />
                            <ScoreBarLine label="Behav" value={r.behav} />
                          </div>
                          <div className="col-span-1">
                            <SuccessPill value={r.success} />
                          </div>
                          <div className="col-span-2 pr-4">
                            <div className="mb-1.5 flex flex-wrap gap-1.5">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${(r.dnla ?? "Pending") === "Available" ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"}`}>
                                DNLA {r.dnla ?? "Pending"}
                              </span>
                              {(r.flags ?? [])[0] && (
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.flags[0].toLowerCase().includes("flag") || r.flags[0].toLowerCase().includes("defensive") ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200" : "bg-ink-100 text-ink-600"}`}>
                                  {r.flags[0]}
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs font-medium text-ink-600">{r.roleFit ?? "Solid role match"}</div>
                          </div>
                          <div className="col-span-1 flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setQuickView(r)}
                              aria-label={`Quick view ${r.name}`}
                              className="grid h-8 w-8 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-brand-600"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
                            </button>
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
                      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-ink-50 text-ink-400">
                        <IconFilter className="h-6 w-6" />
                      </div>
                      <h3 className="text-sm font-bold text-ink-900">No candidates found</h3>
                      <p className="mt-1 text-sm text-ink-500">Try adjusting your filters or search terms.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Reports / modules ── */}
          <section id="reports" className="scroll-mt-24 pt-12">
            <SectionTitle icon={<FileBarChart className="h-4 w-4" />}>Reports &amp; workflows</SectionTitle>
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <BottomCard
                icon={<IconUpload className="h-5 w-5" />} title="Private hiring assessment"
                desc="Upload external candidates, issue invite links, collect evidence, compare against shared pools."
                action="Create batch" secAction="Pricing"
              >
                <div className="my-5 space-y-2.5">
                  <WorkflowStep label="1" title="Upload CSV / resumes" detail="Candidate details, role, email, experience." />
                  <WorkflowStep label="2" title="Confirm credits" detail="Payment-gated invites before interviews." />
                  <WorkflowStep label="3" title="Send secure links" detail="Unique links per candidate with expiry." />
                </div>
              </BottomCard>

              <BottomCard
                icon={<IconReport className="h-5 w-5" />} title="Reports & shortlisting"
                desc="Generate comprehensive analytics from your current filtered views."
                action="Generate report"
              >
                <div className="my-5 flex items-center gap-5">
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <svg
                      role="img"
                      aria-label={`${Math.round((shortlisted.length / Math.max(rows.length, 1)) * 100)}% of matching candidates are shortlist-ready`}
                      className="absolute inset-0 h-full w-full -rotate-90 transform"
                      viewBox="0 0 100 100"
                    >
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-ink-100" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-brand-600" strokeDasharray={`${Math.round((shortlisted.length / Math.max(rows.length, 1)) * 100) * 2.64} 264`} strokeLinecap="round" />
                    </svg>
                    <div className="text-lg font-extrabold tabular-nums text-ink-900">{Math.round((shortlisted.length / Math.max(rows.length, 1)) * 100)}%</div>
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold tabular-nums text-ink-900">{shortlisted.length}</div>
                    <div className="mt-0.5 text-sm leading-tight text-ink-500">Candidates in<br />shortlist</div>
                  </div>
                </div>
                <div className="space-y-2.5 border-t border-ink-100 pt-4">
                  <MetricRow label="Evidence" value="Resume, Interview, DNLA" />
                  <MetricRow label="Action" value="Share with hiring manager" />
                </div>
              </BottomCard>

              <div id="access" className="scroll-mt-24">
                <BottomCard
                  icon={<Share2 className="h-5 w-5" />} title="Shared institute access"
                  desc="Institutes share scoped recruiter links for selected batches, roles, and reports."
                  action="Manage links" secondaryBtn
                >
                  <div className="my-5 space-y-2.5">
                    {topInstitutes.length === 0 ? (
                      <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-4 text-sm text-ink-500">
                        No institutes have shared access yet.
                      </div>
                    ) : (
                      topInstitutes.map(([name, score, note], i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-ink-200 bg-white p-3">
                          <div>
                            <div className="text-sm font-bold text-ink-900">{name}</div>
                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">{note}</div>
                          </div>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-sm font-bold text-white">
                            {score}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </BottomCard>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Sticky bulk-action bar (appears when rows are selected) */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-2 shadow-[0_16px_44px_-18px_rgba(16,24,40,0.35)]">
            <span className="px-2 text-sm font-bold text-ink-900">{selected.size} selected</span>
            <span className="h-5 w-px bg-ink-200" />
            <Button type="button" variant="ghost" size="sm" onClick={() => toast(`Exported ${selected.size} candidates (demo)`, "info")}>
              <IconDownload className="h-4 w-4" /> Export
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => toast(`Group report for ${selected.size} candidates (demo)`, "info")}>
              <IconReport className="h-4 w-4" /> Group report
            </Button>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Candidate quick-view drawer */}
      <Drawer
        open={!!quickView}
        onClose={() => setQuickView(null)}
        title={quickView?.name ?? "Candidate"}
        width="md"
        footer={
          quickView && (
            <ButtonLink href={`/student/${quickView.studentId}`} className="w-full justify-center">
              View full profile
              <IconArrow className="h-4 w-4" />
            </ButtonLink>
          )
        }
      >
        {quickView && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-bold text-ink-700">
                {initials(quickView.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-ink-900">{quickView.name}</p>
                <p className="truncate text-sm text-ink-500">{quickView.role} · {quickView.college}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                ["Fit Score", String(quickView.fit)],
                ["Success", `${quickView.success}%`],
                ["DNLA", quickView.dnla ?? "Pending"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-ink-200 bg-white p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{l}</p>
                  <p className="mt-1 text-lg font-extrabold text-ink-900">{v}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Interview scores</p>
              <ScoreBarLine label="Technical" value={quickView.tech} />
              <ScoreBarLine label="Behavioural" value={quickView.behav} />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-ink-500">Experience</dt>
                <dd className="font-semibold text-ink-800">{quickView.experience ?? "Fresher"}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Availability</dt>
                <dd className="font-semibold text-ink-800">{quickView.availability ?? "Available now"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-ink-500">Role match</dt>
                <dd className="font-semibold text-ink-800">{quickView.roleFit ?? "—"}</dd>
              </div>
            </dl>

            {(quickView.flags ?? []).length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Signals</p>
                <div className="flex flex-wrap gap-1.5">
                  {(quickView.flags ?? []).map((f: string) => (
                    <span key={f} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function KpiTile({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-500 ring-1 ring-inset ring-ink-200">
          {icon}
        </span>
      </div>
      <div className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-ink-900">{value}</div>
      <div className="mt-1 text-xs text-ink-500">{hint}</div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-base font-bold text-ink-900">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-50 text-ink-500 ring-1 ring-inset ring-ink-200">{icon}</span>
      {children}
    </h2>
  );
}

function SortHeader({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider transition-colors ${active ? "text-brand-700" : "text-ink-500 hover:text-ink-700"}`}>
      {label}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden className={active ? "opacity-100" : "opacity-40"}><path d="m6 9 6 6 6-6" /></svg>
    </button>
  );
}

function StatusChip({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      {children}
    </span>
  );
}

function SuccessPill({ value }: { value: number }) {
  const tone =
    value >= 75
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : value >= 65
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-rose-50 text-rose-700 ring-rose-200";
  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ring-inset ${tone}`}>
      {value}%
    </span>
  );
}

function FilterField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</label>
      {children}
    </div>
  );
}

function RangeControl({ id, ariaLabel, value, min, max, suffix = "", onChange }: { id?: string; ariaLabel?: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void; }) {
  return (
    <div className="flex h-[38px] items-center gap-3 rounded-lg border border-ink-200 bg-white px-3">
      <input id={id} aria-label={ariaLabel} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-200 accent-brand-600" />
      <span className="w-10 text-right text-sm font-bold tabular-nums text-ink-900">{value}{suffix}</span>
    </div>
  );
}

function SegmentedControl({ options, value, onChange, ariaLabel }: { options: [string, string][]; value: string; onChange: (value: string) => void; ariaLabel?: string; }) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex rounded-lg border border-ink-200 bg-white p-0.5">
      {options.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${value === id ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:text-ink-900"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function ScoreBarLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[44px_1fr_28px] items-center gap-2.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${value}%` }} />
      </div>
      <span className="text-right text-xs font-bold tabular-nums text-ink-900">{value}</span>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-sm font-semibold text-ink-900">{value}</span>
    </div>
  );
}

function WorkflowStep({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-ink-200 bg-white p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-xs font-bold text-brand-700">
        {label}
      </span>
      <div>
        <div className="text-sm font-semibold text-ink-900">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-ink-500">{detail}</div>
      </div>
    </div>
  );
}

function BottomCard({ icon, title, desc, action, secAction, secondaryBtn, children }: any) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-ink-200 bg-white p-6">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-200">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-bold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{desc}</p>
      <div className="flex-1">{children}</div>
      <div className="mt-auto flex flex-wrap gap-2.5 pt-2">
        <Button
          type="button"
          variant={secondaryBtn ? "ghost" : "primary"}
          size="sm"
          className="flex-1"
        >
          {action}
        </Button>
        {secAction && (
          <Button type="button" variant="ghost" size="sm">{secAction}</Button>
        )}
      </div>
    </div>
  );
}

function initials(name: string) { return name.split(" ").map((p) => p[0]).join(""); }
function postingTitle(jobId: string) { return activeJobs.find((j) => j.id === jobId)?.title ?? "General pipeline"; }
function recencyScore(val: string) { if (val === "Today") return 4; if (val === "Yesterday") return 3; if (val.includes("2 days")) return 2; return 1; }

function IconUpload(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>; }
function IconTarget(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>; }
function IconArrow(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>; }
function IconPost(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>; }
function IconGauge(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 14l4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>; }
function IconShield(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" /><path d="m9 12 2 2 4-4" /></svg>; }
function IconFilter(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" /></svg>; }
function IconDownload(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function IconReport(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>; }
