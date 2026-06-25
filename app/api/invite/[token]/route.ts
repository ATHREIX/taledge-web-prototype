import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getInvite, listJobs } from "@/lib/talent-store";

export const runtime = "nodejs";

/**
 * Resolve an off-campus invite token (the credential in the recruiter's link
 * `/onboarding?invite=<token>`) into the job context the recruiter already
 * defined — so onboarding can PREFILL the track + target role + candidate
 * name/email instead of re-asking. The token itself is the access credential;
 * no login is required to read it (onboarding gates sign-in separately).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || typeof token !== "string" || token.length > 128) {
    return NextResponse.json({ ok: false, error: "Invalid invite" }, { status: 400 });
  }

  const invite = await getInvite(token);
  if (!invite) {
    return NextResponse.json({ ok: false, error: "This invite link is invalid or has expired." }, { status: 404 });
  }

  // NOTE: GET is read-only — it must NOT mutate invite state, or a browser
  // prefetch/unfurl/crawl of the link would silently flip "invited" → "started".
  // The invited→started→completed transition happens when the candidate actually
  // submits their assessment (the authenticated generate-fit-score upsert).

  // INSTITUTE cohort invite — bound to a cohort, no recruiter job to read from.
  if (invite.instituteId) {
    return NextResponse.json({
      ok: true,
      token,
      name: invite.name,
      email: invite.email,
      instituteId: invite.instituteId,
      cohort: invite.cohort ?? "",
      recruiterId: "",
      jobId: "",
      track: invite.track ?? ("placement" as const),
      role: "",
      experienceBand: "fresher" as const,
      skills: [] as string[],
      jobTitle: "",
    });
  }

  // RECRUITER invite — the recruiter defined the role/segment on the job; surface it.
  const job = (await listJobs(invite.recruiterId)).find((j) => j.id === invite.jobId);
  return NextResponse.json({
    ok: true,
    token,
    name: invite.name,
    email: invite.email,
    recruiterId: invite.recruiterId,
    jobId: invite.jobId,
    // A recruiter posting is always the placement track (never a competitive exam).
    track: "placement" as const,
    role: job?.title ?? "",
    experienceBand: job?.experience ?? "fresher",
    skills: job?.skills ?? [],
    jobTitle: job?.title ?? "",
  });
}
