"use client";

import React from "react";
import { motion } from "framer-motion";
import { ScoreRing, Sparkline } from "@/components/score-ring";
import {
  PageShell,
  PageHeader,
  Card,
  Badge,
  Heading,
  Eyebrow,
  Stat,
} from "@/components/ui";
import { containerVariants, itemVariants } from "@/lib/motion";

type Tone = "dark" | "success" | "warn" | "danger";

/** Simple, design-system-consistent empty state for missing/empty data. */
function EmptyState({ message }: { message: string }) {
  return (
    <Card variant="flat" className="p-6 text-center">
      <p className="text-sm text-ink-500">{message}</p>
    </Card>
  );
}

export default function ExamClient({
  e,
  stressTrend,
  consistencyDelta,
  stressDelta,
  riskLevel,
  scoreTone,
  context,
  interventions,
  scoreInputs,
  progress,
}: any) {
  // Guard every collection the page maps over so an unknown/partial aspirant
  // (getExam returns empty arrays for unknown ids) renders a graceful empty
  // state instead of crashing or leaving a blank region.
  const safeScoreInputs = Array.isArray(scoreInputs) ? scoreInputs : [];
  const safeDemands = Array.isArray(context?.demands) ? context.demands : [];
  const safeRisks = Array.isArray(e?.risks) ? e.risks : [];
  const safeInterventions = Array.isArray(interventions) ? interventions : [];
  const safeProgress = Array.isArray(progress) ? progress : [];
  const safeConsistencyTrend = Array.isArray(e?.consistencyTrend) ? e.consistencyTrend : [];
  const safeStressTrend = Array.isArray(stressTrend) ? stressTrend : [];
  const safeStudyHoursTrend = Array.isArray(e?.studyHoursTrend) ? e.studyHoursTrend : [];

  return (
    <PageShell>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">

        {/* Header Section */}
        <motion.header variants={itemVariants} className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex items-center gap-6">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              aria-hidden="true"
              className="w-20 h-20 md:w-24 md:h-24 rounded-xl3 bg-white/80 border border-ink-200/60 flex items-center justify-center text-3xl shadow-panel backdrop-blur-xl"
            >
              {e.avatar}
            </motion.div>
            <PageHeader
              className="mb-0"
              eyebrow="Competitive Exam Track"
              title={e.name}
              description={
                <span className="flex flex-wrap gap-3">
                  <span className="text-ink-700 font-medium">{e.exam}</span>
                  <span aria-hidden="true">•</span>
                  <span>Attempt {e.attempt}</span>
                  <span aria-hidden="true">•</span>
                  <span>{e.monthsPreparing} months in</span>
                </span>
              }
              actions={
                <div className="flex flex-wrap gap-3">
                  <Badge tone="warn">DNLA pending</Badge>
                  <Badge tone={riskLevel === "Priority" ? "danger" : riskLevel === "Monitor" ? "warn" : "success"}>
                    {riskLevel} support
                  </Badge>
                </div>
              }
            />
          </div>
        </motion.header>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Success Potential - Main Card */}
          <motion.div variants={itemVariants} className="md:col-span-5 lg:col-span-4">
            <Card variant="frosted" hover className="p-8 relative overflow-hidden group h-full">
              <Heading as="h2" className="text-lg font-medium text-ink-700 mb-6">Success Potential</Heading>
              <div
                className="flex justify-center transform group-hover:scale-105 transition-transform duration-500"
                role="img"
                aria-label={`Success potential score ${e.successPotential} percent for ${e.exam}`}
              >
                <ScoreRing
                  value={e.successPotential}
                  size={220}
                  stroke={16}
                  label="Score"
                  sub={e.exam}
                  tone={scoreTone}
                />
              </div>
              <div className="mt-8 space-y-4">
                {safeScoreInputs.length === 0 ? (
                  <EmptyState message="Score factors are not available yet." />
                ) : (
                  safeScoreInputs.map((input: any, i: number) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-600">{input.label}</span>
                        <span className="text-ink-900 font-medium">{input.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${input.value}%` }}
                          transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                          className={`h-full rounded-full ${
                            input.value >= 70 ? 'bg-emerald-500' : input.value >= 55 ? 'bg-brand-500' : 'bg-rose-500'
                          }`}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </motion.div>

          {/* Middle Column */}
          <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-6">

            {/* Context Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div variants={itemVariants} className="h-full">
                <Card variant="frosted" className="p-8 group bg-gradient-to-br from-brand-500/10 to-accent-500/10 hover:border-brand-500/30 transition-colors h-full">
                  <Eyebrow className="mb-2">Exam Profile</Eyebrow>
                  <div className="text-2xl font-bold text-ink-900 mb-2">{context?.title}</div>
                  <p className="text-sm text-ink-500 leading-relaxed mb-6">{context?.summary}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Card variant="default" className="p-4 rounded-xl2">
                      <Stat label="Cadence" value={context?.cadence} />
                    </Card>
                    <Card variant="default" className="p-4 rounded-xl2">
                      <Stat label="Review" value="Weekly" />
                    </Card>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants} className="h-full">
                <Card variant="frosted" className="p-8 h-full">
                  <Eyebrow className="mb-6">Preparation Demands</Eyebrow>
                  <div className="space-y-4">
                    {safeDemands.length === 0 ? (
                      <EmptyState message="No preparation demands recorded yet." />
                    ) : (
                      safeDemands.map((demand: any, i: number) => (
                        <div key={i} className="flex flex-col gap-1 p-3 rounded-xl2 hover:bg-white/60 transition-colors">
                          <div className="flex justify-between items-center">
                            <span className="text-ink-700 font-medium">{demand.label}</span>
                            <span className="text-xs px-2 py-1 rounded-md bg-ink-100 text-ink-600">{demand.value}</span>
                          </div>
                          <span className="text-xs text-ink-500">{demand.detail}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* Trends Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <TrendWidget title="Study Consistency" data={safeConsistencyTrend} delta={consistencyDelta} suffix="pts" positiveGood={true} />
              <TrendWidget title="Stress Index" data={safeStressTrend} delta={stressDelta} suffix="pts" positiveGood={false} />
              <TrendWidget title="Daily Hours" data={safeStudyHoursTrend} delta={0} suffix="h" isHours />
            </div>
          </div>

        </div>

        {/* Bottom Section - Interventions & Risks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Card variant="frosted" className="p-8 h-full">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <Eyebrow className="mb-2">Action Plan</Eyebrow>
                  <Heading as="h2" className="text-2xl font-bold text-ink-900">Counsellor interventions and roadmap</Heading>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {safeInterventions.length === 0 ? (
                  <div className="md:col-span-2">
                    <EmptyState message="No interventions have been planned yet." />
                  </div>
                ) : (
                  safeInterventions.map((item: any, i: number) => (
                    <motion.div whileHover={{ y: -4 }} key={i}>
                      <Card variant="flat" className="p-6 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-4">
                          <Badge tone={item.tone}>{item.priority}</Badge>
                          <span className="text-xs text-ink-500">{item.review}</span>
                        </div>
                        <h4 className="text-lg font-semibold text-ink-800 mb-2">{item.title}</h4>
                        <p className="text-sm text-ink-500 flex-grow mb-4">{item.detail}</p>
                        <div className="pt-4 border-t border-ink-200/50 flex justify-between text-xs">
                          <span className="text-ink-500">Owner: <span className="text-ink-700">{item.owner}</span></span>
                        </div>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card variant="frosted" className="p-8 flex flex-col h-full">
              <Eyebrow className="mb-2">Risk Patterns</Eyebrow>
              <Heading as="h2" className="text-xl font-bold text-ink-900 mb-6">Non-clinical indicators</Heading>

              <div className="flex-grow space-y-4">
                {safeRisks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 rounded-xl2 border border-emerald-200 bg-emerald-50">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3" aria-hidden="true">
                      <div className="w-6 h-6 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <p className="text-sm text-emerald-700">No critical risks detected. Trajectory is stable.</p>
                  </div>
                ) : (
                  safeRisks.map((r: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl2 bg-rose-50 border border-rose-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">{r.severity}</span>
                        <span className="text-xs text-ink-500">{r.detected}</span>
                      </div>
                      <div className="text-sm font-medium text-ink-800">{r.label}</div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Workflow Journey */}
        <motion.div variants={itemVariants}>
          <Card variant="frosted" className="p-8 overflow-x-auto hidden-scrollbar">
            <Heading as="h2" className="text-xl font-bold text-ink-900 mb-8">Phase 1 Operating Flow</Heading>
            {safeProgress.length === 0 ? (
              <EmptyState message="No workflow steps to display." />
            ) : (
              <div className="flex gap-4 min-w-max">
                {safeProgress.map((step: any, i: number) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`flex flex-col p-5 rounded-xl2 border w-64 ${step.state === 'Complete' ? 'bg-emerald-50 border-emerald-200' : step.state === 'Active' || step.state === 'Tracking' ? 'bg-brand-50 border-brand-200' : 'bg-white/80 border-ink-200/60'}`}>
                      <div className="flex justify-between items-center mb-4">
                        <div className="w-8 h-8 rounded-full bg-ink-100 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                        <Badge tone={step.tone}>{step.state}</Badge>
                      </div>
                      <div className="text-sm font-medium text-ink-700">{step.label}</div>
                    </div>
                    {i < safeProgress.length - 1 && (
                      <div className="w-8 h-[2px] bg-ink-200" aria-hidden="true" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

      </motion.div>
    </PageShell>
  );
}

function TrendWidget({ title, data, delta, suffix, positiveGood = true, isHours = false }: any) {
  const series = Array.isArray(data) ? data : [];
  const isPositive = delta >= 0;
  const isGood = isHours ? true : positiveGood ? isPositive : !isPositive;

  if (series.length === 0) {
    return (
      <motion.div variants={itemVariants}>
        <Card variant="frosted" className="p-6 flex flex-col justify-between h-full">
          <div className="text-sm text-ink-500 font-medium mb-4">{title}</div>
          <p className="text-sm text-ink-500">No trend data available yet.</p>
        </Card>
      </motion.div>
    );
  }

  const last = series[series.length - 1];

  return (
    <motion.div variants={itemVariants} whileHover={{ y: -4 }}>
      <Card variant="frosted" className="p-6 flex flex-col justify-between h-full">
        <div className="text-sm text-ink-500 font-medium mb-4">{title}</div>
        <div className="flex items-end gap-3 mb-6">
          <span className="text-4xl font-bold text-ink-900 tracking-tight">{last}{suffix}</span>
          {!isHours && (
            <span className={`text-sm font-semibold mb-1 ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isPositive ? '+' : ''}{delta}
            </span>
          )}
        </div>
        <div
          className="h-16 w-full"
          role="img"
          aria-label={`${title} trend, latest value ${last}${suffix}${isHours ? '' : `, change ${isPositive ? '+' : ''}${delta}`}`}
        >
          <Sparkline data={series} tone={isGood ? "success" : "warn"} />
        </div>
      </Card>
    </motion.div>
  );
}
