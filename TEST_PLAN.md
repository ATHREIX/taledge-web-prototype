# Taledge — Manual Test Plan

Production: **https://taledge-web-prototype-pfiv.vercel.app**
Branch: `Fix-Screen-UI/UX` · Last verified commit: `be23345`
Mode: production runs **enforced auth** (`AUTH_ENFORCED=true`) — anonymous users are redirected to login; invited candidates use their invite-link token as their credential.

---

## How to read this file

Each test has a **Verification** tag:

| Tag | Meaning |
|-----|---------|
| ✅ AUTO | I verified this without a browser — build, typecheck, route status, or a code trace. Detail in the row. |
| 🟡 MANUAL | Needs a human in a browser (a real login, a real AI interview, clicking through). Steps + expected result given so you can confirm. |

What I verified automatically this round:
- `tsc --noEmit` = 0 errors, `pnpm build` = success (33 routes).
- Auth gates on production: anonymous POST to `interview/start` and `generate-fit-score` → **401**; bogus `X-Invite-Token` → **401** (invalid invites rejected, no security hole).
- Route health on production: `/` → 200; `/onboarding`, `/dashboard`, `/recruiter/*`, `/institute/*`, `/student/*`, `/student/*/fit-score?view=recruiter|institute` → 307 (login redirect, expected) — **no 500s / no crashes**.

What I **cannot** verify without you: anything behind a real login (recruiter/institute/candidate dashboards) and any **live AI interview** (needs a real browser session + mic/cam + Gemini). Those are 🟡 MANUAL.

> ⚠️ Cost note: taking a real interview and generating a Fit Score **does call Gemini** (this is the intended product behavior, one generation per completed assessment — not an audit). Each full run-through costs a small amount of Gemini usage.

---

## A. Invited candidate — end-to-end (THE critical flow that was broken)

> Root bug fixed: invited candidates are account-less by design, but every interview + scoring route required a Firebase login and returned 401. So in production the interview couldn't start/run/score and nothing saved. Now the invite token authenticates these routes.

### A1 — Recruiter invite: full assessment persists  🟡 MANUAL
**Pre:** A recruiter posts a job and sends an off-campus invite (Recruiter console → "Upload candidates" → generates an invite link).
1. Open the invite link `/onboarding?invite=<token>` in a **fresh/incognito** browser (no login).
2. Complete onboarding (name/email prefilled from invite; role auto-selected — see C1).
3. Take the AI interview through to the end (technical + behavioural).
4. Reach the Fit Score report; let it generate.
**Expected:**
- Interview **starts and runs** (no "authentication required" error). *(Was 401 before.)*
- Fit Score report generates and shows real scores.
- No console 401s on `interview/start`, `interview/voice`, `interview/results`, `generate-fit-score`.

### A2 — Recruiter sees the invited candidate's result  🟡 MANUAL
**Pre:** A1 completed.
1. Log in as that recruiter → Recruiter console.
2. Find the candidate in the pool (search by name).
**Expected:**
- Candidate appears with **Fit / Technical / Behavioural / Success** populated.
- The invite shows status **completed** (Upload-candidates modal lists invited→started→completed).

### A3 — University (institute) invite: cohort student persists & appears  🟡 MANUAL
**Pre:** Institute dashboard → "Add students" creates cohort invite links (with a cohort name).
1. Open a cohort invite link in incognito; complete onboarding + interview + report (as A1).
2. Log in as the institute admin → institute dashboard.
**Expected:**
- The student appears in the **cohort list / placement analytics**, tagged with the cohort you named.
- Their Fit/scores show; cohort size reflects them.
- *(Server binds `instituteId`+`cohort` from the invite token at report generation — `generate-fit-score` line ~582.)*

### A4 — Invalid/expired invite is rejected  ✅ AUTO
Bogus `X-Invite-Token` → **401** on production (verified). An unreadable token in onboarding falls back to manual entry (no hard crash).

---

## B. Recruiter — "View" opens a read-only report (not the demo dashboard)

> Bug fixed: recruiter "View" opened the candidate's **self-service dashboard** with "Continue assessment" / "Technical interview" / coaching "Book" buttons. It now opens a read-only Fit Score report.

### B1 — Table "View" → read-only report  🟡 MANUAL
1. Recruiter console → candidate table → click **View** on any candidate.
**Expected:** URL is `/student/<id>/fit-score?view=recruiter`. The page shows the **Fit Score report only** — **no** "Continue assessment", "Technical interview", "Publish", "Reattempt", "Generate", "Development Pathway" buttons. Header reads "Candidate Fit Score Report"; back button says "Back to pipeline".

### B2 — Candidate with scores but no detailed report shows headline numbers  🟡 MANUAL
1. View a seed/demo candidate that shows Fit/Tech/Behav in the table/drawer (e.g. Varun Bose).
**Expected:** report shows those **real headline numbers** (Fit/Technical/Behavioural/Success), with a banner "Headline Fit Score summary · detailed report pending". **Not** a misleading "no report yet". *(No Gemini call — reads stored scores only.)*

