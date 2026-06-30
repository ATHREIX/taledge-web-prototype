"use client";
import React from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Card, Button, Badge } from "@/components/ui";
import { DashboardShell, DashboardHeader, KPIGrid, Section, EmptyState } from "@/components/dashboard";
import { scoreToTone } from "@/lib/dashboard-theme";

const pipelineStats = [
  { label: "Sourced", value: "1,248", change: "+12%", tone: "neutral" as const },
  { label: "Screened", value: "342", change: "+5%", tone: "brand" as const },
  { label: "Interview", value: "84", change: "+2%", tone: "brand" as const },
  { label: "Offered", value: "12", change: "+1", tone: "success" as const },
];

const funnelSteps = [
  { stage: "Sourced", count: 1248, percentage: 100, color: "from-ink-400 to-ink-300" },
  { stage: "Screened", count: 342, percentage: 27.4, color: "from-brand-500 to-accent-400" },
  { stage: "Interview", count: 84, percentage: 6.7, color: "from-brand-600 to-accent-500" },
  { stage: "Offered", count: 12, percentage: 1.0, color: "from-emerald-500 to-emerald-400" },
];

const activeJobs = [
  { title: "Software Engineer II", dept: "Engineering", matches: 45, status: "Active" },
  { title: "Product Manager", dept: "Product", matches: 12, status: "Active" },
  { title: "Data Analyst", dept: "Data", matches: 8, status: "Review" },
];

const shortlist = [
  { name: "Ananya Sharma", role: "Software Engineer II", score: 94, status: "Interview", initials: "AS" },
  { name: "Vikram Gupta", role: "Product Manager", score: 89, status: "Screened", initials: "VG" },
  { name: "Neha Patel", role: "Software Engineer II", score: 87, status: "Screened", initials: "NP" },
  { name: "Rohan Desai", role: "Data Analyst", score: 85, status: "Sourced", initials: "RD" },
];

