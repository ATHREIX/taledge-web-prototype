"use client";
import React, { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Search,
  Bell,
  Briefcase,
  Filter,
  UserCheck,
  Users,
  Gauge,
  ChevronRight,
  MoreHorizontal,
  Inbox,
  LayoutGrid,
  GitBranch,
  ListChecks,
  LifeBuoy,
  CalendarClock,
  Activity,
  Menu,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Video,
  Phone,
} from "lucide-react";
import { Button, Badge, Drawer } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ------------------------------- data ------------------------------- */

type Candidate = {
  name: string;
  role: string;
  score: number;
  status: string;
  initials: string;
  email: string;
  location: string;
  experience: string;
  tech: number;
  behav: number;
  skills: string[];
};

const kpis: { label: string; value: string; hint: string; trend: number; spark: number[]; icon: ReactNode }[] = [
  { label: "Active Candidates", value: "1,248", hint: "Sourced this cycle", trend: 12, spark: [18, 22, 20, 28, 26, 34, 33, 41], icon: <Users size={16} /> },
  { label: "Shortlisted", value: "12", hint: ">85% fit for open roles", trend: 8, spark: [4, 6, 5, 7, 9, 8, 11, 12], icon: <UserCheck size={16} /> },
  { label: "Avg Fit Score", value: "89%", hint: "Across shortlisted talent", trend: 3, spark: [80, 82, 81, 84, 86, 85, 88, 89], icon: <Gauge size={16} /> },
  { label: "Open Roles", value: "3", hint: "Requisitions in progress", trend: 0, spark: [2, 3, 3, 4, 3, 3, 3, 3], icon: <Briefcase size={16} /> },
];

const TREND_WEEKS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
const trendThis = [820, 910, 870, 1040, 1120, 1080, 1210, 1248];
const trendLast = [700, 760, 800, 790, 880, 920, 960, 1010];

const funnelSteps = [
  { stage: "Sourced", count: 1248, percentage: 100, fill: "bg-ink-300" },
  { stage: "Screened", count: 342, percentage: 27.4, fill: "bg-brand-400" },
  { stage: "Interview", count: 84, percentage: 6.7, fill: "bg-brand-600" },
  { stage: "Offered", count: 12, percentage: 1.0, fill: "bg-emerald-500" },
];

const activeJobs = [
  { title: "Software Engineer II", dept: "Engineering", matches: 45, status: "Active" },
  { title: "Product Manager", dept: "Product", matches: 12, status: "Active" },
  { title: "Data Analyst", dept: "Data", matches: 8, status: "Review" },
];