### B3 — Recruiter view never triggers Gemini  ✅ AUTO (code trace)
In `?view=recruiter|institute` the page only GETs the stored report/summary and never calls the generator. Confirmed in `app/student/[id]/fit-score/page.tsx` (recruiter branch returns before any `generate()`).

### B4 — Quick-view drawer labels not clipped  🟡 MANUAL
1. Recruiter table → click the eye icon (quick view).
**Expected:** "TECHNICAL" and "BEHAVIOURAL" labels render in full (not "TECHNICA"/"BEHAVIOU") and don't overlap the score bars.

### B5 — Genuinely empty candidate  🟡 MANUAL
View a candidate with no scores at all → "This candidate hasn't completed a Fit Score report yet" (no self-action buttons).

---

## C. Onboarding — role auto-selected from the invite

### C1 — Invite role auto-selected  🟡 MANUAL
1. Open a recruiter/institute invite link → go to the role ("Which role are you targeting?") step.
**Expected:** the recruiter's posting role is **pre-selected** (highlighted with a check). If it's a custom title it appears as its own selected card.

### C2 — Resume upload does NOT overwrite the invite role  🟡 MANUAL
1. On an invite, upload a **resume** on the Profile step whose content implies a different role.
2. Continue to the role step.
**Expected:** the **recruiter's role stays selected** (resume-inferred role does not override it). *(Guarded with `!inviteCtx` in `app/onboarding/page.tsx`.)*

### C3 — Without an invite, parsed role still applies  🟡 MANUAL
Normal (non-invite) onboarding + resume/JD upload → role is set from the parsed `target_role` as before.

---

## D. Institute / University — drill-down

### D1 — "Drill down" → read-only student report  🟡 MANUAL
1. Institute dashboard → cohort list → **Drill down →** on a student.
**Expected:** opens `/student/<id>/fit-score?view=institute` — read-only report, header "Student Fit Score Report", breadcrumb "Institute › Student report", back button "Back to cohort". **No** candidate self-actions, **no** demo self-service dashboard. *(Was `/student/<id>` before.)*

### D2 — Institute admin can read their cohort's report  ✅ AUTO (code trace)
`generate-fit-score` GET now allows a non-demo institute admin to read a report for a student in an institute they administer (`isInstituteAdmin`). Cohort students invited via link are `candidate-inv-*` (already readable).

---

## E. Stability / UX regressions (from the earlier audit)

### E1 — `/student/candidate-030` does not crash  ✅ AUTO
Production `/student/candidate-030` → **307** (login redirect), **no 500**. The Firestore-Timestamp crash (`toPlain()` normalizer in `lib/talent-store.ts`) is fixed.

### E2 — "Go home" goes to the dashboard, not the public landing  🟡 MANUAL
Trigger an error page → click **Go home** → lands on `/dashboard` (logged-in home), not `/` (public landing that looks logged-out).

### E3 — No route 500s while anonymous  ✅ AUTO
All sampled routes return 200/307, none 500 (verified on production).

---

## F. AI interview (the engine)

### F1 — Interview starts for a logged-in candidate  🟡 MANUAL
Log in as a candidate → start the technical interview → AI asks role-grounded questions, listens, follows up.

### F2 — Interview starts for an INVITED candidate  🟡 MANUAL
(Covered by A1.) The fix in this round is specifically what makes F2 possible in production.

### F3 — Proctoring / face-verify gate  🟡 MANUAL
In enforced mode the voice round requires face verification first (`verify-face`). Confirm the proctor step runs (it now authenticates for invited candidates too).

### F4 — Results scored & report generated  🟡 MANUAL
After both rounds, the Fit Score report generates with technical/behavioural/fit/success + breakdowns.

---

## G. What to watch in the browser console (quick triage)

| Symptom | Likely cause | Where |
|---|---|---|
| "Authentication required" / 401 during an invited interview | invite token not attached | `lib/api-client.ts` `readInviteToken`, onboarding stored `taledge:workspace-profile.inviteToken` |
| Invited scores not on recruiter/institute dashboard | report never generated, or binding missing | `generate-fit-score` POST + `updateInviteStatus` |
| Recruiter "View" shows assessment buttons | stale deploy / wrong link | recruiter row link should be `…/fit-score?view=recruiter` |
| Report says "no report yet" but table shows scores | summary fallback not loaded | `generate-fit-score` GET `summary`, fit-score recruiter branch |

---

## Open item (not yet implemented — design decision needed)

**Invited candidate's global "Home" still shows "give interview".** An invited guest has no account, so `/dashboard` resolves to the demo id `candidate-001` rather than their `candidate-inv-*` workspace. Their **own workspace** and the **recruiter/institute dashboards** now show completion, but the generic Home can't, without making their browser session "stick" to their invite workspace. Decide desired behavior before implementing (should a one-time guest have a persistent home; what happens if they clear storage).
