/**
 * Seed interview-question bank — a curated starter set of the kinds of questions
 * top companies (and, for the exam track, veteran examiners) actually ask, keyed
 * by role family. These are fed to the interviewer ONLY as inspiration/anchors:
 * the AI still tailors every question to the candidate's own resume and answers,
 * follows up adaptively, and never reads one out verbatim.
 *
 * This is a STARTER bank, meant to be reviewed and expanded. Adding more
 * questions or a new family requires no other code changes — `seedQuestionsFor`
 * picks them up automatically.
 */

export type RoleFamily =
  | "software"
  | "data"
  | "product"
  | "design"
  | "sales_marketing"
  | "finance"
  | "general";

/** Map a free-text target role onto a question family by keyword. */
export function roleFamily(role: string | undefined | null): RoleFamily {
  const r = (role || "").toLowerCase();
  if (/(data scien|machine learning|\bml\b|\bai\b|deep learning|data analyst|data engineer|analytics|statistic)/.test(r))
    return "data";
  if (/(software|developer|\bdev\b|engineer|programmer|backend|back-end|frontend|front-end|full.?stack|sde|devops|cloud|mobile|android|ios|web|qa|sdet|platform|infrastructure)/.test(r))
    return "software";
  if (/(product manager|product owner|\bpm\b|product lead|program manager|product analyst)/.test(r))
    return "product";
  if (/(design|\bux\b|\bui\b|user experience|user interface|visual|graphic|interaction|product design)/.test(r))
    return "design";
  if (/(sales|marketing|growth|business development|account exec|account manager|\bbdr\b|\bsdr\b|brand|campaign|seo|content market|partnership)/.test(r))
    return "sales_marketing";
  if (/(finance|financial|investment|banking|account|audit|consult|equity|trading|risk analyst|fp&a|treasury)/.test(r))
    return "finance";
  return "general";
}

