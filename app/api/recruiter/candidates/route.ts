import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPrincipal, unauthorized, forbidden, principalHasRole } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { listRecruiterVisibleCandidates, toRecruiterRow } from "@/lib/talent-store";

export const runtime = "nodejs";

/**
 * Recruiter candidate pool. Returns every candidate as a recruiter table row
 * (fit / tech / behavioural / success / DNLA-ready / flags). The dashboard does
 * its own filtering & sorting client-side, mirroring the prior in-memory pool —
 * but the data is now the durable talent store (seed today, real results once a
 * candidate completes the interview flow), not a hardcoded array.
 */
export async function GET(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  if (!(await principalHasRole(principal, "recruiter"))) return forbidden("Recruiter access required.");
  const limited = await enforceRateLimit(req, { uid: principal.uid, limit: 60, windowMs: 60_000, scope: "recruiter-candidates" });
  if (limited) return limited;

  try {
    // Multi-recruiter isolation + SCALE: an indexed query returns only the
    // GLOBAL published pool (candidates who consented to recruiter visibility)
    // PLUS this recruiter's OWN off-campus invitees — never another recruiter's
    // private pool, and never a full-collection scan.
    const visible = await listRecruiterVisibleCandidates(principal.uid);
    // Per-row guard: a single malformed record is skipped, never fails the list.
    const rows = visible.flatMap((c) => {
      try { return [toRecruiterRow(c)]; } catch { return []; }
    });
    return NextResponse.json({ ok: true, candidates: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Could not load candidates." }, { status: 500 });
  }
}
