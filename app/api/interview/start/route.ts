import { NextRequest, NextResponse } from "next/server";
import { createSession, updateSession } from "@/lib/session-store";
import { getGeminiApiKey, generateGeminiContent } from "@/lib/gemini";
import { fetchDnlaQuestion } from "@/lib/dnla-questions";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";
import { isTechnicalRole } from "@/lib/role-classification";

export const runtime = "nodejs";
export const maxDuration = 30;

type InterviewMode = "technical" | "behavioural" | "dnla" | "final";

type Body = {
  studentId: string;
  candidateName?: string;
  role: string;
  mode?: InterviewMode;
  stage?: 1 | 2;
  track?: "placement" | "exam";
  resumeSummary?: string;
  dnlaSummary?: string;
  /** Condensed AI + DNLA transcripts — only used by the "final" round. */
  priorInterviews?: string;
  /** Client-computed fingerprint of the resume fields this round is grounded
   *  in (lib/resume-hash). Stored on the session so a resume swap between
   *  interview and scoring is provable from server data. */
  resumeFingerprint?: string;
};

const MAX_STR = 4000;

async function generateFirstQuestion(apiKey: string, mode: Body["mode"], role: string, resumeSummary?: string, candidateName?: string, dnlaSummary?: string, track: "placement" | "exam" = "placement", opts?: { sessionId: string; studentId: string; priorInterviews?: string }): Promise<string> {
  const nameToUse = candidateName && candidateName !== "Candidate" ? candidateName : "the candidate";
  // The opening question stays a warm icebreaker, but for the behavioural round
  // we privately note the candidate's DNLA development areas so the interviewer
  // can steer toward them in later turns (it must NOT quiz them on turn 1).
  const dnlaNote = dnlaSummary
    ? `\nPrivate context (do NOT mention DNLA or scores aloud): this candidate's psychometric development areas to probe LATER in the interview are:\n${dnlaSummary}`
    : "";

  // DNLA interview round. The opening question comes from the licensed DNLA
  // provider API when configured (DNLA_QUESTION_API_URL); until then it falls
  // back to the SAME Gemini generation as the AI interview, using the DNLA
  // (psychometric/behavioural) framing. See lib/dnla-questions.ts.
  if (mode === "dnla") {
    if (opts) {
      const provider = await fetchDnlaQuestion({
        sessionId: opts.sessionId,
        studentId: opts.studentId,
        turnIndex: 1,
        dnlaSummary,
      });
      if (provider?.question) return provider.question;
    }
    const dnlaPrompt = `You are a warm behavioural assessor running a DNLA competency interview framed on the DNLA report ONLY (its areas: Achievement Dynamics, Interpersonal, Will to Succeed, Stress Capacity). The candidate's name is ${nameToUse}${track === "exam" ? `, an aspirant for the ${role} exam` : role && role !== "Candidate" ? `, applying for the ${role} role` : ""}.
Generate a simple, welcoming opening question. Greet them by name (Hello ${nameToUse}), tell them this is a short behavioural round, and ask them to briefly describe a recent situation where they had to stay motivated or organised under pressure. Keep it to 2 sentences. Ask EXACTLY ONE short question.${dnlaNote}`;
    if (apiKey) {
      try {
        const result = await generateGeminiContent(apiKey, dnlaPrompt, { maxOutputTokens: 150, temperature: 0.7, thinkingBudget: 0 });
        if (result.text) return result.text.trim();
      } catch (e) {
        logger.error("interview-start: dnla opener LLM failed, falling back", { err: String(e) });
      }
    }
    return `Hello ${nameToUse}! Welcome to your DNLA behavioural round. To start, tell me about a recent situation where you had to stay motivated and organised under real pressure.`;
  }

  // Final round — combines the AI interview and the DNLA interview into one
  // concluding conversation. The condensed prior transcripts are injected so the
  // interviewer can probe gaps and contradictions across both earlier rounds.
  if (mode === "final") {
    const priorNote = opts?.priorInterviews
      ? `\nPrivate context — summaries of this candidate's EARLIER rounds (AI interview + DNLA behavioural interview). Use them to choose what to probe in this final round; do NOT read them aloud:\n${opts.priorInterviews}`
      : "";
    const finalPrompt = `You are a senior panel interviewer running the FINAL round${track === "exam" ? ` of a ${role} readiness assessment` : role && role !== "Candidate" ? ` for the ${role} role` : ""}. The candidate's name is ${nameToUse}. This round combines and builds on their earlier AI interview and DNLA behavioural interview.
Generate a warm opening question. Greet them by name (Hello ${nameToUse}), tell them this is the final combined round that brings together their technical and behavioural rounds, and ask one broad opening question inviting them to reflect on how they performed so far and what they would most like to demonstrate now. Keep it to 2 sentences. Ask EXACTLY ONE short question.${priorNote}${dnlaNote}`;
    if (apiKey) {
      try {
        const result = await generateGeminiContent(apiKey, finalPrompt, { maxOutputTokens: 180, temperature: 0.7, thinkingBudget: 0 });
        if (result.text) return result.text.trim();
      } catch (e) {
        logger.error("interview-start: final opener LLM failed, falling back", { err: String(e) });
      }
    }
    return `Hello ${nameToUse}! Welcome to your final combined round, bringing together your AI interview and DNLA behavioural interview. To begin, how do you feel your earlier rounds went, and what would you most like to show me now?`;
  }

  // Exam track: the "role" is the competitive exam (UPSC, GATE, CAT, ...). The
  // opener welcomes the aspirant to a readiness assessment for that exam.
  if (track === "exam") {
    const examPrompt = `You are a warm, experienced mentor and counsellor for the ${role} competitive exam. The aspirant's name is ${nameToUse}.
Generate a simple, welcoming opening question. Greet them by name (Hello ${nameToUse}) and welcome them to their ${role} readiness assessment, then ask them to briefly introduce themselves and share where they currently are in their ${role} preparation journey. Do NOT ask any hard subject questions or about specific topics yet. Keep it to 2 sentences. Ask EXACTLY ONE short question.${dnlaNote}`;
    if (apiKey) {
      try {
        const result = await generateGeminiContent(apiKey, examPrompt, { maxOutputTokens: 150, temperature: 0.7, thinkingBudget: 0 });
        if (result.text) return result.text.trim();
      } catch (e) {
        logger.error("interview-start: exam opener LLM failed, falling back", { err: String(e) });
      }
    }
    return `Hello ${nameToUse}! Welcome to your TalEdge readiness assessment for ${role}. To start, please introduce yourself briefly and tell me where you are in your ${role} preparation.`;
  }

  const prompt = mode === "technical"
    ? `You are a strict but professional interviewer for the ${role} role (this role may be in ANY field — engineering, design, product, sales, marketing, finance, operations, HR, etc. — do not assume it is technical). The candidate is applying for the ${role} position. Their name is ${nameToUse}.
Generate a simple, welcoming opening question about their target role. For example, ask them to briefly introduce themselves and explain why they are interested in the ${role} position, or what their general placement goals are. Do NOT ask any specific technical questions or anything about their past projects/resume yet. CRITICAL: You MUST explicitly greet them by their name (Hello ${nameToUse}) and welcome them to the interview for the ${role} position. Keep it to 2 sentences. Ask EXACTLY ONE short question.${dnlaNote}`
    : `You are a strict but professional behavioural interviewer. The candidate is applying for the ${role} position. Their name is ${nameToUse}.
Generate a simple, welcoming opening question about their target role. For example, ask them to briefly introduce themselves and explain why they are interested in the ${role} position. Do NOT ask a complex behavioural question or ask about their past projects/resume yet. CRITICAL: You MUST explicitly greet them by their name (Hello ${nameToUse}) and welcome them to the interview for the ${role} position. Keep it to 2 sentences. Ask EXACTLY ONE short question.${dnlaNote}`;

  if (!apiKey) {
    return `Hello! Welcome to your TalEdge ${mode === "technical" ? (isTechnicalRole(role) ? "Technical" : "Skills") : "Behavioural"} Assessment for the ${role} position. To start, please state your full name and introduce yourself briefly based on your resume.`;
  }

  try {
    const result = await generateGeminiContent(apiKey, prompt, { maxOutputTokens: 150, temperature: 0.7, thinkingBudget: 0 });
    if (result.text) return result.text.trim();
  } catch (e) {
    logger.error("interview-start: failed to generate first question via LLM, falling back", { err: String(e) });
  }
  return `Hello! Welcome to your TalEdge ${mode === "technical" ? (isTechnicalRole(role) ? "Technical" : "Skills") : "Behavioural"} Assessment for the ${role} position. To start, please state your full name and introduce yourself briefly based on your resume.`;
}