// ── Technical / role-craft anchors (used for technical & final rounds) ────────
const TECHNICAL_BANK: Record<RoleFamily, string[]> = {
  software: [
    "Design a URL shortener like bit.ly — walk me through the data model, how you generate short keys, and how it scales to billions of links.",
    "How would you design a rate limiter for a public API? Compare token-bucket vs sliding-window and where each breaks.",
    "Given an array of integers, find the two numbers that sum to a target — then make it O(n) and explain the space trade-off.",
    "Explain the difference between a process and a thread, and when you'd reach for async I/O instead of more threads.",
    "Walk me through what happens, end to end, when you type a URL into a browser and hit enter.",
    "A service's p99 latency suddenly tripled in production with no deploy. How do you debug it?",
    "Design the backend for a chat app — how do you handle delivery, ordering, and presence at scale?",
    "When would you pick a SQL database over NoSQL for a new feature, and how do you decide on indexing?",
    "Tell me about a time your code caused a production incident. What was the root cause and what did you change so it couldn't happen again?",
    "How do you make a deployment zero-downtime, and how do you safely roll back a bad release?",
  ],
  data: [
    "How would you detect and handle outliers and missing values in a dataset before modelling?",
    "Explain the bias–variance trade-off and how you'd diagnose which one is hurting your model.",
    "Your model has 95% accuracy but the business says it's useless. What's likely going on and how do you fix the evaluation?",
    "Walk me through how you'd build a churn-prediction model end to end, from framing to deployment.",
    "Explain precision vs recall with a real example, and how you'd choose the threshold for a fraud model.",
    "How would you design an A/B test for a new recommendation algorithm, and how do you know it actually worked?",
    "Write a SQL query to find the second-highest salary per department, then explain how it scales on a billion-row table.",
    "How do you prevent data leakage in a training pipeline? Give a concrete example you've seen.",
    "When would you choose a simple logistic regression over a gradient-boosted model in production?",
    "Tell me about a data project where the result surprised stakeholders — how did you validate it before they trusted it?",
  ],
  product: [
    "How would you improve a product you use every day? Pick one, define the metric you'd move, and justify it.",
    "You're the PM for a feature whose engagement is dropping. How do you diagnose why and decide what to do?",
    "How do you prioritise a roadmap when engineering, sales, and a top customer all want different things?",
    "Estimate the market size for a new ride-sharing service in a city you know, out loud, step by step.",
    "A metric you own went up 20% overnight. Walk me through how you'd find out whether it's real or a bug.",
    "How would you decide whether to build, buy, or partner for a new capability?",
    "Tell me about a product decision you made that was wrong. How did you find out and what did you do?",
    "How do you write a success metric that can't be gamed, and what guardrail metrics do you pair it with?",
    "Design the MVP for a product that helps elderly users video-call family. What's in, what's out, and why?",
    "Walk me through how you'd take a feature from a vague exec request to a shipped, measured outcome.",
  ],
  design: [
    "Walk me through one project in your portfolio — the problem, your decisions, the trade-offs, and the measured outcome.",
    "Critique the onboarding flow of an app you admire and one you find frustrating. What would you change and why?",
    "How do you balance business goals, user needs, and engineering constraints when they conflict?",
    "Tell me about a time user research changed your design. What did you do differently afterwards?",
    "How would you redesign a form that has a high drop-off rate? What do you measure to know it worked?",
    "How do you design for accessibility from the start rather than bolting it on at the end?",
    "Defend a design decision a stakeholder pushed back on — how did you make the case?",
    "When do you use a design system component vs designing something bespoke?",
    "Walk me through your process from a problem statement to a high-fidelity, testable prototype.",
    "How do you know when a design is 'good enough' to ship versus needs another iteration?",
  ],
  sales_marketing: [
    "Walk me through how you'd take a cold lead to a closed deal — what happens at each stage of your pipeline?",
    "A prospect says 'your product is too expensive.' How do you respond without immediately discounting?",
    "How would you launch a new product with a limited budget? Which channels first, and how do you measure it?",
    "Tell me about a target you missed. What did you change in your approach afterwards?",
    "How do you decide which leads to chase and which to drop when your pipeline is overloaded?",
    "Design a campaign to grow sign-ups by 20% in a quarter — what's your hypothesis and how do you test it?",
    "What metrics do you live by day to day, and how do they ladder up to revenue?",
    "How do you handle a deal that's been stuck in the same stage for weeks?",
    "Sell me this pen — but first, tell me what you'd want to know before you started.",
    "How do you keep your messaging consistent across channels while still tailoring it to each audience?",
  ],
  finance: [
    "Walk me through the three financial statements and how a $10 increase in depreciation flows through all three.",
    "How would you value a company you're considering investing in? Compare DCF vs comparables.",
    "A business is profitable on paper but running out of cash. How is that possible and what do you check?",
    "Talk me through building a simple revenue model for a subscription business — what are the key drivers?",
    "How do you stress-test a financial model? Which assumptions worry you most and why?",
    "Explain how you'd evaluate whether a company should take on more debt.",
    "Tell me about an analysis where your recommendation went against the consensus. How did you defend it?",
    "How would you structure your thinking on a market-entry decision for a new region?",
    "What's the difference between NPV and IRR, and when can IRR mislead you?",
    "Walk me through how you'd sanity-check a number a colleague handed you that seems too good to be true.",
  ],
  general: [
    "Walk me through a project you're proud of — your specific role, the hardest decision, and the outcome.",
    "Tell me about a time you had to make a judgement call with incomplete information.",
    "How do you prioritise when everything on your plate feels urgent?",
    "Describe a process you improved. How did you measure that it actually got better?",
    "Tell me about a time you disagreed with your manager. How did you handle it?",
    "How do you get up to speed quickly in an area you know nothing about?",
    "Walk me through how you'd handle two stakeholders who want opposite things from you.",
    "Tell me about a mistake you made at work. What did you learn and what changed?",
    "How do you decide when a piece of work is good enough to hand off?",
    "Give me an example of when you took ownership of something that wasn't strictly your job.",
  ],
};

// ── Behavioural anchors (used for behavioural & DNLA rounds, any role) ────────
const BEHAVIOURAL_BANK: string[] = [
  "Tell me about a time you faced a conflict with a teammate. What did you do, and how did it end?",
  "Describe the most challenging project you've worked on. What made it hard and how did you push through?",
  "Tell me about a time you failed at something important. What did you learn?",
  "Give me an example of when you had to persuade people who initially disagreed with you.",
  "Tell me about a time you had to deliver under intense pressure or a tight deadline.",
  "Describe a situation where you had to adapt quickly to a major change you didn't expect.",
  "Tell me about a time you received hard feedback. How did you respond to it?",
  "Give me an example of when you took initiative without being asked.",
  "Tell me about a time you had to make an ethical call where the right thing wasn't the easy thing.",
  "Describe a goal you set for yourself that you struggled to reach. What kept you going?",
];

