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
  const turnInstruction = turnIndex === 1
    ? "Note: The candidate is just answering the introductory question. Do NOT ask about preferred programming language or deep technical details yet. Acknowledge their introduction briefly and warmly, and ask a random soft icebreaker question (e.g., how they prepared for this assessment, what their favorite tech tools are, or what inspired them to pursue this path) to build rapport before moving to resume projects."
    : "First, critically evaluate the candidate's previous answer. Start with simpler foundational questions in the early turns. As the interview progresses, gradually increase the complexity based on their responses. Check their behavior and adapt the difficulty accordingly. If they answered well, increase complexity. If they were incorrect or surface-level, call it out briefly and adjust the question.";

  const sysPrompt = mode === "technical"
    ? `You are an elite, highly rigorous senior technical interviewer. ${multilingualInstruction} 
    Your goal is to stress-test the candidate's actual depth based directly on their resume context (skills, projects, and target role/placement goals). Do not accept surface-level answers.
    You MUST ground your questions in their specific resume context (especially their projects, tech stack, and goals). For example, ask technical questions directly relating to a project or skill they listed, or how it helps them achieve their target goal.
    Review their Resume Context provided below. 
    ${turnInstruction}
    Then, formulate your next question. Make sure it explicitly probes a project, skill, or goal listed in their Resume Context. Ask about trade-offs, system failures, or edge cases related to their stack.
    Apply cognitive load by combining concepts. Do NOT be overly friendly. CRITICAL: Ask EXACTLY ONE short question. Do NOT ask multi-part questions or combine multiple questions into one.
    If you feel you have gathered enough depth to evaluate the candidate's technical skills, projects, and target role alignment (this usually takes 6 to 9 questions), you must conclude the interview. To conclude, start your response with the token [CONCLUDE] followed by a warm closing summary (e.g. '[CONCLUDE] Thank you for your responses today. That concludes all my technical questions. We have recorded your responses.'). Do NOT use the conclude token before Turn 6. Keep responses under 50 words.`
    : `You are an elite, highly rigorous behavioural psychologist and HR director. ${multilingualInstruction} 
    Your goal is to map their response to advanced psychometric DNLA markers (Empathy, Resilience, Integrity).
    You MUST ground your questions in their specific resume context (especially their projects, experiences, and goals). Ask how their specific past experiences or aspirations map to these behavioural situations.
    Review their Resume Context provided below. 
    ${turnInstruction}
    Then, formulate your next question targeting their specific past experiences, projects, or placement goals listed in their Resume Context. Do not accept generic STAR answers. Ask adversarial follow-ups regarding their failures, conflicts, and ethical boundaries. 
    Probe their emotional regulation under stress. Do NOT validate generic answers. CRITICAL: Ask EXACTLY ONE short question. Do NOT ask multi-part questions or combine multiple questions into one.
    If you feel you have gathered enough depth to evaluate the candidate's behavioural traits, DNLA markers, and projects (this usually takes 6 to 9 questions), you must conclude the interview. To conclude, start your response with the token [CONCLUDE] followed by a warm closing summary. Do NOT use the conclude token before Turn 6. Keep responses under 50 words.`;

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
    
    const history = session.transcript
      .filter(t => t.role === "user" || t.role === "assistant")
      .map(t => ({ role: t.role as "assistant" | "user", content: t.content }));

    let nextQuestion = "";
    let audioBase64 = "";
    let isDone = false;

    const cleanLower = transcript.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");
    const isExitWord = 
      cleanLower === "exit" || 
      cleanLower === "quit" || 
      cleanLower === "end" || 
      cleanLower === "terminate" || 
      cleanLower === "stop" ||
      cleanLower === "end interview" ||
      cleanLower === "finish interview" ||
      cleanLower.includes("end the interview") ||
      cleanLower.includes("stop the interview") ||
      cleanLower.includes("finish the interview") ||
      cleanLower.includes("quit the interview") ||
      cleanLower.includes("exit the interview") ||
      cleanLower.includes("terminate the interview") ||
      cleanLower.includes("end assessment") ||
      cleanLower.includes("finish assessment");

    // Hard limit at 10 turns or user requests termination
    if (session.turnIndex >= 10 || isExitWord) {
      isDone = true;
      nextQuestion = "Thank you for completing this assessment. Your responses have been recorded and analyzed. Click below to view your detailed results.";
      session.transcript.push({ timestamp: Date.now(), role: "assistant", content: nextQuestion });

      try {
        const apiKey = getGeminiApiKey();
        if (apiKey) audioBase64 = await generateGeminiTTS(apiKey, nextQuestion);
      } catch (ttsErr) {
        console.error("Voice TTS generation failed for exit:", ttsErr);
      }
    } else {
      const next = await callGeminiLLM(
        session.role,
        session.resumeSummary,
        history,
        transcript.trim(),
        session.mode,
        session.turnIndex + 1
      );
      nextQuestion = next.question;

      // Check if LLM suggested to conclude (contains "[CONCLUDE]")
      if (nextQuestion.includes("[CONCLUDE]")) {
        isDone = true;
        nextQuestion = nextQuestion.replace(/\[CONCLUDE\]/gi, "").trim();
      }

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
