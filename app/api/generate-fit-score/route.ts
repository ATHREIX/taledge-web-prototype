import { NextRequest, NextResponse } from "next/server";
import { generateGeminiJson, getGeminiApiKey } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 90;

type Msg = { role: "assistant" | "user"; content: string };

type DnlaItem = {
  competency: string;
  group: string;
  score: number;
  benchmark: number;
  insight: string;
};

type Body = {
  studentId: string;
  candidateName: string;
  targetRole: string;
  resumeSummary?: string;
  resumeSkills?: string[];
  resumeProjects?: { title: string; stack: string[]; impact: string }[];
  technicalQA: Msg[];
  behaviouralQA: Msg[];
  dnla?: DnlaItem[];
  dnlaStrengths?: string[];
  dnlaDevelopmentAreas?: string[];
  dnlaRisks?: string[];
};

function transcriptToText(msgs: Msg[] | undefined): string {
  if (!msgs || msgs.length === 0) return "(no responses)";
  
  const filtered = msgs.filter(m => {
    const text = m.content.toLowerCase().trim();
    return !(
      text === "exit" ||
      text === "quit" ||
      text === "end" ||
      text === "stop" ||
      text === "terminate" ||
      text.includes("end the interview") ||
      text.includes("stop the interview") ||
      text.includes("thank you for completing this assessment")
    );
  });

  if (filtered.length === 0) return "(no responses)";

  return filtered
    .map(
      (m, i) =>
        `${m.role === "assistant" ? "Q" : "A"}${Math.floor(i / 2) + 1}: ${m.content}`
    )
    .join("\n");
}

function clamp(n: any, min = 0, max = 100): number {
  if (n === null || n === undefined || n === -1) return -1;
  const v = Number(n);
  if (!isFinite(v)) return Math.round((min + max) / 2);
  if (v === -1) return -1;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function normalizeMessages(value: unknown): Msg[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m) => m && typeof m === "object")
    .map((m: any) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as Msg["role"],
      content: String(m.content || "").slice(0, 4000),
    }))
    .filter((m) => m.content.trim().length > 0);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeProjects(value: unknown): NonNullable<Body["resumeProjects"]> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p) => p && typeof p === "object")
    .slice(0, 10)
    .map((p: any) => ({
      title: String(p.title || "Untitled project").slice(0, 120),
      stack: normalizeStringArray(p.stack).slice(0, 12),
      impact: String(p.impact || "").slice(0, 240),
    }));
}

function normalizeDnla(value: unknown): DnlaItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((d) => d && typeof d === "object")
    .map((d: any) => ({
      competency: String(d.competency || "").slice(0, 120),
      group: String(d.group || "DNLA").slice(0, 120),
      score: Number(d.score),
      benchmark: Number(d.benchmark),
      insight: String(d.insight || "").slice(0, 300),
    }))
    .filter(
      (d) =>
        d.competency &&
        Number.isFinite(d.score) &&
        Number.isFinite(d.benchmark)
    );
}

const RUBRIC = {
  technical: {
    "Cognitive Load Capacity": ["Multi-constraint problem solving", "Working memory retention (tracking multi-part questions)"],
    "Adversarial Tech Resilience": ["Defense of architecture under cross-examination", "Yielding vs. Defending logic"],
    "Systems Architecture Depth": ["O(n) trade-off awareness", "Failure-state edge case identification", "Microservice anti-patterns"],
    "Code Quality & Pragmatism": ["Algorithmic efficiency", "Clean code principles", "Over-engineering avoidance"],
    "Micro-Expression Proxies (Tech)": ["Latency variance (hesitation detection)", "Hint dependency penalty", "Confidence consistency"],
  },
  resume: {
    "Skill Mapping Matrix": ["JD overlap percentage", "Core vs Tangential skill dilution"],
    "Project Reality Index": ["Complexity vs Claim alignment", "Impact quantification index"],
    "Academic Trajectory": ["Tier multiplier", "Pedigree consistency"],
    "Information Density": ["Fluff-to-substance ratio", "Clarity metric"],
  },
  behavioural: {
    "Advanced Psychometrics (DNLA)": ["Emotional regulation under adversarial questioning", "Cognitive dissonance detection", "Dark Triad suppression"],
    "Conflict Resolution Depth": ["Blame distribution index", "De-escalation strategy map", "Post-mortem accountability"],
    "Linguistic Biomarkers": ["Defensive mechanism triggers", "Pronoun usage (I vs We indexing)", "Calibrated verbosity"],
    "Strategic Empathy": ["Perspective taking metrics", "Stakeholder map understanding"],
    "Growth & Neuroplasticity": ["Feedback assimilation rate", "Fixed vs Growth mindset indicators"],
  },
} as const;