export default function RecruiterDashboard() {
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  const stub = (message: string) => () => setNotice(message);

  // Average fit score across the current shortlist (score-derived KPI).
  const avgFit =
    shortlist.length > 0
      ? Math.round(shortlist.reduce((sum, c) => sum + c.score, 0) / shortlist.length)
      : 0;

  return (
    <>
      {/* Stub action feedback */}
      {notice && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4">
          <div className="rounded-full border border-ink-200 bg-white/90 backdrop-blur-xl px-5 py-3 text-sm font-semibold text-ink-700 shadow-lg">
            {notice}
          </div>
        </div>
      )}

      <DashboardShell>
        <DashboardHeader
          eyebrow="Recruiter Command Center"
          title="Candidate Pipeline"
          description="Track every active requisition, surface high-fit talent, and shortlist top candidates from one command center."
          actions={
            <>
              <Button
                type="button"
                onClick={stub("Search is coming soon in the live build.")}
                variant="ghost"
                aria-label="Search"
                className="rounded-full"
              >
                <Search size={16} aria-hidden="true" /> Search
              </Button>
              <Button
                type="button"
                onClick={stub("No new notifications.")}
                variant="ghost"
                aria-label="Notifications"
                className="rounded-full"
              >
                <Bell size={16} aria-hidden="true" /> Alerts
              </Button>
              <Button
                type="button"
                onClick={stub("Filter panel is coming soon.")}
                variant="ghost"
                className="rounded-full"
              >
                <Filter size={16} aria-hidden="true" /> Filter
              </Button>
              <Button
                type="button"
                onClick={stub("Job posting is coming soon in the live build.")}
                variant="primary"
                className="rounded-full"
              >
                Post New Job
              </Button>
            </>
          }
        />

        {/* KPI strip — top-line pipeline metrics, shared across dashboards */}
        <KPIGrid
          items={[
            {
              label: "Active Candidates",
              value: pipelineStats[0].value,
              hint: "Sourced this cycle",
              tone: "brand",
              icon: <Users size={16} />,
              trend: pipelineStats[0].change,
            },
            {
              label: "Shortlisted",
              value: `${shortlist.length}`,
              hint: ">85% fit for open roles",
              tone: "success",
              icon: <UserCheck size={16} />,
              trend: pipelineStats[3].change,
            },
            {
              label: "Avg Fit Score",
              value: `${avgFit}%`,
              hint: "Across shortlisted talent",
              tone: scoreToTone(avgFit),
              icon: <Gauge size={16} />,
            },
            {
              label: "Open Roles",
              value: `${activeJobs.length}`,
              hint: "Requisitions in progress",
              tone: "neutral",
              icon: <Briefcase size={16} />,
            },
          ]}
        />

        {/* Conversion funnel */}
        <Section
          title="Conversion Funnel"
          description="Candidate flow from sourced to offered across all active requisitions."
          actions={<Badge tone="success" className="uppercase tracking-widest text-[10px]">Healthy</Badge>}
        >
          <Card variant="frosted" className="rounded-xl3 shadow-panel p-6 sm:p-8">
            <div className="overflow-x-auto">
              <div
                role="img"
                aria-label="Conversion funnel: 1,248 sourced, 342 screened, 84 in interview, 12 offered."
                className="flex min-w-[28rem] flex-col justify-center gap-4"
              >
                {funnelSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-4 group cursor-pointer">
                    <div className="w-24 text-right text-sm font-bold text-ink-500 group-hover:text-brand-600 transition-colors">
                      {step.stage}
                    </div>
                    <div className="flex-1 h-10 sm:h-12 bg-white/60 rounded-full border border-white p-1 relative flex items-center shadow-inner">
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: `${step.percentage}%`, opacity: 1 }}
                        transition={{ duration: 1.2, delay: i * 0.15, type: "spring", bounce: 0.2 }}
                        className={`h-full rounded-full bg-gradient-to-r ${step.color} shadow-sm relative min-w-[3.5rem] group-hover:brightness-110 transition-all`}
                      >
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-[10px] sm:text-xs font-bold opacity-90 sm:opacity-80 sm:group-hover:opacity-100 transition-opacity">
                          {step.percentage.toFixed(1)}%
                        </span>
                      </motion.div>
                    </div>
                    <div className="w-16 text-left text-sm font-extrabold text-ink-700 group-hover:text-ink-900">
                      {step.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Requisitions */}
          <Section
            title="Active Requisitions"
            icon={<Briefcase size={18} aria-hidden="true" />}
            className="flex flex-col"
          >
            <Card variant="frosted" className="h-full rounded-xl3 shadow-panel p-6">
              <div className="space-y-4">
                {(activeJobs ?? []).length === 0 ? (
                  <EmptyState
                    icon={<Briefcase size={20} aria-hidden="true" />}
                    title="No active requisitions yet"
                    description="Post a new job to start sourcing matched candidates."
                  />
                ) : (
                  (activeJobs ?? []).map((job, i) => (
                    <Card key={i} variant="flat" hover className="group p-4 cursor-pointer hover:border-brand-200">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-bold text-ink-800 text-sm">{job.title}</div>
                          <div className="text-xs font-medium text-ink-500 mt-0.5">{job.dept}</div>
                        </div>
                        <MoreHorizontal size={16} aria-hidden="true" className="text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink-100">
                        <Badge tone="brand">{job.matches} High Matches</Badge>
                        <div className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">
                          {job.status}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </Card>
          </Section>

          {/* Top Shortlists */}
          <Section
            title="Top Shortlists"
            description="Candidates with >85% Fit Score for active roles"
            icon={<UserCheck size={18} aria-hidden="true" />}
            className="lg:col-span-2"
          >
            <Card variant="frosted" className="h-full rounded-xl3 shadow-panel p-6 sm:p-8 flex flex-col">
              <div className="flex-1 overflow-x-auto">
                {(shortlist ?? []).length === 0 ? (
                  <EmptyState
                    icon={<Inbox size={20} aria-hidden="true" />}
                    title="No shortlisted candidates yet"
                    description="High-fit candidates for your active roles will appear here."
                  />
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-ink-200 text-xs font-bold text-ink-500 uppercase tracking-wider">
                        <th className="pb-4 pl-2">Candidate</th>
                        <th className="pb-4">Applied Role</th>
                        <th className="pb-4">Fit Score</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4"></th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {(shortlist ?? []).map((c, i) => (
                        <tr key={i} className="border-b border-ink-100/50 hover:bg-white/40 transition-colors group">
                          <td className="py-4 pl-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-brand-100 text-brand-700">
                                {c.initials}
                              </div>
                              <span className="font-bold text-ink-800">{c.name}</span>
                            </div>
                          </td>
                          <td className="py-4 font-medium text-ink-600">{c.role}</td>
                          <td className="py-4">
                            <div
                              role="img"
                              aria-label={`Fit score ${c.score} percent`}
                              className="flex items-center gap-2"
                            >
                              <div className="w-full max-w-[80px] bg-ink-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-gradient-to-r from-brand-600 to-accent-500 h-full rounded-full" style={{ width: `${c.score}%` }}></div>
                              </div>
                              <span className="font-bold text-ink-700">{c.score}%</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <Badge tone="neutral" className="uppercase tracking-wider text-[10px]">
                              {c.status}
                            </Badge>
                          </td>
                          <td className="py-4 text-right pr-2">
                            <button type="button" onClick={stub(`Opening ${c.name}'s profile is coming soon.`)} aria-label={`View ${c.name}`} className="text-ink-500 hover:text-brand-600 transition-colors p-1 rounded-full hover:bg-ink-100 opacity-100 sm:opacity-70 sm:group-hover:opacity-100">
                              <ChevronRight size={18} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="mt-6 flex justify-center">
                <Button type="button" onClick={stub("All shortlisted candidates are shown in this demo.")} variant="link">
                  Load More Candidates
                </Button>
              </div>
            </Card>
          </Section>
        </div>
      </DashboardShell>
    </>
  );
}
