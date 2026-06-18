import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-store";
import { getPrincipal, unauthorized, forbidden } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId || typeof sessionId !== "string" || sessionId.length > 200) {
    return NextResponse.json({ error: "sessionId query parameter is required" }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.ownerUid !== uid) {
    return forbidden();
  }

  return NextResponse.json({
    ok: true,
    sessionId: session.sessionId,
    studentId: session.studentId,
    role: session.role,
    mode: session.mode,
    turnIndex: session.turnIndex,
    isDone: session.isDone,
    transcript: session.transcript.map((t) => ({
      role: t.role,
      content: t.content,
      timestamp: t.timestamp,
    })),
    rubricScores: session.rubricScores,
    recruiterNotes: session.recruiterNotes,
    followUpNeeded: session.followUpNeeded,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
}