function rubricToPromptList(rubric: Record<string, readonly string[]>): string {
  return Object.entries(rubric)
    .map(([group, items]) => `  - ${group}: [${items.map((i) => `"${i}"`).join(", ")}]`)
    .join("\n");
}

const ROLE_JDS: Record<string, string> = {
  "Full-stack Software Engineer": "Required Skills: React, Next.js, Node.js, TypeScript, SQL databases, REST APIs, WebSockets, system architecture, performance optimization, and front-to-back testing. Experience building responsive web applications and designing end-to-end features.",
  "Backend Engineer": "Required Skills: Server-side languages (Node.js/Go/Python/Java), databases (SQL, Redis, MongoDB), system design, microservices, API architecture, performance tuning, and message queues. Experience with cloud infrastructure (AWS/GCP), CI/CD, and scaling distributed backend systems.",
  "Frontend Engineer": "Required Skills: JavaScript/TypeScript, React, Next.js, HTML5, CSS3, TailwindCSS. Solid understanding of responsive design, web performance, component architecture, accessibility, browser APIs, and modern state management. Strong design sense.",
  "Data / ML Engineer": "Required Skills: Python, SQL. Experience with machine learning frameworks (TensorFlow, PyTorch, Scikit-learn), libraries (Pandas, NumPy), data pipelines, neural networks, and model deployment. Knowledge of NLP/LLMs, computer vision, data engineering (Spark, Kafka).",
  "Product Manager": "Required Skills: Product lifecycle management, defining product roadmaps, evaluating technical and product trade-offs, writing PRDs, analyzing analytics metrics, and leading cross-functional engineering teams. Strong communication, product sense, problem decomposition, and customer empathy.",
  "Consultant · Strategy": "Required Skills: Analytical reasoning, problem-solving, structured case interview frameworks, market entry analysis, financial modeling, slide deck creation, business strategy. Ability to interface with clients, manage stakeholders, and design organizational growth playbooks."
};

