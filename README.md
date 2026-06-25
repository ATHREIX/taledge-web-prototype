# Taledge

Talent Intelligence & Success Platform prototype. A dual-track web app that fuses DNLA psychometrics, AI-driven interview evaluation, and human coaching into a closed-loop assessment journey for candidates, institutes, recruiters, and coaches.

## Stack

- Next.js 15 (App Router) + React 19
- Tailwind CSS 3
- Google Gemini API
  - `gemini-2.5-flash` for resume parsing, interview turns, and Fit Score synthesis
  - `gemini-3.1-flash-live-preview` for Gemini Live token provisioning
- pnpm

## Local development

```bash
pnpm install
cp .env.example .env.local   # then set GEMINI_API_KEY
PORT=4040 pnpm dev
```

Open http://localhost:4040.

## Environment

Create a `.env.local` file in the project root (copy from below or create manually):

```bash
# Required: Gemini API key for all AI features
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
```

### Getting Your Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **"Create API Key"**
3. Copy the key (starts with `AIza...`)
4. Paste it in your `.env.local` file as shown above

**Note:** This repo is Gemini-only. It does not require third-party LLM router or non-Google provider packages.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Required for resume parsing, interview questions, Fit Score synthesis, and Gemini Live token provisioning. Without it, AI endpoints return `503` instead of fake results. |
| `GEMINI_TEXT_MODEL` | Text/multimodal Gemini model. Defaults to `gemini-2.5-flash`. |
| `GEMINI_LIVE_MODEL` | Live API model. Defaults to `gemini-3.1-flash-live-preview`. |

## Voice Interview Pipeline

The Phase 1 interview uses a text fallback and browser speech input while Gemini Live credentials are being provisioned. `/api/gemini/live-token` mints short-lived tokens for the Live API once `GEMINI_API_KEY` is present.

### Flow
1. Start session → `POST /api/interview/start`
2. Send text answer → `POST /api/interview/voice`
3. Receive the next question
4. Repeat until `isDone: true`
5. Get final results → `POST /api/interview/results`

### Audio Format
- Browser speech recognition can fill the text answer field.
- Server audio upload is intentionally disabled; use Gemini Live with ephemeral tokens for production audio sessions.

## API

All `/api/interview/*` routes require `studentId`, `role`, and `mode`.

- `POST /api/interview` — multi-turn interview question generation (text-based, existing)
- `POST /api/interview/start` — start a voice session, returns `sessionId`
- `POST /api/interview/voice` — receive a text answer and return the next question
- `POST /api/gemini/live-token` — mint a Gemini Live ephemeral token
- `GET /api/interview/status?sessionId=...` — get current session state
- `POST /api/interview/results` — get final scores (only after `isDone: true`)
- `POST /api/parse-resume` — PDF resume parsing
- `POST /api/generate-dnla` — disabled until DNLA provider import is connected
- `POST /api/generate-fit-score` — Final Fit Score report synthesis

Candidate flow (no top nav, focused experience):

- `/onboarding` — Step 01 Profile + Goal + Context (PDF resume parsed by Gemini 2.5 Flash)
- `/student/[id]` — Candidate workspace
- `/student/[id]/interview/technical` — Step 02 AI Technical Interview (Gemini 2.5 Flash)
- `/student/[id]/dnla` — Step 03 DNLA import placeholder
- `/student/[id]/interview/behavioural` — Step 04 AI Behavioural Interview (Gemini 2.5 Flash)
- `/student/[id]/fit-score` — Step 05 Fit Score Reveal (Gemini-generated, PRD §9 rubric)
- `/student/[id]/development` — Step 06 Development Pathway

Marketing and B2B surfaces (with top nav):

- `/` — Landing (ClaimKeys-style sign-in split layout)
- `/exam/[id]` — Competitive Exam aspirant
- `/institute/[id]` — Placement / Exam institute dashboard
- `/recruiter/[id]` — Recruiter console with filtering
- `/coach/[id]` — Coach workspace
- `/coach-ai` — hidden Phase 2 route with unavailable screen

API:

- `POST /api/interview` — multi-turn interview question generation
- `POST /api/parse-resume` — PDF resume parsing
- `POST /api/generate-dnla` — disabled until DNLA provider import is connected
- `POST /api/generate-fit-score` — Final Fit Score report synthesis

## Smoke Test — Voice Pipeline

### 1. Start session
```bash
curl -X POST http://localhost:3000/api/interview/start \
  -H "Content-Type: application/json" \
  -d '{"studentId":"priya","role":"Full-stack Software Engineer","mode":"technical"}'
# → Returns: { "ok": true, "sessionId": "session_...", "mode": "technical" }
```

### 2. Send first text answer
```bash
curl -X POST http://localhost:3000/api/interview/voice \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<session_id>","text":"I built a full-stack app using React and Node.js"}'
# → Returns: { "ok": true, "nextQuestion": "...", "isDone": false }
```

### 3. Mint a Gemini Live token
```bash
curl -X POST http://localhost:3000/api/gemini/live-token
# → Returns 503 without GEMINI_API_KEY, or a short-lived token when configured
```

### 4. Check session state
```bash
curl "http://localhost:3000/api/interview/status?sessionId=<session_id>"
# → Returns: { "ok": true, "turnIndex": 1, "transcript": [...], ... }
```

### 5. End interview & get results
Send enough responses until `isDone: true`, then:
```bash
curl -X POST http://localhost:3000/api/interview/results \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<session_id>"}'
# → Returns: { "ok": true, "generated": { "technical_score": 72, "fit_score": 70, ... } }
```

`lib/data.ts` currently provides anonymized local workspace shells only. Production persistence, auth, and organization-specific records should be connected before real users are onboarded.

## Scripts

```bash
pnpm dev      # next dev
pnpm build    # next build
pnpm start    # next start
```
