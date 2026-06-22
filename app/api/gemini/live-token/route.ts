import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GEMINI_LIVE_MODEL, getGeminiApiKey } from "@/lib/gemini";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// HD prebuilt voice (same native voices as the TTS model): Aoede, Kore, Leda…
const DEFAULT_LIVE_VOICE = "Aoede";

type Body = {
  candidateName?: string;
  role?: string;
  mode?: "technical" | "behavioural" | "dnla" | "final";
  track?: "placement" | "exam";
  resumeSummary?: string;
  dnlaSummary?: string;
  priorInterviews?: string;
};

const cap = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

/** Build the Live interviewer persona/system instruction from the candidate context. */
function buildSystemInstruction(b: Body): string {
  const name = cap(b.candidateName, 120) || "the candidate";
  const role = cap(b.role, 200) || "the role";
  const track = b.track === "exam" ? "exam" : "placement";
  const mode = b.mode || "technical";

  const roleLine =
    track === "exam"
      ? `You are a warm but rigorous mentor and examiner conducting a spoken readiness interview for the ${role} competitive exam.`
      : mode === "dnla"
      ? `You are a warm behavioural assessor conducting a spoken DNLA-style competency interview (Achievement Dynamics, Interpersonal Skills, Execution, Stress & Resilience) for a candidate targeting the ${role} role.`
      : mode === "final"
      ? `You are a senior panel interviewer conducting the spoken FINAL combined round for a candidate targeting the ${role} role, integrating their earlier technical and behavioural rounds.`
      : `You are a sharp, professional senior interviewer conducting a spoken interview for the ${role} role.`;

  const resume = cap(b.resumeSummary, 6000);
  const dnla = cap(b.dnlaSummary, 4000);
  const prior = cap(b.priorInterviews, 8000);

  return [
    roleLine,
    `The candidate's name is ${name}. Speak naturally and conversationally, like a real human interviewer on a call.`,
    `Begin by greeting ${name} by name and asking ONE short, warm opening question. Then ask ONE question at a time and WAIT for the spoken answer before continuing.`,
    `Listen closely to each answer and make your next question build directly on what they just said — drill into claims, expose gaps, follow their examples. Climb from basic to harder questions as they do well; simplify if they struggle.`,
    `Keep each turn short (1–2 sentences, exactly ONE question). Do not lecture. Be encouraging but do not accept vague answers.`,
    resume ? `\nCandidate resume context (reference, not to read aloud):\n${resume}` : "",
    dnla ? `\nDNLA competency report (probe sub-benchmark areas; do not read aloud):\n${dnla}` : "",
    prior ? `\nEarlier rounds summary (build on these; do not read aloud):\n${prior}` : "",
    `\nAfter about 9–12 questions, once you have enough depth, warmly thank them and conclude the interview.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  const limited = enforceRateLimit(req, { uid, limit: 10, windowMs: 60000, scope: "live-token" });
  if (limited) return limited;

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Gemini Live service is not configured." }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* body is optional */
  }

  // Ephemeral tokens are the secure way to authenticate the browser's Live
  // socket, but the `auth_tokens` REST endpoint mints identity-less tokens that
  // the Live API rejects (close code 1008, "unregistered caller") for this
  // key/project — and it does not accept the `liveConnectConstraints` lock that
  // would give a token an identity. The key itself IS Live-capable when used
  // directly, so we hand the raw key to the client to connect with `?key=`.
  //
  // ⚠️ SECURITY TRADE-OFF: this returns GEMINI_API_KEY to the browser, where it
  // is visible to the user. This is acceptable for a LOCAL PROTOTYPE/DEMO — the
  // route is still behind auth + rate limiting — but is NOT safe for public
  // production. Before shipping, switch to a server-side WebSocket proxy (key
  // stays server-side) or a project that can mint valid ephemeral tokens.
  return NextResponse.json({
    ok: true,
    apiKey, // used by the client as the Live WebSocket `?key=` credential
    model: GEMINI_LIVE_MODEL,
    voice: process.env.GEMINI_TTS_VOICE || DEFAULT_LIVE_VOICE,
    systemInstruction: buildSystemInstruction(body),
  });
}
