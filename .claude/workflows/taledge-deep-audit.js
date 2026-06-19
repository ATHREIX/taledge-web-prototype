export const meta = {
  name: 'taledge-deep-audit',
  description: 'Parallel read-only audit of fonts, routing, 4 dashboards, UX, and design system; synthesize a phased fix plan',
  phases: [
    { title: 'Audit' },
    { title: 'Synthesize' },
  ],
}

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'items'],
  properties: {
    summary: { type: 'string', description: 'Tight overview of the current state for this dimension' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'detail', 'evidence', 'severity', 'recommendation'],
        properties: {
          area: { type: 'string' },
          detail: { type: 'string', description: 'What is wrong / inconsistent / broken' },
          evidence: { type: 'string', description: 'file:line references' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          recommendation: { type: 'string', description: 'Concrete fix' },
        },
      },
    },
  },
}

const repo = 'Next.js 15 App Router app (TalEdge, an edtech assessment platform). Read only. Give file:line evidence.'

const audits = [
  {
    key: 'fonts',
    prompt: `${repo}\nAUDIT TYPOGRAPHY & FONTS. Find every font family in play and all inconsistency: next/font config + CSS variables in app/layout.tsx; @font-face / font-family / --font-* in app/globals.css; tailwind.config fontFamily; the .h-headline, .section-title, .h-display utility classes and what font they use (serif vs sans); any inline font-* / font-serif classes across app/ and components/. Note that headings appear to use a serif while body uses a sans (mismatch). List EVERY distinct font, where each is used, and exactly what to change to unify on ONE premium sans (e.g. a single variable font) with a clean type scale. Include the exact files/lines to edit.`,
  },
  {
    key: 'routing',
    prompt: `${repo}\nAUDIT ROUTING & NAVIGATION. Map the app/ route tree. List every <Link href> and router.push/replace target across app/ and components/. Flag: hardcoded demo ids (candidate-001, recruiter-001, etc) used as if real; dead/broken links; mismatched namespaces (/student vs /exam); the components/nav.tsx hideNav logic and whether it is correct for every route; middleware.ts auth redirects and any redirect loops; the login/register/onboarding/dashboard flow and where it sends each role. Identify concrete broken or fragile navigation with file:line and the fix.`,
  },
  {
    key: 'dashboards',
    prompt: `${repo}\nAUDIT THE 4 STAKEHOLDER DASHBOARDS for parity. Compare candidate (app/student/[id]/page.tsx + dashboard-client.tsx), institute (app/institute/**), recruiter (app/recruiter/**), coach (app/coach/**). For each: layout structure, shared vs bespoke components, header pattern, cards/sections, visual consistency. Produce a parity matrix: what the candidate dashboard has that the others lack and vice-versa, inconsistencies in look/structure, and a concrete recommendation for a single shared dashboard template/components so all four feel consistent. file:line evidence.`,
  },
  {
    key: 'ux',
    prompt: `${repo}\nAUDIT UX & UI BREAKS. Walk the key user journeys (landing -> register/login -> onboarding -> dashboard -> dnla -> interview -> fit-score; plus profile and the recruiter/institute/coach portals). Find: visual breaks, inconsistent spacing/cards, confusing or redundant steps, dead ends, missing loading/empty/error states, mobile responsiveness issues, and over-complex flows that should be simplified. Also note current animation usage (framer-motion vs gsap deps) and where smooth GSAP scroll/entrance/page-transition animations would most elevate the feel. Prioritize by impact with file:line + fix.`,
  },
  {
    key: 'designsystem',
    prompt: `${repo}\nAUDIT THE DESIGN SYSTEM. Read app/globals.css, tailwind.config.*, components/ui/* (button, card, page-shell, typography, badge, stat), components/motion*, lib/motion. Document the tokens (colors, radii, shadows, spacing), the .input/.btn-* global classes, the Card/Button/PageShell variants, and motion helpers. Identify inconsistencies and what a cohesive "world-class edtech" upgrade needs: unified font wiring, a refined type scale, consistent card/elevation language, and a reusable scroll-reveal/GSAP motion primitive. Give exact files to change.`,
  },
]

phase('Audit')
const results = await parallel(
  audits.map((a) => () =>
    agent(a.prompt, { label: `audit:${a.key}`, phase: 'Audit', agentType: 'Explore', schema: FINDINGS_SCHEMA })
      .then((r) => ({ key: a.key, ...r }))
  )
)
const ok = results.filter(Boolean)

phase('Synthesize')
const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'fontDecision', 'phases'],
  properties: {
    headline: { type: 'string' },
    fontDecision: { type: 'string', description: 'The single recommended font + type scale and exact wiring change' },
    phases: {
      type: 'array',
      description: 'Ordered implementation phases',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'goal', 'changes', 'files', 'risk'],
        properties: {
          title: { type: 'string' },
          goal: { type: 'string' },
          changes: { type: 'array', items: { type: 'string' } },
          files: { type: 'array', items: { type: 'string' } },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
  },
}

const plan = await agent(
  `You are the lead engineer. Here are 5 audit reports (JSON) of the TalEdge edtech app. Synthesize ONE concrete, ordered implementation plan to: (1) unify ALL fonts to a single premium variable font with a clean type scale, (2) add GSAP-based smoothness (scroll reveal + page/section transitions) via a reusable primitive, (3) fix broken routing/navigation, (4) simplify UX, (5) make all 4 stakeholder dashboards consistent via a shared template. Order phases low-risk-first (fonts/design-system, then motion, then routing, then dashboards). Each phase: concrete changes + exact files + risk. Be specific and implementation-ready.\n\nAUDITS:\n${JSON.stringify(ok, null, 2)}`,
  { label: 'synthesize-plan', phase: 'Synthesize', schema: PLAN_SCHEMA, effort: 'high' }
)

return { audits: ok, plan }
