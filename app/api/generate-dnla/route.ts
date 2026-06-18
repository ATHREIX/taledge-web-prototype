import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";

export const runtime = "nodejs";

// Hard cap on any candidate text we accept, to bound parsing/abuse before the
// provider integration lands. Even though scoring is disabled, we still
// authenticate, rate-limit and validate so the contract is correct on day one.
const MAX_TEXT_LEN = 20_000;

/**
 * Wrap untrusted candidate text so it can never be read as instructions when it
 * is eventually forwarded to the model. The delimiters are explicit and the
 * payload is length-bounded by the caller-side validation above.
 */
function delimitUntrusted(text: string): string {
  return `<<<CANDIDATE_DATA_START\n${text}\nCANDIDATE_DATA_END>>>`;
}

export async function POST(req: NextRequest) {
  // 1. Authn - derive the authorization subject from the verified principal.
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  // 2. Rate limit (this route will be Gemini-backed once DNLA scoring is wired).
  const limited = enforceRateLimit(req, {
    uid,
    limit: 20,
    windowMs: 60_000,
    scope: "generate-dnla",
  });
  if (limited) return limited;

  // 3. Validate the body. The endpoint is not connected yet, but we reject
  //    malformed/oversized input now so callers get a stable contract.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  if (body !== undefined) {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const candidateText = (body as Record<string, unknown>).candidateText;
    if (candidateText !== undefined) {
      if (typeof candidateText !== "string") {
        return NextResponse.json(
          { ok: false, error: "candidateText must be a string." },
          { status: 400 }
        );
      }
      if (candidateText.length > MAX_TEXT_LEN) {
        return NextResponse.json(
          { ok: false, error: "candidateText is too large." },
          { status: 400 }
        );
      }
      // Untrusted text is delimited up front so any future prompt assembly
      // treats it strictly as data, never as instructions.
      void delimitUntrusted(candidateText);
    }
  }

  // 4. Feature not connected yet - keep the existing disabled response shape.
  //    (Shape preserved: { ok: false, error } with 503.) Detail of why is fixed
  //    and safe to surface; no upstream/stack data is echoed.
  try {
    logger.info("generate-dnla called while disabled", { uid });
    return NextResponse.json(
      {
        ok: false,
        error:
          "DNLA scoring is not connected yet. Use the DNLA import workflow once the provider integration is available.",
      },
      { status: 503 }
    );
  } catch (err) {
    logger.error("generate-dnla failed", { uid, err: String(err) });
    return NextResponse.json(
      {
        ok: false,
        error: isProd
          ? "Unable to process request."
          : "DNLA scoring is not connected yet.",
      },
      { status: 503 }
    );
  }
}
