import { NextRequest, NextResponse } from "next/server";
import { generateGeminiContent, generateGeminiJson, getGeminiApiKey } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TranscriptMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: number;
}

async function analyzeResume(body: any, apiKey: string) {
  const { pdfBase64, targetRole } = body;

  if (!pdfBase64) {
    return NextResponse.json({ ok: false, error: "PDF required" }, { status: 400 });
  }

  const prompt = `You are an expert resume analyst. Extract and analyze this resume for a ${targetRole} position.

Return EXACTLY this JSON format (no markdown, no explanation):
{
  "resumeText": "Full extracted text from resume (max 2000 chars)",
  "skills": ["skill1", "skill2", "skill3"],
  "experience": "Brief summary of experience",
  "projects": ["project1", "project2"]
}`;

  try {
    const { parsed } = await generateGeminiJson(apiKey, prompt, {
      parts: [{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }],
      maxOutputTokens: 1000,
      temperature: 0.3,
    });

    return NextResponse.json({
      ok: true,
      resumeText: parsed.resumeText || "",
      skills: parsed.skills || [],
      experience: parsed.experience || "",
      projects: parsed.projects || [],
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Interview analysis service is unavailable.", detail: e?.upstreamError || e?.message },
      { status: Number(e?.status) === 422 ? 422 : 502 }
    );
  }
}

async function generateQuestion(body: any, apiKey: string) {
  const { candidateName, targetRole, experienceLevel, resumeText, skills, previousAnswers, questionCount, isTech } = body;

  const qNum = questionCount + 1;

  const prompt = `You are a strict, world-class AI interviewer conducting a ${isTech ? "technical" : "behavioural"} interview for the world's best tech company.

Candidate: ${candidateName}
Target Role: ${targetRole}
Experience: ${experienceLevel}
Skills: ${skills?.join(", ") || "Not specified"}
Resume context: ${resumeText?.slice(0, 1000) || "Not available"}

${previousAnswers?.length > 0 ? `Previous answers:\n${previousAnswers.map((a: string, i: number) => `User Answer ${i + 1}: ${a}`).join("\n")}` : ""}

This is question ${qNum} of 4.

Generate ONE specific, personalized question for this candidate.

Rules:
- Build heavily on their previous answers. If they gave a vague answer previously, grill them on it.
- Start with simpler, foundational questions in the beginning. As the interview progresses, gradually increase the complexity based on the candidate's responses. Check their behavior and adapt the difficulty according to how well they answer.
- Match their experience level but make it appropriately challenging.
- Keep to 1-2 sentences. Do not use pleasantries. Just ask the question.
- CRITICAL: Ask EXACTLY ONE question. Do NOT ask multi-part questions or combine multiple questions.
- CRITICAL: For technical interviews, at least once during the interview, explicitly tell the user: "For this question, please manually type your code/answer in the input box instead of speaking."

Return ONLY the question text, nothing else.`;

  let question = "";
  try {
    const result = await generateGeminiContent(apiKey, prompt, {
      maxOutputTokens: 150,
      temperature: 0.7,
    });
    question = result.text.trim();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Interview question service is unavailable.", detail: e?.upstreamError || e?.message },
      { status: 502 }
    );
  }

  if (!question) {
    return NextResponse.json({ ok: false, error: "Empty question" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, question });
}

async function generateReport(body: any, apiKey: string) {
  const { candidateName, targetRole, transcript, resumeText, skills } = body;

  const answers = transcript?.filter((m: TranscriptMessage) => m.role === "user").map((m: TranscriptMessage) => m.content) || [];

  const prompt = `You are a world-class AI evaluator. Generate a detailed, highly critical interview report for this candidate.

Candidate: ${candidateName}
Target Role: ${targetRole}

Interview Answers:
${answers.map((a: string, i: number) => `A${i + 1}: ${a}`).join("\n")}

CRITICAL: Plagiarism Detection. Analyze the answers. If any answer sounds copied from a generic AI assistant, Wikipedia, or generic online sources, heavily penalize them and note it in "areasForImprovement".

Generate a comprehensive report in EXACTLY this JSON format (no markdown fences):
{
  "overallScore": 75,
  "technicalScore": 70,
  "communicationScore": 80,
  "problemSolvingScore": 75,
  "strengths": ["strength1", "strength2"],
  "areasForImprovement": ["area1", "area2"],
  "recommendation": "Hire / Consider / Reject",
  "summary": "2-3 sentence summary",
  "detailedFeedback": "Detailed paragraph feedback, including note of any detected plagiarism."
}`;

  try {
    const { parsed: report } = await generateGeminiJson(apiKey, prompt, {
      maxOutputTokens: 1500,
      temperature: 0.2,
    });

    return NextResponse.json({
      ok: true,
      report: {
        ...report,
        candidateName,
        targetRole,
        skills,
        answers,
        generatedAt: Date.now(),
      }
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Interview report service is unavailable.", detail: e?.upstreamError || e?.message },
      { status: Number(e?.status) === 422 ? 422 : 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Interview analysis service is not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "analyzeResume":
        return await analyzeResume(body, apiKey);
      case "generateQuestion":
        return await generateQuestion(body, apiKey);
      case "generateReport":
        return await generateReport(body, apiKey);
      default:
        return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
