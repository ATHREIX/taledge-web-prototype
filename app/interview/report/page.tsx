"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  PageShell,
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  Heading,
  Eyebrow,
  Stat,
} from "@/components/ui";
import { containerVariants, itemVariants } from "@/lib/motion";

interface Report {
  candidateName: string;
  targetRole: string;
  skills: string[];
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  strengths: string[];
  areasForImprovement: string[];
  recommendation: string;
  summary: string;
  detailedFeedback: string;
  answers: string[];
  generatedAt: number;
}

type ScoreTone = "success" | "warn" | "danger";

function scoreTone(score: number): ScoreTone {
  if (score >= 80) return "success";
  if (score >= 60) return "warn";
  return "danger";
}

function recommendationTone(rec: string): "success" | "warn" | "danger" {
  const value = rec.toLowerCase();
  if (value.includes("hire")) return "success";
  if (value.includes("consider")) return "warn";
  return "danger";
}

const scoreBars: Record<ScoreTone, string> = {
  success: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-rose-500",
};

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("interview:report");
    if (saved) {
      try {
        setReport(JSON.parse(saved));
      } catch {
        setReport(null);
      }
    }
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <PageShell width="narrow" className="grid min-h-screen place-items-center text-center">
        <div className="flex items-center gap-3 text-ink-500">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
            aria-hidden="true"
          />
          <span>Loading report...</span>
        </div>
      </PageShell>
    );
  }

  if (!report) {
    return (
      <PageShell width="narrow">
        <PageHeader
          eyebrow="Interview Report"
          title="No report available"
          description="We could not find a saved interview report on this device. Start a new interview to generate one."
          actions={
            <Button type="button" onClick={() => router.push("/interview")}>
              New Interview
            </Button>
          }
        />
        <Card>
          <CardHeader>
            <Heading as="h2" className="text-xl">Nothing to show yet</Heading>
            <p className="mt-2 text-sm text-ink-500">
              Once you complete an AI interview, your scored report will appear here.
            </p>
          </CardHeader>
        </Card>
      </PageShell>
    );
  }

  const skills = report.skills ?? [];
  const strengths = report.strengths ?? [];
  const areasForImprovement = report.areasForImprovement ?? [];
  const answers = report.answers ?? [];

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="AI Interview Report"
        title="Interview Report"
        description={report.targetRole}
        actions={
          <Button type="button" onClick={() => router.push("/interview")}>
            New Interview
          </Button>
        }
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Candidate Info */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Heading as="h1" className="text-2xl">{report.candidateName}</Heading>
                  <p className="mt-1 text-ink-500">{report.targetRole}</p>
                </div>
                <Badge tone={recommendationTone(report.recommendation)}>
                  {report.recommendation}
                </Badge>
              </div>

              {skills.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <Badge key={skill} tone="neutral">{skill}</Badge>
                  ))}
                </div>
              ) : null}
            </CardHeader>
          </Card>
        </motion.div>

        {/* Scores */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <Eyebrow className="mb-4">Performance Scores</Eyebrow>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <ScoreCard label="Overall" score={report.overallScore} />
                <ScoreCard label="Technical" score={report.technicalScore} />
                <ScoreCard label="Communication" score={report.communicationScore} />
                <ScoreCard label="Problem Solving" score={report.problemSolvingScore} />
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Summary */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <Eyebrow className="mb-3">Summary</Eyebrow>
              <p className="leading-relaxed text-ink-600">{report.summary}</p>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Strengths */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <Eyebrow className="mb-3">Strengths</Eyebrow>
              {strengths.length > 0 ? (
                <ul className="space-y-2">
                  {strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                      <span className="text-ink-600">{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">No strengths recorded.</p>
              )}
            </CardHeader>
          </Card>
        </motion.div>

        {/* Areas for Improvement */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <Eyebrow className="mb-3">Areas for Improvement</Eyebrow>
              {areasForImprovement.length > 0 ? (
                <ul className="space-y-2">
                  {areasForImprovement.map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                      <span className="text-ink-600">{a}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">No areas for improvement recorded.</p>
              )}
            </CardHeader>
          </Card>
        </motion.div>

        {/* Detailed Feedback */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <Eyebrow className="mb-3">Detailed Feedback</Eyebrow>
              <p className="leading-relaxed text-ink-600">{report.detailedFeedback}</p>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Answers */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <Eyebrow className="mb-4">Interview Answers</Eyebrow>
              {answers.length > 0 ? (
                <div className="space-y-4">
                  {answers.map((answer, i) => (
                    <div key={i} className="border-l-4 border-brand-500 py-2 pl-4">
                      <div className="mb-1 text-xs text-ink-500">Question {i + 1}</div>
                      <p className="text-sm text-ink-600">{answer}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-500">No answers recorded.</p>
              )}
            </CardHeader>
          </Card>
        </motion.div>
      </motion.div>
    </PageShell>
  );
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  const tone = scoreTone(score);
  return (
    <div className="rounded-xl2 bg-ink-50/60 p-4 text-center">
      <Stat
        className="justify-center"
        label={label}
        value={score}
        tone={tone}
      />
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-200">
        <div
          className={`h-full rounded-full ${scoreBars[tone]}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
