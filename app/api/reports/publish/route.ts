import { NextRequest, NextResponse } from "next/server";
import { getPrincipal, unauthorized, forbidden } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";

export const runtime = "nodejs";

type PublishBody = {
  studentId?: string;
  reportType?: "fit-score" | "dnla" | "combined";
  audience?: "recruiters" | "institute" | "private";
  consent?: boolean;
};

const MAX_STR = 200;
const REPORT_TYPES = ["fit-score", "dnla", "combined"] as const;
const AUDIENCES = ["recruiters", "institute", "private"] as const;

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(req: NextRequest) {
  // 1. AuthN. The verified principal's uid is the ONLY authorization subject.
  //    Publishing is an action the authenticated user performs on their OWN
  //    report - never trust a body-supplied studentId/consent/paid flag as the
  //    security decision.
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return badRequest("Request body must be a JSON object");
  }

  const body = raw as PublishBody;

  // 2. Input validation - reject missing / wrong-type / oversized fields.
  if (body.studentId !== undefined) {
    if (typeof body.studentId !== "string" || body.studentId.length > MAX_STR) {
      return badRequest("studentId must be a string");
    }
  }

  if (body.reportType !== undefined) {
    if (typeof body.reportType !== "string" || !REPORT_TYPES.includes(body.reportType as any)) {
      return badRequest("reportType must be one of: fit-score, dnla, combined");
    }
  }

  if (body.audience !== undefined) {
    if (typeof body.audience !== "string" || !AUDIENCES.includes(body.audience as any)) {
      return badRequest("audience must be one of: recruiters, institute, private");
    }
  }

  if (body.consent !== undefined && typeof body.consent !== "boolean") {
    return badRequest("consent must be a boolean");
  }

  // 3. Authorization subject. Derive the report owner from the verified uid -
  //    NOT from the client-supplied studentId. In demo mode (no real login)
  //    seeded personas are addressed by the body studentId so they keep working;
  //    with enforced auth, the uid is authoritative and a mismatching
  //    client-supplied studentId is rejected rather than silently honored.
  const claimedStudentId =
    typeof body.studentId === "string" ? body.studentId.trim() : "";

  if (!principal.demo) {
    if (claimedStudentId && claimedStudentId !== uid) {
      return forbidden("You can only publish your own report");
    }
  } else if (!claimedStudentId) {
    return badRequest("studentId is required");
  }

  const subjectId = principal.demo ? claimedStudentId : uid;

  // 4. Consent is a BUSINESS precondition for publishing, not the security
  //    gate. Authorization was already established from uid above; this only
  //    blocks the action when the candidate has not consented.
  if (body.consent !== true) {
    return NextResponse.json(
      { ok: false, error: "Candidate consent is required before publishing" },
      { status: 403 }
    );
  }

  try {
    const reportType = body.reportType || "combined";
    const audience = body.audience || "recruiters";

    logger.info("report published", {
      uid,
      demo: principal.demo,
      subjectId,
      reportType,
      audience,
    });

    // Response shape unchanged: ok/status/studentId/reportType/audience/publishedAt/shareId.
    return NextResponse.json({
      ok: true,
      status: "published",
      studentId: subjectId,
      reportType,
      audience,
      publishedAt: Date.now(),
      shareId: `share_${subjectId}_${Math.random().toString(36).slice(2, 8)}`,
    });
  } catch (err) {
    logger.error("report publish failed", {
      uid,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: isProd ? "Publish failed" : String(err) },
      { status: 500 }
    );
  }
}
