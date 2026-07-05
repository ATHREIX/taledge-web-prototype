import { getExam } from "@/lib/data";
import { getExamAspirant } from "@/lib/talent-store";
import ExamClient from "./ExamClient";

type Tone = "dark" | "success" | "warn" | "danger";

export default async function ExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Seed/blank base, then merge the aspirant's durable stored result (real
  // successPotential/motivation/etc. once they've completed the assessment) so a
  // real aspirant sees their own data instead of a 404 or an all-zero hub.
  const base = getExam(id);
  const stored = await getExamAspirant(id);
  const e = stored ? { ...base, ...stored } : base;

  const last = <T,>(items: T[]) => items[items.length - 1];
  const clamp = (value: number) => Math.min(100, Math.max(0, value));

  // Guard against the empty-trend fallback (getExam returns empty arrays for
  // unknown ids) so derived deltas never become NaN downstream.
  const moodTrend = Array.isArray(e.moodTrend) ? e.moodTrend : [];
  const consistencyTrend = Array.isArray(e.consistencyTrend) ? e.consistencyTrend : [];
  const stressTrend = moodTrend.map((mood, index, items) =>
    clamp(Math.round(e.stressIndex + (items[0] - mood) * 0.55 + (index - items.length + 1) * 0.4))
  );
  const consistencyDelta = consistencyTrend.length
    ? last(consistencyTrend) - consistencyTrend[0]
    : 0;
  const stressDelta = stressTrend.length ? last(stressTrend) - stressTrend[0] : 0;
  const riskLevel =
    e.risks.some((risk) => risk.severity === "high") || e.stressIndex >= 70
      ? "Priority"
      : e.risks.length
        ? "Monitor"
        : "Stable";
  const scoreTone: Tone = e.successPotential >= 70 ? "success" : e.successPotential >= 55 ? "dark" : "danger";
  const context = getExamContext(e.exam);
  const interventions = buildInterventions(e.risks.length, e.consistency, e.stressIndex);
  const scoreInputs = [
    { label: "Motivation readiness", value: e.motivation, weight: "25%" },
    { label: "Consistency reliability", value: e.consistency, weight: "30%" },
    { label: "Resilience capacity", value: e.resilience, weight: "25%" },
    { label: "Stress control", value: 100 - e.stressIndex, weight: "20%" },
  ];
  const progress = [
    { label: "Profile and exam context", state: "Complete", tone: "success" as const },
    { label: "DNLA Success Factor import", state: "Pending", tone: "warn" as const },
    {
      label: "Counselling-led structured interview",
      state: e.risks.length ? "Recommended" : "Ready",
      tone: e.risks.length ? ("danger" as const) : ("success" as const),
    },
    { label: "Intervention plan", state: e.risks.length ? "Active" : "Prepared", tone: "dark" as const },
    { label: "12-week progress review", state: "Tracking", tone: "dark" as const },
  ];

  return (
    <ExamClient
      e={e}
      stressTrend={stressTrend}
      consistencyDelta={consistencyDelta}
      stressDelta={stressDelta}
      riskLevel={riskLevel}
      scoreTone={scoreTone}
      context={context}
      interventions={interventions}
      scoreInputs={scoreInputs}
      progress={progress}
    />
  );
}

function getExamContext(exam: string) {
  if (exam.toLowerCase().includes("upsc")) {
    return {
      title: "Long-cycle civil services preparation",
      summary:
        "Success depends on sustained study rhythm, revision loops, answer-writing discipline, current-affairs retention, and recovery after mock-test setbacks.",
      cadence: "Daily",
      demands: [
        { label: "Syllabus breadth", value: "Very high", detail: "Needs structured revision and source control across GS, optional, essay, and interview prep." },
        { label: "Stress endurance", value: "High", detail: "Risk review is triggered when stress climbs while study consistency falls." },
        { label: "Mock cadence", value: "Weekly", detail: "Counsellor notes should reference mock-test response and recovery latency." },
      ],
    };
  }

  if (exam.toLowerCase().includes("gate")) {
    return {
      title: "Concept-depth technical preparation",
      summary:
        "Success depends on topic mastery, problem-solving speed, revision discipline, and confidence calibration through full-length mocks.",
      cadence: "Daily",
      demands: [
        { label: "Concept depth", value: "High", detail: "Weak topics should be linked to revision blocks and mock-section performance." },
        { label: "Stress endurance", value: "Medium", detail: "Review if stress rises before mock-heavy weeks or final revision cycles." },
        { label: "Mock cadence", value: "2x/week", detail: "Use structured post-mock reflection to separate knowledge gaps from pressure errors." },
      ],
    };
  }

  return {
    title: "Adaptive test-readiness preparation",
    summary:
      "Success depends on consistent practice, error-log quality, timing discipline, and confidence management across adaptive test sections.",
    cadence: "5 days/wk",
    demands: [
      { label: "Practice quality", value: "High", detail: "Error logs and section timing should drive each intervention." },
      { label: "Stress endurance", value: "Medium", detail: "Monitor stress spikes around score plateaus and retake decisions." },
      { label: "Mock cadence", value: "Weekly", detail: "Map counsellor review to mock accuracy, pacing, and recovery." },
    ],
  };
}

function buildInterventions(riskCount: number, consistency: number, stressIndex: number) {
  return [
    {
      priority: riskCount || stressIndex > 65 ? "Priority" : "Maintain",
      tone: riskCount || stressIndex > 65 ? ("danger" as const) : ("dark" as const),
      review: "7 days",
      title: stressIndex > 65 ? "Stress reset protocol" : "Stress maintenance check",
      detail:
        stressIndex > 65
          ? "Create a short daily reset routine, reduce late-night study load, and add counsellor check-in notes after mocks."
          : "Keep stress check-ins lightweight and review only when there is a sustained upward trend.",
      owner: "Counsellor",
      metric: stressIndex > 65 ? "Stress index below 60" : "Stable stress band",
    },
    {
      priority: consistency < 65 ? "Priority" : "Track",
      tone: consistency < 65 ? ("warn" as const) : ("dark" as const),
      review: "14 days",
      title: consistency < 65 ? "Consistency rebuild sprint" : "Consistency reinforcement",
      detail:
        consistency < 65
          ? "Convert the timetable into smaller non-negotiable study blocks and log missed-block reasons weekly."
          : "Protect the current routine with weekly review, revision buffers, and mock recovery windows.",
      owner: "Institute mentor",
      metric: "Consistency trend above 70",
    },
    {
      priority: "Planned",
      tone: "dark" as const,
      review: "4 weeks",
      title: "Success Potential review",
      detail:
        "Recompute readiness after the structured counselling interview, weekly trends, and official DNLA Success Factor import are available.",
      owner: "Platform",
      metric: "Updated score with evidence trail",
    },
  ];
}
