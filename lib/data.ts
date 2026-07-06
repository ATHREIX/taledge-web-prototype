export type Persona =
  | { kind: "student"; id: string }
  | { kind: "exam"; id: string }
  | { kind: "institute"; id: string }
  | { kind: "recruiter"; id: string }
  | { kind: "coach"; id: string }
  | { kind: "counsellor"; id: string };

export type DnlaScore = {
  competency: string;
  group:
    | "Achievement Dynamics"
    | "Interpersonal Skills"
    | "Execution"
    | "Stress & Resilience";
  score: number; // 1-7
  benchmark: number; // top performer benchmark
  insight: string;
};

// Representative DNLA psychometric profile used as the PILOT SAMPLE wherever a
// candidate has no real DNLA scores yet (the licensed provider import is not
// activated — see NEXT_PUBLIC_DNLA_ENABLED / dnla-integration). Shown identically
// on the workspace dashboard and the /dnla page so the "Sample DNLA data" badge is
// never contradicted by an empty panel.
export const SAMPLE_DNLA: DnlaScore[] = [
  { competency: "Drive for Results", group: "Achievement Dynamics", score: 6, benchmark: 6, insight: "Pushes tasks to completion under deadlines." },
  { competency: "Initiative", group: "Achievement Dynamics", score: 5, benchmark: 6, insight: "Takes ownership; waits for clarity before acting on ambiguity." },
  { competency: "Collaboration", group: "Interpersonal Skills", score: 5, benchmark: 6, insight: "Works well one-on-one; quieter in larger groups." },
  { competency: "Feedback Reception", group: "Interpersonal Skills", score: 4, benchmark: 6, insight: "Can become defensive when challenged under pressure." },
  { competency: "Problem Solving", group: "Execution", score: 6, benchmark: 6, insight: "Strong analytical breakdown of problems." },
  { competency: "Attention to Detail", group: "Execution", score: 6, benchmark: 5, insight: "Catches edge cases others miss." },
  { competency: "Composure", group: "Stress & Resilience", score: 5, benchmark: 6, insight: "Stays calm in technical rounds." },
  { competency: "Adaptability", group: "Stress & Resilience", score: 4, benchmark: 6, insight: "Prefers familiar tooling; ramps slower on new stacks." },
];

export type Student = {
  id: string;
  name: string;
  avatar: string;
  branch: string;
  /** Department (institute filtering). Defaults to branch when absent. */
  dept?: string;
  /** Semester of study, 1-8 (institute filtering). */
  semester?: number;
  year: string;
  college: string;
  cgpa: number;
  targetRole: string;
  resumeSummary: string;
  projects: { title: string; stack: string[]; impact: string }[];
  skills: string[];
  fit: {
    technical: number;
    behavioural: number;
    fit: number;
    successProbability: number;
  };
  dnla: DnlaScore[];
  strengths: string[];
  developmentAreas: string[];
  risks: string[];
  status: "Not started" | "In progress" | "Interview-ready" | "Published";
};

export type ExamAspirant = {
  id: string;
  name: string;
  avatar: string;
  exam: string;
  attempt: string;
  monthsPreparing: number;
  successPotential: number;
  motivation: number;
  consistency: number;
  resilience: number;
  stressIndex: number;
  risks: {
    label: string;
    severity: "low" | "medium" | "high";
    detected: string;
  }[];
  consistencyTrend: number[]; // 0-100 weekly
  moodTrend: number[]; // 0-100 weekly
  studyHoursTrend: number[];
  institute: string;
};

