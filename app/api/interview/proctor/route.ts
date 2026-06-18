import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/session-store";
import { getPrincipal, unauthorized, forbidden } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";

export const runtime = "nodejs";

// Server-authoritative proctoring sink. The client reports each violation /
// successful face check here; the SERVER owns the count and the blocked state,
// so a page reload can no longer reset the candidate's violation tally (the #1
// audit finding — proctoring previously lived only in client React state).
const MAX_VIOLATIONS = 3;
const MAX_REASON = 300;

type Body = {
  sessionId?: string;
  event?: "violation" | "verified";
  reason?: string;
};

export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  const limited = enforceRateLimit(req, { uid, limit: 60, windowMs: 60000, scope: "interview-proctor" });
  if (limited) return limited;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof body.sessionId !== "string" || !body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  if (body.event !== "violation" && body.event !== "verified") {
    return NextResponse.json({ error: "event must be 'violation' or 'verified'" }, { status: 400 });
  }
  const reason =
    typeof body.reason === "string" ? body.reason.slice(0, MAX_REASON) : "unspecified";

  const session = await getSession(body.sessionId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.ownerUid !== uid) return forbidden();

  if (body.event === "verified") {
    await updateSession(body.sessionId, { faceVerified: true });
    return NextResponse.json({ ok: true, faceVerified: true });
  }

  // event === "violation"
  const proctorViolations = (session.proctorViolations || 0) + 1;
  const blocked = proctorViolations >= MAX_VIOLATIONS || session.blocked;
  await updateSession(body.sessionId, { proctorViolations, blocked });
  logger.info("[proctor] violation", { uid, sessionId: body.sessionId, proctorViolations, blocked, reason: isProd ? undefined : reason });

  return NextResponse.json({ ok: true, proctorViolations, blocked, max: MAX_VIOLATIONS });
}
