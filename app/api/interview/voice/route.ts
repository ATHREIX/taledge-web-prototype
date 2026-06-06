import { NextRequest, NextResponse } from "next/server";
import { generateGeminiContent, getGeminiApiKey, generateGeminiTTS } from "@/lib/gemini";
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
    Your goal is to stress-test the candidate's actual depth based strictly on their resume context. Do not accept surface-level answers. 
    Review their Resume Context provided below. 
    First, critically evaluate the candidate's previous answer. If they were incorrect or surface-level, call it out briefly.
    Then, formulate your next question. If their answer was incomplete, ask an adversarial follow-up. Probe edge cases, system failure states, and O(n) trade-offs. 
    Apply cognitive load by combining concepts. Do NOT be overly friendly. Keep responses under 50 words.`
    : `You are an elite, highly rigorous behavioural psychologist and HR director. ${multilingualInstruction} 
    Your goal is to map their response to advanced psychometric DNLA markers (Empathy, Resilience, Integrity). 
    Review their Resume Context provided below. 
    First, evaluate the candidate's previous answer. Did they demonstrate the required depth?
    Then, formulate your next question targeting their specific past experiences and skills. Do not accept generic STAR answers. Ask adversarial follow-ups regarding their failures, conflicts, and ethical boundaries. 
    Probe their emotional regulation under stress. Do NOT validate generic answers. Keep responses under 50 words.`;

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
      maxOutputTokens: 250,
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
    const isDone = session.turnIndex >= 6;

    const history = session.transcript
      .filter(t => t.role === "user" || t.role === "assistant")
      .map(t => ({ role: t.role as "assistant" | "user", content: t.content }));

    let nextQuestion = "";
    let audioBase64 = "";
    if (!isDone) {
      const next = await callGeminiLLM(
        session.role,
        session.resumeSummary,
        history,
        transcript.trim(),
        session.mode,
        session.turnIndex + 1
      );
      nextQuestion = next.question;
      session.transcript.push({ timestamp: Date.now(), role: "assistant", content: nextQuestion });

      try {
        const apiKey = getGeminiApiKey();
        if (apiKey) audioBase64 = await generateGeminiTTS(apiKey, nextQuestion);
      } catch (ttsErr) {
        console.error("Voice TTS generation failed:", ttsErr);
      }
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
      audioBase64,
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
