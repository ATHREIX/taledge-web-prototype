"use client";
import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Bell, Briefcase, Filter, UserCheck, CheckCircle2, ChevronRight, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Badge,
  Stat,
  Heading,
} from "@/components/ui";
import { containerVariants, itemVariants } from "@/lib/motion";

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

  return (
    <div className="relative min-h-screen bg-canvas text-ink-900 overflow-x-hidden font-sans selection:bg-brand-500/20 flex flex-col">

      {/* Stub action feedback */}
      {notice && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4">
          <div className="rounded-full border border-ink-200 bg-white/90 backdrop-blur-xl px-5 py-3 text-sm font-semibold text-ink-700 shadow-lg">
            {notice}
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="relative z-20 w-full border-b border-ink-200/60 bg-white/60 backdrop-blur-xl">
        <div className="max-w-[90rem] mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" aria-label="Back to dashboard" className="text-ink-500 hover:text-brand-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="h-6 w-px bg-ink-200"></div>
            <Logo />
            <Badge tone="brand" className="ml-2 uppercase tracking-widest text-[10px]">Recruiter</Badge>
          </div>
          <div className="flex items-center gap-4 text-ink-500">
            <button type="button" onClick={stub("Search is coming soon in the live build.")} aria-label="Search" className="hover:text-brand-600 transition-colors p-2 rounded-full hover:bg-ink-100"><Search size={18} /></button>
            <button type="button" onClick={stub("No new notifications.")} aria-label="Notifications" className="hover:text-brand-600 transition-colors p-2 rounded-full hover:bg-ink-100 relative">
              <Bell size={18} />
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-600 to-accent-500 flex items-center justify-center text-white font-bold text-sm shadow-sm cursor-pointer border-2 border-white ml-2">
              RC
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <PageShell width="wide" className="flex-1">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Header */}
          <motion.div variants={itemVariants}>
            <PageHeader
              eyebrow="Pipeline Management"
              title="Candidate Pipeline"
              description="Manage your active job postings, evaluate fit scores, and shortlist top talent seamlessly."
              className="mb-10"
              actions={
                <>
                  <Button type="button" onClick={stub("Filter panel is coming soon.")} variant="ghost" className="rounded-full">
                    <Filter size={16} aria-hidden="true" /> Filter Candidates
                  </Button>
                  <Button type="button" onClick={stub("Job posting is coming soon in the live build.")} variant="primary" className="rounded-full">
                    Post New Job
                  </Button>
                </>
              }
            />
          </motion.div>

          {/* Pipeline Stats & Funnel Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <motion.div variants={itemVariants} className="lg:col-span-1 flex flex-col gap-4">
              {pipelineStats.map((stat, i) => (
                <Card key={i} variant="frosted" hover className="p-5 flex items-center justify-between group cursor-pointer">
                  <Stat label={stat.label} value={stat.value} tone={stat.tone} />
                  <Badge tone={stat.tone}>
                    {stat.change}
                  </Badge>
                </Card>
              ))}
            </motion.div>

            <motion.div variants={itemVariants} className="lg:col-span-3">
              <Card variant="frosted" className="h-full rounded-xl3 p-6 sm:p-8 flex flex-col">
                <Heading as="h3" className="text-lg mb-6 flex items-center gap-2">
                  Conversion Funnel
                  <Badge tone="success" className="uppercase tracking-widest text-[10px]">Healthy</Badge>
                </Heading>
                <div
                  role="img"
                  aria-label="Conversion funnel: 1,248 sourced, 342 screened, 84 in interview, 12 offered."
                  className="flex-1 flex flex-col justify-center gap-4"
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
              </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Active Jobs */}
            <motion.div variants={itemVariants} className="flex flex-col">
               <Card variant="frosted" className="h-full rounded-xl3 p-6">
                  <Heading as="h2" className="text-lg mb-6 flex items-center gap-2">
                    <Briefcase className="text-brand-500" size={18} aria-hidden="true" />
                    Active Requisitions
                  </Heading>

                  <div className="space-y-4">
                    {(activeJobs ?? []).length === 0 ? (
                      <Card variant="flat" className="p-6 text-center text-sm font-medium text-ink-500">
                        No active requisitions yet.
                      </Card>
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
                             <Badge tone="brand">
                               {job.matches} High Matches
                             </Badge>
                             <div className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">
                               {job.status}
                             </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
               </Card>
            </motion.div>

            {/* Shortlisted Candidates */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
               <Card variant="frosted" className="h-full rounded-xl3 p-6 sm:p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <Heading as="h2" className="text-xl">Top Shortlists</Heading>
                      <p className="text-sm text-ink-500 mt-1 font-medium">Candidates with &gt;85% Fit Score for active roles</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-x-auto">
                    {(shortlist ?? []).length === 0 ? (
                      <Card variant="flat" className="p-8 text-center text-sm font-medium text-ink-500">
                        No shortlisted candidates yet.
                      </Card>
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
            </motion.div>
          </div>
        </motion.div>
      </PageShell>
    </div>
  );
}
