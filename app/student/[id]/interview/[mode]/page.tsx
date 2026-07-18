"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import { useRouter, notFound, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, Camera, AlertTriangle, ShieldAlert, FileText, Loader2, Eye, Smartphone, Users, MonitorOff, Clipboard, Brain, Check, X, ArrowRight, Clock, RefreshCw, ScanFace, Lock, BadgeCheck, ChevronRight } from "lucide-react";
import { Card, Button, ButtonLink, Badge, Eyebrow, Heading } from "@/components/ui";
import { authedFetch } from "@/lib/api-client";
import { resumeFingerprint } from "@/lib/resume-hash";
import { getStudent } from "@/lib/data";
import { useGeminiLive } from "@/hooks/useGeminiLive";
import { CodeRunner, type RunResult, type TestSummary } from "@/components/code/code-runner";
import { DEFAULT_LANGUAGE_ID, getCodeLanguage } from "@/lib/code-languages";
import { type Difficulty, DIFFICULTY_OPTIONS, DEFAULT_DIFFICULTY, normalizeDifficulty } from "@/lib/interview-difficulty";
import { isTechnicalRole } from "@/lib/role-classification";

// STT routing switch.
//
// We transcribe the candidate through Gemini Live's server-side
// `inputAudioTranscription` (the hook streams mic audio over a secure WebSocket).
// This is the RELIABLE path: it works in every browser and on any origin, and it
// shares the mic cleanly with the rest of the page.
//
// The forced-English browser Web Speech API (`recognition.lang = "en-US"`) would
// guarantee an English transcript, but in practice it conflicts with the page's
// other microphone use and aborts silently on many machines - leaving the mic
// dead. So it stays OFF by default; a working mic beats a guaranteed-English one.
//
// ⚠️ TRADE-OFF: Gemini auto-detects the spoken language for its transcript, and
// for strongly-accented English it sometimes renders the CAPTION in Hindi/Tamil/
// etc. script. The interviewer model still UNDERSTANDS the speech correctly
// regardless of the caption script - this only affects the on-screen text. There
// is no server-side knob to force the transcription language (confirmed against
// the Live API: the language is inferred from the audio).
const USE_BROWSER_STT = false;

