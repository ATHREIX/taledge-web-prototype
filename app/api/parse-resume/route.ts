import { NextRequest, NextResponse } from "next/server";
import { generateGeminiJson, getGeminiApiKey } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

type Parsed = {
  is_resume?: boolean;
  is_jd?: boolean;
  reason?: string;
  full_name?: string;
  email?: string;
  institution?: string;
  year_cohort?: string;
  target_role?: string;
  summary?: string;
  skills?: string[];
  projects?: { title: string; stack: string[]; impact: string }[];
};

function extractJson(text: string): Parsed | null {
  const trimmed = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = getGeminiApiKey();

  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get("file") as File | null;
  } catch {
    /* fall through */
  }

  if (!file) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const filename = file.name;
  const sizeKb = Math.round(file.size / 1024);
  const isPdf =
    file.type === "application/pdf" || filename.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please upload a PDF resume.",
        filename,
        sizeKb,
      },
      { status: 415 }
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      {
        ok: false,
        error: "Resume file is larger than 10 MB.",
        filename,
        sizeKb,
      },
      { status: 413 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Resume parsing service is not configured.",
        filename,
        sizeKb,
      },
      { status: 503 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse PDF text locally because OpenRouter doesn't support Gemini's native inlineData for PDFs
    let textContent = "";
    try {
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const pdfData = await pdfParse(buffer);
      textContent = pdfData.text;
    } catch (err) {
      console.error("[parse-resume] pdf-parse failed:", err);
      return NextResponse.json({ ok: false, error: "Failed to extract text from PDF." }, { status: 422 });
    }

    const prompt = `You are an expert OCR system and resume parser. Look at the attached document text.

After reading the text, decide whether it is a candidate's resume / CV.

If the document is a Job Description (JD), role profile, or syllabus:
1. Return is_resume: true AND is_jd: true.
2. Extract target_role, skills, projects, and summary from the JD requirements.
3. Crucially, set full_name, email, institution, and year_cohort to empty strings (""). Do NOT populate them with mock candidate values or job titles (like "Human Resources Assistant").

If the document is completely unrelated (e.g. it's an invoice, contract, brochure, receipt, book page, etc.), return EXACTLY this JSON and nothing else:
{ "is_resume": false, "reason": "<one short sentence describing what the document actually is>" }

If the document IS a resume or can be parsed as a candidate profile, return EXACTLY this JSON shape (no markdown fences, no commentary):
{
  "is_resume": true,
  "is_jd": false,
  "full_name": "string (the candidate's name)",
  "email": "string (the email on the resume, or empty string if none)",
  "institution": "string (most recent college/university, or current employer if no school)",
  "year_cohort": "string (e.g., 'Final Year · B.Tech CS' or '2nd Year · MBA'; infer from education section)",
  "target_role": "string (best-guess target role from the resume's headline, objective, or most senior experience)",
  "summary": "string (2-sentence professional summary)",
  "skills": ["array of 6-10 key technical or professional skills"],
  "projects": [
    {
      "title": "string",
      "stack": ["array of technologies or tools used"],
      "impact": "string (one-line measurable outcome)"
    }
  ]
}

Here is the extracted document text:
"""
${textContent.slice(0, 15000)}
"""

Return strictly valid JSON. No prose before or after.`;

    const { parsed, model } = await generateGeminiJson<Parsed>(apiKey, prompt, {
      maxOutputTokens: 1500,
      temperature: 0.1,
      model: "gemini-2.5-flash-lite"
    });

    if (parsed.is_resume === false) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.reason ||
            "This document doesn't appear to be a resume.",
          notResume: true,
          filename,
          sizeKb,
        },
        { status: 422 }
      );
    }

    if (
      !parsed.is_jd && (
        !parsed.full_name ||
        (!parsed.institution && (!parsed.skills || parsed.skills.length === 0))
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This document doesn't look like a resume · we couldn't extract a name and credentials.",
          notResume: true,
          filename,
          sizeKb,
        },
        { status: 422 }
      );
    }

    if (parsed.is_jd) {
      if (!parsed.target_role && (!parsed.skills || parsed.skills.length === 0)) {
        return NextResponse.json(
          {
            ok: false,
            error: "This Job Description doesn't seem to contain roles or skills we can extract.",
            notResume: true,
            filename,
            sizeKb,
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      parsed,
      source: model,
      filename,
      sizeKb,
    });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json(
      {
        ok: false,
        error:
          status === 422
            ? "We couldn't read this file. Please make sure it is a valid resume PDF."
            : "Resume parsing service is unavailable. Please try again.",
        detail: e?.upstreamError || e?.rawPreview || e?.message?.slice(0, 200),
        filename,
        sizeKb,
      },
      { status: status === 422 ? 422 : 502 }
    );
  }
}
