import { notFound } from "next/navigation";
import { getCoach } from "@/lib/data";
import { AUTH_ENFORCED } from "@/lib/flags";
import CoachDashboard from "./CoachDashboard";

export default async function CoachPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Demo mode is openly browsable, so only KNOWN seeded coaches may render -
  // a bogus id must 404 (not show a generic dashboard). Under enforced auth the
  // middleware already requires a logged-in user to reach this page, so a real
  // coach's own uid-keyed workspace is allowed even though it isn't in the
  // static seed registry (their record is created at sign-up).
  if (!AUTH_ENFORCED && !getCoach(id)) notFound();

  return <CoachDashboard coachId={id} />;
}
