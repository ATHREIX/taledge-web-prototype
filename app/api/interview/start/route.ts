import { NextRequest, NextResponse } from "next/server";
import { createSession, updateSession } from "@/lib/session-store";
import { generateGeminiTTS, getGeminiApiKey } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  studentId: string;
  role: string;
  mode?: "technical" | "behavioural";
  stage?: 1 | 2;
  resumeSummary?: string;
};

function generateSessionId(): string {
  return `vs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function firstQuestion(mode: Body["mode"], role: string, resumeSummary?: string): string {
  const resumeContext = resumeSummary ? ` I noticed from your resume that you have experience with: ${resumeSummary}.` : "";
  if (mode === "technical") {
    return `Hello! Welcome to your TalEdge Technical Assessment for the ${role} position.${resumeContext} Before we dive into the architecture, could you please state your full name and tell me what your preferred programming language is for this interview?`;
  }

  return `Hello! Welcome to your TalEdge Behavioural Assessment for the ${role} position.${resumeContext} To get us started, could you please state your full name and tell me a little bit about your current professional background?`;
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
  const question = firstQuestion(resolvedMode, body.role, body.resumeSummary);
  
  let audioBase64 = "";
  try {
    const apiKey = getGeminiApiKey();
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