// The forced-English browser Web Speech API is ONLY usable on a secure origin
// (https or localhost). On a plain-http origin - e.g. opening the dev server via
// its LAN IP like http://192.168.1.120:3000 - Chrome refuses the speech service
// (`service-not-allowed`) and the mic goes dead. In that case we MUST fall back
// to Gemini's server-side transcription, which streams audio over a secure
// WebSocket and therefore works on insecure origins too. This guard keeps STT
// working everywhere while still locking language to English wherever it can.
function browserSttUsable(): boolean {
  if (!USE_BROWSER_STT || typeof window === "undefined") return false;
  if (window.isSecureContext === false) return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

// The word-by-word LIVE CAPTION uses the same browser Web Speech API, but runs
// REGARDLESS of USE_BROWSER_STT (it's display-only, alongside the Gemini audio
// interview). It needs a secure origin + the API. When it can run we keep the mic
// as free as possible for it (skip the separate noise-monitoring stream), so the
// caption's recognition can start instead of losing the mic to another consumer.
function liveCaptionUsable(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext === false) return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

// ── Client-directed Live interview pacing ────────────────────────────────────
// The Gemini Live native-audio model is told NEVER to conclude on its own; the
// CLIENT decides when the interview ends and signals it with a private [WRAP_UP]
// control message. This makes premature/abrupt endings structurally impossible
// regardless of how weakly the model follows instructions.
//
// The round is sized to finish WITHIN A SINGLE Gemini Live socket session. Gemini
// Live caps one WebSocket at ~10 min; resuming across that cap is fragile (the
// browser-direct socket has no server to own reconnection), so a round that runs
// past 10 min risks freezing mid-interview. Keeping the hard cap under 10 min
// means the whole interview happens in one uninterrupted socket — no cap, no
// reconnect, no freeze. It also matches the model's own natural pacing (it wants
// to wrap ~8-10 min in), which stops the "said 'interview complete' then kept
// asking" loop that a too-high minimum used to force. (For genuinely long,
// multi-session interviews, build the server-side WS proxy first.)
//
// LIVE_MIN_MINUTES     - never wrap before this many minutes (a substance floor).
// LIVE_MIN_ANSWERS     - also require at least this many real answers before wrap.
// LIVE_MAX_MINUTES      - hard time backstop; the round always ends by here (crosses
// the ~10-min Live socket cap once, surviving via auto-reconnect).
// LIVE_HARD_CAP_ASKED  - absolute backstop on questions asked.
// ADAPTIVE length: the round ends when the interviewer has gathered enough signal
// (its natural close), bounded by a substance floor and a hard ceiling — NOT a
// fixed clock. A quick, shallow candidate can wrap near the floor; a strong one
// probed deep runs toward the ceiling. The ceiling crosses the ~10-min Gemini Live
// socket cap once, so this doubles as the live test of the reconnection fixes
// (PR #38 always-reconnect + PR #42 mid-turn state reset). If a >10-min interview
// stays seamless, adaptive length is solved with no new infra; if it ever freezes
// at the cap, the server-side WS proxy is the permanent fix.
// Client requested 10-15 min rounds. NOTE: this crosses the ~10-min Gemini Live
// socket cap on EVERY interview, so it leans hard on the reconnection fixes
// (PR #38 always-reconnect + PR #42 mid-turn state reset). If any interview
// freezes at ~10 min, the server-side WS proxy is required.
const LIVE_MIN_MINUTES = 10;
const LIVE_MIN_ANSWERS = 10;
const LIVE_MAX_MINUTES = 15;
const LIVE_HARD_CAP_ASKED = 40;
// ABSOLUTE never-exceed ceiling. When a hard cap (time or question count) is
// reached while the interviewer's last turn is still an UNANSWERED question, we
// do NOT cut the candidate off — we signal [WRAP_UP] and give a bounded grace
// so the round ends on a closing line or a completed answer, never on a naked
// dangling question. This ceiling caps that grace so the round still can't run
// away (15-min target + 2-min max grace).
const LIVE_ABSOLUTE_MAX_MINUTES = 17;
// Private director signals (never shown in the transcript; the system prompt
// tells the model these are control messages, not the candidate).
const LIVE_WRAP_UP_MSG = "[WRAP_UP]";
const LIVE_CONTINUE_MSG =
  "[DIRECTOR: Do not conclude yet. Continue the interview - ask your next question, building on the candidate's last answer and probing deeper. Do not say any closing or sign-off.]";

/**
 * Compact DNLA report for the interviewer prompt: each competency's score vs
 * its benchmark, with sub-benchmark items flagged as development areas so the
 * behavioural interview can target real weaknesses. Empty string when no DNLA
 * data exists for this id (real users until the provider import lands).
 */
function buildDnlaSummary(studentId: string): string {
  const dnla = getStudent(studentId)?.dnla ?? [];
  if (!dnla.length) return "";
  return dnla
    .map(
      (d) =>
        `${d.competency} (${d.group}): ${d.score}/7 vs benchmark ${d.benchmark}${d.score < d.benchmark ? " - development area" : ""}`
    )
    .join("\n");
}

/**
 * Condensed transcripts of the earlier rounds (AI interview + DNLA interview),
 * read from the localStorage transcripts each round persists. Fed to the FINAL
 * round so its questions build on what already happened. Empty string until the
 * candidate has completed at least one prior round.
 */
function buildPriorInterviews(studentId: string): string {
  if (typeof window === "undefined") return "";
  const rounds = [
    { label: "AI interview (technical)", keys: [`taledge:interview:${studentId}:technical`] },
    // Behavioural transcripts can land under either key depending on the route
    // taken (dnla funnel vs a standalone behavioural round) - try both, matching
    // how the Fit Score report reads them.
    { label: "DNLA behavioural interview", keys: [`taledge:interview:${studentId}:behavioural`, `taledge:interview:${studentId}:dnla`] },
  ];
  const parts: string[] = [];
  for (const r of rounds) {
    try {
      const raw = r.keys.map((k) => localStorage.getItem(k)).find(Boolean);
      if (!raw) continue;
      const msgs = JSON.parse(raw) as { role: string; content: string }[];
      if (!Array.isArray(msgs) || msgs.length === 0) continue;
      const condensed = msgs
        .map((mm) => `${mm.role === "assistant" ? "Interviewer" : "Candidate"}: ${mm.content}`)
        .join("\n");
      parts.push(`### ${r.label}\n${condensed}`);
    } catch {
      /* skip an unreadable/corrupt transcript */
    }
  }
  const joined = parts.join("\n\n");
  // Keep the payload bounded (the server also caps priorInterviews length).
  return joined.length > 24000 ? joined.slice(-24000) : joined;
}

type CandidateProfile = {
  fullName: string;
  email?: string;
  institution?: string;
  yearCohort?: string;
  aspiration?: string;
  targetRole: string;
  resumeSummary?: string;
  resumeSkills?: string[];
  resumeProjects?: { title: string; stack?: string[]; impact?: string }[];
};

function isSamePerson(box1: [number, number, number, number], box2: [number, number, number, number]): boolean {
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;
  
  const x_left = Math.max(x1, x2);
  const y_top = Math.max(y1, y2);
  const x_right = Math.min(x1 + w1, x2 + w2);
  const y_bottom = Math.min(y1 + h1, y2 + h2);
  
  if (x_right < x_left || y_bottom < y_top) {
    return false;
  }
  
  const intersectionArea = (x_right - x_left) * (y_bottom - y_top);
  const area1 = w1 * h1;
  const area2 = w2 * h2;
  const unionArea = area1 + area2 - intersectionArea;
  const iou = unionArea > 0 ? intersectionArea / unionArea : 0;
  
  // 1. If IoU is very high, it's definitely the same person detection
  if (iou > 0.7) {
    return true;
  }
  
  // 2. If one box is nested inside another (high intersection over smaller box)
  // AND their horizontal centers are closely aligned (e.g. upper-body box vs full-body box of the same person),
  // they represent the same person.
  const minArea = Math.min(area1, area2);
  const overlapSmaller = intersectionArea / minArea;
  if (overlapSmaller > 0.75) {
    const cx1 = x1 + w1 / 2;
    const cx2 = x2 + w2 / 2;
    const centerDistX = Math.abs(cx1 - cx2);
    // If horizontal centers are within 25% of the smaller box's width
    if (centerDistX < Math.min(w1, w2) * 0.25) {
      return true;
    }
  }
  
  return false;
}

type ProctoringStatus = {
  faceVisible: boolean;
  personCount: number;
  phoneDetected: boolean;
  cameraCovered: boolean;
  tabFocused: boolean;
  noiseDetected: boolean;
  /** True when a second/external display (HDMI, etc.) is attached. */
  externalDisplay: boolean;
};

// ── Accessible modal focus management ────────────────────────────────────────
// The dialogs in this page set aria-modal, but the browser does NOT trap focus for
// aria-modal alone. Attach the returned ref to a dialog's outer container: while
// `active`, it moves focus to the marked primary action (or the first focusable
// element), keeps Tab / Shift+Tab cycling inside the dialog, and restores focus to
// wherever the user was when the dialog closes. Behaviour-only; no logic changes.
function useDialogFocus<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Prefer an explicitly-marked, enabled primary action; else the first focusable.
    const primary = node.querySelector<HTMLElement>('[data-autofocus]:not([disabled])');
    const initial = primary ?? getFocusable()[0] ?? null;
    // Defer past the dialog's enter animation so the target is mounted/visible.
    const raf = requestAnimationFrame(() => initial?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (activeEl === first || !node.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !node.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      node.removeEventListener("keydown", onKeyDown);
      // Restore focus to where the user was before the dialog opened.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active]);
  return ref;
}

export default function InterviewPage({ params }: { params: Promise<{ id: string; mode: string }> }) {
  const { id, mode: rawMode } = use(params);
  // Validate the [mode] route param. The funnel is exactly TWO interviews:
  //   technical (AI interview, Vector A) → behavioural (Vector D) → fit-score.
  // "Final Interview" IS the behavioural round — there is no separate combined
  // round in the product — so /interview/final is an alias for the behavioural
  // interview (its transcript persists under the behavioural key, which the
  // Fit Score reads). "dnla" remains a legacy alias for behavioural links.
  if (rawMode !== "technical" && rawMode !== "behavioural" && rawMode !== "dnla" && rawMode !== "final") {
    notFound();
  }
  const mode = rawMode === "final" ? "behavioural" : rawMode;
  const router = useRouter();
  const pathname = usePathname();
  // The on-screen code compiler must be available wherever the interviewer can
  // set a coding task — only the technical round now that "final" aliases the
  // behavioural interview (this mirrors the coding instruction in the Live
  // system prompt, which is also gated to technical).
  const isTechRound = mode === "technical";
  // This page is shared by both tracks. When mounted under /exam/[id]/... the
  // candidate is a competitive-exam aspirant; the interviewer persona and all
  // in-flow navigation (dashboard, fit-score) stay within that namespace.
  const isExam = !!pathname && pathname.startsWith("/exam");
  const track: "placement" | "exam" = isExam ? "exam" : "placement";
  const flowBase = isExam ? "/exam" : "/student";

  // Human-readable label for the current round (used in headers / dialogs).
  const MODE_LABEL: Record<string, string> = {
    technical: "Technical",
    behavioural: "Behavioural",
    // "dnla" is a Gemini behavioural interview round. Per the PRD, DNLA is a
    // PSYCHOMETRIC QUESTIONNAIRE (Matrix 3, imported), NOT an AI interview — the
    // AI conversational round is the BEHAVIOURAL interview (Matrix 4). Label it as
    // such so it is never presented to the candidate as "DNLA". The funnel routes
    // through mode="behavioural"; this mode stays only for any direct link.
    dnla: "Behavioural",
    // "final" never reaches here — it is aliased to "behavioural" above.
  };
  // `modeLabel` for round 1 is ROLE-AWARE (set after `profile` loads, below):
  // "Technical" for a technical role, "Skills" for a non-technical one (MBA, BA,
  // BCom, sales, etc.). Other rounds use the static map.

  // Guided AI-interview funnel, per the PRD: exactly TWO interviews — Technical
  // (Vector A / Matrix 1) → Behavioural (Vector D / Matrix 4) → Fit Score. The DNLA
  // psychometric (Vector C / Matrix 3) is a SEPARATE questionnaire (the /[id]/dnla
  // page), NOT an interview. There is NO third "final combined" round in the PRD, so
  // it was removed from the funnel (it was also the round that hung on connect).
  const NEXT_STEP: Record<string, { href: string; label: string }> = {
    technical: { href: `${flowBase}/${id}/interview/behavioural`, label: "Continue to behavioural interview" },
    // Behavioural is the LAST interview → straight to the Fit Score.
    behavioural: { href: `${flowBase}/${id}/fit-score`, label: "View your Fit Score" },
    // Out-of-funnel direct links still resolve to the Fit Score ("final" is
    // aliased to "behavioural" before this map is consulted).
    dnla: { href: `${flowBase}/${id}/fit-score`, label: "View your Fit Score" },
  };
  const nextStep = NEXT_STEP[mode] ?? { href: `${flowBase}/${id}/fit-score`, label: "View Results & Report" };

  // Where a TERMINATED session (3 proctoring strikes / identity block) is sent.
  // Per product decision this is the candidate's RESULTS/REPORT page - NOT the
  // dashboard, and NOT the next interview round (a terminated candidate must not
  // be pushed forward into another round). For the final combined round that's
  // the comparison report; for every other round it's the Fit Score report.
  const terminationHref = `${flowBase}/${id}/fit-score`;

  // Gemini Live (realtime HD-voice interviewer). When it connects, it drives the
  // conversation (native-audio out + mic in + transcription); the text/TTS path
  // below is the fallback if Live can't connect.
  const live = useGeminiLive();
  const [liveActive, setLiveActive] = useState(false);
  // Guards the Live auto-conclude effect so it fires exactly once per session.
  const liveEndedRef = useRef(false);
  // Client-director state: whether we've already sent the [WRAP_UP] signal, the
  // fallback timer that force-ends if the model never delivers its closing, and
  // a bounded counter for "keep going" nudges when the model disobeys early.
  const wrapUpSentRef = useRef(false);
  const wrapUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continueNudgeRef = useRef(0);
  // Live transcript mirror + a bounded counter for the wrap-up fallback, so the
  // fallback never force-ends the round while the candidate still owes an answer
  // to the interviewer's most recent question (the "asked a question, then said
  // interview complete without my answer" bug).
  const liveMsgsRef = useRef<{ role: string; text: string }[]>([]);
  const wrapFallbackCountRef = useRef(0);
  // Wall-clock start of the live interview (set when the session goes live).
  // Drives the time-based pacing so the round runs its ~10-15 min adaptive window
  // and is hard-capped at LIVE_MAX_MINUTES, independent of how many questions asked.
  const liveStartedAtRef = useRef(0);
  // Mirror the Live transcript into the page (drives the chat UI + the existing
  // localStorage persistence that the Fit Score report reads). Strip any
  // [CONCLUDE] control token so it is never shown to / spoken at the candidate.
  useEffect(() => {
    if (liveActive && live.messages.length) {
      setMessages(
        live.messages.map((m) => ({
          role: m.role,
          // Strip any control tokens the model might echo so they never show in
          // the transcript shown to / spoken at the candidate.
          text: m.text
            .replace(/\[\s*conclude\s*\]/gi, "")
            .replace(/\[\s*wrap[\s_-]*up\s*\]/gi, "")
            .replace(/\[\s*director:[^\]]*\]/gi, "")
            .trim(),
        }))
      );
    }
  }, [live.messages, liveActive]);
  // Reflect the Live AI's speaking state on the visualizer.
  useEffect(() => {
    if (liveActive) setAiSpeaking(live.aiSpeaking);
  }, [live.aiSpeaking, liveActive]);

  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [interimDraft, setInterimDraft] = useState("");
  // Word-by-word live caption from a PARALLEL browser SpeechRecognition that runs
  // only to DISPLAY the candidate's words in real time. It never sends anything
  // and never touches the Gemini interview; if it can't run (no Web Speech API /
  // insecure origin / mic blocked) the UI falls back to Gemini's transcription.
  const [liveCaption, setLiveCaption] = useState("");
  const captionRecogRef = useRef<any>(null);
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  // Role-aware round-1 identity. A technical role runs a Technical interview
  // (with the coding tool); a non-technical role (MBA/BA/BCom/sales/finance/…)
  // runs a Skills interview and NEVER sees a coding task.
  const roundIsTechnical = isTechnicalRole(profile?.targetRole);
  const modeLabel =
    mode === "technical"
      ? roundIsTechnical
        ? "Technical"
        : "Skills"
      : MODE_LABEL[mode] ?? "Assessment";
  const showCodeTool = isTechRound && track === "placement" && roundIsTechnical;
  
  const [warnings, setWarnings] = useState(0);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const webcamEnabledRef = useRef(false);
  const [isCodingMode, setIsCodingMode] = useState(false);
  // In-interview code compiler state: selected language + the latest run result,
  // which is appended to the submitted answer so the AI evaluates the code.
  const [codeLanguage, setCodeLanguage] = useState(DEFAULT_LANGUAGE_ID);
  const [codeResult, setCodeResult] = useState<RunResult | null>(null);
  const [codeTestSummary, setCodeTestSummary] = useState<TestSummary | null>(null);
  // Timed coding challenge: a self-contained problem with a human-appropriate
  // time budget, started when the candidate opens the Code tab.
  const [codingChallenge, setCodingChallenge] = useState<{ title: string; prompt: string; minutes: number } | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [challengeRemaining, setChallengeRemaining] = useState<number | null>(null); // seconds
  // True for the duration of a dedicated, time-boxed coding interview block -
  // during which the normal Q&A is paused until submit / cancel / timeout.
  const [codeInterviewActive, setCodeInterviewActive] = useState(false);
  const challengeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [setupStep, setSetupStep] = useState<"resume" | "rules" | "systemcheck" | "verify" | "interview">("rules");
  // Pre-interview difficulty the candidate picks on the rules screen. It only
  // sets where the AI STARTS — the interviewer still auto-judges and adapts.
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  // Pre-flight system check (camera / mic / lighting / network / browser). All
  // checks are LOCAL browser APIs - they make no paid API calls. Camera + mic
  // must pass to continue; lighting / network are advisory warnings.
  type CheckStatus = "checking" | "pass" | "warn" | "fail";
  const [sysChecks, setSysChecks] = useState<{ camera: CheckStatus; mic: CheckStatus; lighting: CheckStatus; network: CheckStatus; browser: CheckStatus }>(
    { camera: "checking", mic: "checking", lighting: "checking", network: "checking", browser: "checking" }
  );
  const [micLevel, setMicLevel] = useState(0); // live 0..1 input meter for the mic test
  const sysMicCleanupRef = useRef<null | (() => void)>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  // `unavailable` marks a SOFT-PASS: the identity service (Gemini) was down/timed
  // out, so we could neither confirm nor reject the candidate. We let them proceed
  // (status stays "success") but keep this flag set so the UI shows it was NOT a
  // clean verification and the session is visibly flagged for manual review.
  const [verificationResult, setVerificationResult] = useState<{status: "idle" | "verifying" | "success" | "error", message?: string, unavailable?: boolean}>({status: "idle"});
  const [hasStarted, setHasStarted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  // Specific termination reason (impersonation, etc.) shown on the blocked screen.
  const [blockReason, setBlockReason] = useState<string>("");
  // One-shot identity-mismatch warning shown ~2s before termination.
  const [identityWarning, setIdentityWarning] = useState<string>("");
  const [warningMessage, setWarningMessage] = useState("");
  const [preloadedSession, setPreloadedSession] = useState<any>(null);
  const [aiVolume, setAiVolume] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [proctoringStatus, setProctoringStatus] = useState<ProctoringStatus>({
    faceVisible: false, personCount: 0, phoneDetected: false, cameraCovered: false, tabFocused: true, noiseDetected: false, externalDisplay: false,
  });
  const [violationLog, setViolationLog] = useState<string[]>([]);
  // Diagnostic: the objects the on-device vision model currently sees (class +
  // confidence). Surfaced in the security panel so a "device not detected" report
  // can be traced to whether COCO-SSD is even proposing a box for the phone.
  const [detectedObjects, setDetectedObjects] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  // Live lighting estimate for the Face-ID verify step (canvas brightness).
  const [lightingState, setLightingState] = useState<"good" | "dark" | "bright" | "unknown">("unknown");
  // Surfaces a finite-timeout / failure on the interview-start ("Connecting...")
  // path so the UI does not spin forever. Retry re-runs startInterview().
  const [connectError, setConnectError] = useState<string | null>(null);
  // Surfaced speech-to-text problems (permission denied, no mic, insecure
  // origin) so a silent STT failure is visible and the candidate can fall back to
  // typing instead of staring at a dead mic.
  const [micError, setMicError] = useState<string | null>(null);
  // Cross-browser STT routing. Chrome/Edge expose the Web Speech API, so we use
  // forced-English browser recognition there. Firefox/Safari do NOT implement it,
  // so we instead stream the candidate's mic to Gemini Live (captureMic:true) and
  // use its server-side transcription - which works in every browser. The ref is
  // read synchronously when connecting; the state only drives UI copy.
  const geminiCaptureRef = useRef(false);
  const [usingGeminiStt, setUsingGeminiStt] = useState(false);
  // Non-blocking send/transcribe failure banner (the drafted answer is restored
  // separately so the candidate never loses their typed/spoken response).
  const [sendError, setSendError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  // Dedicated <video> for the Face-ID verify dialog. It shares the SAME
  // MediaStream as the background proctoring feed (a stream can drive multiple
  // <video> elements), so the candidate sees a real live preview while verifying.
  const verifyVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  // Enrolled reference frame (set on successful Face-ID verify) + a live mirror
  // of the detected person count - both read inside long-lived proctoring
  // closures to run continuous anti-impersonation identity checks.
  const referenceImageRef = useRef<string | null>(null);
  const personCountRef = useRef(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  // Whether the chat should auto-scroll to the latest content. Starts true and is
  // flipped off only when the user scrolls UP to re-read, then back on when they
  // return near the bottom (see the scroll listener effect).
  const pinToBottomRef = useRef(true);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Selected browser fallback voice - a female English voice to match the
  // previous (female) Gemini interviewer voice. Populated once voices load.
  const ttsVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const proctoringRef = useRef({ blocked: false, isWarningVisible: false });
  // Mirror of sessionId for use inside long-lived proctoring closures, so each
  // violation can be reported to the server-authoritative proctor endpoint.
  const sessionIdRef = useRef<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef("");
  const modelRef = useRef<any>(null);
  // BlazeFace model - face + eye/nose/ear landmarks used to estimate whether the
  // candidate is looking AT the screen (gaze/eye-contact proctoring). Optional:
  // proctoring still runs if it fails to load.
  const faceModelRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const connectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedRef = useRef(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  // Mirror the chosen difficulty so network callbacks read the live value, never
  // a stale closure.
  const difficultyRef = useRef<Difficulty>(DEFAULT_DIFFICULTY);
  const [proctoringReady, setProctoringReady] = useState(false);
  const doneRef = useRef(false);
  // Mirror aiSpeaking into a ref so the speech-recognition onresult handler
  // (whose closure captures state at setup time) can read the LIVE value and
  // ignore the mic while the AI's TTS has the floor - a half-duplex guard that
  // stops the interviewer's own voice being transcribed as the candidate's answer.
  const aiSpeakingRef = useRef(false);
  useEffect(() => { aiSpeakingRef.current = aiSpeaking; }, [aiSpeaking]);

  // WORD-BY-WORD LIVE CAPTION. A parallel browser SpeechRecognition (en-US,
  // interimResults) that ONLY drives the on-screen caption so the candidate sees
  // their words appear as they speak. It does not send turns or affect the Gemini
  // interview at all. While the AI has the floor its results are ignored (so the
  // interviewer's TTS can't leak in). Best-effort: any failure is swallowed and
  // the UI falls back to Gemini's transcription.
  //
  // CRITICAL: this must be STARTED before Gemini grabs the mic (see
  // handleStartInterview) so the browser recognition claims the mic FIRST -
  // otherwise Gemini's capture shuts it out and the caption never appears.
  const stopLiveCaption = useCallback(() => {
    const r = captionRecogRef.current;
    if (r) { r.shouldRun = false; try { r.stop(); } catch {} captionRecogRef.current = null; }
    setLiveCaption("");
  }, []);

  const startLiveCaption = useCallback(() => {
    if (!liveCaptionUsable() || captionRecogRef.current || doneRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.shouldRun = true;
    rec.onresult = (e: any) => {
      if (aiSpeakingRef.current || doneRef.current) return; // ignore the AI's voice
      let interim = "", finalStr = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalStr += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setLiveCaption((finalStr + interim).trim());
    };
    rec.onend = () => { if (captionRecogRef.current?.shouldRun) { try { rec.start(); } catch {} } };
    rec.onerror = (ev: any) => {
      const err = ev?.error || "";
      if (err === "not-allowed" || err === "audio-capture" || err === "service-not-allowed") {
        if (captionRecogRef.current) captionRecogRef.current.shouldRun = false;
      }
      // no-speech / aborted / network are transient - onend will restart.
    };
    captionRecogRef.current = rec;
    try { rec.start(); } catch {}
  }, []);

  useEffect(() => {
    if (!liveActive || isCodingMode || done) { stopLiveCaption(); return; }
    startLiveCaption(); // idempotent - usually already started in handleStartInterview
    return () => stopLiveCaption();
  }, [liveActive, isCodingMode, done, startLiveCaption, stopLiveCaption]);

  // Clear the word-by-word caption when the interviewer takes the floor, so the
  // candidate's previous answer doesn't linger while the AI responds.
  useEffect(() => {
    if (aiSpeaking || live.partialAi) setLiveCaption("");
  }, [aiSpeaking, live.partialAi]);
  useEffect(() => {
    doneRef.current = done;
    if (done) {
      if (recognitionRef.current) {
        recognitionRef.current.shouldListen = false;
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setRecording(false);
    }
  }, [done]);

  // Restore a previously chosen difficulty once on mount (per device).
  useEffect(() => {
    try {
      const saved = localStorage.getItem("taledge:interview-difficulty");
      if (saved) {
        const d = normalizeDifficulty(saved);
        setDifficulty(d);
        difficultyRef.current = d;
      }
    } catch {}
  }, []);

  // Keep the ref + persistence in sync with the chosen difficulty.
  useEffect(() => {
    difficultyRef.current = difficulty;
    try { localStorage.setItem("taledge:interview-difficulty", difficulty); } catch {}
  }, [difficulty]);

  // Initialize page, camera, and start interview
  useEffect(() => {
    let localProfile = null;
    try {
      let stored = localStorage.getItem("taledge:workspace-profile");
      if (!stored) {
        stored = localStorage.getItem("taledge:demo-profile");
      }
      if (stored) {
         localProfile = JSON.parse(stored);
         setProfile(localProfile);
      }
    } catch {}

    // Gate the interview behind a résumé: the questions are tailored to it, so
    // if none was uploaded (onboarding skipped) show the upload step first.
    const hasResume = !!(
      localProfile &&
      (localProfile.resumeSummary ||
        (localProfile.resumeSkills && localProfile.resumeSkills.length > 0) ||
        (localProfile.resumeProjects && localProfile.resumeProjects.length > 0))
    );
    if (!hasResume) setSetupStep("resume");

    const resumeContext = localProfile ? [
      localProfile.resumeSummary,
      localProfile.resumeSkills && localProfile.resumeSkills.length > 0 ? `Skills: ${localProfile.resumeSkills.join(", ")}` : "",
      localProfile.resumeProjects && localProfile.resumeProjects.length > 0 ? `Projects: ${localProfile.resumeProjects.map((p: any) => `${p.title} (${p.stack?.join(", ") || ""}): ${p.impact || ""}`).join("; ")}` : "",
      localProfile.aspiration ? `Goal/Target Placement: ${localProfile.aspiration}` : ""
    ].filter(Boolean).join("\n") : "";

    // Preload first question. This POST creates the server session whose id every
    // later step depends on (face-verify persistence, proctoring, the Live
    // interviewer). A failed/rate-limited start used to be swallowed silently,
    // leaving sessionIdRef null with no signal, so we retry once and log the
    // failure instead of failing invisibly.
    // Fingerprint the resume this round is grounded in. Persisted with the
    // transcript so the Fit Score can detect a resume swap between interview
    // and scoring (see lib/resume-hash.ts).
    const resumeFp = localProfile ? resumeFingerprint(localProfile) : "";
    try {
      localStorage.setItem(`taledge:interview:${id}:${mode}:resumeHash`, resumeFp);
    } catch {}

    const startBody = JSON.stringify({
       studentId: id,
       candidateName: localProfile?.fullName || "Candidate",
       role: localProfile?.targetRole || (isExam ? "the exam" : "Candidate"),
       mode,
       // stage is the legacy shorthand for the AI interview rounds only;
       // dnla/final are selected via `mode`.
       ...(mode === "technical" || mode === "behavioural" ? { stage: mode === "technical" ? 1 : 2 } : {}),
       track,
       resumeSummary: resumeContext,
       resumeFingerprint: resumeFp,
       dnlaSummary: buildDnlaSummary(id),
       // The final round builds on the earlier AI + DNLA transcripts.
       ...(mode === "behavioural" ? { priorInterviews: buildPriorInterviews(id) } : {})
    });
    const preloadInterviewSession = async (attempt = 1): Promise<void> => {
      try {
        const r = await authedFetch("/api/interview/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: startBody,
        });
        const data = await r.json();
        if (data.ok) {
          setPreloadedSession(data);
          // Expose the session id immediately (the server already created the
          // session). Face verification runs in the setup step BEFORE the
          // interview is started, and needs this ref to persist faceVerified -
          // otherwise the voice endpoint 403s every answer. The `sessionId` state
          // is still set later in startInterview() to flip the "Live" UI.
          sessionIdRef.current = data.sessionId;
          return;
        }
        // Reached the server but it declined to start the session (rate limit,
        // validation, transient error). Retry once, then log so it's traceable.
        if (attempt < 2) {
          await new Promise((res) => setTimeout(res, 1200));
          return preloadInterviewSession(attempt + 1);
        }
        console.error("[interview] /api/interview/start did not create a session", data);
      } catch (err) {
        // Network/parse failure. Retry once before giving up.
        if (attempt < 2) {
          await new Promise((res) => setTimeout(res, 1200));
          return preloadInterviewSession(attempt + 1);
        }
        console.error("[interview] /api/interview/start request failed", err);
      }
    };
    void preloadInterviewSession();

    const timer = setInterval(() => setElapsed(e => e + 1), 1000);

    // Auto-enable camera
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        mediaStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setWebcamEnabled(true);
        webcamEnabledRef.current = true;
        setCameraError(null);
      })
      .catch((err) => {
        console.error("Camera error:", err);
        // Surface camera/getUserMedia failures to the candidate instead of
        // swallowing them - a proctored interview cannot proceed without it.
        const name = err?.name || "";
        const reason =
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera access was denied. Please allow camera permissions in your browser and reload this page."
            : name === "NotFoundError" || name === "DevicesNotFoundError"
            ? "No camera was found on this device. A working webcam is required for this proctored assessment."
            : name === "NotReadableError" || name === "TrackStartError"
            ? "Your camera is already in use by another application. Close it and reload this page."
            : "We could not access your camera. A working webcam is required for this proctored assessment.";
        setCameraError(reason);
      });

    // Request audio stream for noise monitoring.
    //
    // ⚠️ SKIP this whenever the browser Web Speech API can run (forced-English STT
    // OR the word-by-word live caption). Holding a SECOND microphone stream here
    // collides with Chrome's SpeechRecognition (which opens its own mic capture) -
    // recognition then aborts in a silent loop and the live caption falls back to
    // Gemini's slower transcription. A real-time caption matters more than passive
    // noise proctoring, so we leave the mic free for SpeechRecognition.
    if (!browserSttUsable() && !liveCaptionUsable()) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          audioStream = stream;
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            noiseContext = new AudioContextClass();
            audioAnalyzer = noiseContext.createAnalyser();
            audioAnalyzer.fftSize = 256;
            audioSource = noiseContext.createMediaStreamSource(stream);
            audioSource.connect(audioAnalyzer);
          } catch (e) {
            console.error("Audio analyzer setup error:", e);
          }
        })
        .catch((err) => console.warn("Mic access denied or unavailable for noise check:", err));
    } else {
      // Browser STT path: prime the microphone permission up front WITHOUT holding
      // the stream - grab it, then immediately stop every track so the mic is left
      // free for webkitSpeechRecognition. This surfaces the permission prompt
      // during setup (not mid-interview) and avoids the two-streams-one-mic clash.
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => { stream.getTracks().forEach((t) => t.stop()); })
        .catch((err) => console.warn("Mic permission not granted for speech recognition:", err));
    }

    // Load Proctoring Vision AI.
    //
    // IMPORTANT: TensorFlow's UMD CDN bundles detect Monaco Editor's AMD
    // `define()` (pulled in by @monaco-editor/react for the in-interview code
    // compiler) and try to register as ANONYMOUS AMD modules. That both throws
    // "Can only have one anonymous define call per script file" and prevents them
    // from attaching to `window` (so cocoSsd/blazeface would be undefined). We
    // hide `define` while each script evaluates so the UMD bundles take their
    // plain browser-global branch, then restore `define` for Monaco's loader.
    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.appendChild(s);
      });

    const loadTF = async () => {
      const fallbackTimeout = setTimeout(() => {
        if (!modelRef.current) {
          console.warn("TFJS/COCO-SSD model loading timed out. Enabling interview without AI vision proctoring.");
          setProctoringReady(true);
        }
      }, 6000);

      const w = window as any;
      const prevDefine = w.define;
      const restoreDefine = () => { try { w.define = prevDefine; } catch { /* noop */ } };
      // Neutralize AMD for the whole UMD-load window.
      try { w.define = undefined; } catch { /* noop */ }

      try {
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.18.0/dist/tf.min.js");
        // BlazeFace (gaze) + COCO-SSD (object detection) both depend on tf; load
        // them in parallel. Best-effort - a failure of either is non-fatal.
        await Promise.all([
          loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js").catch(() => {}),
          loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js").catch(() => {}),
        ]);
      } catch (err) {
        console.error("TFJS script load failed:", err);
        restoreDefine();
        clearTimeout(fallbackTimeout);
        setProctoringReady(true);
        return;
      }

      // Scripts have evaluated and attached to window - restore AMD for Monaco.
      restoreDefine();

      // Gaze model (optional - eye-contact/gaze proctoring).
      try {
        w.blazeface?.load().then((m: any) => { faceModelRef.current = m; }).catch(() => {});
      } catch { /* gaze detection is optional */ }

      // Object-detection model (multi-person / phone proctoring).
      try {
        if (w.cocoSsd) {
          w.cocoSsd.load().then((model: any) => {
            modelRef.current = model;
            clearTimeout(fallbackTimeout);
            setProctoringReady(true);
          }).catch((e: any) => {
            console.error("CocoSSD load failed, using fallback:", e);
            clearTimeout(fallbackTimeout);
            setProctoringReady(true);
          });
        } else {
          clearTimeout(fallbackTimeout);
          setProctoringReady(true);
        }
      } catch (err) {
        console.error("CocoSSD init failed, using fallback:", err);
        clearTimeout(fallbackTimeout);
        setProctoringReady(true);
      }
    };
    loadTF();

    // Speech-to-text. By default (USE_BROWSER_STT=false) we transcribe the
    // candidate through Gemini Live's server-side `inputAudioTranscription` in
    // EVERY browser - set up in startInterview via captureMic - so STT is
    // consistent and works where the Web Speech API is absent (Firefox/Safari).
    // Browser SpeechRecognition is only initialised when explicitly re-enabled.
    // Either way mic access needs a secure context; warn if we lack one.
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    // Use forced-English browser STT ONLY where it actually works (secure origin
    // + Web Speech API). Otherwise we transcribe through Gemini's server-side
    // capture, which works on any origin - so STT is never dead.
    const useBrowserStt = browserSttUsable();
    if (!useBrowserStt) {
      geminiCaptureRef.current = true;
      setUsingGeminiStt(true);
    }
    // Only the browser STT path needs a secure origin; the Gemini fallback does
    // not, so don't show the "needs https" warning when we're on that fallback.
    if (useBrowserStt) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 3;

      recognition.onstart = () => { setRecording(true); setMicError(null); };
      recognition.onresult = (event: any) => {
        // Half-duplex: ignore anything captured while the AI is speaking (or the
        // round is done) so the interviewer's TTS can't leak into the answer.
        if (aiSpeakingRef.current || doneRef.current) return;
        let finalStr = "";
        let interimStr = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            let bestAlt = event.results[i][0];
            for (let a = 1; a < event.results[i].length; a++) {
              if (event.results[i][a].confidence > bestAlt.confidence) {
                bestAlt = event.results[i][a];
              }
            }
            finalStr += bestAlt.transcript + " ";
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }
        
        if (finalStr) {
          draftRef.current += finalStr;
          setDraft(draftRef.current);
        }
        
        // Zero-latency DOM update of the editable box…
        if (textAreaRef.current) {
          textAreaRef.current.value = draftRef.current + interimStr;
        }
        // …and ALWAYS mirror the interim text into state so the on-screen "You -
        // speaking…" caption updates live (the candidate's words must be visible
        // as a caption, not only inside the input box).
        setInterimDraft(interimStr);

        // Auto-send silence detection (4 seconds)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const btn = document.getElementById("send-btn");
          if (btn && !btn.hasAttribute("disabled")) {
            btn.click();
          }
        }, 4000);
      };
      // Surface failures instead of dying silently. Permission / device / not-
      // supported errors are fatal (stop the restart loop + show a message);
      // no-speech / aborted / network are transient and handled by onend's restart.
      recognition.onerror = (e: any) => {
        const err = e?.error || "unknown";
        console.warn("[stt] recognition error:", err);
        // ONLY a genuine, user-initiated permission denial is fatal - that's the
        // one case auto-restarting can't recover. Everything else (incl.
        // `service-not-allowed`, which Chrome also throws transiently on a flaky
        // network, a rapid restart, a busy speech backend, or a non-secure
        // context) must fall through to onend's auto-restart, or one stray event
        // would silently kill STT for the whole round.
        if (err === "not-allowed") {
          if (recognitionRef.current) recognitionRef.current.shouldListen = false;
          setMicError("Microphone access is blocked. Click the mic icon in your browser's address bar to allow it and reload - or type your answer below.");
        } else if (err === "audio-capture") {
          setMicError("No microphone was detected. Check your mic, or type your answer below.");
        } else if (err === "service-not-allowed" && typeof window !== "undefined" && window.isSecureContext === false) {
          // Non-secure origin (e.g. opened via a http://LAN-IP address): Chrome
          // will never grant the speech service here. Tell the candidate how to
          // fix it instead of looping silently; keep typing available.
          setMicError("Speech-to-text needs a secure (https) or localhost connection. Open the app on http://localhost, or type your answer below.");
        }
        // no-speech / aborted / network / transient service-not-allowed → let
        // onend restart automatically (shouldListen stays true).
      };
      recognition.onend = () => {
        setRecording(false);
        if (recognitionRef.current?.shouldListen) {
           try { recognitionRef.current.start(); } catch(e) {}
        }
      };
      recognitionRef.current = recognition;
    }

    // ==== PROCTORING ENGINE ====

    const issueWarning = (reason: string) => {
      // Only issue warnings after the interview has actually started
      if (!hasStartedRef.current) return;
      if (proctoringRef.current.blocked || proctoringRef.current.isWarningVisible) return;
      proctoringRef.current.isWarningVisible = true;

      setViolationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${reason}`]);

      // Report to the server-authoritative proctor sink (fire-and-forget). The
      // server owns the real count + blocked state, so reloading the page can't
      // wipe violations, and the voice endpoint refuses blocked sessions.
      if (sessionIdRef.current) {
        authedFetch("/api/interview/proctor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current, event: "violation", reason }),
        }).catch(() => {});
      }

      setWarnings(prev => {
        const newWarnings = prev + 1;
        if (newWarnings >= 3) {
          proctoringRef.current.blocked = true;
          setBlocked(true);
        } else {
          setWarningMessage(`PROCTORING WARNING (${newWarnings}/3): ${reason}`);
        }
        return newWarnings;
      });
    };

    // 1. Focus / attention tracking. The candidate must stay ON the interview
    // screen. We warn only after they have been off-screen (tab hidden OR the
    // window lost focus - e.g. alt-tabbed to another app) for longer than a
    // threshold, so a momentary blur never triggers a false positive.
    const FOCUS_LOSS_THRESHOLD_MS = 1200;
    let unfocusTimer: ReturnType<typeof setTimeout> | null = null;
    const clearUnfocusTimer = () => {
      if (unfocusTimer) {
        clearTimeout(unfocusTimer);
        unfocusTimer = null;
      }
    };
    const onScreenLost = () => {
      setProctoringStatus(prev => ({ ...prev, tabFocused: false }));
      if (!hasStartedRef.current || proctoringRef.current.blocked || unfocusTimer) return;
      unfocusTimer = setTimeout(() => {
        unfocusTimer = null;
        issueWarning("You looked away from the interview screen for too long. Keep your focus on the screen.");
      }, FOCUS_LOSS_THRESHOLD_MS);
    };
    const onScreenBack = () => {
      clearUnfocusTimer();
      setProctoringStatus(prev => ({ ...prev, tabFocused: true }));
    };
    const handleVisibilityChange = () => {
      if (document.hidden) onScreenLost();
      else onScreenBack();
    };

    // 2. Keyboard shortcut blocking
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Alt+Tab, Ctrl+Tab, Ctrl+W, Ctrl+N, Ctrl+Shift+I (devtools), F12
      if (
        (e.altKey && e.key === "Tab") ||
        (e.ctrlKey && e.key === "Tab") ||
        (e.ctrlKey && e.key === "w") ||
        (e.ctrlKey && e.key === "n") ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.shiftKey && e.key === "J") ||
        (e.ctrlKey && e.key === "u") ||
        e.key === "F12" ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 3. Disable drag events 
    const handleDragStart = (e: DragEvent) => e.preventDefault();

    // 4. Detect window resize (potential devtools)
    let lastWidth = window.outerWidth;
    const handleResize = () => {
      const widthDiff = Math.abs(window.outerWidth - window.innerWidth);
      if (widthDiff > 200 && lastWidth === window.outerWidth) {
        // DevTools likely opened
        setViolationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] DevTools size anomaly detected`]);
      }
      lastWidth = window.outerWidth;
    };

    // 4c. Copy / cut blocking - each attempt is a proctoring warning (shared
    // 3-strike pipeline, so repeated copying ends the assessment).
    const handleCopyAttempt = (e: Event) => {
      e.preventDefault();
      issueWarning("Copying interview content is not allowed.");
    };

    // 4d. Full-screen lock. The assessment runs full-screen; LEAVING it warns
    // ONCE (and we send the candidate back in), then terminates on the next exit.
    let fullscreenExits = 0;
    const inFullscreen = () =>
      !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    const handleFullscreenChange = () => {
      if (!hasStartedRef.current || proctoringRef.current.blocked || doneRef.current) return;
      if (inFullscreen()) return; // entered / re-entered → ignore
      fullscreenExits++;
      const reason = "You exited full-screen mode.";
      setViolationLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${reason}`]);
      if (sessionIdRef.current) {
        authedFetch("/api/interview/proctor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current, event: "violation", reason }),
        }).catch(() => {});
      }
      if (fullscreenExits >= 2) {
        proctoringRef.current.blocked = true;
        setBlockReason("You exited full-screen mode again. For exam integrity, this assessment has been terminated.");
        setBlocked(true);
      } else {
        proctoringRef.current.isWarningVisible = true;
        setWarningMessage("FULL-SCREEN REQUIRED: You left full-screen. Return to full-screen to continue - exiting again will end your assessment.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Window blur/focus catches leaving the screen even when the tab stays
    // technically visible (alt-tab to another app, second monitor, devtools).
    window.addEventListener("blur", onScreenLost);
    window.addEventListener("focus", onScreenBack);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("copy", handleCopyAttempt);
    document.addEventListener("cut", handleCopyAttempt);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange as EventListener);
    window.addEventListener("resize", handleResize);

    // 4b. External display / HDMI detection. A second or extended monitor during
    // a proctored interview is a hard integrity breach -> warn + terminate.
    // NOTE: browsers cannot passively detect generic USB/HID device plug-ins
    // (sandbox); `screen.isExtended` is the reliable signal for an external
    // display, which is the actual screen-mirroring/second-screen cheat vector.
    let extDisplayFlagged = false;
    const checkExternalDisplay = () => {
      const extended =
        typeof window !== "undefined" && (window.screen as any)?.isExtended === true;
      setProctoringStatus((prev) =>
        prev.externalDisplay === extended ? prev : { ...prev, externalDisplay: extended }
      );
      if (!hasStartedRef.current || proctoringRef.current.blocked) return;
      if (extended && !extDisplayFlagged) {
        extDisplayFlagged = true;
        const reason = "External display / HDMI detected. Disconnect all extra monitors to continue.";
        setViolationLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${reason}`]);
        if (sessionIdRef.current) {
          authedFetch("/api/interview/proctor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: sessionIdRef.current, event: "violation", reason }),
          }).catch(() => {});
        }
        // An external display is not a 3-strike nudge - terminate immediately.
        proctoringRef.current.blocked = true;
        setBlocked(true);
      } else if (!extended) {
        extDisplayFlagged = false;
      }
    };
    checkExternalDisplay();
    const displayInterval = setInterval(checkExternalDisplay, 1500);
    try {
      (window.screen as any)?.addEventListener?.("change", checkExternalDisplay);
    } catch {
      /* screen change event not supported */
    }

    // 5. Advanced AI Vision Tracking + Canvas brightness detection
    let missingFrames = 0;
    let darkFrames = 0;
    let intrusionFrames = 0;
    let phoneFrames = 0;
    let gazeAwayFrames = 0;
    let wasAbsent = false;

    // Background noise detection context and nodes
    let audioStream: MediaStream | null = null;
    let audioAnalyzer: AnalyserNode | null = null;
    let audioSource: MediaStreamAudioSourceNode | null = null;
    let noiseContext: AudioContext | null = null;

    // ===== IDENTITY CONTINUITY (anti-impersonation) =====
    // After enrolment (Face-ID verify), keep confirming the SAME person is at
    // the camera. A sustained mismatch warns at +2s and terminates at +5s
    // (wall-clock). A ONE-TIME grace: if the enrolled candidate returns while
    // warned, the test resumes - but only once; any later mismatch ends it.
    let identityBusy = false;
    let pardonUsed = false;        // the single resume-grace has been spent
    let episodeActive = false;     // a mismatch escalation is in progress
    let episodeStart = 0;          // wall-clock (ms) of first detection
    let episodeWarned = false;     // the +2s warning has been shown
    let episodeChecking = false;   // an identity re-check is in flight
    let lastEpisodeCheckAt = 0;
    let episodeMonitor: ReturnType<typeof setInterval> | null = null;
    const IDENTITY_WARN_MSG =
      "A different person has been detected at the camera. The enrolled candidate must return NOW, or this assessment will be terminated.";

    const captureFrame = (): string | null => {
      const v = videoRef.current;
      if (!v || !webcamEnabledRef.current || !v.videoWidth) return null;
      try {
        const c = document.createElement("canvas");
        const scale = Math.min(1, 640 / v.videoWidth);
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round((v.videoHeight || 480) * scale);
        const ctx = c.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.8);
      } catch {
        return null;
      }
    };

    const runIdentityCheck = async (): Promise<"same" | "different" | "unknown"> => {
      if (!referenceImageRef.current) return "unknown";
      const frame = captureFrame();
      if (!frame) return "unknown";
      try {
        const res = await authedFetch("/api/interview/verify-face", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: frame,
            referenceBase64: referenceImageRef.current,
            sessionId: sessionIdRef.current,
          }),
        });
        const data = await res.json();
        if (data && data.samePerson === false) return "different";
        return "same";
      } catch {
        return "unknown";
      }
    };

    const terminateImpersonation = () => {
      // Never terminate once the interview is finishing/finished - the identity
      // monitor runs on a timer and could otherwise fire during the closing.
      if (proctoringRef.current.blocked || doneRef.current || !hasStartedRef.current) return;
      proctoringRef.current.blocked = true;
      setIdentityWarning("");
      const reason = "A different person was detected at the camera. For exam integrity, this assessment has been terminated.";
      setBlockReason(reason);
      setViolationLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Face identity mismatch - a different person was detected`]);
      if (sessionIdRef.current) {
        authedFetch("/api/interview/proctor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current, event: "violation", reason: "Face identity mismatch - different person detected" }),
        }).catch(() => {});
      }
      setBlocked(true);
    };

    const endEpisode = () => {
      episodeActive = false;
      if (episodeMonitor) {
        clearInterval(episodeMonitor);
        episodeMonitor = null;
      }
    };

    // Wall-clock escalation tick (runs every 250ms during a mismatch episode):
    //   • t ≥ 2s → show ONE warning
    //   • a re-check says "same" after warning → RESUME (consumes the one-time
    //     grace) - the enrolled candidate came back
    //   • t ≥ 5s with a different person still present → terminate
    const episodeTick = async () => {
      if (!episodeActive) return;
      if (proctoringRef.current.blocked) {
        endEpisode();
        return;
      }
      const elapsed = Date.now() - episodeStart;
      if (elapsed >= 2000 && !episodeWarned) {
        episodeWarned = true;
        setIdentityWarning(IDENTITY_WARN_MSG);
      }
      if (episodeChecking) return;
      const due = Date.now() - lastEpisodeCheckAt >= 1500;
      const deadline = elapsed >= 5000;
      if (!due && !deadline) return;
      episodeChecking = true;
      lastEpisodeCheckAt = Date.now();
      const v = await runIdentityCheck();
      episodeChecking = false;
      if (!episodeActive) return;
      if (v === "same") {
        // Enrolled candidate is back. If we had warned (a real, sustained
        // mismatch), this spends the single grace; resume the test.
        if (episodeWarned) pardonUsed = true;
        setIdentityWarning("");
        endEpisode();
        return;
      }
      if (deadline) {
        if (v === "different") {
          terminateImpersonation();
        } else {
          // Unreadable frame at the deadline → fail-open (never falsely end).
          setIdentityWarning("");
        }
        endEpisode();
      }
    };

    const onIdentityDifferent = () => {
      if (proctoringRef.current.blocked || episodeActive) return;
      // The one-time grace is already spent → no second chance; end it now.
      if (pardonUsed) {
        terminateImpersonation();
        return;
      }
      episodeActive = true;
      episodeStart = Date.now();
      episodeWarned = false;
      episodeChecking = false;
      lastEpisodeCheckAt = Date.now(); // the triggering check just ran
      episodeMonitor = setInterval(() => { void episodeTick(); }, 250);
    };

    // Identity probe. While an escalation episode is active it owns the checks,
    // so this only feeds in NEW detections between episodes.
    const verifyIdentityNow = async (urgent = false) => {
      if (
        identityBusy ||
        episodeActive ||
        !hasStartedRef.current ||
        proctoringRef.current.blocked ||
        !webcamEnabledRef.current ||
        !referenceImageRef.current
      )
        return;
      if (!urgent && personCountRef.current < 1) return;
      identityBusy = true;
      try {
        const v = await runIdentityCheck();
        if (v === "different") onIdentityDifferent();
      } finally {
        identityBusy = false;
      }
    };

    const checkVisionAI = async () => {
      if (!videoRef.current || !webcamEnabledRef.current || proctoringRef.current.blocked || proctoringRef.current.isWarningVisible) return;

      // Canvas-based brightness check (catches tape over camera, finger over lens, etc.)
      try {
        const video = videoRef.current;
        let canvas = canvasRef.current;
        if (!canvas) {
          canvas = document.createElement("canvas");
          canvasRef.current = canvas;
        }
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx && video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, 64, 48);
          const imageData = ctx.getImageData(0, 0, 64, 48);
          const pixels = imageData.data;
          let totalBrightness = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            totalBrightness += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          }
          const avgBrightness = totalBrightness / (pixels.length / 4);
          
          if (avgBrightness < 15) {
            darkFrames++;
            setProctoringStatus(prev => ({ ...prev, cameraCovered: true }));
            if (darkFrames >= 3) {
              issueWarning("Camera appears to be covered or blocked! The image is completely dark.");
              darkFrames = 0;
            }
          } else {
            darkFrames = 0;
            setProctoringStatus(prev => ({ ...prev, cameraCovered: false }));
          }
        }
      } catch {}

      // COCO-SSD object detection
      if (modelRef.current) {
        try {
          // Ask the detector for MORE candidate boxes than the default (20) and at
          // a lower internal score, so a phone - which COCO-SSD scores weakly,
          // especially held close - actually shows up in the list to be filtered.
          const predictions = await modelRef.current.detect(videoRef.current, 40, 0.2);

          // Diagnostic readout: what the vision model actually sees right now.
          const topDetections = predictions
            .filter((p: any) => p.score >= 0.25)
            .slice(0, 6)
            .map((p: any) => `${p.class} ${Math.round(p.score * 100)}%`)
            .join(" · ");
          setDetectedObjects(topDetections);

          // Lower person detection threshold to 0.35 to successfully capture long-distance humans in frame,
          // but filter out overlapping bounding boxes to prevent hands-on-head/shoulders from registering as multiple people.
          const personPredictions = predictions.filter((p: any) => p.class === "person" && p.score > 0.35);
          
          const uniquePersons: any[] = [];
          personPredictions.forEach((p: any) => {
            const isOverlapping = uniquePersons.some((u: any) => {
              return isSamePerson(
                p.bbox as [number, number, number, number], 
                u.bbox as [number, number, number, number]
              );
            });
            if (!isOverlapping) {
              uniquePersons.push(p);
            }
          });

          const personCount = uniquePersons.length;
          personCountRef.current = personCount;

          // A device held up to read from is an intentional breach we want caught.
          // COCO-SSD frequently labels a hand-held phone as "remote" (small dark
          // rectangle) rather than "cell phone", and scores it weakly - so we match
          // BOTH classes at a sensitive 0.3 threshold. This is a LOCAL (COCO-SSD)
          // check and costs nothing. "laptop" (the interview runs on one) and the
          // false-positive-prone "book" class are deliberately NOT included.
          const DEVICE_CLASSES = new Set(["cell phone", "remote"]);
          const phoneDetected = predictions.some((p: any) =>
            DEVICE_CLASSES.has(p.class) && p.score >= 0.3
          );

          // Audio level check for background noise
          let noiseDetected = false;
          if (audioAnalyzer && noiseContext) {
            if (noiseContext.state === 'suspended') {
              try { noiseContext.resume(); } catch(e) {}
            }
            if (noiseContext.state === 'running') {
              const dataArray = new Uint8Array(audioAnalyzer.frequencyBinCount);
              audioAnalyzer.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avgVolume = sum / dataArray.length;
              noiseDetected = avgVolume > 35; // continuous average volume threshold
            }
          }

          setProctoringStatus(prev => ({
            ...prev,
            personCount,
            faceVisible: personCount >= 1,
            phoneDetected,
            noiseDetected,
          }));
          
          // A device in frame is a strike once it persists ~1.6s (2 frames) - long
          // enough to filter a single noisy mis-detection, fast enough to catch a
          // phone actually held up to read from.
          if (phoneDetected) {
            phoneFrames++;
            if (phoneFrames >= 2) {
              issueWarning("Unauthorized device detected! Please remove any phone from your frame.");
              phoneFrames = 0;
            }
          } else {
            phoneFrames = 0;
          }

          // Debounce multiple people detection: trigger warning only if detected in 2 consecutive frames (1.6s)
          if (personCount > 1) {
            intrusionFrames++;
            if (intrusionFrames >= 2) {
              issueWarning(`Intrusion detected! The AI detected ${personCount} people in your camera frame. Only 1 person is allowed.`);
              intrusionFrames = 0;
            }
          } else {
            intrusionFrames = 0;
          }

          // Debounce missing face detection: trigger warning only if detected in 3 consecutive frames (2.4s)
          if (personCount === 0) {
            wasAbsent = true;
            missingFrames++;
            if (missingFrames >= 3) {
              issueWarning("You are not visible to the AI! Your face must be clearly visible at all times.");
              missingFrames = 0;
            }
          } else {
            // A face returned after an absence - the classic seat-swap moment.
            // Urgently re-confirm it is still the SAME enrolled candidate.
            if (wasAbsent) {
              wasAbsent = false;
              void verifyIdentityNow(true);
            }
            missingFrames = 0;
          }

          // EYE-CONTACT / GAZE: when a person is present, use BlazeFace landmarks
          // (eyes + nose) to estimate head orientation. A nose that sits well off
          // the eye midline (head turned away), or a person with no detectable
          // frontal face (turned away/down), means they are not looking at the
          // screen. Warn only after this persists ~4s (5 frames) to avoid noise.
          if (faceModelRef.current && personCount >= 1) {
            try {
              const faces = await faceModelRef.current.estimateFaces(videoRef.current, false);
              let lookingAway = false;
              if (faces && faces.length > 0 && Array.isArray(faces[0].landmarks)) {
                const lm = faces[0].landmarks as number[][]; // [rEye,lEye,nose,mouth,rEar,lEar]
                const rEye = lm[0], lEye = lm[1], nose = lm[2];
                const eyeMidX = (rEye[0] + lEye[0]) / 2;
                const interEye = Math.abs(lEye[0] - rEye[0]) || 1;
                const eyeMidY = (rEye[1] + lEye[1]) / 2;
                const yaw = (nose[0] - eyeMidX) / interEye;      // left/right turn
                const pitch = (nose[1] - eyeMidY) / interEye;    // down-tilt
                lookingAway = Math.abs(yaw) > 0.55 || pitch > 1.6;
              } else {
                // Person in frame but no frontal face detected = turned away.
                lookingAway = true;
              }
              if (lookingAway) {
                gazeAwayFrames++;
                if (gazeAwayFrames >= 4) {
                  // ~1.4s of looking away/down (e.g. reading from a phone) → strike.
                  issueWarning("Keep your eyes on the screen. The AI detected you looking away from the interview.");
                  gazeAwayFrames = 0;
                }
              } else {
                gazeAwayFrames = 0;
              }
            } catch { /* gaze estimation is best-effort */ }
          } else {
            gazeAwayFrames = 0;
          }
        } catch (e) {}
      }
    };
    // Scan ~3×/second so cheating (a phone, looking away, leaving frame) is caught
    // in ~1s, not several. Faster than this risks audio contention with Gemini Live.
    const visionInterval = setInterval(checkVisionAI, 350);
    // Periodic anti-impersonation identity confirmation (in addition to the
    // urgent re-check fired whenever a face reappears after an absence).
    const identityInterval = setInterval(() => { void verifyIdentityNow(false); }, 5000);

     return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", onScreenLost);
      window.removeEventListener("focus", onScreenBack);
      clearUnfocusTimer();
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("copy", handleCopyAttempt);
      document.removeEventListener("cut", handleCopyAttempt);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange as EventListener);
      window.removeEventListener("resize", handleResize);
      clearInterval(displayInterval);
      try {
        (window.screen as any)?.removeEventListener?.("change", checkExternalDisplay);
      } catch {
        /* noop */
      }
      clearInterval(visionInterval);
      clearInterval(identityInterval);
      if (episodeMonitor) clearInterval(episodeMonitor);
      clearInterval(timer);
      if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
      try { window.speechSynthesis?.cancel(); } catch (e) {}
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      audioStream?.getTracks().forEach(t => t.stop());
      if (noiseContext) {
        try { noiseContext.close(); } catch(e) {}
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Robustly (re)bind the live MediaStream to BOTH video elements whenever they
  // mount or the step changes - and explicitly call play(). Without this, the
  // background feed (and the verify preview) can stay black: getUserMedia
  // resolves once, but the <video> for a given step may not be in the DOM yet,
  // or autoplay may not start without an explicit play() call.
  useEffect(() => {
    const stream = mediaStreamRef.current;
    if (!stream) return;
    [videoRef.current, verifyVideoRef.current].forEach((v) => {
      if (v && v.srcObject !== stream) v.srcObject = stream;
      v?.play?.().catch(() => {});
    });
  }, [webcamEnabled, setupStep, hasStarted, capturedImage]);

  // While on the Face-ID verify step, sample camera brightness so we can guide
  // the candidate ("too dark", "good lighting"). Person/face counts come from
  // the existing vision loop (proctoringStatus). Cheap, no model needed.
  useEffect(() => {
    if (hasStarted || setupStep !== "verify" || blocked) return;
    const canvas = document.createElement("canvas");
    const tick = () => {
      const vid = verifyVideoRef.current || videoRef.current;
      if (!vid || vid.readyState < 2 || !vid.videoWidth) return;
      try {
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(vid, 0, 0, 64, 48);
        const { data } = ctx.getImageData(0, 0, 64, 48);
        let tot = 0;
        for (let i = 0; i < data.length; i += 4) tot += (data[i] + data[i + 1] + data[i + 2]) / 3;
        const avg = tot / (data.length / 4);
        setLightingState(avg < 35 ? "dark" : avg > 235 ? "bright" : "good");
      } catch {
        /* brightness sampling is best-effort */
      }
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [hasStarted, setupStep, blocked, webcamEnabled]);

  // CRITICAL: When blocked, immediately kill all audio and speech recognition
  useEffect(() => {
    if (!blocked) return;
    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.shouldListen = false;
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    // Stop any playing audio
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
      audioSourceRef.current = null;
    }
    // Stop the browser fallback voice too.
    try { window.speechSynthesis?.cancel(); } catch (e) {}
    // Close audio context
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setAiSpeaking(false);
    setAiVolume(0);
    setRecording(false);
    setIsProcessing(false);

    // If the interview already completed normally, the `done` redirect owns the
    // navigation - don't double-drive it here.
    if (doneRef.current || done) return;

    // A genuine proctoring termination: show the termination notice briefly, then
    // send the candidate to their RESULTS/REPORT page (NOT the dashboard), so they
    // still see an outcome. The manual button on the blocked screen is the
    // immediate fallback.
    const redirectTimer = setTimeout(() => {
      router.push(terminationHref);
    }, 5000);
    return () => clearTimeout(redirectTimer);
  }, [blocked, router, id, done, terminationHref]);

  // Sync messages to localStorage for the Fit Score generator
  useEffect(() => {
    if (messages.length > 0) {
      const formattedForScoring = messages.map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text
      }));
      localStorage.setItem(`taledge:interview:${id}:${mode}`, JSON.stringify(formattedForScoring));
      localStorage.setItem(`taledge:interview:${id}:${mode}:updatedAt`, Date.now().toString());
    }
  }, [messages, id, mode]);

  // When the AI interview concludes, auto-open the Fit Score report so
  // generation starts without depending on a manual button click. The
  // transcript is already persisted by the effect above; the report page reads
  // it and auto-generates. The on-screen button remains as a fallback.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      router.push(nextStep.href);
    }, 3500);
    return () => clearTimeout(t);
  }, [done, router, id, nextStep.href]);

  // Keep the conversation pinned to the latest content. This must follow the LIVE
  // streaming captions (live.partialAi / live.partialUser) and the "thinking"
  // state too - not just committed messages - otherwise new words land below the
  // fold and the view appears frozen while the screen fills up.
  //
  // IMPORTANT: captions stream MANY updates per second, so a "smooth" animated
  // scroll restarts on every token and makes the whole Q&A column visibly bounce.
  // We pin INSTANTLY (no animation). We keep pinning UNLESS the user has actively
  // scrolled up to re-read - tracked by a scroll listener (`pinToBottomRef`), so a
  // fresh chat (which starts at the top) still auto-scrolls, but we never yank a
  // user who deliberately scrolled away.
  useEffect(() => {
    const scroller = chatBottomRef.current?.parentElement;
    if (!scroller) return;
    const onScroll = () => {
      const dist = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      pinToBottomRef.current = dist < 120;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [liveActive, hasStarted, done]);

  useEffect(() => {
    if (!pinToBottomRef.current) return;
    // Scroll the chat CONTAINER itself (not scrollIntoView on the sentinel) -
    // scrollIntoView walks up to the nearest scrollable ancestor and, on a long
    // answer, yanks the whole page. Setting scrollTop on the messages container
    // keeps the scroll contained to the chat, so a large answer stays pinned to
    // the bottom without the page jumping.
    const scroller = chatBottomRef.current?.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages, live.partialAi, live.partialUser, liveCaption, isProcessing, liveActive]);

  const stripMarkdown = (text: string) => text.replace(/\*/g, "");

  // Pick a female English voice for the browser fallback (voices load async, so
  // re-pick on voiceschanged). Matches the previous female Gemini interviewer.
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return;
    const FEMALE = /female|zira|samantha|aria|jenny|eva|susan|linda|heera|fiona|karen|moira|tessa|veena|google us english|google uk english female/i;
    const pick = () => {
      const voices = synth.getVoices();
      if (!voices.length) return;
      const en = voices.filter((v) => /^en/i.test(v.lang));
      const pool = en.length ? en : voices;
      ttsVoiceRef.current = pool.find((v) => FEMALE.test(v.name)) || pool[0] || null;
    };
    pick();
    synth.addEventListener?.("voiceschanged", pick);
    return () => {
      try { synth.removeEventListener?.("voiceschanged", pick); } catch (e) {}
    };
  }, []);

  // Browser fallback voice. Used when the server returns no TTS audio - e.g. in
  // production where the GEMINI key/project may not have the preview TTS model
  // enabled (text questions still work, but audioBase64 comes back empty). This
  // keeps the AI interviewer audible everywhere with no API/key dependency.
  const speakWithBrowserTTS = (text: string) => {
    try {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth || !text) {
        startListening();
        return;
      }
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(stripMarkdown(text));
      // Prefer the selected female English voice; lang as a fallback hint.
      if (ttsVoiceRef.current) {
        utter.voice = ttsVoiceRef.current;
        utter.lang = ttsVoiceRef.current.lang || "en-US";
      } else {
        utter.lang = "en-US";
      }
      utter.rate = 1;
      utter.pitch = 1.05;
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      setAiSpeaking(true);
      const finish = () => {
        setAiSpeaking(false);
        setAiVolume(0);
        startListening();
      };
      utter.onend = finish;
      utter.onerror = finish;
      synth.speak(utter);
    } catch {
      startListening();
    }
  };

  const playAudioAndListen = async (base64Data: string, fallbackText?: string) => {
    if (!base64Data) {
      // No server audio → speak the question with the browser voice instead of
      // sitting silent, then start listening for the answer.
      if (fallbackText) speakWithBrowserTTS(fallbackText);
      else startListening();
      return;
    }

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const binaryString = atob(base64Data);
      const byteLength = binaryString.length;
      const validLength = byteLength % 2 === 0 ? byteLength : byteLength - 1;
      const bytes = new Uint8Array(validLength);
      for (let i = 0; i < validLength; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      
      const audioBuffer = audioCtxRef.current.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }

      const source = audioCtxRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      source.connect(analyser);
      analyser.connect(audioCtxRef.current.destination);
      
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      setAiSpeaking(true);
      
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        setAiVolume(average);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      source.onended = () => {
        setAiSpeaking(false);
        setAiVolume(0);
        audioSourceRef.current = null;
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        startListening();
      };
      
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      
      audioSourceRef.current = source;
      source.start();
    } catch (e) {
      console.error("Audio playback error:", e);
      // Decode/playback failed → still give the candidate a spoken question.
      if (fallbackText) speakWithBrowserTTS(fallbackText);
      else startListening();
    }
  };

  const startListening = () => {
    if (doneRef.current) return;
    if (recognitionRef.current && !isCodingMode) {
      recognitionRef.current.shouldListen = true;
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  };

  // "Re-do": wipe the answer the candidate has drafted so far and capture it
  // again from scratch. Clears the draft (state + ref + the uncontrolled
  // textarea + the live caption) and any pending auto-send timer, then force-
  // restarts speech recognition so a fresh, clean capture begins. With forced-
  // English browser STT this fully resets the answer; in the Gemini fallback
  // (no SpeechRecognition) it clears the typed draft. Safe to call repeatedly.
  const redoAnswer = () => {
    setDraft("");
    setInterimDraft("");
    draftRef.current = "";
    if (textAreaRef.current) textAreaRef.current.value = "";
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    const rec = recognitionRef.current;
    if (rec && !isCodingMode && !doneRef.current) {
      // Restart cleanly: stop() lets onend auto-restart with an empty buffer; if
      // it wasn't actually running, start it directly. Both paths leave it live.
      rec.shouldListen = true;
      try { rec.stop(); } catch {}
      try { rec.start(); } catch {}
    }
  };

  // Manual mic control for live mode - a real user gesture reliably (re)starts
  // Chrome's SpeechRecognition even when an effect-driven auto-start was blocked
  // or errored. Tapping it clears any prior mic error and starts/stops listening.
  const toggleLiveMic = () => {
    setMicError(null);
    if (!recognitionRef.current) {
      // No browser SpeechRecognition (Firefox/Safari). The mic is still live via
      // Gemini's server-side capture, so there's nothing to toggle here.
      if (!usingGeminiStt) setMicError("Speech-to-text isn't available in this browser. Please type your answer below.");
      return;
    }
    if (recording) {
      recognitionRef.current.shouldListen = false;
      try { recognitionRef.current.stop(); } catch {}
    } else {
      startListening();
    }
  };

  // LIVE mode: drive the candidate's answer with the browser's forced-English STT
  // (recognition.lang = "en-US"), NOT Gemini's auto-detecting input transcription
  // (which surfaced Hindi/Tamil and lagged). Keep recognition running CONTINUOUSLY
  // for the whole live round (it auto-restarts via onend); the onresult handler
  // already ignores audio captured while the interviewer is speaking, so we don't
  // churn start()/stop() on every AI caption - that race left it stuck "not
  // listening". Recognition only fully stops in the code editor or when done.
  useEffect(() => {
    if (!liveActive) return;
    if (isCodingMode || done) {
      if (recognitionRef.current) {
        recognitionRef.current.shouldListen = false;
        try { recognitionRef.current.stop(); } catch {}
      }
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      return;
    }
    startListening();
    // startListening only reads refs; safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveActive, isCodingMode, done]);

  async function startInterview() {
    setIsProcessing(true);
    setConnectError(null);
    // Finite timeout so the "Connecting..." state can never spin forever. If no
    // session has been established within ~20s, surface a retryable error.
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    connectTimerRef.current = setTimeout(() => {
      if (!sessionId) {
        setIsProcessing(false);
        setConnectError("We could not reach the AI interviewer. Please check your connection and try again.");
      }
    }, 20000);

    const finishConnect = () => {
      if (connectTimerRef.current) {
        clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
    };

    try {
      localStorage.removeItem(`taledge:fit-score:${id}`);
      // ATTEMPT ISOLATION: starting a NEW round supersedes any previous
      // attempt's stored transcript for this mode. Without this, an old
      // abandoned attempt's answers could be scored as if they were this
      // round's evidence (a Fit Score generated seconds after a fresh round
      // started was built from a stale morning transcript). Previous REPORTS
      // stay viewable — they live server-side in the scoringAudits ledger.
      localStorage.removeItem(`taledge:interview:${id}:${mode}`);
      localStorage.removeItem(`taledge:interview:${id}:${mode}:updatedAt`);
    } catch (e) {}
    if (preloadedSession) {
      finishConnect();
      setSessionId(preloadedSession.sessionId);
      sessionIdRef.current = preloadedSession.sessionId;
      setMessages([{ role: "ai", text: stripMarkdown(preloadedSession.firstQuestion) }]);
      setIsProcessing(false);
      playAudioAndListen(preloadedSession.audioBase64, preloadedSession.firstQuestion);
      return;
    }

    const resumeContext = profile ? [
      profile.resumeSummary,
      profile.resumeSkills && profile.resumeSkills.length > 0 ? `Skills: ${profile.resumeSkills.join(", ")}` : "",
      profile.resumeProjects && profile.resumeProjects.length > 0 ? `Projects: ${profile.resumeProjects.map((p: any) => `${p.title} (${p.stack?.join(", ") || ""}): ${p.impact || ""}`).join("; ")}` : "",
      profile.aspiration ? `Goal/Target Placement: ${profile.aspiration}` : ""
    ].filter(Boolean).join("\n") : "";

    try {
      const res = await authedFetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: id,
          candidateName: profile?.fullName || "Candidate",
          role: profile?.targetRole || (isExam ? "the exam" : "Candidate"),
          mode,
          // stage is the legacy shorthand for the AI interview rounds only;
          // dnla/final are selected via `mode`.
          ...(mode === "technical" || mode === "behavioural" ? { stage: mode === "technical" ? 1 : 2 } : {}),
          track,
          resumeSummary: resumeContext,
          dnlaSummary: buildDnlaSummary(id),
          // The final round builds on the earlier AI + DNLA transcripts.
          ...(mode === "behavioural" ? { priorInterviews: buildPriorInterviews(id) } : {})
        }),
      });
      const data = await res.json();
      if (data.ok) {
        finishConnect();
        setSessionId(data.sessionId);
        sessionIdRef.current = data.sessionId;
        setMessages([{ role: "ai", text: stripMarkdown(data.firstQuestion) }]);
        setIsProcessing(false);
        playAudioAndListen(data.audioBase64, data.firstQuestion);
      } else {
        finishConnect();
        setIsProcessing(false);
        setConnectError("The AI interviewer could not start this session. Please try again.");
      }
    } catch (e) {
      finishConnect();
      setIsProcessing(false);
      setConnectError("We could not reach the AI interviewer. Please check your connection and try again.");
    }
  }

  const handleGoToVerify = () => {
    // Each new server interview session requires a fresh server-observed check.
    // A prior client-side frame is not an authentication credential and cannot
    // be reused to mark a different session verified.
    setSetupStep("verify");
  };

  // ── PRE-FLIGHT SYSTEM CHECK ────────────────────────────────────────────────
  // Runs camera / mic / lighting / network / browser checks when the candidate
  // reaches the systemcheck step, so device issues surface BEFORE the proctored
  // interview rather than mid-answer. Everything here is local browser API work -
  // no paid/Gemini calls. The mic test opens a short-lived audio stream to drive
  // a live input meter, then releases it (a cleanup is stored in a ref).
  const runSystemChecks = useCallback(() => {
    setSysChecks({ camera: "checking", mic: "checking", lighting: "checking", network: "checking", browser: "checking" });

    // Browser / secure-context support.
    const hasGUM = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    const secure = typeof window === "undefined" || window.isSecureContext !== false;
    setSysChecks((c) => ({ ...c, browser: hasGUM && secure ? "pass" : "fail" }));

    // Camera - a live video track + a decoded frame size means it's truly working.
    const camTrack = mediaStreamRef.current?.getVideoTracks?.()[0];
    const camLive = !!camTrack && camTrack.readyState === "live" && (videoRef.current?.videoWidth ?? 0) > 0;
    setSysChecks((c) => ({ ...c, camera: camLive ? "pass" : webcamEnabledRef.current ? "warn" : "fail" }));

    // Lighting - sample average brightness of the current camera frame.
    try {
      const v = videoRef.current;
      if (v && v.videoWidth) {
        const cv = document.createElement("canvas");
        cv.width = 64; cv.height = 48;
        const cx = cv.getContext("2d", { willReadFrequently: true });
        if (cx) {
          cx.drawImage(v, 0, 0, 64, 48);
          const px = cx.getImageData(0, 0, 64, 48).data;
          let tot = 0;
          for (let i = 0; i < px.length; i += 4) tot += (px[i] + px[i + 1] + px[i + 2]) / 3;
          const avg = tot / (px.length / 4);
          // Too dark (back-light / dim room) is the #1 cause of "face not visible"
          // strikes - flag it up front as a warning so they can fix it now.
          setSysChecks((c) => ({ ...c, lighting: avg < 45 ? "warn" : "pass" }));
        }
      } else {
        setSysChecks((c) => ({ ...c, lighting: "warn" }));
      }
    } catch {
      setSysChecks((c) => ({ ...c, lighting: "warn" }));
    }

    // Network - round-trip to our own tiny health endpoint (no paid service).
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setSysChecks((c) => ({ ...c, network: "fail" }));
    } else {
      const t0 = performance.now();
      fetch(`/api/health?t=${Math.round(t0)}`, { cache: "no-store" })
        .then((r) => {
          const rtt = performance.now() - t0;
          setSysChecks((c) => ({ ...c, network: r.ok ? (rtt < 1200 ? "pass" : "warn") : "warn" }));
        })
        .catch(() => setSysChecks((c) => ({ ...c, network: "warn" })));
    }

    // Microphone - open a short-lived stream, confirm a live audio track, and run
    // a live level meter so the candidate can SEE their mic working.
    if (sysMicCleanupRef.current) { sysMicCleanupRef.current(); sysMicCleanupRef.current = null; }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const track = stream.getAudioTracks()[0];
        setSysChecks((c) => ({ ...c, mic: track && track.readyState === "live" ? "pass" : "warn" }));
        let raf = 0;
        let ctx: AudioContext | null = null;
        try {
          ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            setMicLevel(Math.min(1, sum / data.length / 70));
            raf = requestAnimationFrame(tick);
          };
          tick();
        } catch { /* meter is best-effort */ }
        sysMicCleanupRef.current = () => {
          if (raf) cancelAnimationFrame(raf);
          try { ctx?.close(); } catch {}
          stream.getTracks().forEach((t) => t.stop());
          setMicLevel(0);
        };
      })
      .catch(() => setSysChecks((c) => ({ ...c, mic: "fail" })));
  }, []);

  // Trigger the checks on entering the step; release the mic meter on leaving.
  useEffect(() => {
    if (setupStep === "systemcheck") {
      runSystemChecks();
    } else if (sysMicCleanupRef.current) {
      sysMicCleanupRef.current();
      sysMicCleanupRef.current = null;
    }
    return () => {
      if (setupStep === "systemcheck" && sysMicCleanupRef.current) {
        sysMicCleanupRef.current();
        sysMicCleanupRef.current = null;
      }
    };
  }, [setupStep, runSystemChecks]);

  const handleCaptureAndVerify = async () => {
    setVerificationResult({ status: "verifying" });
    
    // Verify Identity using Gemini Vision
    try {
      if (videoRef.current && webcamEnabledRef.current) {
        const tempCanvas = document.createElement("canvas");
        // Downscale to max 640px wide: a face check needs no more, and a full
        // 720p/1080p frame makes the JPEG encode far heavier.
        const vw = videoRef.current.videoWidth || 640;
        const vh = videoRef.current.videoHeight || 480;
        const scale = Math.min(1, 640 / vw);
        tempCanvas.width = Math.round(vw * scale);
        tempCanvas.height = Math.round(vh * scale);
        const ctx = tempCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
          // Encode asynchronously via toBlob (off the click's synchronous path)
          // instead of the blocking toDataURL - toDataURL on a full frame blocked
          // the main thread ~200ms and showed up as a poor INP on this button.
          const base64Image: string = await new Promise<string>((resolve, reject) => {
            tempCanvas.toBlob(
              (blob) => {
                if (!blob) return reject(new Error("Could not capture image"));
                const fr = new FileReader();
                fr.onerror = () => reject(new Error("Could not read captured image"));
                fr.onload = () => resolve(String(fr.result));
                fr.readAsDataURL(blob);
              },
              "image/jpeg",
              0.8
            );
          });
          setCapturedImage(base64Image);

          // The verify-face server distinguishes a GENUINE reject (no/multiple
          // faces) from an INFRA outage (Gemini down/timeout/429/missing key) via
          // an `unavailable` flag on a verified:false response:
          //   { ok, verified:true }                        → passed
          //   { ok, verified:false, unavailable:true }     → service down (NOT the
          //                                                   candidate's fault)
          //   { ok, verified:false, unavailable:false }    → genuine reject
          // A transient outage is retried, but production fails closed: a service
          // outage cannot be converted into a client-asserted verification.
          type VerifyResponse = { ok?: boolean; verified?: boolean; unavailable?: boolean; reason?: string };
          const MAX_VERIFY_ATTEMPTS = 3;
          let vData: VerifyResponse = {};
          let unavailable = false;
          for (let attempt = 1; attempt <= MAX_VERIFY_ATTEMPTS; attempt++) {
            const vRes = await authedFetch("/api/interview/verify-face", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // Pass the session so the server records faceVerified atomically with
              // the passing check (no reliance on the separate proctor POST below).
              body: JSON.stringify({ imageBase64: base64Image, sessionId: sessionIdRef.current })
            });
            vData = (await vRes.json()) as VerifyResponse;
            unavailable = vData.ok === true && vData.verified === false && vData.unavailable === true;
            // A decisive answer (a pass, or a genuine reject) ends the loop.
            if (!unavailable) break;
            // Infra outage: keep a calm "verifying, one moment" state and back off
            // before retrying the SAME captured frame (no need to re-capture).
            if (attempt < MAX_VERIFY_ATTEMPTS) {
              setVerificationResult({ status: "verifying", message: "Verifying… one moment." });
              await new Promise((r) => setTimeout(r, 1500));
            }
          }

          if (vData.ok && vData.verified) {
            setVerificationResult({ status: "success" });
            // Enrol this verified frame as the identity reference. Every later
            // identity check compares the live camera against THIS person.
            referenceImageRef.current = base64Image;
          } else if (unavailable) {
            setVerificationResult({
              status: "error",
              unavailable: true,
              message: "Verification is temporarily unavailable. Please retry in a moment.",
            });
          } else {
            // GENUINE reject (no face / multiple faces / etc.) → hard fail, keep the
            // existing "Retake photo" recovery.
            setVerificationResult({
              status: "error",
              message: "Failed: " + (vData.reason || "No clear face detected.")
            });
          }
        }
      }
    } catch (e) {
      console.error("Face verification error:", e);
      setVerificationResult({ status: "error", message: "An unexpected error occurred during verification." });
    }
  };

  const handleStartInterview = async () => {
    setSetupStep("interview");
    setHasStarted(true);
    hasStartedRef.current = true;

    // Claim the mic for the word-by-word caption recognition FIRST - synchronously
    // inside this click gesture and BEFORE Gemini's capture - so the browser
    // recognition isn't shut out by Gemini grabbing the mic a moment later.
    startLiveCaption();

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {}

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    
    const osc = audioCtxRef.current.createOscillator();
    const gain = audioCtxRef.current.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(audioCtxRef.current.destination);
    osc.start(0);
    osc.stop(audioCtxRef.current.currentTime + 0.1);

    // The realtime Gemini Live HD-voice interviewer is the ONLY interviewer path -
    // there is NO text/TTS fallback. If Live can't connect (no token, blocked mic,
    // Google outage) we do NOT silently degrade; we surface a clear, retryable
    // error (see the `else` branch below and the Retry card in the chat panel).
    const resumeContext = profile ? [
      profile.resumeSummary,
      profile.resumeSkills && profile.resumeSkills.length > 0 ? `Skills: ${profile.resumeSkills.join(", ")}` : "",
      profile.resumeProjects && profile.resumeProjects.length > 0 ? `Projects: ${profile.resumeProjects.map((p: any) => `${p.title} (${p.stack?.join(", ") || ""}): ${p.impact || ""}`).join("; ")}` : "",
      profile.aspiration ? `Goal/Target Placement: ${profile.aspiration}` : "",
    ].filter(Boolean).join("\n") : "";
    // Decide the STT path authoritatively at connect time (don't rely on effect
    // ordering). Use forced-English browser STT (captureMic:false → text turns)
    // ONLY where it actually works - a secure origin with the Web Speech API.
    // Everywhere else (insecure LAN-IP origin, Firefox/Safari) stream the mic to
    // Gemini for server-side transcription (captureMic:true) so STT never dies.
    const useBrowserStt = browserSttUsable();
    geminiCaptureRef.current = !useBrowserStt;
    setUsingGeminiStt(!useBrowserStt);
    let liveOk = false;
    try {
      liveOk = await live.connect(
        {
          candidateName: profile?.fullName || "Candidate",
          role: profile?.targetRole || (isExam ? "the exam" : "Candidate"),
          mode,
          track,
          resumeSummary: resumeContext,
          dnlaSummary: buildDnlaSummary(id),
          difficulty: difficultyRef.current,
          ...(mode === "behavioural" ? { priorInterviews: buildPriorInterviews(id) } : {}),
        },
        { captureMic: !useBrowserStt }
      );
    } catch {
      liveOk = false;
    }
    if (liveOk) {
      liveEndedRef.current = false; // arm auto-conclude for this fresh session
      // Reset the client-director state for the fresh session.
      wrapUpSentRef.current = false;
      continueNudgeRef.current = 0;
      wrapFallbackCountRef.current = 0;
      liveStartedAtRef.current = performance.now(); // start the ~30-min pacing clock
      if (wrapUpTimerRef.current) { clearTimeout(wrapUpTimerRef.current); wrapUpTimerRef.current = null; }
      setLiveActive(true);
      setSessionId("live"); // marks the session "live" so the header shows connected
    } else {
      // Gemini Live is the ONLY interviewer path. When it can't connect we do not
      // degrade to a Gemini-TTS text interview - we surface a soft, retryable
      // notice that Google's realtime service is temporarily unavailable.
      setIsProcessing(false);
      setConnectError(
        "Google's servers are temporarily unavailable, so the live interviewer can't start right now. Please try again in a moment."
      );
    }
  };

  // End a live interview: stop the socket/mic and mark done (the transcript is
  // already mirrored + persisted, and the done effect advances to the report).
  const endLiveInterview = () => {
    // DISARM PROCTORING FIRST. The interview is over, so nothing the candidate
    // does now (exit full-screen, look away, lean out of frame, press Esc) may be
    // treated as a violation - otherwise a late proctoring "termination" sets
    // `blocked` and its redirect dumps the candidate on the dashboard instead of
    // their results page. Flip both refs synchronously (don't wait for the `done`
    // effect) so every proctoring guard sees "finished" immediately.
    hasStartedRef.current = false;
    doneRef.current = true;
    try { live.disconnect(); } catch (e) {}
    setLiveActive(false);
    setAiSpeaking(false);
    setDone(true);
  };

  // Tear down the Live interview gracefully: let the interviewer's closing line
  // finish playing (so the ending sounds professional rather than cut off), then
  // end. Idempotent and hard-capped so it can never hang.
  const gracefulEndLive = () => {
    if (liveEndedRef.current) return;
    liveEndedRef.current = true;
    // We've committed to ending - disarm proctoring NOW (before the ~7s closing
    // drain) so the candidate relaxing / exiting full-screen during the goodbye
    // can't trigger a false termination that hijacks the post-interview redirect.
    hasStartedRef.current = false;
    if (wrapUpTimerRef.current) { clearTimeout(wrapUpTimerRef.current); wrapUpTimerRef.current = null; }
    const startedAt = performance.now();
    const waitForDrain = () => {
      // aiSpeakingRef mirrors the interviewer's live speaking state - end once the
      // closing audio has drained, or after a hard 7s cap regardless.
      if (!aiSpeakingRef.current || performance.now() - startedAt > 7000) {
        endLiveInterview();
      } else {
        setTimeout(waitForDrain, 250);
      }
    };
    setTimeout(waitForDrain, 600); // let the closing line begin before we watch for it to finish
  };

  // CLIENT-DIRECTED ending. The Live model is instructed NEVER to conclude on its
  // own; the client governs the whole lifecycle here so the round runs its
  // ~10-15 min adaptive window and can never end early, abruptly, or mid-answer:
  //   1) hard backstops on time AND questions asked, so it can never run away;
  //   2) ONLY once at least LIVE_MIN_MINUTES have elapsed AND enough real answers
  //      exist, privately signal [WRAP_UP] so the interviewer gives its single
  //      clean closing line. We do NOT slam the mic shut - the candidate may be
  //      mid-sentence - we just ask for a graceful close and arm a fallback timer;
  //   3) end gracefully when that closing arrives;
  //   4) if the model disobeys and tries to close before time's up, nudge it to
  //      keep going instead of ending early.
  //
  // Wrap-up fallback: if the model never delivers a recognizable closing, end
  // gracefully a bit later — but NEVER cut the candidate off mid-question. When
  // the timer fires and the interviewer's latest turn is still an unanswered
  // question, re-send [WRAP_UP] (ask it to close after this answer) and extend
  // the window instead of ending, bounded so a silent candidate still wraps. The
  // MAX_MINUTES ticker is the ultimate hard end.
  const armWrapFallback = () => {
    if (wrapUpTimerRef.current) clearTimeout(wrapUpTimerRef.current);
    wrapUpTimerRef.current = setTimeout(() => {
      if (liveEndedRef.current) return;
      const msgs = liveMsgsRef.current;
      const last = msgs[msgs.length - 1];
      const lastIsUnansweredQuestion =
        !!last &&
        last.role === "ai" &&
        /\?/.test(last.text) &&
        !/this interview is now complete/i.test(last.text);
      // Candidate still owes an answer to the interviewer's latest question: do
      // NOT end (that cuts them off mid-question) and do NOT re-signal [WRAP_UP]
      // (that would force the model to close BEFORE they answer). Just wait and
      // re-check, bounded so a genuinely silent candidate still wraps; the
      // MAX_MINUTES ticker is the ultimate hard end. Once they answer, the model's
      // own [WRAP_UP]-driven closing (branch 3) or the next fire ends it cleanly.
      if (lastIsUnansweredQuestion && wrapFallbackCountRef.current < 4) {
        wrapFallbackCountRef.current += 1;
        armWrapFallback();
        return;
      }
      gracefulEndLive();
    }, 30000);
  };
  useEffect(() => {
    if (!liveActive || liveEndedRef.current || !live.messages.length) return;
    liveMsgsRef.current = live.messages;
    const aiTurns = live.messages.filter((m) => m.role === "ai");
    const answered = live.messages.filter((m) => m.role === "user").length;
    const lastAi = aiTurns[aiTurns.length - 1];
    if (!lastAi) return;

    // Minutes elapsed since the live session went live (the pacing clock).
    const liveMinutes = liveStartedAtRef.current
      ? (performance.now() - liveStartedAtRef.current) / 60000
      : 0;
    // We have both enough time AND enough substance to close cleanly.
    const readyToWrap = liveMinutes >= LIVE_MIN_MINUTES && answered >= LIVE_MIN_ANSWERS;

    // Did the interviewer just deliver a clean, question-free closing?
    const t = lastAi.text.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
    const isClosing =
      /this interview is now complete/.test(t) ||
      /\[\s*conclude\s*\]/i.test(lastAi.text) ||
      /(that|this) concludes (our|the|this) (interview|session|assessment)/.test(t);
    // A turn that still asks the candidate something is NOT a real closing - keep
    // going (this is exactly the ask-and-conclude-in-one-breath bug).
    const beforeClose = lastAi.text.replace(/this interview is now complete[.!?]*/i, " ");
    const asksQuestion =
      beforeClose.includes("?") ||
      /\b(what|how|why|when|where|which|who|can you|could you|would you|tell me|walk me|describe|explain|give me)\b/i.test(beforeClose);
    const cleanClose = isClosing && !asksQuestion;

    // 1) Hard caps — never let the round run away, but never cut the candidate
    //    off mid-question either. When a cap is reached while the interviewer's
    //    LAST turn is still an unanswered question, signal [WRAP_UP] (so it
    //    closes with a line instead of a dangling question) and let
    //    armWrapFallback give a bounded grace for the candidate to finish + the
    //    model to close. Only force-cut once past the ABSOLUTE ceiling, or when
    //    nothing is hanging (last turn isn't an unanswered question).
    const lastMsg = live.messages[live.messages.length - 1];
    const lastIsUnansweredQuestion =
      !!lastMsg && lastMsg.role === "ai" && /\?/.test(lastMsg.text) && !isClosing;
    const capReached = liveMinutes >= LIVE_MAX_MINUTES || aiTurns.length >= LIVE_HARD_CAP_ASKED;
    if (capReached) {
      if (liveMinutes >= LIVE_ABSOLUTE_MAX_MINUTES || !lastIsUnansweredQuestion) {
        gracefulEndLive();
        return;
      }
      // At the cap with a question still hanging: ask the model to close, hold
      // the end for the bounded grace window instead of cutting the candidate off.
      if (!wrapUpSentRef.current) {
        wrapUpSentRef.current = true;
        try { live.sendControl(LIVE_WRAP_UP_MSG); } catch {}
      }
      armWrapFallback();
      return;
    }

    // 2) Full interview delivered → privately ask the interviewer to wrap up (once).
    if (!wrapUpSentRef.current && readyToWrap) {
      wrapUpSentRef.current = true;
      try { live.sendControl(LIVE_WRAP_UP_MSG); } catch {}
      // Fallback only: end gracefully a bit later IF the model never delivers its
      // closing — but armWrapFallback never cuts the candidate off mid-question.
      armWrapFallback();
      return;
    }

    // 3) End once the interviewer delivers its closing. After our [WRAP_UP]
    //    signal, the next clean (question-free) turn IS the closing, so end on it.
    //    Also honor a clean self-close once we're genuinely ready to wrap.
    if ((wrapUpSentRef.current && cleanClose) || (cleanClose && readyToWrap)) {
      gracefulEndLive();
      return;
    }

    // 4) Recover from a premature self-conclude (model ignored its instructions
    //    before time/substance is up): nudge it to keep going instead of ending.
    if (cleanClose && !readyToWrap && continueNudgeRef.current < 6) {
      continueNudgeRef.current += 1;
      try { live.sendControl(LIVE_CONTINUE_MSG); } catch {}
    }
    // endLiveInterview/gracefulEndLive are stable for this render; intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.messages, liveActive]);

  // Time-driven backstop. The effect above is message-driven, so if the
  // conversation stalls (candidate goes quiet near the end) it might not re-run.
  // This independent ticker guarantees the round still wraps at LIVE_MAX_MINUTES
  // (grace to LIVE_ABSOLUTE_MAX_MINUTES for a hanging question), even with no new
  // messages arriving.
  useEffect(() => {
    if (!liveActive) return;
    const tick = setInterval(() => {
      if (liveEndedRef.current || !liveStartedAtRef.current) return;
      const liveMinutes = (performance.now() - liveStartedAtRef.current) / 60000;
      if (liveMinutes >= LIVE_MAX_MINUTES) {
        // Same protection as the message-driven path: at the hard cap, don't cut
        // off a still-pending question — signal a close and give bounded grace,
        // force-ending only past the absolute ceiling or when nothing hangs.
        const lastMsg = live.messages[live.messages.length - 1];
        const lastIsUnansweredQuestion =
          !!lastMsg &&
          lastMsg.role === "ai" &&
          /\?/.test(lastMsg.text) &&
          !/this interview is now complete|concludes (our|the|this)/i.test(lastMsg.text);
        if (liveMinutes >= LIVE_ABSOLUTE_MAX_MINUTES || !lastIsUnansweredQuestion) {
          gracefulEndLive();
          return;
        }
        if (!wrapUpSentRef.current) {
          wrapUpSentRef.current = true;
          try { live.sendControl(LIVE_WRAP_UP_MSG); } catch {}
        }
        armWrapFallback();
        return;
      }
      const answered = live.messages.filter((m) => m.role === "user").length;
      if (!wrapUpSentRef.current && liveMinutes >= LIVE_MIN_MINUTES && answered >= LIVE_MIN_ANSWERS) {
        wrapUpSentRef.current = true;
        try { live.sendControl(LIVE_WRAP_UP_MSG); } catch {}
        armWrapFallback();
      }
    }, 15000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveActive, live.messages]);

  // The interviewer's most recent question (drives the code compiler's hidden
  // test-case generation when it's a coding task).
  const lastAiQuestion = (() => {
    const arr = messages ?? [];
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i].role === "ai") return arr[i].text;
    return "";
  })();

  // Format a coding answer (language + source + execution output + hidden test
  // results) so the AI interviewer/report can evaluate the code, not just read it.
  const buildCodeAnswer = (): string => {
    const meta = getCodeLanguage(codeLanguage);
    const source = (draftRef.current || draft).trim();
    let out = "";
    if (codingChallenge) {
      out += `[Coding challenge · ${codingChallenge.title} · ${codingChallenge.minutes} min budget]\n${codingChallenge.prompt}\n\n`;
    }
    out += `[Coding answer · ${meta.label}]\n\n\`\`\`${meta.monaco}\n${source}\n\`\`\``;
    if (codeTestSummary) {
      out += `\n\nHidden test cases: ${codeTestSummary.passed}/${codeTestSummary.total} passed.`;
    }
    if (codeResult) {
      const parts = [
        codeResult.compileError ? `Compile error:\n${codeResult.compileError}` : "",
        codeResult.stdout ? `stdout:\n${codeResult.stdout}` : "",
        codeResult.stderr ? `stderr:\n${codeResult.stderr}` : "",
      ].filter(Boolean);
      out += `\n\nExecution result (exit ${codeResult.exitCode ?? "-"}):\n${parts.join("\n") || "(no output)"}`;
    } else if (!codeTestSummary) {
      out += `\n\n(Candidate did not run the code.)`;
    }
    return out;
  };

  // Send a typed/spoken/coded answer during a live interview. For spoken answers
  // the forced-English STT writes into the textarea (including not-yet-finalised
  // interim words), so read its live value rather than the lagging `draft` state.
  const handleSendLiveText = () => {
    const spoken = (textAreaRef.current ? textAreaRef.current.value : draft).trim();
    const text = isCodingMode ? buildCodeAnswer() : spoken;
    if (isCodingMode ? !(draftRef.current || draft).trim() : !spoken) return;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    const ok = live.sendText(text);
    if (ok) {
      setDraft("");
      draftRef.current = "";
      setInterimDraft("");
      setCodeResult(null);
      setCodeTestSummary(null);
      if (textAreaRef.current) textAreaRef.current.value = "";
      // Coding answer submitted → end the coding block, resume normal interview.
      if (isCodingMode && codeInterviewActive) exitCodeInterview(true);
      else stopChallengeTimer();
    }
  };

  // Submit the current coding answer through whichever path is active.
  const submitCodeAnswer = () => {
    if (liveActive) handleSendLiveText();
    else handleSendText();
  };

  const stopChallengeTimer = () => {
    if (challengeTimerRef.current) { clearInterval(challengeTimerRef.current); challengeTimerRef.current = null; }
  };

  // Start (or restart) the countdown for the active coding challenge. When it
  // hits zero, auto-submit whatever the candidate has (the time budget reflects
  // what a human would realistically need) and return to the normal interview.
  const startChallengeTimer = (minutes: number) => {
    if (challengeTimerRef.current) clearInterval(challengeTimerRef.current);
    const deadline = Date.now() + minutes * 60 * 1000;
    setChallengeRemaining(minutes * 60);
    challengeTimerRef.current = setInterval(() => {
      const remain = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setChallengeRemaining(remain);
      if (remain <= 0) {
        stopChallengeTimer();
        // Time's up → submit code if any (which ends the block), else end the
        // coding block and resume the normal interview.
        if ((draftRef.current || draft).trim()) submitCodeAnswer();
        else exitCodeInterview(false);
      }
    }, 1000);
  };

  // Fetch a fresh timed coding problem tailored to the role, and start its timer.
  const fetchCodingChallenge = async () => {
    if (challengeLoading) return;
    setChallengeLoading(true);
    setChallengeError(null);
    try {
      const res = await authedFetch("/api/code/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: profile?.targetRole || (isExam ? "the exam" : "Software Engineer"),
          track,
          // Coding problems only grade easy/medium/hard; "adaptive" maps to medium.
          difficulty: difficultyRef.current === "adaptive" ? "medium" : difficultyRef.current,
          avoid: codingChallenge?.title ? [codingChallenge.title] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setChallengeError(data?.error || "Couldn't load a coding problem. Try again.");
        return;
      }
      setCodingChallenge({ title: data.title, prompt: data.prompt, minutes: data.minutes });
      // Fresh problem → reset the editor and prior results.
      setDraft("");
      draftRef.current = "";
      setCodeResult(null);
      setCodeTestSummary(null);
      startChallengeTimer(data.minutes);
    } catch {
      setChallengeError("Couldn't reach the problem service. Check your connection.");
    } finally {
      setChallengeLoading(false);
    }
  };

  // Start the dedicated, time-boxed AI Code Interview: open the Code tab, pull a
  // problem, start the timer, and ask the live interviewer to pause its questions.
  const enterCodingMode = () => {
    if (codeInterviewActive) { setIsCodingMode(true); return; }
    setIsCodingMode(true);
    setCodeInterviewActive(true);
    if (!codingChallenge && !challengeLoading) fetchCodingChallenge();
    if (liveActive) {
      try {
        live.sendText("I'm starting the coding challenge now. Please pause the interview questions and wait quietly until I submit my solution.");
        live.setMicMuted(true); // fully pause the interviewer while the candidate codes
      } catch {}
    }
  };

  // End the coding block and return to the normal interview. `submitted` = the
  // candidate sent their code (the answer is already on its way); otherwise they
  // cancelled or ran out of time without submitting.
  const exitCodeInterview = (submitted: boolean) => {
    stopChallengeTimer();
    setChallengeRemaining(null);
    setCodeInterviewActive(false);
    setIsCodingMode(false);
    setCodingChallenge(null);
    setCodeResult(null);
    setCodeTestSummary(null);
    if (liveActive) { try { live.setMicMuted(false); } catch {} } // re-open the mic
    if (!submitted) {
      setDraft("");
      draftRef.current = "";
      if (liveActive) {
        try { live.sendText("Let's skip the coding challenge and continue with the interview."); } catch {}
      }
    }
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Challenge header shown above the compiler: guideline + problem + countdown.
  const renderCodingChallenge = () => (
    <div className="rounded-xl border border-brand-200/70 bg-brand-50/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-700">
          <FileText aria-hidden className="w-3.5 h-3.5" /> AI Code Interview
        </span>
        <div className="flex items-center gap-2">
          {challengeRemaining != null && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums px-2 py-0.5 rounded-md border ${
                challengeRemaining <= 60 ? "bg-rose-100 text-rose-700 border-rose-200 animate-pulse" : "bg-white text-ink-700 border-ink-200"
              }`}
              role="timer"
              aria-live="off"
            >
              <Clock aria-hidden className="w-3 h-3" /> {fmtTime(challengeRemaining)}
            </span>
          )}
          <button
            type="button"
            onClick={fetchCodingChallenge}
            disabled={challengeLoading}
            title="Get a new problem"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-600 hover:text-brand-700 disabled:opacity-50"
          >
            {challengeLoading ? <Loader2 aria-hidden className="w-3 h-3 animate-spin" /> : <RefreshCw aria-hidden className="w-3 h-3" />} New
          </button>
          <button
            type="button"
            onClick={() => exitCodeInterview(false)}
            title="Cancel the coding interview and continue normally"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-700"
          >
            <X aria-hidden className="w-3 h-3" /> Cancel
          </button>
        </div>
      </div>

      {/* Guideline - shown once the code interview is active. */}
      <div className="flex items-start gap-1.5 rounded-lg bg-white/70 border border-brand-100 px-2.5 py-2 text-[11px] text-ink-600 leading-relaxed">
        <Brain aria-hidden className="w-3.5 h-3.5 text-brand-500 mt-0.5 shrink-0" />
        <span>
          Your <strong>AI code interview has started</strong> - the regular questions are paused. Solve the problem below, run it,
          and <strong>Submit code</strong> before the timer ends. Prefer not to code? Tap <strong>Cancel</strong> to continue the normal interview.
        </span>
      </div>

      {challengeLoading && !codingChallenge ? (
        <p className="text-xs text-ink-500">Generating a coding problem tailored to your role…</p>
      ) : challengeError ? (
        <p className="text-xs text-rose-600">{challengeError}</p>
      ) : codingChallenge ? (
        <>
          <p className="text-sm font-bold text-ink-800">{codingChallenge.title}</p>
          <div className="text-xs text-ink-600 whitespace-pre-wrap max-h-32 overflow-auto leading-relaxed pr-1">{codingChallenge.prompt}</div>
          <p className="text-[10px] text-ink-400">
            Suggested time {codingChallenge.minutes} min - the timer auto-submits your code, then the interview resumes.
          </p>
        </>
      ) : null}
    </div>
  );

  // Stop the challenge timer when the round ends / unmounts.
  useEffect(() => {
    if (done && challengeTimerRef.current) {
      clearInterval(challengeTimerRef.current);
      challengeTimerRef.current = null;
    }
  }, [done]);
  useEffect(() => () => { if (challengeTimerRef.current) clearInterval(challengeTimerRef.current); }, []);

  // Tear down the Live session when the assessment is blocked.
  useEffect(() => {
    if (blocked && liveActive) {
      try { live.disconnect(); } catch (e) {}
      setLiveActive(false);
    }
  }, [blocked, liveActive, live]);

  const closeWarning = async () => {
    setWarningMessage("");
    proctoringRef.current.isWarningVisible = false;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch(e) {}
  };

  // FLOW: AI interview (technical) -> DNLA interview -> Final combined round ->
  // Fit Score report. `nextStep` (computed near the top from `mode`) is where the
  // current round hands off once it concludes.
  const goToNextStep = () => router.push(nextStep.href);

  // Allow Escape to dismiss the active proctoring dialog (setup / warning).
  // The terminal "blocked" dialog is intentionally not Escape-dismissible.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (warningMessage && !blocked) {
        closeWarning();
      } else if (!hasStarted && setupStep === "verify" && !blocked) {
        setSetupStep("systemcheck");
      } else if (!hasStarted && setupStep === "systemcheck" && !blocked) {
        setSetupStep("rules");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [warningMessage, blocked, hasStarted, setupStep]);

  async function handleSendText() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    // In coding mode the answer is the formatted code + execution output; the raw
    // source (for restore-on-failure) lives in draft.
    const rawCode = (draftRef.current || draft).trim();
    const currentText = isCodingMode
      ? buildCodeAnswer()
      : (textAreaRef.current ? textAreaRef.current.value.trim() : (draft + interimDraft).trim());
    const hasContent = isCodingMode ? !!rawCode : !!currentText;
    if (!hasContent || !sessionId || isProcessing) return;
    const wasCodeSubmit = isCodingMode && codeInterviewActive;

    if (recognitionRef.current) {
      recognitionRef.current.shouldListen = false;
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    // What to put back in the editor on failure: the raw source in coding mode,
    // otherwise the plain answer text.
    const draftToRestore = isCodingMode ? rawCode : currentText;

    setSendError(null);
    setMessages(prev => [...prev, { role: "user", text: currentText }]);
    setDraft("");
    draftRef.current = "";
    setInterimDraft("");
    setCodeResult(null);
    setCodeTestSummary(null);
    stopChallengeTimer();
    if (textAreaRef.current) textAreaRef.current.value = "";
    setIsProcessing(true);

    // Restore the candidate's drafted answer (and roll back the optimistic
    // message) so a transient send/transcribe failure never silently drops it.
    const restoreDraft = () => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === "user" && last.text === currentText) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      draftRef.current = draftToRestore;
      setDraft(draftToRestore);
      if (textAreaRef.current) textAreaRef.current.value = draftToRestore;
    };

    // Self-healing context: carry enough to rebuild this session if the server
    // lost it (serverless without a shared store). `messages` here is the prior
    // conversation (the current answer is sent separately as `text`).
    const recovery = {
      studentId: id,
      role: profile?.targetRole || (isExam ? "the exam" : "Candidate"),
      mode,
      track,
      resumeSummary: profile ? [
        profile.resumeSummary,
        profile.resumeSkills && profile.resumeSkills.length > 0 ? `Skills: ${profile.resumeSkills.join(", ")}` : "",
        profile.resumeProjects && profile.resumeProjects.length > 0 ? `Projects: ${profile.resumeProjects.map((p: any) => `${p.title} (${p.stack?.join(", ") || ""}): ${p.impact || ""}`).join("; ")}` : "",
        profile.aspiration ? `Goal/Target Placement: ${profile.aspiration}` : "",
      ].filter(Boolean).join("\n") : "",
      dnlaSummary: buildDnlaSummary(id),
      difficulty: difficultyRef.current,
      ...(mode === "behavioural" ? { priorInterviews: buildPriorInterviews(id) } : {}),
      transcript: messages.map((mm) => ({
        role: mm.role === "ai" ? "assistant" : "user",
        content: mm.text,
      })),
    };

    try {
      const res = await authedFetch("/api/interview/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          text: currentText,
          difficulty: difficultyRef.current,
          recovery,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        // Coding answer accepted → end the coding block, resume normal interview.
        if (wasCodeSubmit) exitCodeInterview(true);
        if (data.isDone) {
          try {
            localStorage.removeItem(`taledge:fit-score:${id}`);
          } catch (e) {}
          // Disarm proctoring on completion so nothing the candidate does on the
          // results hand-off can fire a late termination → dashboard bounce.
          hasStartedRef.current = false;
          doneRef.current = true;
          setDone(true);
          const finalMsg = data.nextQuestion 
            ? stripMarkdown(data.nextQuestion) 
            : "Thank you for completing this assessment. Your responses have been recorded and analyzed. Click below to view your detailed results.";
          setMessages(prev => [...prev, { role: "ai", text: finalMsg }]);
          setIsProcessing(false);
          playAudioAndListen(data.audioBase64, finalMsg);
          return;
        }
        setMessages(prev => [...prev, { role: "ai", text: stripMarkdown(data.nextQuestion) }]);
        setIsProcessing(false);
        playAudioAndListen(data.audioBase64, data.nextQuestion);
      } else {
        setIsProcessing(false);
        restoreDraft();
        setSendError("Your answer could not be sent. It has been restored below - please try sending again.");
      }
    } catch (e) {
      setIsProcessing(false);
      restoreDraft();
      setSendError("Your answer could not be sent. It has been restored below - please try sending again.");
    }
  }

  function toggleMic() {
    if (!recognitionRef.current) return;
    if (recording) {
      recognitionRef.current.shouldListen = false;
      recognitionRef.current.stop();
    } else {
      startListening();
    }
  }

  const m = Math.floor(elapsed / 60);
  const s = String(elapsed % 60).padStart(2, "0");

  // Proctoring status indicator helper
  const StatusDot = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-pulse'}`} />
      <span className={`text-[11px] font-bold uppercase tracking-wider ${ok ? 'text-emerald-700' : 'text-rose-600'}`}>{label}</span>
    </div>
  );

  // Face-ID guidance row (verify dialog checklist) - Salesforce layout, on-brand tones.
  const VerifyGuide = ({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) => (
    <div className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-[11.5px] font-medium ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : warn ? "border-rose-200 bg-rose-50 text-rose-700" : "border-ink-200 bg-ink-50 text-ink-500"}`}>
      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-white ${ok ? "bg-emerald-500" : warn ? "bg-rose-500" : "bg-ink-400"}`}>
        {ok ? <Check className="w-2.5 h-2.5" /> : warn ? <X className="w-2.5 h-2.5" /> : <span className="block w-1 h-1 rounded-full bg-white" />}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );

  // ── Derived live state for the Face-ID verify dialog ──────────────────────
  const vModelsLoaded = proctoringReady && !!modelRef.current;
  const vPersonCount = proctoringStatus.personCount;
  const vLightingOk = lightingState === "good";
  const vTooMany = vModelsLoaded && vPersonCount > 1;
  const vNoPerson = vModelsLoaded && vPersonCount === 0;
  const vFaceOk = vModelsLoaded ? proctoringStatus.faceVisible : webcamEnabled;
  const vAllGood = webcamEnabled && vLightingOk && (!vModelsLoaded || vPersonCount === 1) && vFaceOk;
  // Hard-block capture only on clearly-bad, fixable conditions; otherwise let the
  // server-side Gemini face check be the final gate (so detection lag never traps).
  const vBlockCapture = !webcamEnabled || lightingState === "dark" || vTooMany;
  const vPersonLabel = !vModelsLoaded
    ? "Detecting…"
    : vPersonCount === 0
    ? "No person detected"
    : vPersonCount === 1
    ? "1 person detected"
    : `${vPersonCount} people detected`;
  const vPersonTone: "ok" | "bad" | "neutral" = !vModelsLoaded ? "neutral" : vPersonCount === 1 ? "ok" : "bad";
  const vLightingLabel =
    lightingState === "good" ? "Good lighting" : lightingState === "dark" ? "Too dark" : lightingState === "bright" ? "Too bright" : "Checking lighting…";
  const vCaptureHint = !webcamEnabled
    ? "Waiting for camera…"
    : lightingState === "dark"
    ? "Too dark - add light on your face"
    : vTooMany
    ? `Only one person allowed (${vPersonCount} detected)`
    : lightingState === "bright"
    ? "Reduce glare / backlight"
    : vNoPerson
    ? "Position your face in the frame"
    : vModelsLoaded && !proctoringStatus.faceVisible
    ? "Center your face in the oval"
    : "Capture & Verify";

  // ── Focus traps for the setup / blocking modal dialogs (accessibility) ──────
  // Each ref is attached to a dialog's outer container; the hook only acts while
  // that dialog's render condition is true.
  const cameraErrorDialogRef = useDialogFocus<HTMLDivElement>(!!cameraError && !blocked);
  const resumeDialogRef = useDialogFocus<HTMLDivElement>(!hasStarted && setupStep === "resume" && !blocked);
  const rulesDialogRef = useDialogFocus<HTMLDivElement>(!hasStarted && setupStep === "rules" && !blocked);
  const syscheckDialogRef = useDialogFocus<HTMLDivElement>(!hasStarted && setupStep === "systemcheck" && !blocked);
  const verifyDialogRef = useDialogFocus<HTMLDivElement>(!hasStarted && setupStep === "verify" && !blocked);
  const blockedDialogRef = useDialogFocus<HTMLDivElement>(blocked);

  // ── Header connection status: 3 explicit states (was 'Live' / 'Connecting…') ─
  // Thinking… while the model is generating; Live once a session is idle/ready;
  // Connecting… before a session exists. Derives display only — no behaviour change.
  const connStatus: { tone: "success" | "warn"; label: string; pulse: boolean } = isProcessing
    ? { tone: "warn", label: "Thinking…", pulse: true }
    : sessionId
    ? { tone: "success", label: "Live", pulse: true }
    : { tone: "warn", label: "Connecting…", pulse: false };

  return (
    <div className="min-h-screen bg-canvas flex flex-col font-sans relative z-0 select-none"
      onCopy={e => e.preventDefault()}
      onCut={e => e.preventDefault()}
      onPaste={e => e.preventDefault()}
      onContextMenu={e => e.preventDefault()}
      onSelectCapture={e => {}}
    >
      {/* Ambient background glow (single decorative halo) */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-brand-300/20 blur-[130px] animate-pulse" style={{ animationDuration: '8s' }} />
      </div>

      {/* ===== CAMERA FAILURE OVERLAY (blocking) ===== */}
      {cameraError && !blocked && (
        <div
          ref={cameraErrorDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="camera-error-title"
          className="fixed inset-0 z-[210] bg-ink-900/70 backdrop-blur-xl flex items-center justify-center p-4 text-center"
        >
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-lg">
            <Card variant="default" className="rounded-xl2 p-8 border-rose-200">
              <div aria-hidden className="w-16 h-16 bg-rose-100 rounded-full mx-auto flex items-center justify-center mb-5">
                <Camera className="w-8 h-8 text-rose-600" />
              </div>
              <Heading as="h2" id="camera-error-title" className="text-2xl text-ink-900 mb-3">Camera Unavailable</Heading>
              <p className="text-ink-600 mb-6 text-sm" aria-live="assertive">{cameraError}</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button type="button" data-autofocus onClick={() => window.location.reload()} size="lg">
                  Retry Camera Access
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.push(`${flowBase}/${id}`)} size="lg">
                  Return to Dashboard
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      )}

      {/* ===== PRE-START RULES OVERLAY ===== */}
      {!hasStarted && setupStep === "resume" && !blocked && (
        <div
          ref={resumeDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-dialog-title"
          className="fixed inset-0 z-[100] bg-ink-900/60 backdrop-blur-xl overflow-y-auto flex justify-center p-4 md:p-8"
        >
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="my-auto w-full max-w-lg">
            <Card variant="default" className="rounded-xl2 p-6 md:p-8 text-center">
              <div aria-hidden className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl2 bg-gradient-to-br from-brand-600 to-accent-500 shadow-panel">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <Heading as="h2" id="resume-dialog-title" className="text-2xl">Upload your résumé first</Heading>
              <p className="mt-2 text-sm text-ink-500">
                Your {modeLabel} interview is tailored to your résumé - your skills, projects and target role. Upload it now for the most relevant questions.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <ButtonLink href="/onboarding" size="lg" data-autofocus>
                  <FileText className="h-4 w-4" /> Upload résumé
                </ButtonLink>
                <Button type="button" variant="ghost" size="lg" onClick={() => setSetupStep("rules")}>
                  Continue without résumé
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      )}

      {!hasStarted && setupStep === "rules" && !blocked && (
        <div
          ref={rulesDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-dialog-title"
          aria-describedby="rules-dialog-desc"
          className="fixed inset-0 z-[100] bg-ink-900/60 backdrop-blur-xl overflow-y-auto flex justify-center p-4 md:p-8"
        >
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="my-auto w-full max-w-2xl">
            <Card variant="default" className="rounded-xl2 p-6 md:p-8">
            <div aria-hidden className="w-12 h-12 bg-gradient-to-br from-brand-600 to-accent-500 rounded-xl2 flex items-center justify-center shadow-panel mb-4">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <Eyebrow className="mb-1">{modeLabel} Assessment</Eyebrow>
            <Heading as="h2" id="rules-dialog-title" className="text-xl text-ink-900 mb-1">Proctored Assessment</Heading>
            <p id="rules-dialog-desc" className="text-ink-500 mb-4 text-xs font-semibold">This is a strictly monitored AI interview. Read the rules carefully.</p>

            <div className="bg-ink-50/60 rounded-xl2 p-4 mb-4 border border-ink-200/50 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              {[
                { icon: <MonitorOff className="w-4 h-4" />, title: "No Window Switching", desc: "Leaving or unfocusing triggers a warning." },
                { icon: <Users className="w-4 h-4" />, title: "No Other People", desc: "Only 1 person allowed in frame." },
                { icon: <Smartphone className="w-4 h-4" />, title: "No Devices", desc: "Phones or books are prohibited." },
                { icon: <Camera className="w-4 h-4" />, title: "Camera Always On", desc: "Covering camera triggers warnings." },
                { icon: <Clipboard className="w-4 h-4" />, title: "No Copy/Paste", desc: "Keyboard shortcuts are blocked." },
                { icon: <Eye className="w-4 h-4" />, title: "Face Visible", desc: "Your face must remain visible." },
                { icon: <Mic className="w-4 h-4" />, title: "Quiet Environment", desc: "Keep background noise low." },
              ].map((rule, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="mt-0.5 text-brand-600 shrink-0">{rule.icon}</div>
                  <div>
                    <span className="text-xs font-bold text-ink-800 block leading-tight">{rule.title}</span>
                    <span className="text-[10px] text-ink-500 leading-snug block">{rule.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl2 p-2.5 mb-4">
              <p className="text-rose-600 text-[10px] font-bold text-center">⚠ 3 violations = automatic termination. No exceptions.</p>
            </div>

            {/* Difficulty picker — asked ONCE, before the AI interview (technical
                round). The chosen level is persisted per device and reused for the
                later behavioural/DNLA/final rounds, so we don't ask again there.
                It only sets where the interviewer STARTS; the AI still auto-judges
                every answer and adapts up or down from here. */}
            {mode === "technical" ? (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-ink-800">Starting difficulty</span>
                  <span className="text-[10px] text-ink-500 font-semibold">AI still adapts to your answers</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DIFFICULTY_OPTIONS.map((opt) => {
                    const active = difficulty === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setDifficulty(opt.key)}
                        aria-pressed={active}
                        title={opt.blurb}
                        className={`rounded-xl2 border px-2.5 py-2 text-left transition ${
                          active
                            ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500/40"
                            : "border-ink-200/60 bg-white hover:border-ink-300"
                        }`}
                      >
                        <span className={`block text-xs font-bold leading-tight ${active ? "text-brand-700" : "text-ink-800"}`}>
                          {opt.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-ink-500">{opt.blurb}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mb-4 flex items-center justify-between rounded-xl2 border border-ink-200/60 bg-ink-50/60 px-3 py-2">
                <span className="text-[10px] text-ink-500 font-semibold">Starting difficulty (from your AI interview)</span>
                <span className="text-xs font-bold text-brand-700">
                  {DIFFICULTY_OPTIONS.find((o) => o.key === difficulty)?.label ?? "Adaptive"}
                </span>
              </div>
            )}

            <Button type="button" data-autofocus onClick={() => setSetupStep("systemcheck")} disabled={!proctoringReady} size="lg" className="w-full">
              {proctoringReady ? "Continue to System Check" : <><Loader2 className="w-4 h-4 animate-spin" /> Initializing AI Proctoring Engine...</>}
            </Button>
            </Card>
          </motion.div>
        </div>
      )}

      {/* ===== PRE-FLIGHT SYSTEM CHECK ===== */}
      {!hasStarted && setupStep === "systemcheck" && !blocked && (
        <div
          ref={syscheckDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="syscheck-title"
          className="fixed inset-0 z-[100] bg-ink-900/60 backdrop-blur-xl overflow-y-auto flex justify-center p-4 md:p-8"
        >
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="my-auto w-full max-w-2xl">
            <Card variant="default" className="rounded-xl2 p-6 md:p-8">
              <div aria-hidden className="w-12 h-12 bg-gradient-to-br from-brand-600 to-accent-500 rounded-xl2 flex items-center justify-center shadow-panel mb-4">
                <ScanFace className="w-6 h-6 text-white" />
              </div>
              <Eyebrow className="mb-1">Before you begin</Eyebrow>
              <Heading as="h2" id="syscheck-title" className="text-xl text-ink-900 mb-1">System Check</Heading>
              <p className="text-ink-500 mb-4 text-xs font-semibold">We&apos;re confirming your camera, microphone, lighting and connection so nothing interrupts your interview.</p>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-3">
                  <div className="relative rounded-xl2 overflow-hidden border border-ink-200 bg-ink-900 aspect-video">
                    <video
                      ref={(el) => { if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) el.srcObject = mediaStreamRef.current; }}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-500">Mic input</span>
                      <span className="text-[10px] text-ink-400">Say a few words</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-ink-100 overflow-hidden" role="meter" aria-label="Microphone input level">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-[width] duration-75" style={{ width: `${Math.round(micLevel * 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { key: "camera", label: "Camera", icon: <Camera className="w-3.5 h-3.5" /> },
                    { key: "mic", label: "Microphone", icon: <Mic className="w-3.5 h-3.5" /> },
                    { key: "lighting", label: "Lighting", icon: <Eye className="w-3.5 h-3.5" /> },
                    { key: "network", label: "Connection", icon: <ChevronRight className="w-3.5 h-3.5" /> },
                    { key: "browser", label: "Browser", icon: <BadgeCheck className="w-3.5 h-3.5" /> },
                  ].map((row) => {
                    const st = sysChecks[row.key as keyof typeof sysChecks];
                    return (
                      <div key={row.key} className="flex items-center gap-2.5 rounded-xl border border-ink-200/70 bg-white px-3 py-2.5">
                        <span className="text-ink-500 shrink-0">{row.icon}</span>
                        <span className="text-xs font-bold text-ink-800 flex-1">{row.label}</span>
                        {st === "checking" && <span className="flex items-center gap-1 text-[10px] font-semibold text-ink-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…</span>}
                        {st === "pass" && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><Check className="w-3.5 h-3.5" /> Good</span>}
                        {st === "warn" && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> Check</span>}
                        {st === "fail" && <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600"><X className="w-3.5 h-3.5" /> Failed</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {sysChecks.lighting === "warn" && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">Your lighting looks dim - face a window or a light so the camera sees you clearly. This avoids &quot;face not visible&quot; warnings during the interview.</p>
              )}
              {sysChecks.network === "warn" && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">Your connection looks slow - for the best experience, use a stable network.</p>
              )}
              {(sysChecks.camera === "fail" || sysChecks.mic === "fail" || sysChecks.browser === "fail") && (
                <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-2">We couldn&apos;t access your {sysChecks.camera === "fail" ? "camera" : sysChecks.mic === "fail" ? "microphone" : "browser features"}. Allow camera + microphone permissions and re-run the check. Use Chrome or Edge for the best experience.</p>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="lg" onClick={runSystemChecks} className="flex-1">
                  <RefreshCw className="w-4 h-4" /> Re-run
                </Button>
                <Button
                  type="button"
                  data-autofocus
                  size="lg"
                  onClick={handleGoToVerify}
                  disabled={!(sysChecks.camera === "pass" && sysChecks.mic === "pass" && sysChecks.browser !== "fail")}
                  className="flex-[2]"
                >
                  Continue to Face ID <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-ink-400 text-center mt-2">Camera and microphone must pass to continue. Lighting and connection are advisory.</p>
            </Card>
          </motion.div>
        </div>
      )}

      {/* ===== FACE ID VERIFICATION OVERLAY ===== */}
      {!hasStarted && setupStep === "verify" && !blocked && (
        <div
          ref={verifyDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-dialog-title"
          aria-describedby="verify-dialog-desc"
          className="fixed inset-0 z-[100] bg-ink-900/70 backdrop-blur-md overflow-y-auto flex items-center justify-center p-3 sm:p-4 font-sans"
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl2 bg-white shadow-[0_12px_48px_rgba(24,24,27,0.4)] ring-1 ring-black/5"
          >
            {/* ── Brand header (Salesforce layout, TalEdge colors) ────────── */}
            <div className="relative shrink-0 bg-gradient-to-br from-brand-700 via-brand-600 to-accent-500 px-6 pt-5 pb-4 text-white">
              <div className="flex items-start gap-3.5">
                <div aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
                  <ScanFace className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <Heading as="h2" id="verify-dialog-title" className="text-[18px] font-bold leading-tight text-white">
                    Identity Verification
                  </Heading>
                  <p id="verify-dialog-desc" className="mt-0.5 text-[13px] font-medium text-white/85">
                    A quick biometric check confirms it&apos;s you before the assessment begins.
                  </p>
                </div>
                <span className="ml-auto hidden sm:inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-white/25">
                  <Lock className="h-3 w-3" aria-hidden /> Secure
                </span>
              </div>

              {/* Step path */}
              <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Guidelines
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-white/45" aria-hidden />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-brand-700 shadow-sm">
                  <ScanFace className="h-3.5 w-3.5" aria-hidden /> Identity
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-white/45" aria-hidden />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-white/70 ring-1 ring-white/15">
                  <Brain className="h-3.5 w-3.5" aria-hidden /> Interview
                </span>
              </div>
            </div>

            {/* ── Body (scrolls if the viewport is short) ─────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {capturedImage ? (
                <div className="relative mx-auto w-full max-h-[46dvh] aspect-[4/3] overflow-hidden rounded-xl bg-ink-900 ring-1 ring-ink-200">
                  <img src={capturedImage} alt="Captured Face ID frame" className="h-full w-full object-cover" />
                  {verificationResult.status === "verifying" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-900/70 text-white backdrop-blur-sm">
                      <Loader2 className="mb-3 h-8 w-8 animate-spin" />
                      <span className="text-sm font-semibold tracking-wide">Verifying your identity…</span>
                    </div>
                  )}
                  {verificationResult.status === "success" && (
                    verificationResult.unavailable ? (
                      <div className="absolute inset-0 flex items-center justify-center border-2 border-amber-500 bg-amber-500/20 backdrop-blur-[2px]">
                        <div className="scale-110 rounded-full bg-amber-500 p-3 text-white shadow-lg">
                          <AlertTriangle className="h-8 w-8" />
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center border-2 border-emerald-500 bg-emerald-500/25 backdrop-blur-[2px]">
                        <div className="scale-110 rounded-full bg-emerald-500 p-3 text-white shadow-lg">
                          <Check className="h-8 w-8" />
                        </div>
                      </div>
                    )
                  )}
                  {verificationResult.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center border-2 border-rose-500 bg-rose-500/20 backdrop-blur-[2px]">
                      <div className="scale-110 rounded-full bg-rose-500 p-3 text-white shadow-lg">
                        <X className="h-8 w-8" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative mx-auto w-full max-h-[46dvh] aspect-[4/3] overflow-hidden rounded-xl bg-ink-900 ring-1 ring-ink-200">
                    {/* real live preview - shares the proctoring MediaStream */}
                    <video
                      ref={verifyVideoRef}
                      autoPlay
                      playsInline
                      muted
                      aria-label="Live camera preview"
                      className="h-full w-full object-cover [transform:scaleX(-1)]"
                    />
                    {/* face alignment guide */}
                    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className={`h-[80%] aspect-[3/4] rounded-[46%] border-2 border-dashed transition-colors duration-500 ${vAllGood ? "border-emerald-400" : "border-white/70"}`} />
                    </div>
                    {/* live status chips */}
                    <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                      <span className={`h-1.5 w-1.5 rounded-full ${webcamEnabled ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
                      {webcamEnabled ? "Live" : "Off"}
                    </div>
                    <div className={`absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur ${vPersonTone === "ok" ? "bg-emerald-500/85" : vPersonTone === "bad" ? "bg-rose-500/85" : "bg-white/20"}`}>
                      <Users aria-hidden className="h-3 w-3" /> {vPersonLabel}
                    </div>
                    {!webcamEnabled && (
                      <div className="absolute inset-0 grid place-items-center text-xs font-semibold text-white/80">
                        {cameraError ? "Camera unavailable" : "Starting camera…"}
                      </div>
                    )}
                  </div>

                  <p className="mt-3 text-center text-[12.5px] leading-relaxed text-ink-500">
                    Center your face in the oval and look directly at the camera. Only one person may be present.
                  </p>

                  {/* live guidance checklist */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <VerifyGuide ok={webcamEnabled} label={webcamEnabled ? "Camera active" : "Camera off"} />
                    <VerifyGuide ok={vModelsLoaded ? vPersonCount === 1 : webcamEnabled} warn={vTooMany} label={vPersonLabel} />
                    <VerifyGuide ok={vLightingOk} warn={lightingState === "bright"} label={vLightingLabel} />
                    <VerifyGuide
                      ok={vModelsLoaded ? proctoringStatus.faceVisible : webcamEnabled}
                      label={vModelsLoaded ? (proctoringStatus.faceVisible ? "Face detected" : "Face not detected") : "Face check ready"}
                    />
                  </div>
                </>
              )}

              {verificationResult.status === "error" && (
                <div className="mt-4 flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50 p-3" role="alert" aria-live="assertive">
                  <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-rose-700">{verificationResult.message}</p>
                    <button
                      type="button"
                      onClick={() => { setCapturedImage(null); setVerificationResult({ status: "idle" }); }}
                      className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-800"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden /> Retake photo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer action bar ───────────────────────────────────────── */}
            <div className="shrink-0 border-t border-ink-200 bg-ink-50 px-6 py-4">
              {verificationResult.status === "success" ? (
                <>
                  {verificationResult.unavailable && (
                    <div className="mb-3 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3" role="status" aria-live="polite">
                      <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <p className="text-[12.5px] font-semibold text-amber-700">
                        Identity verification is temporarily unavailable. You may proceed. This session is flagged for manual review.
                      </p>
                    </div>
                  )}
                  <Button
                    type="button"
                    data-autofocus
                    size="lg"
                    onClick={handleStartInterview}
                    className={`w-full ${verificationResult.unavailable ? "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500/40" : "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500/40"}`}
                  >
                    {verificationResult.unavailable ? (
                      <><ShieldAlert className="h-4 w-4" aria-hidden /> Proceed, verification unavailable <ArrowRight className="h-4 w-4" aria-hidden /></>
                    ) : (
                      <><BadgeCheck className="h-4 w-4" aria-hidden /> Identity verified - Start interview <ArrowRight className="h-4 w-4" aria-hidden /></>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  data-autofocus
                  size="lg"
                  onClick={handleCaptureAndVerify}
                  disabled={verificationResult.status === "verifying" || vBlockCapture}
                  className="w-full disabled:cursor-not-allowed"
                >
                  {verificationResult.status === "verifying" ? (
                    <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Verifying…</>
                  ) : vBlockCapture ? (
                    <>{vCaptureHint}</>
                  ) : (
                    <><ScanFace className="h-4 w-4" aria-hidden /> Capture &amp; verify</>
                  )}
                </Button>
              )}
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-ink-400">
                <Lock className="h-3 w-3" aria-hidden /> Your camera image is used only to confirm your identity for this assessment.
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* ===== BLOCKED OVERLAY ===== */}
      {blocked && (
        <div
          ref={blockedDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="blocked-dialog-title"
          className="fixed inset-0 z-[200] bg-ink-900/60 backdrop-blur-xl flex items-center justify-center p-4 text-center"
        >
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="w-full max-w-lg">
            <Card variant="default" className="rounded-xl2 p-10 border-rose-200">
            <div aria-hidden className="w-20 h-20 bg-rose-100 rounded-full mx-auto flex items-center justify-center mb-6">
              <ShieldAlert className="w-10 h-10 text-rose-600" />
            </div>
            <Heading as="h2" id="blocked-dialog-title" className="text-3xl text-ink-900 mb-4">Assessment Terminated</Heading>
            <p className="text-ink-500 mb-4 text-lg" role="alert">{blockReason || `Your assessment has been permanently blocked due to ${warnings} proctoring violations.`}</p>
            {violationLog.length > 0 ? (
              <div className="bg-rose-50 border border-rose-100 rounded-xl2 p-4 mb-8 text-left max-h-32 overflow-y-auto">
                {violationLog.map((v, i) => (
                  <p key={i} className="text-xs text-rose-600 font-mono mb-1">{v}</p>
                ))}
              </div>
            ) : (
              <div className="bg-ink-50/60 border border-ink-200/50 rounded-xl2 p-4 mb-8 text-center">
                <p className="text-xs text-ink-500">No detailed violation log is available for this session.</p>
              </div>
            )}
            <p className="text-xs text-ink-400 mb-4">Taking you to your results…</p>
            <Button type="button" data-autofocus variant="danger" onClick={() => router.push(terminationHref)} size="lg" className="px-8 py-3">
              View results
            </Button>
            </Card>
          </motion.div>
        </div>
      )}

      {/* ===== WARNING OVERLAY ===== */}
      <AnimatePresence>
        {warningMessage && !blocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="warning-dialog-title"
            aria-describedby="warning-dialog-desc"
            className="fixed inset-0 z-[150] bg-ink-900/60 backdrop-blur-xl flex items-center justify-center p-4 text-center"
          >
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-lg">
              <Card variant="default" className="rounded-xl2 p-10 border-amber-200">
              <div aria-hidden className="w-20 h-20 bg-amber-100 rounded-full mx-auto flex items-center justify-center mb-6">
                <AlertTriangle className="w-10 h-10 text-amber-600" />
              </div>
              <Heading as="h2" id="warning-dialog-title" className="text-2xl text-ink-900 mb-4" aria-live="assertive">{warningMessage.split(':')[0]}</Heading>
              <p id="warning-dialog-desc" className="text-ink-700 mb-4 text-lg font-medium">{warningMessage.split(':').slice(1).join(':')}</p>
              <p className="text-ink-500 mb-8 text-sm">Return to fullscreen immediately. {3 - warnings} warning(s) remaining before termination.</p>
              <button type="button" autoFocus onClick={closeWarning} className="px-8 py-4 w-full bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-500 shadow-panel transition-all">
                I Understand - Return to Interview
              </button>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== IDENTITY (IMPERSONATION) WARNING ===== */}
      <AnimatePresence>
        {identityWarning && !blocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="identity-warning-title"
            className="fixed inset-0 z-[160] bg-ink-900/70 backdrop-blur-xl flex items-center justify-center p-4 text-center"
          >
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-lg">
              <Card variant="default" className="rounded-xl2 p-10 border-rose-200">
                <div aria-hidden className="w-20 h-20 bg-rose-100 rounded-full mx-auto flex items-center justify-center mb-6">
                  <ShieldAlert className="w-10 h-10 text-rose-600" />
                </div>
                <Heading as="h2" id="identity-warning-title" className="text-2xl text-ink-900 mb-4" aria-live="assertive">
                  Identity Check Failed
                </Heading>
                <p className="text-ink-700 mb-3 text-lg font-medium">{identityWarning}</p>
                <p className="text-rose-600 font-bold text-sm">
                  Re-verifying now - the assessment will end if the enrolled candidate is not at the camera.
                </p>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== MAIN INTERVIEW LAYOUT ===== */}
      <div className="flex-1 flex flex-col w-full z-10 relative">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-2xl border-b border-ink-200/60 sticky top-0 z-50">
          <div className="max-w-[1800px] mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div aria-hidden className="relative w-9 h-9 bg-gradient-to-br from-brand-600 to-accent-500 rounded-xl flex items-center justify-center shadow-panel">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-ink-900 text-sm leading-tight">TalEdge AI</h1>
                <p className="text-[10px] font-medium text-ink-500">{modeLabel} Assessment</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge tone="danger" className="hidden md:inline-flex">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                PROCTORED · {warnings}/3
              </Badge>
              <Badge tone={connStatus.tone}>
                <span className={`h-1.5 w-1.5 rounded-full ${connStatus.tone === "success" ? "bg-emerald-500" : "bg-amber-500"} ${connStatus.pulse ? "animate-pulse" : ""}`} />
                {connStatus.label}
              </Badge>
              <Badge tone="neutral" className="font-mono">
                {m}:{s}
              </Badge>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-[1800px] mx-auto w-full p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Camera + Proctoring Panel + Profile.
              Below lg it drops BELOW the chat (order-2) so the Q&A is the primary
              top region on small screens instead of being pushed off the fold.
              On lg the grid columns place it back on the left (order reset). */}
          <div className="order-2 lg:order-none lg:col-span-3 flex flex-col md:grid md:grid-cols-2 lg:flex lg:flex-col gap-4">
            {/* Camera Feed */}
            <Card variant="default" className="bg-white/50 p-1.5 relative group">
              <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
                <div className="px-2.5 py-1 bg-black/70 backdrop-blur-xl rounded-lg text-[11px] font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <span className={`w-1.5 h-1.5 rounded-full ${webcamEnabled ? 'bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-rose-500'}`} />
                  <Camera aria-hidden className="w-2.5 h-2.5" />
                  {webcamEnabled ? "LIVE" : "OFF"}
                </div>
                <div className="px-2.5 py-1 bg-brand-50/80 backdrop-blur-xl rounded-lg text-[11px] font-bold text-brand-700 flex items-center gap-1.5 uppercase tracking-wider border border-brand-200/50">
                  {proctoringReady ? (
                    <><Eye aria-hidden className="w-2.5 h-2.5 text-emerald-600" /> AI Vision</>
                  ) : (
                    <><Loader2 aria-hidden className="w-2.5 h-2.5 animate-spin" /> Loading...</>
                  )}
                </div>
              </div>
              {/* Person count indicator */}
              {hasStarted && proctoringStatus.personCount > 0 && (
                <div className="absolute top-3 right-3 z-20">
                  <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 uppercase tracking-wider ${proctoringStatus.personCount === 1 ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-600 border border-rose-500/30 animate-pulse'}`}>
                    <Users aria-hidden className="w-2.5 h-2.5" />
                    {proctoringStatus.personCount} {proctoringStatus.personCount === 1 ? 'Person' : 'People'}
                  </div>
                </div>
              )}
              <div className="relative rounded-xl overflow-hidden">
                <div className={`absolute inset-0 border-2 rounded-xl z-10 pointer-events-none transition-colors duration-500 ${webcamEnabled && !proctoringStatus.cameraCovered ? 'border-emerald-500/20' : 'border-rose-500/30'}`} />
                <video ref={videoRef} autoPlay playsInline muted aria-label="Live proctoring camera feed of the candidate" className="w-full h-32 md:h-48 lg:h-auto lg:aspect-[4/3] object-cover bg-black rounded-xl" />
              </div>
            </Card>

            {/* Live Proctoring Panel */}
            {hasStarted && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card variant="default" className="bg-white/50 p-4">
                <Eyebrow className="mb-3 flex items-center gap-1.5">
                  <ShieldAlert aria-hidden className="w-3 h-3 text-brand-500" /> Live Security Checks
                </Eyebrow>
                <div className="grid grid-cols-2 gap-2">
                  <StatusDot ok={proctoringStatus.faceVisible} label="Face visible" />
                  <StatusDot ok={!proctoringStatus.phoneDetected} label="No devices" />
                  <StatusDot ok={proctoringStatus.personCount <= 1} label="No intrusion" />
                  <StatusDot ok={!proctoringStatus.cameraCovered} label="Cam clear" />
                  <StatusDot ok={proctoringStatus.tabFocused} label="Tab focused" />
                  <StatusDot ok={!proctoringStatus.noiseDetected} label="Quiet Env" />
                  <StatusDot ok={!proctoringStatus.externalDisplay} label="Single screen" />
                  <StatusDot ok={warnings === 0} label={`${warnings}/3 warns`} />
                </div>
                {/* Diagnostic: live object detections from the on-device vision
                    model. Helps confirm whether a phone is actually being seen. */}
                <div className="mt-3 pt-3 border-t border-ink-200/50">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-ink-400 mb-1 flex items-center gap-1.5">
                    <Eye aria-hidden className="w-2.5 h-2.5" /> AI sees
                  </div>
                  <p className="text-[10px] font-mono text-ink-500 leading-snug break-words min-h-[1.2em]">
                    {modelRef.current ? (detectedObjects || "-") : "vision model loading…"}
                  </p>
                </div>
                </Card>
              </motion.div>
            )}

            {/* Candidate Profile */}
            <Card variant="default" className="bg-white/50 p-5">
              <Eyebrow className="mb-3 flex items-center gap-1.5">
                <FileText aria-hidden className="w-3 h-3 text-brand-500" /> Candidate Profile
              </Eyebrow>
              {profile ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-ink-500 mb-0.5">Name</div>
                    <div className="text-sm font-semibold text-ink-800">{profile.fullName}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-ink-500 mb-0.5">Role</div>
                    <div className="text-sm font-semibold text-ink-800">{profile.targetRole}</div>
                  </div>
                  {profile.resumeSkills && profile.resumeSkills.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">Skills</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(profile.resumeSkills ?? []).slice(0, 6).map((skill, idx) => (
                          <Badge key={idx} tone="brand" className="rounded-md text-[10px]">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-ink-500">No candidate profile is available for this session.</p>
              )}
            </Card>
          </div>

          {/* Right Column: Chat Interface. order-1 lifts it above the camera/proctor
              stack below lg so the interview Q&A stays the primary top region. */}
          <div className="order-1 lg:order-none lg:col-span-9 flex flex-col h-[72vh] min-h-[520px] md:h-[76vh] lg:h-[calc(100vh-7rem)] bg-white/40 backdrop-blur-3xl rounded-xl2 shadow-panel border border-ink-200/60 overflow-hidden relative">
            {/* Messages - min-h-0 is REQUIRED: without it this flex-1 child keeps
                its default min-height:auto, refuses to shrink below its content,
                and the list overflows the panel (pushing the input area off-screen)
                instead of scrolling internally. */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 bg-transparent" role="log" aria-label="Interview conversation" aria-live="polite">
              {(messages?.length ?? 0) === 0 && !isProcessing && connectError && (
                <div className="h-full flex items-center justify-center">
                  <Card variant="flat" className="rounded-xl2 px-6 py-5 text-center max-w-sm border-rose-200" role="alert" aria-live="assertive">
                    <div aria-hidden className="w-12 h-12 bg-rose-100 rounded-full mx-auto flex items-center justify-center mb-3">
                      <AlertTriangle className="w-6 h-6 text-rose-600" />
                    </div>
                    <p className="text-sm font-semibold text-ink-800 mb-1">Live interviewer unavailable</p>
                    <p className="text-xs text-ink-500 mb-4">{connectError}</p>
                    <Button type="button" size="sm" onClick={handleStartInterview} disabled={isProcessing}>
                      {isProcessing ? <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" /> : null} Retry
                    </Button>
                  </Card>
                </div>
              )}
              {(messages?.length ?? 0) === 0 && !isProcessing && !connectError && (
                <div className="h-full flex items-center justify-center">
                  <Card variant="flat" className="rounded-xl2 px-6 py-5 text-center max-w-sm">
                    <p className="text-sm text-ink-500">
                      {hasStarted
                        ? "Connecting to your AI interviewer..."
                        : "Complete the proctoring setup to begin your interview."}
                    </p>
                  </Card>
                </div>
              )}
              <AnimatePresence>
                {(messages ?? []).map((msg, i) => (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-xl2 px-5 py-3.5 text-[14px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-br-sm border border-brand-400/30 shadow-md"
                        : "bg-white/80 backdrop-blur-md text-ink-800 border border-ink-200/80 rounded-bl-sm shadow-sm"
                    }`}>
                      {msg.role === "ai" && (
                        <div className="text-[9px] font-bold uppercase tracking-wider text-brand-600 mb-1.5 flex items-center gap-1">
                          <Brain aria-hidden className="w-3 h-3" /> AI Interviewer
                        </div>
                      )}
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {/* Live caption: the interviewer's words as it speaks. */}
                {liveActive && live.partialAi && (
                  <motion.div key="partial-ai" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                    <div className="max-w-[85%] rounded-xl2 px-5 py-3.5 text-[14px] leading-relaxed bg-brand-50/80 backdrop-blur-md text-ink-800 border border-brand-200/80 rounded-bl-sm shadow-sm">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-brand-600 mb-1.5 flex items-center gap-1.5">
                        <Brain aria-hidden className="w-3 h-3" /> AI Interviewer
                        <span className="inline-flex gap-0.5" aria-hidden>
                          <span className="w-1 h-1 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-1 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-1 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                        <span className="normal-case font-semibold text-brand-500">speaking…</span>
                      </div>
                      {live.partialAi}
                    </div>
                  </motion.div>
                )}
                {/* Live caption: the candidate's own words as they answer. */}
                {/* Candidate live caption - the forced-English browser STT writes
                    into `draft`/`interimDraft`; show it as a chat caption (not just
                    in the input box) so spoken words are clearly visible. Falls back
                    to Gemini's own transcription if that path is ever used. */}
                {liveActive && !isCodingMode && (() => {
                  const liveUserCaption = liveCaption || (`${draft} ${interimDraft}`).trim() || live.partialUser;
                  if (!liveUserCaption) return null;
                  return (
                    <motion.div key="partial-user" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                      <div className="max-w-[85%] rounded-xl2 px-5 py-3.5 text-[14px] leading-relaxed italic bg-gradient-to-br from-brand-600/70 to-brand-700/70 text-white rounded-br-sm border border-brand-400/30 shadow-md">
                        <div className="not-italic text-[9px] font-bold uppercase tracking-wider text-white/80 mb-1.5 flex items-center gap-1.5">
                          <Mic aria-hidden className="w-3 h-3 animate-pulse" /> You
                          <span className="normal-case font-semibold text-white/70">speaking…</span>
                        </div>
                        {liveUserCaption}
                      </div>
                    </motion.div>
                  );
                })()}
                {isProcessing && (
                  <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-white/80 backdrop-blur-md text-ink-500 border border-ink-200/80 rounded-xl2 px-5 py-3.5 rounded-bl-sm flex items-center gap-3 shadow-sm">
                      <div className="flex gap-1" aria-hidden>
                        <span className="w-2 h-2 rounded-full bg-brand-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-accent-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm font-medium text-ink-500">Thinking...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={chatBottomRef} />
            </div>

            {/* AI Visualizer Orb */}
            <div
              className="absolute top-5 right-5 pointer-events-none"
              role="img"
              aria-label={aiSpeaking ? "AI interviewer is speaking" : isProcessing ? "AI interviewer is thinking" : recording ? "Listening to your response" : sessionId ? "AI interviewer is ready" : "AI interviewer is idle"}
            >
              <div className="relative w-14 h-14 md:w-16 md:h-16 flex items-center justify-center">
                 <div
                   className={`absolute inset-0 rounded-full blur-xl transition-all duration-75 ${aiSpeaking ? 'bg-brand-500/20' : !isProcessing && sessionId && !recording ? 'bg-emerald-500/10 animate-pulse' : isProcessing ? 'bg-brand-500/10' : 'bg-transparent'}`}
                   style={{ transform: aiSpeaking ? `scale(${1 + aiVolume / 80})` : 'scale(1)' }}
                 />
                 <div
                   className={`relative w-8 h-8 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-75 ${aiSpeaking ? 'bg-gradient-to-tr from-brand-600 to-accent-500 border-brand-400 shadow-[0_0_30px_rgba(79,70,229,0.4)]' : !isProcessing && sessionId && !recording ? 'bg-gradient-to-tr from-emerald-500 to-emerald-300 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]' : isProcessing ? 'bg-gradient-to-tr from-brand-600 to-accent-500 border-brand-400' : 'bg-ink-100 border-ink-300'}`}
                   style={{ transform: aiSpeaking ? `scale(${1 + aiVolume / 120})` : '' }}
                 >
                   <div className="w-1/2 h-1/2 rounded-full bg-white/30 blur-[1px]" />
                 </div>
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-5 bg-white/70 backdrop-blur-xl border-t border-ink-200/60 z-10">
              {done ? (
                <div className="bg-emerald-50 rounded-xl2 p-6 border border-emerald-100 text-center">
                  <h3 className="text-lg font-bold text-emerald-800 mb-2">
                    {mode === "behavioural" ? "Assessment Completed" : `${modeLabel} Round Completed`}
                  </h3>
                  <p className="text-ink-500 text-sm mb-4">
                    {mode === "behavioural"
                      ? "Both interviews are complete. Building your Fit Score report…"
                      : "This round is complete. Continue to the next round of your assessment."}
                  </p>
                  <button type="button" onClick={goToNextStep} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-panel transition-all inline-flex items-center justify-center gap-2">
                    {nextStep.label} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : liveActive ? (
                (() => {
                  // The interviewer "has the floor" while it is speaking or its
                  // captions are still streaming. During that window the mic is
                  // muted and the answer box is locked; both reopen on the
                  // candidate's turn.
                  const aiHasFloor = aiSpeaking || !!live.partialAi;
                  return (
                <div className="space-y-3">
                  <div className={`flex items-center justify-center gap-2.5 text-sm font-semibold ${aiHasFloor ? "text-brand-700" : "text-emerald-700"}`} aria-live="polite">
                    {aiHasFloor ? (
                      <>
                        <MicOff aria-hidden className="w-4 h-4" />
                        Interviewer is speaking… your mic is muted
                      </>
                    ) : (
                      <>
                        <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/60" />
                          <Mic className="relative w-4 h-4 text-emerald-600 animate-pulse" />
                        </span>
                        Mic is on - speak your answer, or type it below
                      </>
                    )}
                  </div>

                  {/* The candidate's live words already appear as a chat caption
                      bubble in the conversation above (the "You · speaking…" bubble),
                      so the separate Live-transcript box was removed - it duplicated
                      that text and pushed the answer input down / blocked the view. */}

                  {live.error && (
                    <p className="text-[11px] font-semibold text-rose-600 text-center" role="alert">{live.error}</p>
                  )}
                  {micError && (
                    <p className="text-[11px] font-semibold text-amber-600 text-center" role="alert">{micError} You can type your answer in the box below.</p>
                  )}

                  {showCodeTool && !isCodingMode && (
                    <div className="flex items-center justify-center gap-1.5" role="group" aria-label="Response mode">
                      <button type="button" aria-pressed={!isCodingMode} onClick={() => setIsCodingMode(false)} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${!isCodingMode ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200 border border-ink-200/60'}`}>Voice / Text</button>
                      <button type="button" aria-pressed={isCodingMode} onClick={enterCodingMode} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${isCodingMode ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200 border border-ink-200/60'}`}><FileText aria-hidden className="w-3 h-3 inline mr-1" />Code</button>
                    </div>
                  )}

                  {isCodingMode ? (
                    <div className="space-y-2">
                      {renderCodingChallenge()}
                      <CodeRunner
                        code={draft}
                        onCodeChange={(v) => { setDraft(v); draftRef.current = v; }}
                        language={codeLanguage}
                        onLanguageChange={setCodeLanguage}
                        onResultChange={setCodeResult}
                        onTestSummaryChange={setCodeTestSummary}
                        question={codingChallenge?.prompt || lastAiQuestion}
                        editorHeight={220}
                      />
                    </div>
                  ) : (
                    <div className={`bg-white border rounded-xl p-2 flex transition-all ${aiHasFloor ? "border-ink-200/60 opacity-60" : "border-ink-200 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10"}`}>
                      <label htmlFor="live-answer-input" className="sr-only">Your response</label>
                      {/* Uncontrolled (defaultValue + ref) so the forced-English
                          STT can write recognised words straight into it in
                          real-time, mirroring the REST answer box. */}
                      <textarea
                        id="live-answer-input"
                        ref={textAreaRef}
                        defaultValue={draft}
                        disabled={aiHasFloor}
                        onChange={(e) => { setDraft(e.target.value); draftRef.current = e.target.value; }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendLiveText(); }
                        }}
                        placeholder={aiHasFloor ? "Wait for the interviewer to finish…" : "Speak in English or type your response..."}
                        className="flex-1 bg-transparent px-2 py-2 resize-none text-sm focus:outline-none text-ink-800 placeholder-ink-400 disabled:cursor-not-allowed max-h-40 overflow-y-auto"
                        rows={3}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-ink-500">
                      {isCodingMode
                        ? "Write and run your code, then Send it to the interviewer for evaluation."
                        : aiHasFloor ? "Listen - you can respond once the interviewer finishes." : usingGeminiStt ? "Talk naturally - your spoken answer sends automatically when you pause. Or type it. Keep background noise low." : "Talk naturally or type. Keep background noise low."}
                    </p>
                    <div className="flex gap-2 shrink-0">
                      {!isCodingMode && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={redoAnswer}
                          disabled={aiHasFloor}
                          title="Clear your answer and speak/type it again"
                        >
                          <RefreshCw aria-hidden className="w-3.5 h-3.5" /> Re-do
                        </Button>
                      )}
                      <Button type="button" id="send-btn" size="sm" onClick={handleSendLiveText} disabled={aiHasFloor}>
                        <Send aria-hidden className="w-3.5 h-3.5" /> {isCodingMode ? "Submit code" : "Send"}
                      </Button>
                      <Button type="button" variant="danger" size="sm" onClick={endLiveInterview}>
                        End interview &amp; see results
                      </Button>
                    </div>
                  </div>
                </div>
                  );
                })()
              ) : connectError ? (
                // The live interviewer failed to connect and the retry card is shown
                // in the transcript above. Suppress the full answer-input UI here so
                // it is not a dead, confusing control while there is no session.
                <div className="flex items-center justify-center gap-2 py-2 text-center text-[13px] font-medium text-ink-400">
                  <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-rose-400" />
                  Answer input is unavailable until the interviewer reconnects. Use Retry above.
                </div>
              ) : (
                <div className="space-y-3">
                  {sendError && (
                    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl2 px-3 py-2" role="alert" aria-live="assertive">
                      <AlertTriangle aria-hidden className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <p className="flex-1 text-[11px] font-semibold text-rose-700 leading-snug">{sendError}</p>
                      <button type="button" onClick={() => setSendError(null)} aria-label="Dismiss error" className="text-rose-500 hover:text-rose-700 shrink-0">
                        <X aria-hidden className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {!isCodingMode && (
                  <div className="flex items-center justify-between px-1 mb-1">
                    <div className="text-[10px] font-bold text-ink-500 uppercase tracking-wider flex items-center gap-2" aria-live="polite">
                      {recording && <span className="flex h-2 w-2 relative" aria-hidden><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span></span>}
                      {recording ? "Listening... (Auto-submitting after 4s of silence)" : "Auto-Mic Ready"}
                    </div>
                    <div className="text-[9px] font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100/50 animate-pulse">
                      ⚠ Keep background noise low & sit in a quiet place
                    </div>
                    <div className="flex items-center gap-1.5" role="group" aria-label="Response input mode">
                      <button type="button" aria-pressed={!isCodingMode} onClick={() => setIsCodingMode(false)} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${!isCodingMode ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200 border border-ink-200/60'}`}>Voice / Text</button>
                      {showCodeTool && <button type="button" aria-pressed={isCodingMode} onClick={enterCodingMode} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${isCodingMode ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200 border border-ink-200/60'}`}><FileText aria-hidden className="w-3 h-3 inline mr-1" />Code</button>}
                    </div>
                  </div>
                  )}

                  <div className="flex gap-3 items-end">
                    {!isCodingMode && (
                      <button
                        type="button"
                        onClick={toggleMic}
                        aria-label={recording ? "Stop microphone" : "Start microphone"}
                        aria-pressed={recording}
                        className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                          recording ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30" : "bg-ink-100 text-ink-500 hover:bg-ink-200 border border-ink-200"
                        }`}
                      >
                        {recording ? <Mic aria-hidden className="w-5 h-5 animate-pulse" /> : <MicOff aria-hidden className="w-5 h-5" />}
                      </button>
                    )}

                    <div className="flex-1">
                      {isCodingMode ? (
                        <div className="space-y-2">
                          {renderCodingChallenge()}
                          <CodeRunner
                            code={draft}
                            onCodeChange={(v) => { setDraft(v); draftRef.current = v; }}
                            language={codeLanguage}
                            onLanguageChange={setCodeLanguage}
                            onResultChange={setCodeResult}
                            onTestSummaryChange={setCodeTestSummary}
                            question={codingChallenge?.prompt || lastAiQuestion}
                            editorHeight={220}
                          />
                        </div>
                      ) : (
                        <div className="bg-white border border-ink-200 rounded-xl p-2 flex focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
                          <label htmlFor="answer-input" className="sr-only">Your response</label>
                          <textarea
                            id="answer-input"
                            ref={textAreaRef}
                            defaultValue={draft}
                            onChange={(e) => {
                               draftRef.current = e.target.value;
                               setDraft(e.target.value);
                            }}
                            placeholder="Speak naturally or type your response..."
                            className="flex-1 bg-transparent px-2 py-2 resize-none text-sm focus:outline-none text-ink-800 placeholder-ink-400 max-h-40 overflow-y-auto"
                            rows={3}
                          />
                        </div>
                      )}
                      <div className="flex justify-end mt-2 gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={redoAnswer}
                          disabled={isProcessing}
                        >
                          Clear & Re-answer
                        </Button>
                        <Button type="button" id="send-btn" size="sm" onClick={handleSendText} disabled={isProcessing}>
                          {isProcessing ? <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" /> : <Send aria-hidden className="w-3.5 h-3.5" />} Send
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
