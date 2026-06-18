"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Badge,
  Heading,
  Eyebrow,
  Stat,
} from "@/components/ui";
import { containerVariants, itemVariants } from "@/lib/motion";

// Mock data for Behavioural Risk Patterns (Burnout Trends)
const burnoutTrends = [
  { month: "Jan", riskLevel: 30 },
  { month: "Feb", riskLevel: 45 },
  { month: "Mar", riskLevel: 60 },
  { month: "Apr", riskLevel: 85 }, // Peak exam stress
  { month: "May", riskLevel: 50 },
  { month: "Jun", riskLevel: 40 },
];

const atRiskStudents = [
  { id: 1, name: "Liam O'Connor", risk: 92, status: "Critical Intervention", trend: "up" },
  { id: 2, name: "Emma Watson", risk: 85, status: "High Risk", trend: "up" },
  { id: 3, name: "Noah Patel", risk: 78, status: "Moderate Risk", trend: "down" },
  { id: 4, name: "Olivia Kim", risk: 75, status: "Moderate Risk", trend: "same" },
];

export default function ExamInstituteDashboard() {
  return (
    <div className="relative min-h-screen w-full flex">
      {/* Sidebar Mock */}
      <div className="relative z-10 w-64 border-r border-ink-200/60 bg-white/60 backdrop-blur-xl hidden md:flex flex-col p-6 shadow-panel">
        <div className="flex items-center gap-3 mb-12">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 text-white font-bold shadow-md">
            EI
          </div>
          <span className="font-bold text-lg tracking-tight leading-tight">Exam<br/>Institute</span>
        </div>
        <nav className="space-y-3 flex-1">
          {["Dashboard", "Batches", "Risk Patterns", "Interventions", "Settings"].map((item, i) => (
            <button
              key={item}
              type="button"
              aria-current={i === 0 ? "page" : undefined}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                i === 0
                  ? "bg-brand-50 border border-brand-100 text-brand-700 shadow-sm"
                  : "text-ink-500 hover:bg-ink-50 hover:text-ink-900 border border-transparent"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 h-screen overflow-y-auto overflow-x-hidden">
        <PageShell>
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
                    Exam <span className="text-gradient-brand">Dashboard</span>
                  </>
                }
                description="Monitor student well-being and identify critical burnout trends."
                actions={
                  <>
                    <Button type="button" variant="ghost" className="rounded-full">
                      Export Data
                    </Button>
                    <Button type="button" variant="primary" className="rounded-full">
                      Schedule Intervention
                    </Button>
                  </>
                }
              />
            </motion.div>

            {/* Top Stats */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: "Total Exam Cohort", value: "8,450", trend: "+2.1%", positive: true },
                { label: "High Burnout Risk", value: "412", trend: "+14%", positive: false },
                { label: "Avg Stress Index", value: "68/100", trend: "-5%", positive: true },
              ].map((stat, i) => (
                <Card key={i} variant="frosted" hover className="p-6">
                  <Stat
                    label={stat.label}
                    value={stat.value}
                    sub={
                      <span className={`font-bold ${stat.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {stat.trend}
                      </span>
                    }
                  />
                </Card>
              ))}
            </motion.div>

            {/* Behavioural Risk Patterns & At-Risk List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              {/* Burnout Trends Bar Chart */}
              <motion.div variants={itemVariants} className="flex flex-col">
                <Card variant="frosted" className="flex-1 rounded-xl3 p-8 lg:p-10 flex flex-col">
                  <div className="mb-8">
                    <Eyebrow className="mb-2">Analytics</Eyebrow>
                    <Heading as="h2" className="text-2xl mb-1">Behavioural Risk Patterns</Heading>
                    <p className="text-sm font-medium text-ink-500">Aggregate Burnout Trends (Last 6 Months)</p>
                  </div>

                  {(burnoutTrends?.length ?? 0) === 0 ? (
                    <Card variant="flat" className="flex-1 flex items-center justify-center p-8 text-center">
                      <p className="text-sm font-medium text-ink-500">No burnout trend data available yet.</p>
                    </Card>
                  ) : (
                    <div
                      role="img"
                      aria-label={`Aggregate burnout risk trends over the last 6 months: ${burnoutTrends
                        .map((t) => `${t.month} ${t.riskLevel}%`)
                        .join(", ")}.`}
                      className="flex-1 flex items-end gap-4 h-64 mt-auto"
                    >
                      {burnoutTrends.map((trend, i) => {
                        const isHigh = trend.riskLevel >= 75;
                        const colorClass = isHigh
                          ? "from-rose-500 to-rose-400 shadow-rose-500/30"
                          : "from-brand-600 to-accent-500 shadow-brand-500/30";
                        return (
                          <div key={trend.month} className="flex-1 flex flex-col items-center group/bar cursor-pointer">
                            <div className="relative w-full flex justify-center h-full items-end pb-2">
                              <motion.div
                                className={`w-10 sm:w-12 rounded-xl bg-gradient-to-t ${colorClass} shadow-lg transition-transform hover:-translate-y-1`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: `${trend.riskLevel}%`, opacity: 1 }}
                                transition={{ duration: 0.8, delay: 0.2 + i * 0.1, type: "spring", bounce: 0.3 }}
                              >
                                <div className="opacity-0 group-hover/bar:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-ink-900 text-white text-xs font-bold py-1.5 px-3 rounded-lg pointer-events-none transition-opacity">
                                  {trend.riskLevel}%
                                </div>
                              </motion.div>
                            </div>
                            <div className="text-sm font-bold text-ink-500 mt-2">{trend.month}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </motion.div>

              {/* At-Risk Students List */}
              <motion.div variants={itemVariants} className="flex flex-col">
                <Card variant="frosted" className="flex-1 rounded-xl3 p-8 lg:p-10 flex flex-col">
                  <div className="mb-8 flex justify-between items-end">
                    <div>
                      <Eyebrow className="mb-2">Interventions</Eyebrow>
                      <Heading as="h2" className="text-2xl mb-1">Critical Watchlist</Heading>
                      <p className="text-sm font-medium text-ink-500">Students requiring immediate intervention</p>
                    </div>
                    <Button type="button" variant="link" className="text-sm">
                      View All →
                    </Button>
                  </div>

                  {(atRiskStudents?.length ?? 0) === 0 ? (
                    <Card variant="flat" className="flex-1 flex items-center justify-center p-8 text-center">
                      <p className="text-sm font-medium text-ink-500">No students currently flagged for intervention.</p>
                    </Card>
                  ) : (
                  <div className="space-y-5 flex-1">
                    {atRiskStudents.map((student, i) => (
                      <motion.div
                        key={student.id}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                      >
                        <Card
                          variant="flat"
                          hover
                          className="group/item flex items-center gap-4 p-4 cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full bg-ink-200 flex items-center justify-center font-bold text-ink-600 text-sm">
                            {student.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className="font-bold text-ink-900 truncate">{student.name}</h4>
                              <Badge tone="danger">{student.status}</Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="h-2 flex-1 bg-ink-200 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-brand-600 to-rose-500 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${student.risk}%` }}
                                  transition={{ duration: 1, delay: 0.8 + i * 0.1 }}
                                />
                              </div>
                              <span className="text-xs font-bold text-ink-600 w-8">{student.risk}%</span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                  )}
                </Card>
              </motion.div>
            </div>

          </motion.div>
        </PageShell>
      </div>
    </div>
  );
}