export const students: Student[] = [
  {
    id: "candidate-001",
    name: "Aarav Mehta",
    avatar: "AM",
    branch: "Computer Science",
    year: "Final Year",
    college: "IIT Bombay",
    cgpa: 8.6,
    targetRole: "Software Engineer",
    resumeSummary:
      "Backend-leaning full-stack engineer with strong DSA fundamentals and two production internships. Ships reliable services but tends to take feedback defensively in panel settings.",
    projects: [
      {
        title: "Distributed Rate Limiter",
        stack: ["Go", "Redis", "gRPC", "Docker"],
        impact: "Cut API abuse incidents by 38% across three internal services.",
      },
      {
        title: "Campus Placement Portal",
        stack: ["Next.js", "PostgreSQL", "Prisma", "TypeScript"],
        impact: "Adopted by 1,200+ students, reduced manual coordination by 60%.",
      },
    ],
    skills: ["Go", "TypeScript", "System Design", "PostgreSQL", "Docker", "Data Structures"],
    fit: { technical: 82, behavioural: 58, fit: 74, successProbability: 71 },
    dnla: [
      { competency: "Drive for Results", group: "Achievement Dynamics", score: 6, benchmark: 6, insight: "Consistently pushes tasks to completion under deadlines." },
      { competency: "Initiative", group: "Achievement Dynamics", score: 5, benchmark: 6, insight: "Takes ownership but waits for clarity before acting on ambiguity." },
      { competency: "Collaboration", group: "Interpersonal Skills", score: 4, benchmark: 6, insight: "Works well one-on-one; quieter in larger cross-functional groups." },
      { competency: "Feedback Reception", group: "Interpersonal Skills", score: 3, benchmark: 6, insight: "Becomes defensive when challenged in panel interviews." },
      { competency: "Problem Solving", group: "Execution", score: 6, benchmark: 6, insight: "Strong analytical breakdown of technical problems." },
      { competency: "Attention to Detail", group: "Execution", score: 6, benchmark: 5, insight: "Catches edge cases reviewers typically miss." },
      { competency: "Planning & Organising", group: "Execution", score: 5, benchmark: 6, insight: "Plans well solo, less structured in group projects." },
      { competency: "Composure", group: "Stress & Resilience", score: 5, benchmark: 6, insight: "Stays calm in technical rounds, mild stress in behavioural ones." },
      { competency: "Adaptability", group: "Stress & Resilience", score: 4, benchmark: 6, insight: "Prefers familiar tooling; ramps slower on new stacks." },
    ],
    strengths: ["Deep technical fundamentals", "Reliable delivery", "Strong edge-case thinking"],
    developmentAreas: ["Receiving critical feedback", "Group communication", "Self-advocacy in panels"],
    risks: ["Defensive reaction to pushback may affect team-fit interviews"],
    status: "In progress",
  },
  {
    id: "candidate-002",
    name: "Diya Sharma",
    avatar: "DS",
    branch: "Information Technology",
    year: "Final Year",
    college: "BITS Pilani",
    cgpa: 9.1,
    targetRole: "Associate Product Manager",
    resumeSummary:
      "Product-minded builder with strong stakeholder storytelling and clean execution. Interview-ready candidate who needs a light polish sprint on written PRD structure.",
    projects: [
      {
        title: "Retention Analytics Dashboard",
        stack: ["React", "Python", "Mixpanel", "SQL"],
        impact: "Surfaced churn drivers that lifted week-4 retention by 12%.",
      },
      {
        title: "Vernacular Onboarding Flow",
        stack: ["Figma", "Next.js", "i18n"],
        impact: "Improved onboarding completion by 22% across tier-2 users.",
      },
    ],
    skills: ["Product Strategy", "User Research", "SQL", "Figma", "Roadmapping", "Stakeholder Management"],
    fit: { technical: 71, behavioural: 86, fit: 81, successProbability: 83 },
    dnla: [
      { competency: "Drive for Results", group: "Achievement Dynamics", score: 6, benchmark: 6, insight: "Outcome-oriented with clear success metrics." },
      { competency: "Initiative", group: "Achievement Dynamics", score: 6, benchmark: 6, insight: "Proactively scopes problems before being asked." },
      { competency: "Collaboration", group: "Interpersonal Skills", score: 6, benchmark: 6, insight: "Bridges engineering and design conversations naturally." },
      { competency: "Feedback Reception", group: "Interpersonal Skills", score: 6, benchmark: 6, insight: "Invites critique and iterates quickly." },
      { competency: "Problem Solving", group: "Execution", score: 5, benchmark: 6, insight: "Structured thinker; occasionally over-indexes on consensus." },
      { competency: "Attention to Detail", group: "Execution", score: 5, benchmark: 5, insight: "Solid, with room to tighten written PRD precision." },
      { competency: "Planning & Organising", group: "Execution", score: 6, benchmark: 6, insight: "Excellent roadmap and milestone discipline." },
      { competency: "Composure", group: "Stress & Resilience", score: 6, benchmark: 6, insight: "Calm and articulate under interview pressure." },
      { competency: "Adaptability", group: "Stress & Resilience", score: 6, benchmark: 6, insight: "Comfortable pivoting when requirements shift." },
    ],
    strengths: ["Stakeholder storytelling", "Strong behavioural maturity", "Roadmap discipline"],
    developmentAreas: ["Written PRD tightening", "Technical depth for edge cases"],
    risks: [],
    status: "Interview-ready",
  },
  {
    id: "candidate-003",
    name: "Rohan Verma",
    avatar: "RV",
    branch: "Electronics & Communication",
    year: "Final Year",
    college: "NIT Trichy",
    cgpa: 8.2,
    targetRole: "Data Engineer",
    resumeSummary:
      "Fast, confident builder with strong pipeline skills. High raw ability offset by overconfidence flags and blunt disagreement handling in behavioural rounds.",
    projects: [
      {
        title: "Streaming ETL Platform",
        stack: ["Spark", "Kafka", "Airflow", "Python"],
        impact: "Reduced batch latency from 6 hours to near real-time for analytics.",
      },
      {
        title: "Sensor Anomaly Detection",
        stack: ["Python", "TensorFlow", "InfluxDB"],
        impact: "Flagged 94% of hardware faults before field failure in trials.",
      },
    ],
    skills: ["Python", "Spark", "Kafka", "Airflow", "SQL", "Data Modeling"],
    fit: { technical: 79, behavioural: 52, fit: 68, successProbability: 64 },
    dnla: [
      { competency: "Drive for Results", group: "Achievement Dynamics", score: 6, benchmark: 6, insight: "High energy and fast shipping cadence." },
      { competency: "Initiative", group: "Achievement Dynamics", score: 6, benchmark: 6, insight: "Volunteers for hard problems readily." },
      { competency: "Collaboration", group: "Interpersonal Skills", score: 3, benchmark: 6, insight: "Blunt pushback can shut down team discussion." },
      { competency: "Feedback Reception", group: "Interpersonal Skills", score: 3, benchmark: 6, insight: "Discounts feedback he disagrees with too quickly." },
      { competency: "Problem Solving", group: "Execution", score: 6, benchmark: 6, insight: "Strong at decomposing data pipeline failures." },
      { competency: "Attention to Detail", group: "Execution", score: 5, benchmark: 5, insight: "Solid, occasionally skips validation when confident." },
      { competency: "Planning & Organising", group: "Execution", score: 5, benchmark: 6, insight: "Capable planner, prefers to improvise." },
      { competency: "Composure", group: "Stress & Resilience", score: 5, benchmark: 6, insight: "Steady technically; defensive when challenged." },
      { competency: "Adaptability", group: "Stress & Resilience", score: 5, benchmark: 6, insight: "Adjusts to new tools quickly when motivated." },
    ],
    strengths: ["Real-time data pipeline expertise", "Speed of execution", "Strong technical confidence"],
    developmentAreas: ["Handling disagreement", "Reducing overconfidence", "Collaborative communication"],
    risks: ["Overconfidence flags may affect team-fit interviews", "Blunt disagreement handling"],
    status: "In progress",
  },
  {
    id: "candidate-004",
    name: "Ananya Iyer",
    avatar: "AI",
    branch: "Mechanical Engineering",
    year: "Pre-final Year",
    college: "VIT Vellore",
    cgpa: 7.9,
    targetRole: "Business Analyst",
    resumeSummary:
      "Analytical generalist transitioning from core mechanical into analytics. Early in the readiness journey with strong learning velocity and steady temperament.",
    projects: [
      {
        title: "Supply Chain Cost Model",
        stack: ["Excel", "Power BI", "SQL"],
        impact: "Identified 9% logistics savings opportunity for a campus startup.",
      },
      {
        title: "Manufacturing KPI Tracker",
        stack: ["Python", "Pandas", "Tableau"],
        impact: "Automated weekly reporting, saving ~5 hours per cycle.",
      },
    ],
    skills: ["SQL", "Power BI", "Excel", "Business Analysis", "Python", "Stakeholder Communication"],
    fit: { technical: 61, behavioural: 70, fit: 64, successProbability: 60 },
    dnla: [
      { competency: "Drive for Results", group: "Achievement Dynamics", score: 5, benchmark: 6, insight: "Motivated learner, still building outcome focus." },
      { competency: "Initiative", group: "Achievement Dynamics", score: 5, benchmark: 6, insight: "Takes initiative on familiar tasks." },
      { competency: "Collaboration", group: "Interpersonal Skills", score: 6, benchmark: 6, insight: "Easy to work with and well liked in teams." },
      { competency: "Feedback Reception", group: "Interpersonal Skills", score: 5, benchmark: 6, insight: "Open to feedback, sometimes lacks follow-through." },
      { competency: "Problem Solving", group: "Execution", score: 4, benchmark: 6, insight: "Developing structured analytical frameworks." },
      { competency: "Attention to Detail", group: "Execution", score: 5, benchmark: 5, insight: "Careful with data, improving on documentation." },
      { competency: "Planning & Organising", group: "Execution", score: 4, benchmark: 6, insight: "Benefits from clearer milestone planning." },
      { competency: "Composure", group: "Stress & Resilience", score: 5, benchmark: 6, insight: "Steady and even-tempered under pressure." },
      { competency: "Adaptability", group: "Stress & Resilience", score: 5, benchmark: 6, insight: "Adapting well to the analytics domain shift." },
    ],
    strengths: ["Strong learning velocity", "Easy team collaboration", "Even temperament"],
    developmentAreas: ["Technical depth in SQL", "Structured problem framing", "Milestone planning"],
    risks: ["Early in readiness journey - needs more mock practice"],
    status: "Not started",
  },
];

