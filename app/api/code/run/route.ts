import { NextRequest, NextResponse } from "next/server";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";
import { runCode, isSupportedLanguage } from "@/lib/code-exec";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CODE = 50_000;
const MAX_STDIN = 10_000;

export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  const limited = enforceRateLimit(req, { uid, limit: 30, windowMs: 60_000, scope: "code-run" });
  if (limited) return limited;

  let body: { language?: string; code?: string; stdin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const langId = String(body.language || "").trim().toLowerCase();
  const code = String(body.code ?? "");
  const stdin = String(body.stdin ?? "");

  if (!isSupportedLanguage(langId)) return NextResponse.json({ ok: false, error: `Language "${langId}" is not supported.` }, { status: 400 });
  if (!code.trim()) return NextResponse.json({ ok: false, error: "Write some code first." }, { status: 422 });
  if (code.length > MAX_CODE) return NextResponse.json({ ok: false, error: "Code is too long." }, { status: 400 });
  if (stdin.length > MAX_STDIN) return NextResponse.json({ ok: false, error: "Input is too long." }, { status: 400 });

  try {
    const r = await runCode(langId, code, stdin);
    if (r.timedOut) return NextResponse.json({ ok: false, error: "Code execution timed out." }, { status: 504 });
    return NextResponse.json({
      ok: true,
      language: langId,
      stdout: r.stdout,
      stderr: r.stderr,
      output: r.stdout + r.stderr,
      exitCode: r.exitCode,
      signal: null,
      compileError: r.compileError,
    });
  } catch (e: any) {
    logger.error("code-run error", { uid, detail: (e?.detail || e?.message)?.slice?.(0, 200) });
    return NextResponse.json(
      { ok: false, error: "Code runner is unavailable.", ...(isProd ? {} : { detail: (e?.detail || e?.message)?.slice?.(0, 200) }) },
      { status: 502 }
    );
  }
}