export async function POST(req: NextRequest) {
  // 1. AuthN: derive the authorization subject from the verified principal,
  //    never from a client-supplied studentId.
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  // 2. Rate limit (Gemini-backed route).
  const limited = await enforceRateLimit(req, { uid, limit: 20, windowMs: 60000, scope: "interview-start" });
  if (limited) return limited;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // 3. Input validation: types, presence, and size bounds.
  if (typeof body.studentId !== "string" || !body.studentId.trim() || body.studentId.length > MAX_STR) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }
  if (typeof body.role !== "string" || !body.role.trim() || body.role.length > MAX_STR) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }
  if (body.candidateName !== undefined && (typeof body.candidateName !== "string" || body.candidateName.length > MAX_STR)) {
    return NextResponse.json({ error: "candidateName must be a string" }, { status: 400 });
  }
  if (body.resumeSummary !== undefined && (typeof body.resumeSummary !== "string" || body.resumeSummary.length > MAX_STR * 4)) {
    return NextResponse.json({ error: "resumeSummary must be a string" }, { status: 400 });
  }
  if (body.dnlaSummary !== undefined && (typeof body.dnlaSummary !== "string" || body.dnlaSummary.length > MAX_STR * 4)) {
    return NextResponse.json({ error: "dnlaSummary must be a string" }, { status: 400 });
  }
  if (body.priorInterviews !== undefined && (typeof body.priorInterviews !== "string" || body.priorInterviews.length > MAX_STR * 8)) {
    return NextResponse.json({ error: "priorInterviews must be a string" }, { status: 400 });
  }
  if (body.resumeFingerprint !== undefined && (typeof body.resumeFingerprint !== "string" || body.resumeFingerprint.length > 64)) {
    return NextResponse.json({ error: "resumeFingerprint must be a short string" }, { status: 400 });
  }
  if (body.mode !== undefined && !["technical", "behavioural", "dnla", "final"].includes(body.mode)) {
    return NextResponse.json({ error: "mode must be 'technical', 'behavioural', 'dnla', or 'final'" }, { status: 400 });
  }
  if (body.track !== undefined && !["placement", "exam"].includes(body.track)) {
    return NextResponse.json({ error: "track must be 'placement' or 'exam'" }, { status: 400 });
  }
  const track: "placement" | "exam" = body.track === "exam" ? "exam" : "placement";
  if (body.stage !== undefined && body.stage !== 1 && body.stage !== 2) {
    return NextResponse.json({ error: "stage must be 1 or 2" }, { status: 400 });
  }

  // stage 1/2 are legacy shorthands for the AI interview rounds; dnla/final are
  // selected directly via `mode`. "final" (the funnel's Final Interview) IS the
  // behavioural round, so it resolves to the behavioural interviewer.
  const rawResolved: InterviewMode | undefined =
    body.stage === 1 ? "technical" : body.stage === 2 ? "behavioural" : body.mode;

  if (!rawResolved || !["technical", "behavioural", "dnla", "final"].includes(rawResolved)) {
    return NextResponse.json(
      { error: "mode must be 'technical', 'behavioural', 'dnla', or 'final', or stage must be 1 or 2" },
      { status: 400 }
    );
  }
  const resolvedMode: InterviewMode = rawResolved === "final" ? "behavioural" : rawResolved;

  // 4. Server-authoritative session id; never trust a client-supplied one.
  const sessionId = crypto.randomUUID();

  let session;
  try {
    session = await createSession({
      sessionId,
      ownerUid: uid,
      studentId: body.studentId,
      role: body.role,
      mode: resolvedMode,
      track,
      resumeSummary: body.resumeSummary,
      dnlaSummary: body.dnlaSummary,
      priorInterviews: body.priorInterviews,
      resumeHash: body.resumeFingerprint || undefined,
    });
  } catch (e) {
    logger.error("interview-start: createSession failed", { err: String(e), uid });
    return NextResponse.json(
      { error: isProd ? "Failed to start interview" : `Failed to start interview: ${String(e)}` },
      { status: 500 }
    );
  }

  const apiKey = getGeminiApiKey();
  const question = await generateFirstQuestion(
    apiKey || "",
    resolvedMode,
    body.role,
    body.resumeSummary,
    body.candidateName,
    body.dnlaSummary,
    track,
    { sessionId: session.sessionId, studentId: body.studentId, priorInterviews: body.priorInterviews }
  );

  // No server-side TTS — the live interviewer is Gemini Live native audio.
  const audioBase64 = "";

  // Best-effort: persisting the opening question must never 500 the start. The
  // client receives firstQuestion directly, and the voice route can rebuild the
  // session from client context if this write didn't land.
  try {
    await updateSession(session.sessionId, {
      transcript: [{ timestamp: Date.now(), role: "assistant", content: question }],
    });
  } catch (e) {
    logger.error("interview-start: updateSession (seed question) failed", { err: String(e), uid });
  }

  return NextResponse.json({
    ok: true,
    sessionId: session.sessionId,
    firstQuestion: question,
    audioBase64,
    message: "Session created.",
    mode: session.mode,
  });
}