export const examAspirants: ExamAspirant[] = [
  {
    id: "aspirant-001",
    name: "Karthik Nair",
    avatar: "KN",
    exam: "UPSC Civil Services",
    attempt: "2nd Attempt",
    monthsPreparing: 16,
    successPotential: 54,
    motivation: 62,
    consistency: 48,
    resilience: 45,
    stressIndex: 71,
    risks: [
      { label: "Declining study consistency", severity: "high", detected: "Consistency down for 3 consecutive weeks" },
      { label: "Elevated stress markers", severity: "high", detected: "Mood and stress trend worsening before mains" },
      { label: "Sleep disruption", severity: "medium", detected: "Late-night study spikes flagged in tracker" },
    ],
    consistencyTrend: [78, 75, 72, 70, 66, 61, 55, 50, 48],
    moodTrend: [70, 68, 65, 60, 58, 54, 50, 46, 44],
    studyHoursTrend: [9, 8.5, 8, 7, 6.5, 6, 5.5, 5, 4.5],
    institute: "TalEdge Civil Services Academy",
  },
  {
    id: "aspirant-002",
    name: "Sneha Reddy",
    avatar: "SR",
    exam: "NEET UG",
    attempt: "1st Attempt",
    monthsPreparing: 22,
    successPotential: 81,
    motivation: 86,
    consistency: 84,
    resilience: 80,
    stressIndex: 38,
    risks: [
      { label: "Mild burnout watch", severity: "low", detected: "High hours sustained - monitor for fatigue" },
    ],
    consistencyTrend: [80, 82, 83, 84, 85, 86, 85, 86, 87],
    moodTrend: [78, 80, 82, 83, 84, 85, 84, 86, 87],
    studyHoursTrend: [9, 9.5, 9.5, 10, 10, 9.5, 10, 9.5, 10],
    institute: "TalEdge Medical Prep Institute",
  },
  {
    id: "aspirant-003",
    name: "Arjun Patel",
    avatar: "AP",
    exam: "JEE Advanced",
    attempt: "1st Attempt",
    monthsPreparing: 14,
    successPotential: 68,
    motivation: 72,
    consistency: 64,
    resilience: 66,
    stressIndex: 55,
    risks: [
      { label: "Inconsistent mock-test cadence", severity: "medium", detected: "Study hours fluctuate around mock windows" },
      { label: "Concept gaps in Physical Chemistry", severity: "medium", detected: "Repeated dips in topic-wise scores" },
    ],
    consistencyTrend: [60, 68, 58, 70, 62, 72, 60, 66, 64],
    moodTrend: [64, 66, 60, 68, 62, 70, 64, 67, 66],
    studyHoursTrend: [7, 8, 6, 8.5, 7, 8.5, 6.5, 7.5, 7],
    institute: "TalEdge Engineering Academy",
  },
  {
    id: "aspirant-004",
    name: "Meera Joshi",
    avatar: "MJ",
    exam: "CAT",
    attempt: "1st Attempt",
    monthsPreparing: 8,
    successPotential: 73,
    motivation: 78,
    consistency: 75,
    resilience: 72,
    stressIndex: 46,
    risks: [
      { label: "Quant accuracy under timer", severity: "medium", detected: "Speed-accuracy tradeoff flagged in mocks" },
    ],
    consistencyTrend: [68, 70, 72, 71, 74, 75, 76, 75, 77],
    moodTrend: [72, 73, 74, 73, 75, 76, 77, 76, 78],
    studyHoursTrend: [5, 5.5, 6, 6, 6.5, 6.5, 7, 6.5, 7],
    institute: "TalEdge Management Prep Institute",
  },
];

