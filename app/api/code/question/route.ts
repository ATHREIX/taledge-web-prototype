import { NextRequest, NextResponse } from "next/server";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";
import { getGeminiApiKey, generateGeminiJson } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

// A human-appropriate time budget, clamped so a generated estimate can't produce
// a 2-second or 3-hour timer.
const MIN_MINUTES = 5;
const MAX_MINUTES = 45;

export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  const limited = await enforceRateLimit(req, { uid, limit: 15, windowMs: 60_000, scope: "code-question" });
  if (limited) return limited;

  const apiKey = getGeminiApiKey();
  if (!apiKey) return NextResponse.json({ ok: false, error: "Coding-question service is not configured." }, { status: 503 });

  let body: { role?: string; track?: string; difficulty?: string; avoid?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const role = String(body.role || "Software Engineer").slice(0, 200);
  const track = body.track === "exam" ? "exam" : "placement";
  const difficulty = ["easy", "medium", "hard"].includes(String(body.difficulty)) ? String(body.difficulty) : "medium";
  const avoid = Array.isArray(body.avoid) ? body.avoid.filter((s) => typeof s === "string").slice(0, 5) : [];

  const prompt = `Generate ONE self-contained coding problem for a ${difficulty}-difficulty ${role} ${track} interview.

Requirements:
- The candidate solves it by writing a program that READS from standard input (stdin) and PRINTS the answer to standard output (stdout). State the exact input/output format clearly in the problem text.
- Include 1 worked example (sample input -> expected output) inside the problem text.
- Make it solvable in a single source file in any common language.
- Realistic for the role; not a trick puzzle.
- Keep the whole problem statement concise (under ~160 words).
${avoid.length ? `- Do NOT repeat or closely resemble these already-used problems: ${avoid.join("; ")}.` : ""}

Also estimate "minutes": the time a competent candidate would realistically need to read, write, AND test a correct solution (a fair human time budget — typically 10-25 for medium).

Return EXACTLY this JSON (no markdown, no commentary):
{
  "title": "<short problem title, max 60 chars>",
  "prompt": "<full problem statement incl. input/output format and worked example(s)>",
  "minutes": <integer minutes a human needs>
}
Strictly valid JSON.`;

  try {
    const { parsed } = await generateGeminiJson(apiKey, prompt, { maxOutputTokens: 2048, temperature: 0.6, thinkingBudget: 0 });
    const title = String(parsed?.title || "Coding Challenge").slice(0, 80);
    const statement = String(parsed?.prompt || "").slice(0, 4000).trim();
    if (!statement) return NextResponse.json({ ok: false, error: "Could not generate a problem." }, { status: 422 });
    const rawMin = Number(parsed?.minutes);
    const minutes = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Number.isFinite(rawMin) ? Math.round(rawMin) : 15));

    return NextResponse.json({ ok: true, title, prompt: statement, minutes });
  } catch (e: any) {
    const status = Number(e?.status) || 502;
    logger.error("code-question error", { uid, status, detail: (e?.upstreamError || e?.message)?.slice?.(0, 200) });
    return NextResponse.json(
      {
        ok: false,
        error: status === 422 ? "Could not generate a coding problem." : "Coding-question service is unavailable.",
        ...(isProd ? {} : { detail: (e?.upstreamError || e?.message)?.slice?.(0, 200) }),
      },
      { status: status === 422 ? 422 : 502 }
    );
  }
}