const shortlist: Candidate[] = [
  { name: "Ananya Sharma", role: "Software Engineer II", score: 94, status: "Interview", initials: "AS", email: "ananya.sharma@email.com", location: "Bengaluru", experience: "2 yrs", tech: 92, behav: 88, skills: ["React", "TypeScript", "Node"] },
  { name: "Vikram Gupta", role: "Product Manager", score: 89, status: "Screened", initials: "VG", email: "vikram.gupta@email.com", location: "Mumbai", experience: "3 yrs", tech: 84, behav: 90, skills: ["Roadmapping", "Analytics", "SQL"] },
  { name: "Neha Patel", role: "Software Engineer II", score: 87, status: "Screened", initials: "NP", email: "neha.patel@email.com", location: "Pune", experience: "1 yr", tech: 88, behav: 82, skills: ["Java", "Spring", "AWS"] },
  { name: "Rohan Desai", role: "Data Analyst", score: 85, status: "Sourced", initials: "RD", email: "rohan.desai@email.com", location: "Hyderabad", experience: "2 yrs", tech: 86, behav: 80, skills: ["Python", "SQL", "Tableau"] },
  { name: "Priya Nair", role: "Software Engineer II", score: 84, status: "Interview", initials: "PN", email: "priya.nair@email.com", location: "Chennai", experience: "2 yrs", tech: 85, behav: 83, skills: ["Go", "Kubernetes", "gRPC"] },
  { name: "Arjun Mehta", role: "Product Manager", score: 83, status: "Screened", initials: "AM", email: "arjun.mehta@email.com", location: "Delhi", experience: "4 yrs", tech: 78, behav: 88, skills: ["Strategy", "UX", "A/B"] },
  { name: "Sneha Iyer", role: "Data Analyst", score: 82, status: "Sourced", initials: "SI", email: "sneha.iyer@email.com", location: "Bengaluru", experience: "1 yr", tech: 83, behav: 81, skills: ["R", "Power BI", "ETL"] },
  { name: "Karan Singh", role: "Software Engineer II", score: 81, status: "Screened", initials: "KS", email: "karan.singh@email.com", location: "Noida", experience: "3 yrs", tech: 84, behav: 78, skills: ["C++", "Systems", "Redis"] },
  { name: "Divya Rao", role: "Product Manager", score: 80, status: "Sourced", initials: "DR", email: "divya.rao@email.com", location: "Kochi", experience: "2 yrs", tech: 76, behav: 84, skills: ["Discovery", "Metrics", "Figma"] },
  { name: "Aditya Kumar", role: "Data Analyst", score: 79, status: "Sourced", initials: "AK", email: "aditya.kumar@email.com", location: "Jaipur", experience: "1 yr", tech: 80, behav: 78, skills: ["Python", "Pandas", "dbt"] },
  { name: "Meera Joshi", role: "Software Engineer II", score: 78, status: "Sourced", initials: "MJ", email: "meera.joshi@email.com", location: "Ahmedabad", experience: "2 yrs", tech: 81, behav: 75, skills: ["Vue", "Nuxt", "GraphQL"] },
  { name: "Sahil Verma", role: "Product Manager", score: 77, status: "Sourced", initials: "SV", email: "sahil.verma@email.com", location: "Gurugram", experience: "3 yrs", tech: 72, behav: 82, skills: ["GTM", "Pricing", "SQL"] },
];

const upcomingInterviews = [
  { name: "Ananya Sharma", role: "Software Engineer II", time: "Today · 2:30 PM", mode: "video", initials: "AS" },
  { name: "Priya Nair", role: "Software Engineer II", time: "Today · 4:00 PM", mode: "video", initials: "PN" },
  { name: "Vikram Gupta", role: "Product Manager", time: "Tomorrow · 11:00 AM", mode: "phone", initials: "VG" },
  { name: "Karan Singh", role: "Software Engineer II", time: "Wed · 3:15 PM", mode: "video", initials: "KS" },
];

const activityFeed = [
  { text: "moved Ananya Sharma to Interview", time: "2h ago", tone: "brand" as const },
  { text: "added 18 new candidates to Software Engineer II", time: "5h ago", tone: "neutral" as const },
  { text: "Vikram Gupta cleared the screening round", time: "Yesterday", tone: "success" as const },
  { text: "Data Analyst requisition moved to Review", time: "Yesterday", tone: "warn" as const },
  { text: "shared shortlist with hiring manager", time: "2 days ago", tone: "neutral" as const },
];

const sideNav: { id: string; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "pipeline", label: "Pipeline", icon: GitBranch },
  { id: "requisitions", label: "Requisitions", icon: Briefcase },
  { id: "shortlist", label: "Shortlist", icon: ListChecks },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "activity", label: "Activity", icon: Activity },
];

type SortKey = "name" | "role" | "score" | "status";

/* ------------------------------ page ------------------------------ */