export type Institute = {
  id: string;
  /** Firebase uids allowed to administer this institute (mint share links,
   *  manage interventions). Empty/unset = no admins configured; in enforced
   *  auth that means access is denied (fail-closed). Demo mode ignores this. */
  adminUids?: string[];
  name: string;
  kind: "placement" | "exam";
  cohort: number;
  interviewReady: number;
  avgFit: number;
  topGap: string;
  insights: { label: string; severity: "info" | "warn" | "danger" }[];
  batches: {
    name: string;
    size: number;
    avgTech: number;
    avgBehav: number;
    avgFit: number;
    topGap: string;
  }[];
  /** Organisations planning a campus drive at this institute (PRD §4 — campus
   *  engagement). Seeded today; wired to recruiter intent later. */
  campusDrives?: {
    company: string;
    role: string;
    date: string;
    openings: number;
    status: "Confirmed" | "In discussion" | "Scheduled";
  }[];
};

export const institutes: Institute[] = [
  {
    id: "institute-placement",
    name: "TalEdge School of Engineering",
    kind: "placement",
    cohort: 320,
    interviewReady: 168,
    avgFit: 72,
    topGap: "Behavioural communication in panel rounds",
    insights: [
      { label: "168 of 320 candidates are interview-ready ahead of placement season", severity: "info" },
      { label: "Behavioural scores trail technical by ~14 points cohort-wide", severity: "warn" },
      { label: "22 candidates flagged for feedback-reception risk before publishing", severity: "danger" },
    ],
    batches: [
      { name: "CSE 2026", size: 96, avgTech: 81, avgBehav: 66, avgFit: 76, topGap: "Self-advocacy in panels" },
      { name: "IT 2026", size: 84, avgTech: 76, avgBehav: 72, avgFit: 74, topGap: "Written communication" },
      { name: "ECE 2026", size: 78, avgTech: 74, avgBehav: 62, avgFit: 69, topGap: "Collaborative communication" },
      { name: "Mechanical 2027", size: 62, avgTech: 64, avgBehav: 68, avgFit: 65, topGap: "Technical depth in analytics" },
    ],
    campusDrives: [
      { company: "Atlas Systems", role: "Software Engineer", date: "Aug 12, 2026", openings: 24, status: "Confirmed" },
      { company: "Northwind Analytics", role: "Data Analyst", date: "Aug 20, 2026", openings: 12, status: "Confirmed" },
      { company: "Vertex Cloud", role: "Associate PM", date: "Sep 02, 2026", openings: 8, status: "Scheduled" },
      { company: "Lumen Robotics", role: "Embedded Engineer", date: "Sep 15, 2026", openings: 10, status: "In discussion" },
    ],
  },
  {
    id: "institute-exam",
    name: "TalEdge Competitive Exam Academy",
    kind: "exam",
    cohort: 240,
    interviewReady: 0,
    avgFit: 66,
    topGap: "Study consistency and stress management",
    insights: [
      { label: "Average success potential holding at 66% across active cohorts", severity: "info" },
      { label: "31 aspirants show declining consistency trend over 3+ weeks", severity: "warn" },
      { label: "12 aspirants flagged with high stress index before main exams", severity: "danger" },
    ],
    batches: [
      { name: "UPSC 2026", size: 64, avgTech: 58, avgBehav: 60, avgFit: 60, topGap: "Stress and consistency recovery" },
      { name: "NEET 2026", size: 72, avgTech: 78, avgBehav: 80, avgFit: 79, topGap: "Burnout prevention" },
      { name: "JEE 2026", size: 58, avgTech: 68, avgBehav: 64, avgFit: 66, topGap: "Mock-test cadence" },
      { name: "CAT 2026", size: 46, avgTech: 72, avgBehav: 74, avgFit: 73, topGap: "Quant accuracy under timer" },
    ],
  },
  {
    id: "institute-tech",
    name: "TalEdge Institute of Technology",
    kind: "placement",
    cohort: 0, // analytics derive from the live cohort assigned to this institute
    interviewReady: 0,
    avgFit: 0,
    topGap: "Communication in panel rounds",
    insights: [
      { label: "Cohort analytics build from each candidate's completed assessment", severity: "info" },
    ],
    batches: [],
    campusDrives: [
      { company: "Quanta Labs", role: "Backend Engineer", date: "Aug 28, 2026", openings: 16, status: "Confirmed" },
      { company: "Helios Fintech", role: "Full-stack Engineer", date: "Sep 10, 2026", openings: 9, status: "In discussion" },
    ],
  },
];

