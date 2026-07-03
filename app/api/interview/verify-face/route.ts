import { NextRequest, NextResponse } from "next/server";
import { generateGeminiContent, getGeminiApiKey } from "@/lib/gemini";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { getSession, updateSession } from "@/lib/session-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { DEMO_MODE } from "@/lib/flags";

export const runtime = "nodejs";

// Upper bound on the incoming base64 payload. A webcam JPEG frame is well under
// this; anything larger is almost certainly abuse and would burn cost/time.
const MAX_IMAGE_BASE64_LENGTH = 8_000_000; // ~6MB decoded

/**
 * INFRA-UNAVAILABLE proctoring response. Used ONLY when we never got a real
 * verdict from the model: missing key, or a thrown/timed-out call / 429 / 5xx
 * from Gemini. This is DISTINCT from a genuine "no face" verdict (the model
 * answered and said there is no single face) — that path returns
 * `unavailable:false` below. NEVER returns verified:true on these paths in
 * enforced mode.
 */
function verificationUnavailable() {
  // Production fails CLOSED. In demo/pilot mode, an infrastructure outage
  // (Gemini quota/429, timeout, missing key) must not block the flow being
  // demonstrated, so we pass with a clear demo marker. Real "no face" verdicts
  // (when the API works) still reject in every mode.
  if (DEMO_MODE) {
    return NextResponse.json({ ok: true, verified: true, demo: true, reason: "demo_bypass" });
  }
  // Enforced mode: fail closed, but flag this as an INFRA outage
  // (`unavailable:true`) so the client can distinguish a transient Gemini failure
  // from a real no-face verdict and offer a retry instead of hard-blocking every
  // candidate on an outage.
  return NextResponse.json({ ok: true, verified: false, unavailable: true, reason: "verification_unavailable" });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate. uid is the authorization subject (never trust the body).
    const principal = await getPrincipal(req);
    if (!principal) return unauthorized();
    const uid = principal.uid;

    // 2. Rate limit - this route calls the paid Gemini API.
    const limited = await enforceRateLimit(req, {
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
    const sessionId = (body as { sessionId?: unknown })?.sessionId;
    const referenceBase64 = (body as { referenceBase64?: unknown })?.referenceBase64;
    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return NextResponse.json({ ok: false, error: "No image provided" }, { status: 400 });
    }

    /**
     * Persist the passing face check directly on the session (owner-scoped) so
     * the voice endpoint's `faceVerified` gate is satisfied. Previously this
     * relied on a separate fire-and-forget client POST to /api/interview/proctor
     * which, if it raced or failed, left faceVerified=false and 403'd every
     * answer. Doing it here makes verification atomic with the check itself.
     */
    const markFaceVerified = async () => {
      if (typeof sessionId !== "string" || !sessionId) return;
      try {
        const session = await getSession(sessionId);
        if (session && session.ownerUid === uid) {
          await updateSession(sessionId, { faceVerified: true });
        }
      } catch (e) {
        logger.error("verify-face: failed to persist faceVerified", {
          message: String((e as any)?.message || e),
        });
      }
    };
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      return NextResponse.json({ ok: false, error: "Image too large" }, { status: 400 });
    }

    // ── IDENTITY CONTINUITY ─────────────────────────────────────────────────
    // When a reference frame is supplied, compare the CURRENT live frame against
    // the enrolled candidate. Used during the interview to catch a person swap.
    // Fail-OPEN (samePerson:true) on ANY uncertainty/outage so a legitimate
    // candidate is never wrongly terminated — only a CONFIDENT mismatch flags.
    if (typeof referenceBase64 === "string" && referenceBase64.length > 0) {
      if (referenceBase64.length > MAX_IMAGE_BASE64_LENGTH) {
        return NextResponse.json({ ok: true, verified: true, samePerson: true, reason: "reference_too_large" });
      }
      const idKey = getGeminiApiKey();
      if (!idKey) {
        return NextResponse.json({ ok: true, verified: true, samePerson: true, reason: "unavailable" });
      }
      const refData = referenceBase64.replace(/^data:image\/\w+;base64,/, "");
      const curData = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const idPrompt = `You are a strict identity-verification AI for a proctored exam.
You are given a REFERENCE image of the enrolled candidate and a CURRENT live webcam frame.
Decide whether the CURRENT frame shows the SAME person as the REFERENCE.
Report NOT the same person ONLY if the primary face in CURRENT is CLEARLY a DIFFERENT individual (i.e. the candidate was replaced by someone else).
If the CURRENT image is dark, blurry, turned away, partially visible, or shows no face, respond same_person: true — never falsely accuse.
Respond with ONLY a single minified JSON object and nothing else:
{"same_person": <true|false>, "reason": "<short reason>"}
The "same_person" field MUST be a strict JSON boolean (true or false).`;
      try {
        const idResult = await generateGeminiContent(idKey, idPrompt, {
          parts: [
            { text: "REFERENCE (enrolled candidate):" },
            { inlineData: { mimeType: "image/jpeg", data: refData } },
            { text: "CURRENT (live webcam frame):" },
            { inlineData: { mimeType: "image/jpeg", data: curData } },
          ],
          temperature: 0.1,
          thinkingBudget: 0,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
        });
        const idRaw = (idResult.text || "").trim();
        let different = false;
        let idReason = "";
        try {
          const cleaned = idRaw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
          const parsed = JSON.parse(cleaned);
          different = parsed?.same_person === false; // only an explicit false flags
          if (typeof parsed?.reason === "string") idReason = parsed.reason;
        } catch {
          different = false; // unparseable → fail open
        }
        return NextResponse.json({ ok: true, verified: !different, samePerson: !different, reason: idReason });
      } catch (e: any) {
        logger.error("verify-face: identity compare error", { message: String(e?.message || e) });
        return NextResponse.json({ ok: true, verified: true, samePerson: true, reason: "unavailable" });
      }
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
      await markFaceVerified();
      return NextResponse.json({ ok: true, verified: true });
    }
    // GENUINE reject: the model returned a real verdict and there is no single
    // clear face (no face / multiple faces / other face). This is NOT an infra
    // failure, so `unavailable:false` — the client asks the candidate to
    // reposition rather than showing a service-unavailable retry. (faceVerified
    // is intentionally NOT persisted on this path.)
    return NextResponse.json({ ok: true, verified: false, unavailable: false, reason: reason || "No single clear face detected" });
  } catch (error: any) {
    // FAIL CLOSED on any error - never bypass proctoring with verified:true.
    logger.error("verify-face: verification error", {
      message: String(error?.message || error),
      status: error?.status,
    });
    return verificationUnavailable();
  }
}
