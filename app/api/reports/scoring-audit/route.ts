import { NextRequest, NextResponse } from "next/server";
import { getPrincipal, unauthorized, forbidden, principalHasRole } from "@/lib/server-auth";
import { listScoringAudits } from "@/lib/scoring-audit";
import { getCandidate, getExamAspirant, canAdministerInstitute } from "@/lib/talent-store";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * Read the durable scoring-audit ledger for a student — the cross-check data
 * behind every Fit Score: per-question × component matrix, raw-LLM vs computed
 * headlines, drift, flags, transcript snapshot.
 *
 * Authorization mirrors the fit-score GET: the owner, demo mode, a recruiter
 * (role-checked) with a consented/owned candidate, or an institute admin for
 * their own student. The ledger contains full transcripts — never expose it
 * wider than the report itself.
 */
export async function GET(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();

  const url = new URL(req.url);
  const sid = url.searchParams.get("studentId") || "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 5, 1), 20);
  if (!sid) return NextResponse.json({ ok: false, error: "studentId required" }, { status: 400 });

  try {
    const rec = (await getCandidate(sid)) ?? (await getExamAspirant(sid));
    const isRecruiterView =
      !principal.demo &&
      !principal.invite &&
      (await principalHasRole(principal, "recruiter")) &&
      (!!(rec as any)?.publishedToRecruiters || (rec as any)?.recruiterId === principal.uid);
    const readable =
      principal.demo ||
      sid === principal.uid ||
      isRecruiterView ||
      (!principal.demo &&
        !!(rec as any)?.instituteId &&
        (await canAdministerInstitute((rec as any).instituteId, principal.uid, principal.demo)));
    if (!readable) return forbidden();

    const audits = await listScoringAudits(sid, limit);
    return NextResponse.json({ ok: true, audits });
  } catch (e) {
    logger.warn("scoring-audit GET failed", { studentId: sid, err: String(e) });
    return NextResponse.json({ ok: false, error: "Could not load scoring audits." }, { status: 500 });
  }
}