export type RecruiterRow = {
  /** Unique per-row id (the pool can list the same candidate for two roles).
   * Used for React keys + selection identity; studentId stays for drill-down links. */
  poolId: string;
  studentId: string;
  name: string;
  college: string;
  role: string;
  fit: number;
  tech: number;
  behav: number;
  success: number;
  flags: string[];
};

export const recruiterPool: RecruiterRow[] = [
  {
    poolId: "candidate-001-swe",
    studentId: "candidate-001",
    name: "Aarav Mehta",
    college: "IIT Bombay",
    role: "Software Engineer",
    fit: 74,
    tech: 82,
    behav: 58,
    success: 71,
    flags: ["Feedback reception below benchmark"],
  },
  {
    poolId: "candidate-002-apm",
    studentId: "candidate-002",
    name: "Diya Sharma",
    college: "BITS Pilani",
    role: "Associate Product Manager",
    fit: 81,
    tech: 71,
    behav: 86,
    success: 83,
    flags: [],
  },
  {
    poolId: "candidate-003",
    studentId: "candidate-003",
    name: "Rohan Verma",
    college: "NIT Trichy",
    role: "Data Engineer",
    fit: 68,
    tech: 79,
    behav: 52,
    success: 64,
    flags: ["Overconfidence flag", "Disagreement handling"],
  },
  {
    poolId: "candidate-004",
    studentId: "candidate-004",
    name: "Ananya Iyer",
    college: "VIT Vellore",
    role: "Business Analyst",
    fit: 64,
    tech: 61,
    behav: 70,
    success: 60,
    flags: ["Early readiness - limited mock history"],
  },
  {
    poolId: "candidate-002-pa",
    studentId: "candidate-002",
    name: "Diya Sharma",
    college: "BITS Pilani",
    role: "Product Analyst",
    fit: 78,
    tech: 73,
    behav: 84,
    success: 80,
    flags: [],
  },
  {
    poolId: "candidate-001-be",
    studentId: "candidate-001",
    name: "Aarav Mehta",
    college: "IIT Bombay",
    role: "Backend Engineer",
    fit: 76,
    tech: 84,
    behav: 59,
    success: 72,
    flags: [],
  },
];