export async function POST(req: NextRequest) {
  const apiKey = getGeminiApiKey();
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!body.studentId || !body.candidateName || !body.targetRole) {
    return NextResponse.json(
      {
        ok: false,
        error: "studentId, candidateName, and targetRole are required.",
      },
      { status: 400 }
    );
  }

  const technicalQA = normalizeMessages(body.technicalQA);
  const behaviouralQA = normalizeMessages(body.behaviouralQA);
  const resumeSkills = normalizeStringArray(body.resumeSkills);
  const resumeProjects = normalizeProjects(body.resumeProjects);
  const dnlaItems = normalizeDnla(body.dnla);
  const dnlaStrengths = normalizeStringArray(body.dnlaStrengths);
  const dnlaDevelopmentAreas = normalizeStringArray(body.dnlaDevelopmentAreas);
  const dnlaRisks = normalizeStringArray(body.dnlaRisks);

  const techCount = technicalQA.filter((m) => m.role === "user").length;
  const behavCount = behaviouralQA.filter((m) => m.role === "user").length;
  
  if (techCount + behavCount === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No interview responses found. Complete at least one answer in the Technical or Behavioural interview to generate your Fit Score report.",
      },
      { status: 422 }
    );
  }
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Fit Score generation service is not configured." },
      { status: 503 }
    );
  }

  const dnlaSummary = dnlaItems
    .map((d) => `${d.group} · ${d.competency}: ${d.score.toFixed(1)} / 7 (benchmark ${d.benchmark.toFixed(1)})`)
    .join("\n");

  const skillList = resumeSkills.join(", ");
  const projectList = resumeProjects
    .map((p) => `${p.title} [${p.stack.join(", ")}] · ${p.impact}`)
    .join("\n");

  const jdText = ROLE_JDS[body.targetRole] || `Required Skills and competencies for the ${body.targetRole} role, including foundational technical skills, communication, problem-solving, and role-aligned expertise.`;

  const prompt = `You are a senior talent intelligence analyst computing a candidate's Fit Score per the Taledge PRD §9 rubric.

You will receive:
- Target Job Description (JD) requirements
- Resume context (skills, projects, summary)
- Full DNLA Social Competence report (already scored on 1-7 scale)
- Technical Interview transcript
- Behavioural Interview transcript

CRITICAL GROUNDING RULES:
1. Every sub-score MUST be grounded in **specific evidence** from the transcripts and resume. Quote the candidate's exact words when justifying scores.
2. Directly compare and analyze the candidate's Resume (skills, projects, experience) against the Target Job Description (JD). Ground Component 02 (Resume & profile features) specifically in this comparative overlap: evaluate the "JD overlap percentage" and check for "Core vs Tangential skill dilution".
3. Where evidence is thin or contradictory, score in the 30-55 range and call that out in the verdict.
4. Do NOT invent capabilities the candidate did not demonstrate.
5. Do NOT give generous scores without evidence. If the candidate gave a one-word answer, score that dimension low.
6. The narrative MUST reference at least 2 specific things the candidate said (paraphrased or quoted).
7. If a transcript section says "(no responses)", it means that interview stage has not been started yet. You MUST set its corresponding headline score (technical_score or behavioural_score) to -1. Compute the overall fit_score and success_probability composites based ONLY on the completed interview stages (do not include the -1 stage in calculations). Keep the breakdown subscores for the missing stage as 0.

Your task is to compute every sub-score (0-100 scale) with brutal honesty grounded in the actual evidence provided below.

Candidate: ${body.candidateName}
Target role: ${body.targetRole}
Target Job Description (JD):
${jdText}

Resume summary: ${body.resumeSummary || "(not provided)"}
Resume skills: ${skillList || "(not provided)"}
Resume projects:
${projectList || "(not provided)"}

DNLA report:
${dnlaSummary || "(not provided)"}
DNLA strengths: ${dnlaStrengths.join("; ") || "(none captured)"}
DNLA development areas: ${dnlaDevelopmentAreas.join("; ") || "(none captured)"}
DNLA risks: ${dnlaRisks.join("; ") || "(none)"}

Technical Interview transcript:
${transcriptToText(technicalQA)}

Behavioural Interview transcript:
${transcriptToText(behaviouralQA)}

Sub-score rubric (every numeric must be an integer 0-100):

Component 01 · Technical Interview features:
${rubricToPromptList(RUBRIC.technical)}

Component 02 · Resume & profile features:
${rubricToPromptList(RUBRIC.resume)}

Component 04 · Behavioural Interview features:
${rubricToPromptList(RUBRIC.behavioural)}

Headline scores (also 0-100):
- technical_score: weighted aggregate of Component 01
- behavioural_score: weighted aggregate of Component 03 (DNLA) and Component 04
- fit_score: weighted composite of Components 01-04 for the target role
- success_probability: predicted likelihood of successful placement, 0-100

Cross-component features (Component 05) · each must be { "label": string, "verdict": string, "tone": "ok" | "warn" | "danger" }:
- "Tech vs Resume gap" → are technical answers supported by what the resume claims?
- "Confidence vs Accuracy gap" → does the candidate over- or under-claim relative to demonstrated accuracy?
- "Behaviours vs Psychometric alignment" → do behavioural answers align with the DNLA profile?

Return EXACTLY this JSON shape (no markdown fences, no commentary):

{
  "technical_score": <0-100 integer or -1 if pending>,
  "behavioural_score": <0-100 integer or -1 if pending>,
  "fit_score": <0-100 integer>,
  "success_probability": <0-100 integer>,
  "verdict": "<one short phrase, e.g. 'Interview-ready' / 'Develop further' / 'Strong fit' / 'High potential, needs polish'>",
  "narrative": "<3-sentence executive summary referencing concrete evidence>",
  "technical_breakdown": [
    { "group": "<group>", "rows": [["<sub-score label>", <0-100>], ...] }
  ],
  "resume_breakdown": [
    { "group": "<group>", "rows": [["<sub-score label>", <0-100>], ...] }
  ],
  "behavioural_breakdown": [
    { "group": "<group>", "rows": [["<sub-score label>", <0-100>], ...] }
  ],
  "cross_flags": [
    { "label": "<check>", "verdict": "<one-sentence finding>", "tone": "ok" | "warn" | "danger" }
  ]
}

Strictly valid JSON. No prose before or after.`;

  try {
    const { parsed, model } = await generateGeminiJson(apiKey, prompt, {
      maxOutputTokens: 8192,
      temperature: 0.2,
    });

    const generated = {
      technical_score: clamp(parsed.technical_score),
      behavioural_score: clamp(parsed.behavioural_score),
      fit_score: clamp(parsed.fit_score),
      success_probability: clamp(parsed.success_probability),
      verdict: String(parsed.verdict || "Awaiting verdict").slice(0, 60),
      narrative: String(parsed.narrative || "").slice(0, 800),
      technical_breakdown: Array.isArray(parsed.technical_breakdown)
        ? parsed.technical_breakdown.map((g: any) => ({
            group: String(g.group || ""),
            rows: Array.isArray(g.rows)
              ? g.rows.map((r: any) => [String(r?.[0] || ""), clamp(r?.[1])])
              : [],
          }))
        : [],
      resume_breakdown: Array.isArray(parsed.resume_breakdown)
        ? parsed.resume_breakdown.map((g: any) => ({
            group: String(g.group || ""),
            rows: Array.isArray(g.rows)
              ? g.rows.map((r: any) => [String(r?.[0] || ""), clamp(r?.[1])])
              : [],
          }))
        : [],
      behavioural_breakdown: Array.isArray(parsed.behavioural_breakdown)
        ? parsed.behavioural_breakdown.map((g: any) => ({
            group: String(g.group || ""),
            rows: Array.isArray(g.rows)
              ? g.rows.map((r: any) => [String(r?.[0] || ""), clamp(r?.[1])])
              : [],
          }))
        : [],
      cross_flags: Array.isArray(parsed.cross_flags)
        ? parsed.cross_flags.slice(0, 4).map((f: any) => ({
            label: String(f.label || ""),
            verdict: String(f.verdict || ""),
            tone: ["ok", "warn", "danger"].includes(f.tone) ? f.tone : "warn",
          }))
        : [],
    };

    return NextResponse.json({
      ok: true,
      generated,
      source: model,
      meta: { techCount, behavCount, hasDnla: dnlaItems.length > 0 },
    });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json(
      {
        ok: false,
        error:
          status === 422
            ? "The evaluation service returned an unreadable report."
            : "Fit Score generation service is unavailable. Please try again.",
        detail: e?.upstreamError || e?.rawPreview || e?.message?.slice(0, 200),
      },
      { status: status === 422 ? 422 : 502 }
    );
  }
}