export default function RecruiterDashboard() {
  const [notice, setNotice] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quickView, setQuickView] = useState<Candidate | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "score", dir: "desc" });
  const [visible, setVisible] = useState(6);

  // Brief skeleton on first paint so the data-heavy widgets don't flash in raw.
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 480);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  // Close mobile nav on Escape.
  useEffect(() => {
    if (!mobileNav) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileNav(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNav]);

  const stub = (message: string) => () => setNotice(message);

  const avgFit = shortlist.length
    ? Math.round(shortlist.reduce((s, c) => s + c.score, 0) / shortlist.length)
    : 0;

  const sortedShortlist = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...shortlist].sort((a, b) => {
      if (sort.key === "score") return (a.score - b.score) * dir;
      return String(a[sort.key]).localeCompare(String(b[sort.key])) * dir;
    });
  }, [sort]);

  const rows = sortedShortlist.slice(0, visible);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "score" ? "desc" : "asc" }));

  return (
    <div className="min-h-screen bg-canvas">
      {/* Stub action feedback */}
      {notice && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 px-4">
          <div className="rounded-full border border-ink-200 bg-white/90 px-5 py-3 text-sm font-semibold text-ink-700 shadow-lg backdrop-blur-xl">
            {notice}
          </div>
        </div>
      )}

      {/* Mobile nav drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-[55] lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <div className="absolute left-0 top-0 h-full w-64 border-r border-ink-200 bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">Recruiter workspace</p>
              <button type="button" aria-label="Close" onClick={() => setMobileNav(false)} className="grid h-8 w-8 place-items-center rounded-md text-ink-500 hover:bg-ink-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarNav activeSection={activeSection} onSelect={(id) => { setActiveSection(id); setMobileNav(false); }} />
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[88rem] gap-8 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        {/* ───────────── Desktop left rail ───────────── */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">
            <p className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">Recruiter workspace</p>
            <div className="mt-3">
              <SidebarNav activeSection={activeSection} onSelect={setActiveSection} />
            </div>
            <div className="mt-6 rounded-xl border border-ink-200 bg-white p-4">
              <div className="flex items-center gap-2 text-ink-700">
                <LifeBuoy className="h-4 w-4" aria-hidden />
                <span className="text-sm font-bold">Need a hand?</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500">Our team can help you set up requisitions and source matched talent.</p>
              <Button type="button" variant="ghost" size="sm" className="mt-3 w-full" onClick={stub("Support chat is coming soon.")}>Contact support</Button>
            </div>
          </div>
        </aside>

        {/* ───────────── Main column ───────────── */}
        <main className="min-w-0 flex-1">
          {/* Breadcrumb row + mobile menu button */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-ink-400">
              <span>Recruiter</span>
              <span aria-hidden>/</span>
              <span className="text-ink-700">Candidate Pipeline</span>
            </nav>
            <button type="button" aria-label="Open menu" onClick={() => setMobileNav(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-700 lg:hidden">
              <Menu className="h-4 w-4" />
            </button>
          </div>

          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-200 pb-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Candidate Pipeline</h1>
              <p className="mt-1.5 max-w-xl text-sm text-ink-500">Track every active requisition, surface high-fit talent, and shortlist top candidates from one command center.</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Updated 2 min ago · Synced
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={stub("Search is coming soon in the live build.")} variant="ghost" size="sm" aria-label="Search"><Search size={16} aria-hidden="true" /> Search</Button>
              <Button type="button" onClick={stub("No new notifications.")} variant="ghost" size="sm" aria-label="Notifications"><Bell size={16} aria-hidden="true" /> Alerts</Button>
              <Button type="button" onClick={stub("Filter panel is coming soon.")} variant="ghost" size="sm"><Filter size={16} aria-hidden="true" /> Filter</Button>
              <Button type="button" onClick={stub("Job posting is coming soon in the live build.")} variant="primary" size="sm">Post New Job</Button>
            </div>
          </header>

          {/* ── Overview / KPIs ── */}
          <section id="overview" className="scroll-mt-24 pt-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />)
                : kpis.map((k) => <KpiTile key={k.label} {...k} />)}
            </div>
          </section>

          {/* ── Pipeline: trend chart + funnel ── */}
          <section id="pipeline" className="scroll-mt-24 pt-12">
            <div className="flex items-center justify-between">
              <SectionTitle icon={<GitBranch className="h-4 w-4" />}>Pipeline analytics</SectionTitle>
              <Badge tone="success" className="text-[10px] uppercase tracking-widest">Healthy</Badge>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-xl border border-ink-200 bg-white p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink-900">Candidates over time</h3>
                    <p className="mt-0.5 text-xs text-ink-500">Weekly sourced volume vs last cycle</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-ink-700"><span className="h-2 w-2 rounded-full bg-brand-600" /> This cycle</span>
                    <span className="inline-flex items-center gap-1.5 text-ink-400"><span className="h-2 w-3 rounded-full border-2 border-dashed border-ink-300" /> Last cycle</span>
                  </div>
                </div>
                {loading ? <SkeletonBlock className="h-48 w-full" /> : <AreaChart weeks={TREND_WEEKS} primary={trendThis} compare={trendLast} />}
              </div>

              <div className="rounded-xl border border-ink-200 bg-white p-6">
                <h3 className="text-sm font-bold text-ink-900">Conversion funnel</h3>
                <p className="mt-0.5 text-xs text-ink-500">Stage-to-stage pass-through</p>
                {loading ? (
                  <div className="mt-5 space-y-3.5">{Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-9 w-full" />)}</div>
                ) : (
                  <div className="mt-5 space-y-3.5">
                    {funnelSteps.map((step, i) => {
                      const prev = funnelSteps[i - 1];
                      const conv = prev ? Math.round((step.count / prev.count) * 100) : null;
                      return (
                        <div key={step.stage}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-ink-600">{step.stage}</span>
                            <span className="font-bold tabular-nums text-ink-800">{step.count.toLocaleString()}</span>
                          </div>
                          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
                            <div className={`h-full rounded-full ${step.fill}`} style={{ width: `${step.percentage}%` }} />
                          </div>
                          {conv !== null && (
                            <div className="mt-1 text-[11px] font-semibold text-ink-400">
                              <ArrowDownRight className="mr-0.5 inline h-3 w-3" />{conv}% pass-through
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Requisitions + Shortlist ── */}
          <div className="grid grid-cols-1 gap-6 pt-12 lg:grid-cols-3">
            <section id="requisitions" className="scroll-mt-24 flex flex-col">
              <SectionTitle icon={<Briefcase className="h-4 w-4" />}>Active requisitions</SectionTitle>
              <div className="mt-5 space-y-3">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-24 w-full rounded-xl" />)
                  : activeJobs.map((job, i) => (
                      <div key={i} className="group cursor-pointer rounded-xl border border-ink-200 bg-white p-4 transition-colors hover:border-ink-300">
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <div className="text-sm font-bold text-ink-900">{job.title}</div>
                            <div className="mt-0.5 text-xs font-medium text-ink-500">{job.dept}</div>
                          </div>
                          <MoreHorizontal size={16} aria-hidden="true" className="text-ink-400 opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <div className="flex items-center justify-between border-t border-ink-100 pt-3">
                          <Badge tone="brand">{job.matches} high matches</Badge>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-500">{job.status}</span>
                        </div>
                      </div>
                    ))}
              </div>
            </section>

            <section id="shortlist" className="scroll-mt-24 lg:col-span-2">
              <SectionTitle icon={<ListChecks className="h-4 w-4" />}>Top shortlists</SectionTitle>
              <p className="mt-1 text-sm text-ink-500">Candidates with &gt;85% Fit Score for active roles. Click a row for details.</p>

              <div className="mt-5 flex flex-col overflow-hidden rounded-xl border border-ink-200 bg-white">
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} className="h-10 w-full" />)}</div>
                  ) : (
                    <table className="w-full min-w-[36rem] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-ink-200 bg-ink-50 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                          <Th label="Candidate" sortKey="name" sort={sort} onSort={toggleSort} />
                          <Th label="Applied role" sortKey="role" sort={sort} onSort={toggleSort} />
                          <Th label="Fit score" sortKey="score" sort={sort} onSort={toggleSort} />
                          <Th label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                          <th className="px-5 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 text-sm">
                        {rows.map((c) => (
                          <tr key={c.name} className="group cursor-pointer transition-colors hover:bg-ink-50" onClick={() => setQuickView(c)}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-700">{c.initials}</div>
                                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${c.status === "Interview" ? "bg-amber-500" : "bg-emerald-500"}`} />
                                </div>
                                <span className="font-semibold text-ink-900">{c.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 font-medium text-ink-600">{c.role}</td>
                            <td className="px-5 py-3.5">
                              <div role="img" aria-label={`Fit score ${c.score} percent`} className="flex items-center gap-2.5">
                                <div className="h-1.5 w-full max-w-[72px] overflow-hidden rounded-full bg-ink-100">
                                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${c.score}%` }} />
                                </div>
                                <span className="text-xs font-bold tabular-nums text-ink-800">{c.score}%</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5"><Badge tone="neutral" className="text-[10px] uppercase tracking-wider">{c.status}</Badge></td>
                            <td className="px-5 py-3.5 text-right">
                              <button type="button" onClick={(e) => { e.stopPropagation(); setQuickView(c); }} aria-label={`View ${c.name}`} className="grid h-8 w-8 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-brand-600">
                                <ChevronRight size={18} aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {!loading && (
                  <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3">
                    <span className="text-xs text-ink-500">Showing {rows.length} of {shortlist.length}</span>
                    {visible < shortlist.length ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setVisible((v) => Math.min(v + 4, shortlist.length))}>Load more</Button>
                    ) : (
                      <span className="text-xs font-medium text-ink-400">All candidates shown</span>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ── Schedule + Activity ── */}
          <div className="grid grid-cols-1 gap-6 pt-12 lg:grid-cols-2">
            <section id="schedule" className="scroll-mt-24">
              <SectionTitle icon={<CalendarClock className="h-4 w-4" />}>Upcoming interviews</SectionTitle>
              <div className="mt-5 divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
                {upcomingInterviews.map((iv) => (
                  <div key={iv.name} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-700">{iv.initials}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink-900">{iv.name}</div>
                      <div className="truncate text-xs text-ink-500">{iv.role}</div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                        {iv.mode === "video" ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                      </span>
                      <span className="whitespace-nowrap text-xs font-semibold text-ink-600">{iv.time}</span>
                    </div>
                  </div>
                ))}
                <div className="px-5 py-3">
                  <Button type="button" variant="link" onClick={stub("Calendar view is coming soon.")}>Open calendar</Button>
                </div>
              </div>
            </section>

            <section id="activity" className="scroll-mt-24">
              <SectionTitle icon={<Activity className="h-4 w-4" />}>Recent activity</SectionTitle>
              <div className="mt-5 rounded-xl border border-ink-200 bg-white p-5">
                <ol className="space-y-4">
                  {activityFeed.map((a, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", a.tone === "brand" ? "bg-brand-500" : a.tone === "success" ? "bg-emerald-500" : a.tone === "warn" ? "bg-amber-500" : "bg-ink-300")} />
                        {i < activityFeed.length - 1 && <span className="mt-1 w-px flex-1 bg-ink-100" />}
                      </div>
                      <div className="-mt-0.5 pb-1">
                        <p className="text-sm text-ink-700"><span className="font-semibold text-ink-900">You</span> {a.text}</p>
                        <p className="mt-0.5 text-xs text-ink-400">{a.time}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* ── Candidate quick-view drawer ── */}
      <Drawer
        open={!!quickView}
        onClose={() => setQuickView(null)}
        title={quickView?.name ?? "Candidate"}
        width="md"
        footer={
          quickView && (
            <div className="flex w-full gap-2.5">
              <Button type="button" variant="ghost" size="md" className="flex-1" onClick={stub("Messaging is coming soon.")}>Message</Button>
              <Button type="button" variant="primary" size="md" className="flex-1" onClick={stub("Profile view is coming soon.")}>View full profile</Button>
            </div>
          )
        }
      >
        {quickView && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-bold text-ink-700">{quickView.initials}</div>
              <div className="min-w-0">
                <p className="truncate font-bold text-ink-900">{quickView.name}</p>
                <p className="truncate text-sm text-ink-500">{quickView.role} · {quickView.location}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[["Fit Score", `${quickView.score}%`], ["Status", quickView.status], ["Exp.", quickView.experience]].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-ink-200 bg-white p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{l}</p>
                  <p className="mt-1 text-base font-extrabold text-ink-900">{v}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Interview scores</p>
              <ScoreBar label="Technical" value={quickView.tech} />
              <ScoreBar label="Behavioural" value={quickView.behav} />
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Top skills</p>
              <div className="flex flex-wrap gap-1.5">
                {quickView.skills.map((s) => (
                  <span key={s} className="rounded-md border border-ink-200 bg-ink-50 px-2 py-0.5 text-xs font-semibold text-ink-700">{s}</span>
                ))}
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Email</dt><dd className="font-semibold text-ink-800">{quickView.email}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Location</dt><dd className="font-semibold text-ink-800">{quickView.location}</dd></div>
            </dl>
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* --------------------------- components --------------------------- */

function SidebarNav({ activeSection, onSelect }: { activeSection: string; onSelect: (id: string) => void }) {
  return (
    <nav className="space-y-0.5" aria-label="Recruiter sections">
      {sideNav.map((item) => {
        const Icon = item.icon;
        const active = activeSection === item.id;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={() => onSelect(item.id)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-semibold transition-colors ${active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-transparent text-ink-600 hover:bg-ink-100/70 hover:text-ink-900"}`}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

function KpiTile({ label, value, hint, trend, spark, icon }: { label: string; value: string; hint: string; trend: number; spark: number[]; icon: ReactNode }) {
  const up = trend > 0;
  const flat = trend === 0;
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-500 ring-1 ring-inset ring-ink-200">{icon}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-3xl font-extrabold tabular-nums tracking-tight text-ink-900">{value}</span>
        <Sparkline data={spark} up={up} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        {!flat && (
          <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold", up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(trend)}%
          </span>
        )}
        <span className="text-xs text-ink-500">{hint}</span>
      </div>
    </div>
  );
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const w = 64, h = 22;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / span) * (h - 3) - 1.5]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const color = up ? "text-emerald-500" : "text-rose-500";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={cn("shrink-0", color)} aria-hidden>
      <path d={area} fill="currentColor" opacity="0.1" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AreaChart({ weeks, primary, compare }: { weeks: string[]; primary: number[]; compare: number[] }) {
  const W = 640, H = 200, padX = 8, padTop = 12, padBottom = 8;
  const all = [...primary, ...compare];
  const min = Math.min(...all) * 0.95, max = Math.max(...all) * 1.02;
  const span = max - min || 1;
  const x = (i: number) => padX + (i / (primary.length - 1)) * (W - padX * 2);
  const y = (v: number) => padTop + (1 - (v - min) / span) * (H - padTop - padBottom);
  const toLine = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const primaryLine = toLine(primary);
  const areaPath = `${primaryLine} L${x(primary.length - 1).toFixed(1)} ${H - padBottom} L${padX} ${H - padBottom} Z`;
  const last = primary.length - 1;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" preserveAspectRatio="none" role="img" aria-label="Weekly sourced candidates vs last cycle">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={padX} x2={W - padX} y1={padTop + g * (H - padTop - padBottom)} y2={padTop + g * (H - padTop - padBottom)} stroke="currentColor" className="text-ink-100" strokeWidth="1" />
        ))}
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" className="text-brand-500" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" className="text-brand-500" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaFill)" />
        <path d={toLine(compare)} fill="none" stroke="currentColor" className="text-ink-300" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={primaryLine} fill="none" stroke="currentColor" className="text-brand-600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(last)} cy={y(primary[last])} r="4" className="fill-brand-600" />
      </svg>
      <div className="mt-2 flex justify-between px-1 text-[10px] font-semibold text-ink-400">
        {weeks.map((wk) => <span key={wk}>{wk}</span>)}
      </div>
    </div>
  );
}

function Th({ label, sortKey, sort, onSort }: { label: string; sortKey: SortKey; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void }) {
  const active = sort.key === sortKey;
  return (
    <th className="px-5 py-3">
      <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 font-bold uppercase tracking-wider transition-colors", active ? "text-brand-700" : "hover:text-ink-700")}>
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden className={cn(active ? "opacity-100" : "opacity-40", active && sort.dir === "asc" ? "rotate-180" : "")}><path d="m6 9 6 6 6-6" /></svg>
      </button>
    </th>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[80px_1fr_32px] items-center gap-3">
      <span className="text-xs font-semibold text-ink-500">{label}</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${value}%` }} /></div>
      <span className="text-right text-xs font-bold tabular-nums text-ink-900">{value}</span>
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

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-ink-100", className)} />;
}

function SkeletonKpi() {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
        <div className="h-8 w-8 animate-pulse rounded-lg bg-ink-100" />
      </div>
      <div className="mt-4 h-8 w-20 animate-pulse rounded bg-ink-100" />
      <div className="mt-3 h-3 w-28 animate-pulse rounded bg-ink-100" />
    </div>
  );
}