export type CoachSession = {
  id: string;
  studentId: string;
  topic: string;
  date: string;
  status: "Upcoming" | "Completed";
  outcome?: string;
};

export const coachSessions: CoachSession[] = [
  {
    id: "cs-001",
    studentId: "candidate-001",
    topic: "Feedback reaction and self-advocacy",
    date: "Jun 05, 2026 - 5:00 PM",
    status: "Upcoming",
  },
  {
    id: "cs-002",
    studentId: "candidate-003",
    topic: "Collaborative communication and disagreement handling",
    date: "Jun 06, 2026 - 7:00 PM",
    status: "Upcoming",
  },
  {
    id: "cs-003",
    studentId: "candidate-002",
    topic: "Written product storytelling polish",
    date: "Jun 08, 2026 - 4:00 PM",
    status: "Upcoming",
  },
  {
    id: "cs-004",
    studentId: "candidate-001",
    topic: "Mock interview debrief - behavioural round",
    date: "May 28, 2026 - 6:00 PM",
    status: "Completed",
    outcome: "Behavioural score improved from 54 to 58; defensive responses reduced.",
  },
  {
    id: "cs-005",
    studentId: "candidate-004",
    topic: "Readiness kickoff and SQL fundamentals plan",
    date: "May 30, 2026 - 3:30 PM",
    status: "Completed",
    outcome: "Set a 6-week roadmap; first mock scheduled and learning plan agreed.",
  },
  {
    id: "cs-006",
    studentId: "candidate-003",
    topic: "Overconfidence reset and peer feedback drill",
    date: "May 26, 2026 - 7:30 PM",
    status: "Completed",
    outcome: "Reduced overconfidence flags by one tier; agreed to structured pause-and-listen technique.",
  },
];

export const personas: Persona[] = [
  { kind: "student", id: "candidate-001" },
  { kind: "exam", id: "aspirant-001" },
  { kind: "institute", id: "institute-placement" },
  { kind: "recruiter", id: "recruiter-001" },
  { kind: "coach", id: "coach-001" },
  { kind: "counsellor", id: "counsellor-001" },
];

