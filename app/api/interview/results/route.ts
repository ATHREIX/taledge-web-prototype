import { NextRequest, NextResponse } from "next/server";
import { generateGeminiJson, getGeminiApiKey } from "@/lib/gemini";
import { getSession } from "@/lib/session-store";
import { getPrincipal, unauthorized, forbidden } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { sessionId: string };

function transcriptToText(msgs: any[]): string {
  if (!msgs || msgs.length === 0) return "(no responses)";
  return msgs
    .map((m, i) => `${m.role === "assistant" ? "Q" : "A"}${Math.floor(i / 2) + 1}: ${m.content}`)
    .join("\n");
}

function clampScore(n: any, min = 0, max = 100): number {
  const v = Number(n);
  if (!isFinite(v)) return Math.round((min + max) / 2);
  return Math.max(min, Math.min(max, Math.round(v)));
}

export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  const limited = enforceRateLimit(req, { uid, limit: 20, windowMs: 60000, scope: "interview-results" });
  if (limited) return limited;

  const apiKey = getGeminiApiKey();
  let body: Body;

  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.sessionId || typeof body.sessionId !== "string" || body.sessionId.length > 200) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const session = await getSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.ownerUid !== uid) {
    return forbidden();
  }

  if (!session.isDone) {
    return NextResponse.json(
      {
        ok: false,
        error: "Interview is not complete yet. Keep sending audio until isDone=true.",
        isDone: false,
        turnIndex: session.turnIndex,
      },
      { status: 422 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Interview results service is not configured." },
      { status: 503 }
    );
  }

  const msgs = session.transcript.map((t: any) => ({
    role: t.role as "assistant" | "user",
    content: t.content,
  }));

  const prompt = `You are a senior talent intelligence analyst computing interview results.

Interview session details:
- Candidate role: ${session.role}
- Mode: ${session.mode}
- Resume context: ${session.resumeSummary || "(not provided)"}

Interview transcript:
${transcriptToText(msgs)}

Per-turn rubric scores captured during interview:
${JSON.stringify(session.rubricScores, null, 2)}

Recruiter notes:
${session.recruiterNotes || "(none)"}

CODING: If any answer is marked "[Coding answer · <language>]" with source and an "Execution result", evaluate the code concretely — correctness, efficiency, edge cases, quality, and whether it compiled and produced correct output (a non-zero exit code, stderr, or compile error is a negative signal). Reflect this in technical_score and the narrative, and (only when code was submitted) append a { "group": "Coding Implementation", "rows": [["Correctness", <0-100>], ["Efficiency & complexity", <0-100>], ["Edge cases & code quality", <0-100>]] } group to technical_breakdown.

Compute the final scores:

Return EXACTLY this JSON shape (no markdown fences, no commentary):

{
  "technical_score": <0-100 integer>,
  "behavioural_score": <0-100 integer>,
  "fit_score": <0-100 integer>,
  "success_probability": <0-100 integer>,
  "verdict": "<one short phrase>",
  "narrative": "<3-sentence executive summary>",
  "technical_breakdown": [
    { "group": "<group>", "rows": [["<sub-score label>", <0-100>], ...] }
  ],
  "resume_breakdown": [
    { "group": "<group>", "rows": [["<sub-score label>", <0-100>], ...] }
  ],
  "behavioural_breakdown": [
    { "group": "<group>", "rows": [["<sub-score label>", <0-100>], ...] }
  ],
  "cross_flags": [
    { "label": "<check>", "verdict": "<one-sentence finding>", "tone": "ok" | "warn" | "danger" }
  ]
}

  Strictly valid JSON.`;

  try {
    const { parsed, model } = await generateGeminiJson(apiKey, prompt, {
      maxOutputTokens: 3000,
      temperature: 0.2,
    });

    const generated = {
      technical_score: clampScore(parsed.technical_score),
      behavioural_score: clampScore(parsed.behavioural_score),
      fit_score: clampScore(parsed.fit_score),
      success_probability: clampScore(parsed.success_probability),
      verdict: String(parsed.verdict || "Awaiting verdict").slice(0, 60),
      narrative: String(parsed.narrative || "").slice(0, 800),
      technical_breakdown: Array.isArray(parsed.technical_breakdown)
        ? parsed.technical_breakdown.map((g: any) => ({
            group: String(g.group || ""),
            rows: Array.isArray(g.rows)
              ? g.rows.map((r: any) => [String(r?.[0] || ""), clampScore(r?.[1])])
              : [],
          }))
        : [],
      resume_breakdown: Array.isArray(parsed.resume_breakdown)
        ? parsed.resume_breakdown.map((g: any) => ({
            group: String(g.group || ""),
            rows: Array.isArray(g.rows)
              ? g.rows.map((r: any) => [String(r?.[0] || ""), clampScore(r?.[1])])
              : [],
          }))
        : [],
      behavioural_breakdown: Array.isArray(parsed.behavioural_breakdown)
        ? parsed.behavioural_breakdown.map((g: any) => ({
            group: String(g.group || ""),
            rows: Array.isArray(g.rows)
              ? g.rows.map((r: any) => [String(r?.[0] || ""), clampScore(r?.[1])])
              : [],
          }))
        : [],
      cross_flags: Array.isArray(parsed.cross_flags)
        ? parsed.cross_flags.slice(0, 4).map((f: any) => ({
            label: String(f.label || ""),
            verdict: String(f.verdict || ""),
            tone: ["ok", "warn", "danger"].includes(f.tone) ? f.tone : "warn",
          }))
        : [],
    };

    return NextResponse.json({
      ok: true,
      sessionId: session.sessionId,
      generated,
      source: model,
      meta: { turnCount: session.turnIndex, transcriptLength: session.transcript.length },
    });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    logger.error("interview-results generation failed", {
      sessionId: session.sessionId,
      status,
      detail: e?.upstreamError || e?.rawPreview || e?.message,
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          status === 422
            ? "The model didn't return a parseable report."
            : "Something went wrong while generating results.",
        ...(isProd
          ? {}
          : { detail: e?.upstreamError || e?.rawPreview || e?.message?.slice(0, 200) }),
      },
      { status: status === 422 ? 422 : 502 }
    );
  }
}
