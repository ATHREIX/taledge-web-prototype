import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getShareLink, getInstituteRecord, listCandidatesByInstitute, toRecruiterRow } from "@/lib/talent-store";

export const runtime = "nodejs";

/**
 * Resolve a recruiter share token → the institute's scoped candidate pool (§4.6).
 * Intentionally token-authenticated (NOT login-gated): the unguessable, expiring
 * token IS the bearer credential, so an invited recruiter can open the link
 * without a Taledge account. Returns 404 for an unknown/expired token.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getShareLink(token);
  if (!link) {
    return NextResponse.json({ ok: false, error: "This access link is invalid or has expired." }, { status: 404 });
  }
  const inst = await getInstituteRecord(link.instituteId);
  // SHORTLIST: when the link is bound to a hand-picked set, restrict to it.
  const shortlist =
    Array.isArray(link.studentIds) && link.studentIds.length
      ? new Set(link.studentIds)
      : null;
  // CONSENT GATE: only surface candidates who published to recruiters — the same
  // gate the recruiter pool uses. A share token must NOT expose the institute's
  // full cohort incl. unconsented students. One bad record can't 500 the list.
  const candidates = (await listCandidatesByInstitute(link.instituteId))
    .filter((c) => c.publishedToRecruiters === true)
    .filter((c) => (shortlist ? shortlist.has(c.id) : true))
    .flatMap((c) => {
      try { return [toRecruiterRow(c)]; } catch { return []; }
    });
  return NextResponse.json({
    ok: true,
    label: link.label,
    shortlisted: !!shortlist,
    institute: inst ? { id: inst.id, name: inst.name, kind: inst.kind } : null,
    candidates,
  });
}
