# TalEdge — AI Voice Interview Platform

## What this is
Voice-based AI interviewer. **Browser → Gemini Live API directly** (native audio WebSocket,
`hooks/useGeminiLive.ts`) — there is NO backend audio path today. The Next.js backend serves
REST routes (interview start/voice/proctor, fit-score) and persists to Firestore.

- Stack: **Next.js App Router (TypeScript) on Firebase App Hosting (Cloud Run), Firestore via
  firebase-admin (ADC), Gemini REST + Gemini Live (browser-side)**
- Run locally: `pnpm dev` (demo mode without admin creds; file-store fallbacks under /tmp)
- Build/typecheck: `pnpm build` · `npx tsc --noEmit`
- Load tests: `k6 run loadtest/platform.test.js` · `k6 run loadtest/gemini-gate.test.js`
  (BASE env overrides target; defaults to prod)
- Package manager: **pnpm only** (deploy uses frozen lockfile — never npm install)

Target: 5–20 concurrent interviews. Pilot phase.

---

## Non-negotiable invariants

**1. No shared state across interviews.**
Audited 2026-07-12: server holds NO Gemini Live sessions (they live in each candidate's
browser); interview sessions are per-doc in Firestore with transactional updates; the client
hook keeps everything in per-component refs. Keep it that way. Known accepted exceptions:
in-memory rate-limit fallback and /tmp file stores are DEMO-ONLY paths (prod rethrows);
`app/api/code/grade/route.ts` test cache is per-instance (P1: non-deterministic grading
across instances — fix by persisting generated tests keyed by question hash).

**2. Never score from the Live session's memory.**
Already enforced: the Live session is conversation-only; every turn persists (session store +
client transcript); scoring is ONE separate Gemini text call over the full stored transcript
(`/api/generate-fit-score`), headline numbers recomputed deterministically in server code.
Every score writes a `scoringAudits` doc: transcripts, per-question × component evidence
matrix, resume inputs + row evidence, raw-LLM vs computed headlines + drift, prompt version
(`SCORING_PROMPT_VERSION` in lib/scoring-audit.ts — bump on any rubric/prompt change).
Scoring rules are evidence-or-exclude: absent data → row -1 (excluded), never a mid-band
placeholder; penalties require positive evidence (see rules 7ter–10 in the fit-score prompt).

**3. Live-session lifetime is the #1 fragility.**
Interviews run adaptive 10–15 min (LIVE_MIN/MAX_MINUTES in the interview page) and CROSS the
~10-min Gemini Live socket cap every session. The client already enables
`contextWindowCompression` + `sessionResumption` and reconnects on GoAway/close with the
stored handle. If interviews still freeze at ~10 min in the field, the fix is a server-side
WS proxy (separate Cloud Run service) — do not band-aid the client further.

**4. Model pinning.** `GEMINI_LIVE_MODEL` and `GEMINI_TEXT_MODEL` are pinned via
apphosting.yaml env. KNOWN VIOLATION: the fit-score route's LAST fallback is
`gemini-flash-latest` (deliberate: a live-alias safety net after `gemini-2.0-flash` was
retired and 404'd in prod). If you touch the fallback chain, keep at least one non-alias
pinned fallback ahead of it.

**5. The Live API key is exposed to signed-in browsers** (`LIVE_INTERVIEW_ENABLED=true`
pilot trade-off, rate-limited). Acceptable for the pilot only; the WS proxy removes it.

---

## Verify a change (run these, don't guess)

```bash
npx tsc --noEmit && pnpm build          # every change
k6 run loadtest/platform.test.js        # anything touching routes/auth/rate limits
k6 run loadtest/gemini-gate.test.js     # anything touching Gemini-backed routes (asserts anon rejection, no paid calls)
```

After deploy (push to main → App Hosting auto-builds):
- watch `gcloud run revisions list --service=taledge-be --region=us-central1 --project=int-taledge`
- check 5xx: Cloud Logging `httpRequest.status>=500`
- scoring changes: pull the newest `scoringAudits` doc and read `drift` + row evidence.

## Working style
- One scoped change at a time; do not refactor adjacent code unasked.
- Commits: never add Co-Authored-By/Claude footers.
- Funnel is technical interview → DNLA questionnaire → behavioural interview ("final" is an
  alias of behavioural everywhere — never resurrect a separate final round).
- DNLA provider integration is HELD (their tan/create 500s); don't enable DNLA_API_KEY
  until it returns 200/403 and the key is rotated.
