import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPrincipal, unauthorized, forbidden, principalHasRole } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getShortlist, setShortlist } from "@/lib/talent-store";

export const runtime = "nodejs";

/** Get the authenticated recruiter's shortlisted candidate ids (PRD §4.5). */
export async function GET(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  if (!(await principalHasRole(principal, "recruiter"))) return forbidden("Recruiter access required.");
  const limited = await enforceRateLimit(req, { uid: principal.uid, limit: 60, windowMs: 60_000, scope: "recruiter-shortlist" });
  if (limited) return limited;
  const candidateIds = await getShortlist(principal.uid);
  return NextResponse.json({ ok: true, candidateIds });
}

/** Replace the recruiter's shortlist with the provided candidate ids. */
export async function PUT(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  if (!(await principalHasRole(principal, "recruiter"))) return forbidden("Recruiter access required.");
  const limited = await enforceRateLimit(req, { uid: principal.uid, limit: 60, windowMs: 60_000, scope: "recruiter-shortlist-write" });
  if (limited) return limited;
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }
  const ids = Array.isArray(body.candidateIds) ? body.candidateIds.filter((x: unknown) => typeof x === "string") : [];
  const saved = await setShortlist(principal.uid, ids);
  return NextResponse.json({ ok: true, candidateIds: saved });
}
