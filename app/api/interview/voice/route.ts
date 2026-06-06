import { NextRequest, NextResponse } from "next/server";
import { generateGeminiContent, getGeminiApiKey } from "@/lib/gemini";
import { getSession, updateSession } from "@/lib/session-store";

export const runtime = "nodejs";
export const maxDuration = 60;

async function callGeminiLLM(
  role: string,
  resumeSummary: string | undefined,
  history: { role: "assistant" | "user"; content: string }[],
  transcript: string,
  mode: "technical" | "behavioural",
  turnIndex: number
): Promise<{ question: string; isDone: boolean }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw Object.assign(new Error("Gemini interview service is not configured."), {
      status: 503,
    });
  }

  const multilingualInstruction = `You possess lingual abilities to conduct the interview seamlessly in English, Hindi, and Hinglish. Adapt to the language the user speaks.`;
  const sysPrompt = mode === "technical"
    ? `You are an elite, highly rigorous senior technical interviewer. ${multilingualInstruction} 
    Your goal is to stress-test the candidate's actual depth. Do not accept surface-level answers. 
    If they give a standard answer, ask an adversarial follow-up. Probe edge cases, system failure states, and O(n) trade-offs. 
    Apply cognitive load by combining concepts. Do NOT be overly friendly. Keep responses under 50 words.`
    : `You are an elite, highly rigorous behavioural psychologist and HR director. ${multilingualInstruction} 
    Your goal is to map their response to advanced psychometric DNLA markers (Empathy, Resilience, Integrity). 
    Do not accept generic STAR answers. Ask adversarial follow-ups regarding their failures, conflicts, and ethical boundaries. 
    Probe their emotional regulation under stress. Do NOT validate their answers. Keep responses under 50 words.`;

  const historyText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  const prompt = `${sysPrompt}

Role: ${role}
Resume context: ${resumeSummary || "(not provided)"}
Turn: ${turnIndex}

History:
${historyText || "(first answer)"}

Candidate said: "${transcript}"

Ask the next question.`;

  try {
    const result = await generateGeminiContent(apiKey, prompt, {
      maxOutputTokens: 180,
      temperature: 0.7,
    });
    const question = result.text.trim();
    if (!question) {
      throw Object.assign(new Error("Gemini returned an empty interview question."), {
        status: 502,
      });
    }
    return { question, isDone: false };
  } catch (e) {
    console.error("[voice] Gemini question error:", e);
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let sessionId: string | null = null;
    let transcript = "";

    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          error:
            "Server audio upload is disabled. Use /api/gemini/live-token for Gemini Live audio sessions, or send transcribed text.",
        },
        { status: 501 }
      );
    } else {
      const body = await req.json();
      sessionId = body.sessionId;
      transcript = body.text || "";
    }

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (!transcript.trim()) {
      return NextResponse.json({ error: "Answer text is required" }, { status: 422 });
    }

    session.transcript.push({ timestamp: Date.now(), role: "user", content: transcript.trim() });
    const isDone = session.turnIndex >= 3;

    const history = session.transcript
      .filter(t => t.role === "user" || t.role === "assistant")
      .map(t => ({ role: t.role as "assistant" | "user", content: t.content }));

    let nextQuestion = "";
    if (!isDone) {
      const next = await callGeminiLLM(
        session.role,
        session.resumeSummary,
        history.slice(0, -1),
        transcript.trim(),
        session.mode,
        session.turnIndex + 1
      );
      nextQuestion = next.question;
      session.transcript.push({ timestamp: Date.now(), role: "assistant", content: nextQuestion });
    }

    updateSession(sessionId, {
      transcript: session.transcript,
      turnIndex: session.turnIndex + 1,
      isDone,
    });

    return NextResponse.json({
      ok: true,
      sessionId,
      transcript,
      nextQuestion,
      isDone,
      turnIndex: session.turnIndex + 1,
    });

  } catch (e: any) {
    console.error("[voice] Error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: Number(e?.status) || 500 }
    );
  }
}
