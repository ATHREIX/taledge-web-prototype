import { NextRequest, NextResponse } from "next/server";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";

export const runtime = "nodejs";

type ImportBody = {
  studentId?: string;
  track?: "placement" | "exam";
  reportId?: string;
  source?: string;
  competencies?: unknown[];
};

const MAX_STR = 200;
const MAX_COMPETENCIES = 1000;

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(req: NextRequest) {
  // 1. AuthN: derive the authorization subject from the verified principal.
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return badRequest("Request body must be a JSON object");
  }

  const body = raw as ImportBody;

  // 2. Input validation: reject missing / wrong-type / oversized fields.
  if (typeof body.studentId !== "string" || body.studentId.trim().length === 0) {
    return badRequest("studentId is required");
  }
  if (body.studentId.length > MAX_STR) {
    return badRequest("studentId is too long");
  }

  if (typeof body.track !== "string" || !["placement", "exam"].includes(body.track)) {
    return badRequest("track must be 'placement' or 'exam'");
  }

  if (body.reportId !== undefined) {
    if (typeof body.reportId !== "string" || body.reportId.length > MAX_STR) {
      return badRequest("reportId must be a string");
    }
  }

  if (body.source !== undefined) {
    if (typeof body.source !== "string" || body.source.length > MAX_STR) {
      return badRequest("source must be a string");
    }
  }

  if (body.competencies !== undefined) {
    if (!Array.isArray(body.competencies) || body.competencies.length > MAX_COMPETENCIES) {
      return badRequest("competencies must be an array");
    }
  }

  try {
    const studentId = body.studentId.trim();
    const track = body.track as "placement" | "exam";

    return NextResponse.json({
      ok: true,
      status: "queued",
      source: body.source || "dnla-api-pending",
      integration: "provider-contract-pending",
      reportId: body.reportId || `dnla_${studentId}_${Date.now()}`,
      studentId,
      track,
      importedCompetencies: Array.isArray(body.competencies) ? body.competencies.length : 0,
      visibility:
        track === "exam"
          ? "candidate-and-exam-institute-only"
          : "candidate-placement-institute-and-authorized-recruiters",
    });
  } catch (err) {
    logger.error("dnla import failed", {
      uid: principal.uid,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: isProd ? "Import failed" : String(err) },
      { status: 500 }
    );
  }
}
