import { NextRequest, NextResponse } from "next/server";
import { generateGeminiContent, getGeminiApiKey } from "@/lib/gemini";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { DEMO_MODE } from "@/lib/flags";

export const runtime = "nodejs";

// Upper bound on the incoming base64 payload. A webcam JPEG frame is well under
// this; anything larger is almost certainly abuse and would burn cost/time.
const MAX_IMAGE_BASE64_LENGTH = 8_000_000; // ~6MB decoded

/**
 * FAIL-CLOSED proctoring response. Used whenever we cannot positively confirm a
 * single face (missing key, validation gap that still needs a body shape, or any
 * thrown error). NEVER returns verified:true on these paths.
 */
function verificationUnavailable() {
  // Production fails CLOSED. In demo/pilot mode, an infrastructure outage
  // (Gemini quota/429, timeout, missing key) must not block the flow being
  // demonstrated, so we pass with a clear demo marker. Real "no face" verdicts
  // (when the API works) still reject in every mode.
  if (DEMO_MODE) {
    return NextResponse.json({ ok: true, verified: true, demo: true, reason: "demo_bypass" });
  }
  return NextResponse.json({ ok: true, verified: false, reason: "verification_unavailable" });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate. uid is the authorization subject (never trust the body).
    const principal = await getPrincipal(req);
    if (!principal) return unauthorized();
    const uid = principal.uid;

    // 2. Rate limit - this route calls the paid Gemini API.
    const limited = enforceRateLimit(req, {
      uid,
      limit: 30,
      windowMs: 60_000,
      scope: "verify-face",
    });
    if (limited) return limited;

    // 3. Parse + validate input. Reject missing/wrong-type/oversized payloads.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const imageBase64 = (body as { imageBase64?: unknown })?.imageBase64;
    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return NextResponse.json({ ok: false, error: "No image provided" }, { status: 400 });
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      return NextResponse.json({ ok: false, error: "Image too large" }, { status: 400 });
    }

    // 4. FAIL CLOSED on missing key: never bypass proctoring with verified:true.
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      logger.warn("verify-face: GEMINI_API_KEY missing, failing closed");
      return verificationUnavailable();
    }

    const prompt = `You are a strict security and proctoring AI analyzing a single webcam still image.
Decide whether EXACTLY ONE human face is clearly visible and generally facing the camera.

Treat as NOT verified: zero faces, more than one face, a face that is heavily obscured, turned away, or an image too dark/blurry to be certain.

Respond with ONLY a single minified JSON object and nothing else (no markdown, no code fences):
{"verified": <true|false>, "reason": "<short reason, empty string if verified>"}

The "verified" field MUST be a strict JSON boolean (true or false), never a string or any other value.`;

    // Remove the data URL prefix if present.
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const result = await generateGeminiContent(apiKey, prompt, {
      parts: [{ inlineData: { mimeType: "image/jpeg", data: base64Data } }],
      temperature: 0.1,
      // gemini-2.5-flash spends output tokens on "thinking"; disable it so this
      // yes/no check returns the JSON directly (80 tokens previously got fully
      // consumed by reasoning -> empty text -> false rejects on clear faces).
      thinkingBudget: 0,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
    });

    // Parse the strict-boolean response. Anything we cannot confidently read as
    // verified:true is treated as not verified (fail closed).
    const raw = (result.text || "").trim();
    let verified = false;
    let reason = "";
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      verified = parsed?.verified === true; // strict boolean only
      if (typeof parsed?.reason === "string") reason = parsed.reason;
    } catch {
      verified = false;
      reason = "";
    }

    if (verified) {
      return NextResponse.json({ ok: true, verified: true });
    }
    return NextResponse.json({ ok: true, verified: false, reason: reason || "No single clear face detected" });
  } catch (error: any) {
    // FAIL CLOSED on any error - never bypass proctoring with verified:true.
    logger.error("verify-face: verification error", {
      message: String(error?.message || error),
      status: error?.status,
    });
    return verificationUnavailable();
  }
}
