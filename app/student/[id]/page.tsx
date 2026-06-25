import { getStudent } from "@/lib/data";
import { getCandidate } from "@/lib/talent-store";
import DashboardClient from "./dashboard-client";

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = getStudent(id);
  // Prefer the durable talent-store record (a real or invited candidate with
  // live assessment results) over the seed fallback, so a recruiter's "View
  // candidate" - and the candidate's own dashboard - shows the ACTUAL person
  // and scores, not a hollow all-zero "New Candidate". Deep-merge `fit` so any
  // pending sub-score still has a number (the base 0s) and `dnla` stays an array.
  const stored = await getCandidate(id);
  const s = stored
    ? { ...base, ...stored, fit: { ...base.fit, ...(stored.fit ?? {}) }, dnla: stored.dnla ?? base.dnla }
    : base;

  return <DashboardClient student={s} />;
}
