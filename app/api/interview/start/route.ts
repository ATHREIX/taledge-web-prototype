import { NextRequest, NextResponse } from "next/server";
import { createSession, updateSession } from "@/lib/session-store";
import { generateGeminiTTS, getGeminiApiKey, generateGeminiContent } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  studentId: string;
  candidateName?: string;
  role: string;
  mode?: "technical" | "behavioural";
  stage?: 1 | 2;
  resumeSummary?: string;
};

function generateSessionId(): string {
  return `vs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function generateFirstQuestion(apiKey: string, mode: Body["mode"], role: string, resumeSummary?: string, candidateName?: string): Promise<string> {
  const nameToUse = candidateName && candidateName !== "Candidate" ? candidateName : "the candidate";
  const prompt = mode === "technical"
    ? `You are a strict but professional technical interviewer. The candidate is applying for the ${role} position. Their name is ${nameToUse}.
Generate a simple, welcoming opening question about their target role. For example, ask them to briefly introduce themselves and explain why they are interested in the ${role} position, or what their general placement goals are. Do NOT ask any specific technical questions or anything about their past projects/resume yet. CRITICAL: You MUST explicitly greet them by their name (Hello ${nameToUse}) and welcome them to the interview for the ${role} position. Keep it to 2 sentences. Ask EXACTLY ONE short question.`
    : `You are a strict but professional behavioural interviewer. The candidate is applying for the ${role} position. Their name is ${nameToUse}.
Generate a simple, welcoming opening question about their target role. For example, ask them to briefly introduce themselves and explain why they are interested in the ${role} position. Do NOT ask a complex behavioural question or ask about their past projects/resume yet. CRITICAL: You MUST explicitly greet them by their name (Hello ${nameToUse}) and welcome them to the interview for the ${role} position. Keep it to 2 sentences. Ask EXACTLY ONE short question.`;

  if (!apiKey) {
    return `Hello! Welcome to your TalEdge ${mode === "technical" ? "Technical" : "Behavioural"} Assessment for the ${role} position. To start, please state your full name and introduce yourself briefly based on your resume.`;
  }

  try {
    const result = await generateGeminiContent(apiKey, prompt, { maxOutputTokens: 150, temperature: 0.7 });
    if (result.text) return result.text.trim();
  } catch (e) {
    console.error("Failed to generate first question via LLM, falling back", e);
  }
  return `Hello! Welcome to your TalEdge ${mode === "technical" ? "Technical" : "Behavioural"} Assessment for the ${role} position. To start, please state your full name and introduce yourself briefly based on your resume.`;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.studentId || !body.role) {
    return NextResponse.json(
      { error: "studentId and role are required" },
      { status: 400 }
    );
  }

  const resolvedMode = body.stage === 1 ? "technical" : body.stage === 2 ? "behavioural" : body.mode;

  if (!resolvedMode || !["technical", "behavioural"].includes(resolvedMode)) {
    return NextResponse.json(
      { error: "mode must be 'technical' or 'behavioural', or stage must be 1 or 2" },
      { status: 400 }
    );
  }

  const sessionId = generateSessionId();

  const session = createSession({
    sessionId,
    studentId: body.studentId,
    role: body.role,
    mode: resolvedMode,
    resumeSummary: body.resumeSummary,
  });
  
  const apiKey = getGeminiApiKey();
  const question = await generateFirstQuestion(apiKey || "", resolvedMode, body.role, body.resumeSummary, body.candidateName);
  
  let audioBase64 = "";
  try {
    if (apiKey) audioBase64 = await generateGeminiTTS(apiKey, question);
  } catch (ttsErr) {
    console.error("TTS generation failed:", ttsErr);
  }

  updateSession(session.sessionId, {
    transcript: [{ timestamp: Date.now(), role: "assistant", content: question }],
  });

  return NextResponse.json({
    ok: true,
    sessionId: session.sessionId,
    firstQuestion: question,
    audioBase64,
    message: "Session created.",
    mode: session.mode,
  });
}