/** Known coaches. Mirrors the institute/exam registries so /coach/[id] can
 *  notFound() an unknown id instead of rendering a generic dashboard for any URL. */
export const coaches = [{ id: "coach-001", name: "Lead Coach" }];
export function getCoach(id: string) {
  return coaches.find((c) => c.id === id);
}

export function getStudent(id: string) {
  return students.find((s) => s.id === id) || {
    id,
    name: "New Candidate",
    avatar: "NC",
    branch: "Computer Science",
    year: "Final Year",
    college: "TalEdge University",
    cgpa: 8.0,
    targetRole: "Software Engineer",
    resumeSummary: "",
    projects: [],
    skills: [],
    fit: { technical: 0, behavioural: 0, fit: 0, successProbability: 0 },
    dnla: [],
    strengths: [],
    developmentAreas: [],
    risks: [],
    status: "Not started" as const
  };
}
// Lenient fallback (like getStudent): in enforced mode onboarding routes a real
// exam aspirant to /exam/<uid>, so a strict seed-only lookup 404'd every real
// aspirant's own workspace hub and every in-funnel "back to workspace" link. Return
// a blank aspirant for an unknown id so the hub renders; the page then merges the
// aspirant's stored results (see app/exam/[id]/page.tsx) over this base.
export function getExam(id: string): ExamAspirant {
  return (
    examAspirants.find((e) => e.id === id) || {
      id,
      name: "New Aspirant",
      avatar: "NA",
      exam: "Competitive Exam",
      attempt: "Attempt 1",
      monthsPreparing: 0,
      successPotential: 0,
      motivation: 0,
      consistency: 0,
      resilience: 0,
      stressIndex: 0,
      risks: [],
      consistencyTrend: [],
      moodTrend: [],
      studyHoursTrend: [],
      institute: "",
    }
  );
}
export function getInstitute(id: string) {
  return institutes.find((i) => i.id === id);
}

/* ───────────────────────── Institute cohort (pilot) ─────────────────────────
 * A deterministic dummy cohort so the institute dashboard can render a real
 * student list, a 20/60/20 bell-curve split, and branch/dept/semester filters.
 * Deterministic (index-derived, no Math.random) to avoid SSR hydration drift.
 * ------------------------------------------------------------------------- */

const FIRST = ["Aanya","Vivaan","Ananya","Reyansh","Ishaan","Saanvi","Kabir","Aadhya","Arjun","Myra","Vihaan","Anika","Krishna","Diya","Rohan","Navya","Aryan","Kiara","Dhruv","Pari","Karan","Riya","Yash","Sara","Nikhil","Tara","Aditya","Isha","Manav","Avni","Rahul","Tanvi","Siddharth","Nisha","Varun","Pooja"];
const LAST = ["Sharma","Verma","Iyer","Nair","Reddy","Gupta","Patel","Bose","Khan","Rao","Menon","Singh","Das","Jain","Pillai","Shah"];
const DEPTS = [
  { branch: "Computer Science", dept: "Computer Science & Engineering" },
  { branch: "Information Technology", dept: "Information Technology" },
  { branch: "Electronics", dept: "Electronics & Communication" },
  { branch: "Electrical", dept: "Electrical & Electronics" },
  { branch: "Mechanical", dept: "Mechanical Engineering" },
  { branch: "Civil", dept: "Civil Engineering" },
];
const COLLEGES = ["TalEdge School of Engineering", "TalEdge Institute of Technology"];
const ROLES = ["Software Engineer","Data Analyst","QA Engineer","Frontend Engineer","Backend Engineer","Systems Engineer","Associate PM"];

const DNLA_TEMPLATE: { competency: string; group: DnlaScore["group"] }[] = [
  { competency: "Goal Orientation", group: "Achievement Dynamics" },
  { competency: "Initiative", group: "Achievement Dynamics" },
  { competency: "Communication", group: "Interpersonal Skills" },
  { competency: "Empathy", group: "Interpersonal Skills" },
  { competency: "Planning & Structure", group: "Execution" },
  { competency: "Follow-through", group: "Execution" },
  { competency: "Composure", group: "Stress & Resilience" },
  { competency: "Feedback Reception", group: "Stress & Resilience" },
];

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

