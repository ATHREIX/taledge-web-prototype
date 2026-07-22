import { NextRequest, NextResponse } from "next/server";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { getLatestDnlaForCandidate } from "@/lib/dnla-store";
import { isDnlaConfigured } from "@/lib/dnla-client";
import { isDnlaTestModeConfigured } from "@/lib/dnla-test-tans";

export const runtime = "nodejs";

/**
 * Candidate-facing DNLA status poll. Owner-scoped: a candidate can only read
 * their own assessment. Returns the normalized axis scores once complete, so the
 * DNLA step can flip from "in progress" → done and the Fit Score can consume it.
 */
export async function GET(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();

  const candidateId = req.nextUrl.searchParams.get("candidateId")?.trim();
  if (!candidateId) {
    return NextResponse.json({ ok: false, error: "candidateId is required." }, { status: 400 });
  }

  const session = await getLatestDnlaForCandidate(principal.uid, candidateId);
  const testMode = isDnlaTestModeConfigured();
  const available = testMode || isDnlaConfigured();
  if (!session) {
    return NextResponse.json({
      ok: true,
      status: "none",
      available,
      mode: testMode ? "pre-issued-test" : "live",
    });
  }

  return NextResponse.json({
    ok: true,
    available: true,
    mode: session.source === "pre-issued-test" ? "pre-issued-test" : "live",
    status: session.status, // "pending" | "complete" | "error" | "none"
    startUrl: session.startUrl,
    finishedAt: session.finishedAt ?? null,
    ...(session.status === "complete" && session.normalized
      ? {
          axes: session.normalized.axes,
          baseline: session.normalized.baseline,
          dnla: session.normalized.dnla,
          strengths: session.normalized.strengths,
          developmentAreas: session.normalized.developmentAreas,
          risks: session.normalized.risks,
        }
      : {}),
  });
}