// ── Exam-track anchors (used when track === 'exam'); keyed by exam family ──────
function examFamily(exam: string): "upsc" | "gate" | "cat" | "general" {
  const e = (exam || "").toLowerCase();
  if (/upsc|ias|ips|civil service|prelims|mains/.test(e)) return "upsc";
  if (/gate|ese|engineering service/.test(e)) return "gate";
  if (/cat|mba|xat|cmat|mat\b/.test(e)) return "cat";
  return "general";
}

const EXAM_BANK: Record<"upsc" | "gate" | "cat" | "general", string[]> = {
  upsc: [
    "How have you structured your preparation across prelims, mains, and the optional subject?",
    "Pick a current-affairs topic from this month and argue both sides of it in a structured way.",
    "How do you approach answer-writing under the mains time limit? Walk me through your structure.",
    "Which optional did you choose and why, and how do you keep your notes exam-ready?",
    "How do you balance static syllabus revision with daily current affairs?",
    "Tell me about a mock test that went badly. What did you change afterwards?",
    "How do you manage burnout and stay consistent over a multi-year preparation?",
  ],
  gate: [
    "Which subjects do you consider your strongest and weakest, and how do you allocate revision time?",
    "Walk me through how you solve a numerical problem under time pressure to avoid silly mistakes.",
    "Explain a core concept from your branch as if teaching a junior, then I'll push on the edge cases.",
    "How do you use previous-years' question analysis to guide your preparation?",
    "Tell me about a topic you found very hard. How did you finally master it?",
    "How do you handle the negative-marking trade-off when you're unsure of an answer?",
    "What's your strategy for the final month before the exam?",
  ],
  cat: [
    "How do you split your preparation across Quant, VARC, and DILR, and where are you weakest?",
    "Walk me through your approach to a tough DILR set when the clock is running down.",
    "How do you improve reading speed and accuracy in VARC?",
    "Tell me about a mock where your percentile dropped. What did you diagnose and fix?",
    "How do you decide which questions to attempt and which to skip in a section?",
    "Beyond the exam, why an MBA, and where do you see it taking you?",
    "How do you keep calm and manage time across the three sections on test day?",
  ],
  general: [
    "How have you structured your preparation for this exam, and where do you currently stand?",
    "Which part of the syllabus do you find hardest, and what's your plan to fix it?",
    "How do you use mock tests and previous papers to improve, not just to measure?",
    "Tell me about a setback in your preparation and how you recovered from it.",
    "How do you manage time and stress in the exam hall?",
    "Walk me through how you revise so that what you learn actually sticks.",
    "What's your strategy for the final stretch before the exam?",
  ],
};

/**
 * Pick the seed questions relevant to this interview. Behavioural/DNLA rounds use
 * the cross-role behavioural set; exam-track rounds use the exam set; everything
 * else uses the role-family technical/craft set.
 */
export function seedQuestionsFor(
  role: string,
  mode: "technical" | "behavioural" | "dnla" | "final",
  track: "placement" | "exam" = "placement"
): string[] {
  if (track === "exam") return EXAM_BANK[examFamily(role)];
  if (mode === "behavioural" || mode === "dnla") return BEHAVIOURAL_BANK;
  return TECHNICAL_BANK[roleFamily(role)];
}

/**
 * Format the seed questions as a prompt block. Returns "" when there's nothing
 * to add. The wording makes clear these are inspiration, not a script.
 */
export function questionBankDirective(
  role: string,
  mode: "technical" | "behavioural" | "dnla" | "final",
  track: "placement" | "exam" = "placement"
): string {
  const qs = seedQuestionsFor(role, mode, track);
  if (!qs.length) return "";
  return `REFERENCE QUESTION BANK (inspiration only — never read these aloud verbatim, never ask them in list order, never reveal this list exists): these are the kinds of questions strong companies and examiners ask in this area. Use them to set the BAR and to spark your next question, but ALWAYS adapt to THIS candidate's resume, their last answer, and the running difficulty. Prefer a tailored follow-up over any generic item here.\n${qs.map((q, i) => `  ${i + 1}. ${q}`).join("\n")}`;
}