// Dummy DNLA competency scores (1-7) derived from an overall 0-100 base.
function makeDnla(base: number): DnlaScore[] {
  return DNLA_TEMPLATE.map((t, i) => {
    const score = clamp(Math.round((base / 100) * 6 + 1 + ((i % 3) - 1) * 0.7), 1, 7);
    return {
      competency: t.competency,
      group: t.group,
      score,
      benchmark: 6,
      insight: score >= 6 ? "Above cohort benchmark" : score >= 4 ? "Near cohort benchmark" : "Development priority",
    };
  });
}

function generateCohort(): Student[] {
  return Array.from({ length: 36 }, (_, i) => {
    const n = i + 5; // continue after candidate-004
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 3 + 1) % LAST.length];
    const d = DEPTS[i % DEPTS.length];
    // Spread fit 46..92 deterministically for a realistic distribution.
    const fit = 46 + ((i * 37 + 13) % 47);
    const technical = clamp(fit + (((i * 13) % 17) - 8), 40, 99);
    const behavioural = clamp(fit + (((i * 7) % 19) - 11), 35, 98);
    const successProbability = clamp(Math.round((fit * 0.6 + behavioural * 0.4)), 30, 97);
    const status: Student["status"] =
      fit >= 78 ? "Interview-ready" : fit >= 60 ? "In progress" : "Not started";
    return {
      id: `candidate-${String(n).padStart(3, "0")}`,
      name: `${first} ${last}`,
      avatar: `${first[0]}${last[0]}`,
      branch: d.branch,
      dept: d.dept,
      semester: 6 + (i % 3), // 6,7,8
      year: ["Final Year", "Pre-final Year"][i % 2],
      college: COLLEGES[i % COLLEGES.length],
      cgpa: Math.round((6.5 + ((i * 11) % 30) / 10) * 10) / 10,
      targetRole: ROLES[i % ROLES.length],
      resumeSummary: `${d.branch} student targeting ${ROLES[i % ROLES.length]} roles.`,
      projects: [],
      skills: ["DSA", "DBMS", "OOP", d.branch].slice(0, 3 + (i % 2)),
      fit: { technical, behavioural, fit, successProbability },
      dnla: makeDnla(fit),
      strengths: behavioural >= 70 ? ["Collaboration"] : ["Technical fundamentals"],
      developmentAreas: behavioural < 60 ? ["Communication in panels"] : ["Advanced system design"],
      risks: fit < 58 ? ["Below interview-readiness threshold"] : [],
      status,
    };
  });
}

// Append the generated cohort to the named students (idempotent guard).
if (students.length < 8) {
  students.push(...generateCohort());
}

/** Distinct filter options derived from the live student list. */
export const studentBranches = Array.from(new Set(students.map((s) => s.branch)));
export const studentSemesters = Array.from(
  new Set(students.map((s) => s.semester).filter((x): x is number => typeof x === "number"))
).sort((a, b) => a - b);

/* ───────────────────────── Campus organisations (pilot) ───────────────────── */
export type Organisation = {
  id: string;
  name: string;
  sector: string;
  roles: string[];
  openings: number;
  ctc: string;
  status: "Planning" | "Scheduled" | "Visited";
  date: string;
};

export const organisations: Organisation[] = [
  { id: "org-001", name: "Nimbus Cloud Systems", sector: "Cloud / SaaS", roles: ["Software Engineer", "SRE"], openings: 18, ctc: "₹12–18 LPA", status: "Scheduled", date: "Jul 14, 2026" },
  { id: "org-002", name: "Vertex Analytics", sector: "Data / AI", roles: ["Data Analyst", "ML Engineer"], openings: 10, ctc: "₹10–16 LPA", status: "Planning", date: "Aug 02, 2026" },
  { id: "org-003", name: "Meridian Fintech", sector: "Fintech", roles: ["Backend Engineer", "QA Engineer"], openings: 14, ctc: "₹9–14 LPA", status: "Scheduled", date: "Jul 21, 2026" },
  { id: "org-004", name: "Orbit Robotics", sector: "Hardware / IoT", roles: ["Systems Engineer", "Embedded Engineer"], openings: 8, ctc: "₹8–13 LPA", status: "Planning", date: "Aug 18, 2026" },
  { id: "org-005", name: "Helix Health", sector: "HealthTech", roles: ["Frontend Engineer", "Software Engineer"], openings: 12, ctc: "₹10–15 LPA", status: "Visited", date: "May 28, 2026" },
  { id: "org-006", name: "Quanta Semiconductors", sector: "Semiconductors", roles: ["VLSI Engineer", "Systems Engineer"], openings: 9, ctc: "₹11–17 LPA", status: "Planning", date: "Sep 05, 2026" },
];
