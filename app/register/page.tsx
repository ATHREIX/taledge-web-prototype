"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { syncSessionCookie } from "@/lib/session-cookie";
import { Logo } from "@/components/logo";
import { postAuthPath, type Role } from "@/lib/roles";
import {
  EASE,
  BrandPanel,
  EntField,
  MailIcon,
  LockIcon,
  PasswordToggle,
  Spinner,
  Arrow,
} from "@/components/landing/enterprise/auth-kit";

/* ------------------------------- data ----------------------------- */

const STEPS = ["Welcome", "Platform", "Organization"];

const INDUSTRIES = ["Technology", "Education", "Financial Services", "Healthcare", "Manufacturing", "Public Sector"];
const TEAM_SIZES = ["1–50", "51–200", "201–1,000", "1,000+"];
const HIRING_VOLUMES = ["Under 10 / year", "10–100 / year", "100–1,000 / year", "1,000+ / year"];

// Enterprise personas shown to the buyer, each mapped to a real backend role so
// post-auth routing and the role-aware workspace stay intact.
const PLATFORM_ROLES: { key: string; label: string; desc: string; role: Role; path: string }[] = [
  { key: "recruiter", label: "Recruiter", desc: "Source, assess and shortlist on verified evidence.", role: "recruiter", path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 .01" },
  { key: "university", label: "University", desc: "Make whole cohorts interview-ready with readiness heatmaps.", role: "institute", path: "M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1 3 3 6 3s6-2 6-3v-5" },
  { key: "coach", label: "Coach", desc: "Run risk-ranked coaching sessions with every gap in view.", role: "coach", path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 11l2 2 4-4" },
  { key: "candidate", label: "Candidate", desc: "Get assessed by AI, earn a Fit Score, and follow a coaching pathway.", role: "candidate", path: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" },
];

const ASSESSMENTS = [
  { key: "technical", label: "Technical assessments", desc: "Proctored, adaptive technical interviews - transcribed and rubric-scored.", path: "M16 18 22 12 16 6M8 6 2 12l6 6" },
  { key: "interview", label: "Interview workflows", desc: "Sequenced technical + behavioural rounds run by a live voice agent.", path: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2" },
  { key: "evaluation", label: "Evaluation templates", desc: "Structured rubrics so every candidate is scored consistently.", path: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { key: "pipelines", label: "Candidate pipelines", desc: "Role-matched, verified candidates published to recruiters on consent.", path: "M3 3v18h18M8 17V9M13 17V5M18 17v-6" },
];

/* ---- role-aware steps -------------------------------------------------------
 * One wizard shell, but the Organization (step 2) and Modules (step 3) steps
 * swap labels + options to fit the persona picked in step 1 - so a university
 * is asked about cohorts (not "hiring volume"), and a coach about their
 * practice (not "candidate pipelines"). Keyed by the PLATFORM_ROLES key.
 */
type ChoiceField = { key: string; label: string; options: string[] };
type Step2Config = {
  title: string;
  sub: string;
  nameLabel: string;
  namePlaceholder: string;
  fields: [ChoiceField, ChoiceField, ChoiceField];
};
type ModuleItem = { key: string; label: string; desc: string; path: string };
type ModulesConfig = { title: string; sub: string; items: ModuleItem[] };

type PersonaKey = "recruiter" | "university" | "coach" | "candidate";

const STEP2: Record<Exclude<PersonaKey, "candidate">, Step2Config> = {
  recruiter: {
    title: "Tell us about your organization",
    sub: "This tailors your workspace, benchmarks and pipelines.",
    nameLabel: "Organization name",
    namePlaceholder: "Acme Corporation",
    fields: [
      { key: "industry", label: "Industry", options: INDUSTRIES },
      { key: "teamSize", label: "Team size", options: TEAM_SIZES },
      { key: "hiringVolume", label: "Annual hiring volume", options: HIRING_VOLUMES },
    ],
  },
  university: {
    title: "Tell us about your institution",
    sub: "This tailors cohort readiness heatmaps and placement benchmarks.",
    nameLabel: "Institution name",
    namePlaceholder: "Indian Institute of Technology",
    fields: [
      { key: "institutionType", label: "Institution type", options: ["Engineering", "Management", "Arts & Science", "Polytechnic", "Multidisciplinary", "Coaching Institute"] },
      { key: "cohortSize", label: "Cohort size", options: ["Under 200", "200–1,000", "1,000–5,000", "5,000+"] },
      { key: "annualPlacements", label: "Graduating students / year", options: ["Under 100", "100–500", "500–2,000", "2,000+"] },
    ],
  },
  coach: {
    title: "Tell us about your coaching practice",
    sub: "This tailors your risk-ranked queues and session cadence.",
    nameLabel: "Practice or affiliated institute",
    namePlaceholder: "Independent · or your institute name",
    fields: [
      { key: "coachingFocus", label: "Coaching focus", options: ["Placement coaching", "Exam counselling", "Both"] },
      { key: "menteeLoad", label: "Active mentees", options: ["1–10", "11–30", "31–75", "75+"] },
      { key: "cadence", label: "Typical cadence", options: ["Weekly", "Bi-weekly", "Monthly", "Ad-hoc"] },
    ],
  },
};

const MODULES: Record<PersonaKey, ModulesConfig> = {
  recruiter: {
    title: "Configure your assessments",
    sub: "Select the modules to enable now. Everything stays adjustable from your workspace.",
    items: ASSESSMENTS,
  },
  candidate: {
    title: "Configure your assessments",
    sub: "Select the modules to enable now. Everything stays adjustable from your workspace.",
    items: ASSESSMENTS,
  },
  university: {
    title: "Configure your cohort tools",
    sub: "Select the modules to enable for your cohort. Everything stays adjustable later.",
    items: [
      { key: "readiness", label: "Cohort readiness heatmaps", desc: "Branch- and year-level interview-readiness across the whole cohort.", path: "M3 3v18h18M7 14l3-3 4 4 5-6" },
      { key: "assessments", label: "Placement assessments", desc: "Proctored technical + behavioural rounds, transcribed and rubric-scored.", path: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
      { key: "exam-prep", label: "Exam-prep tracks", desc: "Stress, consistency and success-potential tracking for exam aspirants.", path: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2" },
      { key: "publishing", label: "Recruiter publishing", desc: "Publish interview-ready students to recruiters on student consent.", path: "M3 3v18h18M8 17V9M13 17V5M18 17v-6" },
    ],
  },
  coach: {
    title: "Configure your coaching tools",
    sub: "Select the modules to enable now. Everything stays adjustable from your workspace.",
    items: [
      { key: "queues", label: "Risk-ranked queues", desc: "Mentees auto-prioritised by behavioural drag and exam-stress signals.", path: "M3 3v18h18M8 17V9M13 17V5M18 17v-6" },
      { key: "scheduling", label: "Session scheduling", desc: "Book and track coaching sessions against each mentee's gaps.", path: "M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" },
      { key: "goals", label: "Intervention goals", desc: "Set measurable goals and track progress to target dates.", path: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
      { key: "outcomes", label: "Outcome tracking", desc: "Score lift, readiness conversion and stress-reduction impact over time.", path: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
    ],
  },
};

/* ----------------------------- primitives ------------------------- */

function OptionCard({
  selected,
  onClick,
  title,
  desc,
  path,
  compact,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc?: string;
  path?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "group relative flex w-full items-start gap-3 rounded-xl border bg-white text-left transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/12 " +
        (compact ? "p-3.5 " : "p-4 ") +
        (selected
          ? "border-brand-600 shadow-[0_14px_36px_-22px_rgba(79,70,229,0.6)] ring-1 ring-brand-600"
          : "border-ink-200 hover:border-brand-600/40 hover:shadow-sm")
      }
    >
      {path && (
        <span
          className={
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors " +
            (selected ? "bg-brand-600 text-white" : "bg-brand-600/[0.07] text-brand-600 group-hover:bg-brand-600/10")
          }
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={path} />
          </svg>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold text-ink-900">{title}</span>
        {desc && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-500">{desc}</span>}
      </span>
      <span
        aria-hidden
        className={
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all " +
          (selected ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 text-transparent")
        }
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      </span>
    </button>
  );
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "rounded-lg border px-4 py-3 text-[14px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/12 " +
        (selected
          ? "border-brand-600 bg-brand-600/[0.06] text-brand-600 ring-1 ring-brand-600"
          : "border-ink-200 bg-white text-ink-600 hover:border-brand-600/40 hover:text-ink-900")
      }
    >
      {children}
    </button>
  );
}

function StepHeading({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand-600">{kicker}</p>
      <h1 className="mt-2 text-[1.7rem] font-extrabold tracking-[-0.02em] text-ink-900 sm:text-[2rem]">{title}</h1>
      {sub && <p className="mt-2 text-[14.5px] leading-relaxed text-ink-500">{sub}</p>}
    </div>
  );
}

/* ------------------------------- page ----------------------------- */

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  // Same-origin ?next= threaded through to the "Sign in" cross-link so a
  // deep-link/invite survives if the user switches to logging in instead.
  const [next, setNext] = useState<string | null>(null);
  // SSO setup mode: a Google/Microsoft user who signed in with no users/{uid}
  // doc is sent here (by /login) with ?setup=1 to pick their stakeholder role.
  // They're already authenticated, so we skip the credentials step (step 0) and
  // the final step writes their profile doc instead of creating an account.
  const [isSetup, setIsSetup] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("next");
    setNext(raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null);
    if (params.get("setup") === "1") {
      setIsSetup(true);
      setStep((s) => (s === 0 ? 1 : s)); // skip credentials for an authed SSO user
    }
  }, []);
  // Guard + prefill for setup mode: bounce to /login if the session is missing,
  // and seed the name from the SSO profile so they don't retype it.
  useEffect(() => {
    if (!isSetup) return;
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }
    if (user?.displayName) setName((n) => n || user.displayName || "");
    if (user?.email) setEmail((e) => e || user.email || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetup, authLoading, user]);

  // account
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // organization
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [hiringVolume, setHiringVolume] = useState("");
  // platform + assessments
  const [platformRole, setPlatformRole] = useState("");
  const [prefs, setPrefs] = useState<string[]>(ASSESSMENTS.map((a) => a.key));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Domain must be a real hostname (letters/digits/hyphen/dot + a ≥2-letter TLD).
  // The looser [^\s@]+ accepted things Firebase then rejects as auth/invalid-email
  // (e.g. an underscore in the domain: test@recruiter_1.com), which sent the user
  // all the way through the wizard only to fail on the final createUser call.
  const emailValid = /^[^\s@]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(
    email.trim()
  );
  const isCandidate = platformRole === "candidate";
  // Step order: 0 Welcome · 1 Platform · 2 Organization.
  const stepValid = [
    name.trim().length > 1 && emailValid && password.length >= 6,
    !!platformRole,
    orgName.trim().length > 1 && !!industry && !!teamSize && !!hiringVolume,
    prefs.length > 0,
  ];
  // Candidates have no organization, so step 2 is skipped for them. In SSO setup
  // the credentials step (0) is dropped - the user is already authenticated.
  // Step order: 0 Welcome · 1 Platform · 2 Organization. (The former
  // "Assessments" module step was removed - its selection was never consumed
  // anywhere, so it collected preferences that had no effect.)
  const flow = isSetup
    ? isCandidate
      ? [1]
      : [1, 2]
    : isCandidate
      ? [0, 1]
      : [0, 1, 2];
  const firstStep = flow[0];
  const lastStep = flow[flow.length - 1];
  const total = flow.length;
  const pos = Math.max(0, flow.indexOf(step)) + 1;
  const nextOf = (s: number) => s + 1;
  const prevOf = (s: number) => s - 1;
  const stepErrors = [
    "Enter your full name, a valid work email, and a password with at least 6 characters.",
    "Select how you'll use Taledge.",
    "Add a name and make a selection in each field to continue.",
    "Select at least one module.",
  ];

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setError("");
    setStep(next);
  };

  const selectedRole = PLATFORM_ROLES.find((r) => r.key === platformRole);
  const persona = (platformRole || "recruiter") as PersonaKey;
  const cfg2 = STEP2[(persona === "candidate" ? "recruiter" : persona) as Exclude<PersonaKey, "candidate">];
  // Positional binding of the three org-field selections to their state setters,
  // so the role-aware step can render whichever labels/options cfg2 defines.
  const orgFields = [
    { value: industry, set: setIndustry },
    { value: teamSize, set: setTeamSize },
    { value: hiringVolume, set: setHiringVolume },
  ];

  const pickRole = (key: string) => {
    setPlatformRole(key);
    // Each persona has different org options + module set - clear stale org
    // selections and pre-select all of the chosen persona's modules (keeps the
    // original "everything on by default" UX, just role-correct).
    setIndustry("");
    setTeamSize("");
    setHiringVolume("");
    const mods = MODULES[key as PersonaKey] ?? MODULES.recruiter;
    setPrefs(mods.items.map((m) => m.key));
  };

  const createAccount = async () => {
    setError("");
    setLoading(true);
    const cleanEmail = email.trim();
    try {
      const role: Role = selectedRole?.role ?? "recruiter";
      // SSO setup: the user is already authenticated (Google/Microsoft). Persist
      // their chosen role/profile onto the existing account rather than creating
      // a new email/password one.
      let uid: string;
      if (isSetup) {
        const current = auth.currentUser;
        if (!current) {
          setError("Your session expired. Please sign in again.");
          router.replace("/login");
          return;
        }
        uid = current.uid;
        if (name && current.displayName !== name) {
          try {
            await updateProfile(current, { displayName: name });
          } catch {
            /* best-effort */
          }
        }
      } else {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        uid = cred.user.uid;
        try {
          await updateProfile(cred.user, { displayName: name });
        } catch {
          /* best-effort */
        }
      }
      try {
        await setDoc(
          doc(db, "users", uid),
          {
            uid,
            email: isSetup ? auth.currentUser?.email ?? cleanEmail : cleanEmail,
            name,
            role,
            published: false,
            organization: {
              name: orgName,
              persona: platformRole,
              // Store the three selections under the persona's own field keys
              // (e.g. cohortSize/annualPlacements for a university), not the
              // recruiter-centric industry/teamSize/hiringVolume names.
              [cfg2.fields[0].key]: industry,
              [cfg2.fields[1].key]: teamSize,
              [cfg2.fields[2].key]: hiringVolume,
            },
            assessmentPreferences: prefs,
            createdAt: new Date().toISOString(),
          },
          // Merge in setup so we don't clobber any fields an existing partial doc
          // already holds; a fresh email sign-up writes the full doc.
          isSetup ? { merge: true } : {}
        );
      } catch {
        /* profile persistence is best-effort in demo */
      }
      go(4); // success screen
    } catch (err: any) {
      const code = err?.code || "";
      setError(
        code === "auth/email-already-in-use"
          ? "That email is already registered. Try signing in instead."
          : code === "auth/invalid-email"
          ? "Please enter a valid work email."
          : code === "auth/weak-password"
          ? "Password must be at least 6 characters."
          : err?.message || "Could not create your account."
      );
      // Return to the first step so the user can fix their input — but do NOT
      // call go(), which runs setError("") and would wipe the message we just
      // set, leaving a silent bounce with no reason shown.
      setDir(-1);
      setStep(firstStep);
    } finally {
      setLoading(false);
    }
  };

  const launchDashboard = async () => {
    const role = selectedRole?.role ?? "recruiter";
    // Write the middleware gate cookie before navigating to a protected page
    // (/onboarding and the role hubs are all gated), so the RSC fetch isn't
    // bounced back to /login by enforced-mode middleware.
    await syncSessionCookie(auth.currentUser);
    // Honor a same-origin ?next= (e.g. a recruiter who signed up to open an
    // institute's shared link returns to it). Candidates still enter onboarding.
    const nextParam =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
    const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
    // A brand-new candidate starts the assessment funnel; orgs go to the hub.
    router.push(safeNext || (role === "candidate" ? "/onboarding" : postAuthPath(role)));
  };

  const isSuccess = step === 4;

  return (
    <div className="grid min-h-screen bg-white text-ink-900 antialiased lg:grid-cols-[1.05fr_1fr]">
      {/* Left - editorial enterprise panel (sticky, full height) */}
      <div className="lg:sticky lg:top-0 lg:h-screen">
        <BrandPanel
          heading="Build your talent workflow."
          sub="Set up assessments, recruiter pipelines and analytics in minutes - the enterprise platform that turns candidate potential into one defensible score."
        />
      </div>

      {/* Right - onboarding */}
      <div className="relative flex min-h-screen flex-col">
        {/* top bar */}
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" aria-label="Taledge home" className="inline-flex lg:hidden"><Logo /></Link>
          <span aria-hidden className="hidden lg:block" />
          {!isSuccess && !isSetup && (
            <p className="text-[14px] text-ink-500">
              Already have an account?{" "}
              <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-brand-600 hover:underline">Sign in</Link>
            </p>
          )}
          {!isSuccess && isSetup && (
            <p className="text-[14px] text-ink-500">Finish setting up your workspace</p>
          )}
        </header>

        <main className="mx-auto w-full max-w-xl px-5 pb-20 pt-4 sm:px-8">
        {/* progress */}
        {!isSuccess && (
          <div className="mb-10">
            <div className="flex items-center justify-between">
              {flow.map((sIdx, i) => {
                const done = i < pos - 1;
                const current = i === pos - 1;
                return (
                  <div key={sIdx} className="flex items-center gap-2">
                    <span
                      className={
                        "grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold transition-colors " +
                        (done ? "bg-brand-600 text-white" : current ? "bg-brand-600/[0.12] text-brand-600 ring-2 ring-brand-600" : "bg-ink-100 text-ink-400")
                      }
                    >
                      {done ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className={"hidden text-[13px] font-semibold sm:inline " + (i <= pos - 1 ? "text-ink-900" : "text-ink-400")}>{STEPS[sIdx]}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-100">
              <motion.div
                className="h-full rounded-full bg-brand-600"
                initial={false}
                animate={{ width: `${total > 1 ? ((pos - 1) / (total - 1)) * 100 : 100}%` }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </div>
          </div>
        )}

        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              {/* error */}
              {error && (
                <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13.5px] text-rose-700">
                  <span aria-hidden className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">!</span>
                  {error}
                </div>
              )}

              {/* ---------- STEP 1 - WELCOME ---------- */}
              {step === 0 && (
                <div>
                  <StepHeading
                    kicker={`Step ${pos} of ${total}`}
                    title="Let's build your hiring workflow"
                    sub="A few quick details and your talent-intelligence workspace is ready - assessments, recruiter pipelines and analytics in one place."
                  />
                  <div className="mt-7 space-y-4">
                    <EntField label="Full name" value={name} onChange={setName} placeholder="Priya Sharma" autoComplete="name" required />
                    <EntField label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" autoComplete="email" required icon={<MailIcon />} />
                    <EntField
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={setPassword}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      required
                      icon={<LockIcon />}
                      trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
                    />
                  </div>
                </div>
              )}

              {/* ---------- ORGANIZATION (role-aware) ---------- */}
              {step === 2 && (
                <div>
                  <StepHeading kicker={`Step ${pos} of ${total}`} title={cfg2.title} sub={cfg2.sub} />
                  <div className="mt-7 space-y-6">
                    <EntField label={cfg2.nameLabel} value={orgName} onChange={setOrgName} placeholder={cfg2.namePlaceholder} required />
                    {cfg2.fields.map((f, i) => {
                      const cols = f.options.some((o) => o.length > 14) ? "sm:grid-cols-2" : "sm:grid-cols-3";
                      return (
                        <div key={f.key}>
                          <p className="mb-2.5 text-[13px] font-semibold text-ink-900">{f.label}</p>
                          <div className={`grid grid-cols-2 gap-2.5 ${cols}`}>
                            {f.options.map((x) => (
                              <Pill key={x} selected={orgFields[i].value === x} onClick={() => orgFields[i].set(x)}>{x}</Pill>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---------- PLATFORM SETUP ---------- */}
              {step === 1 && (
                <div>
                  <StepHeading kicker={`Step ${pos} of ${total}`} title="How will you use Taledge?" sub="Choose your primary role - you can invite the rest of your team later." />
                  <div className="mt-7 grid gap-3">
                    {PLATFORM_ROLES.map((r) => (
                      <OptionCard
                        key={r.key}
                        selected={platformRole === r.key}
                        onClick={() => pickRole(r.key)}
                        title={r.label}
                        desc={r.desc}
                        path={r.path}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ---------- SUCCESS ---------- */}
              {step === 4 && (
                <div className="py-6 text-center">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                    className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-brand-600 text-white shadow-[0_24px_60px_-24px_rgba(79,70,229,0.7)]"
                  >
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
                    className="mt-7 text-[2rem] font-extrabold tracking-[-0.02em] text-ink-900 sm:text-[2.4rem]"
                  >
                    Your workspace is ready
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.22 }}
                    className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-500"
                  >
                    {orgName ? `${orgName}'s` : "Your"} Taledge workspace is configured as{" "}
                    <span className="font-semibold text-ink-900">{selectedRole?.label ?? "your team"}</span>. Launch in to start
                    turning candidate potential into proof.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
                    className="mt-9 flex flex-wrap items-center justify-center gap-3"
                  >
                    <button
                      type="button"
                      onClick={launchDashboard}
                      className="group inline-flex items-center gap-2 rounded-lg bg-brand-600 px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md"
                    >
                      Launch dashboard
                      <Arrow className="transition-transform group-hover:translate-x-0.5" />
                    </button>
                    <Link
                      href="/"
                      className="inline-flex items-center gap-2 rounded-lg border border-ink-300 bg-white px-7 py-3.5 text-[15px] font-semibold text-ink-900 transition-all hover:border-brand-600/40 hover:bg-ink-50"
                    >
                      Schedule a platform walkthrough
                    </Link>
                  </motion.div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* nav controls */}
        {!isSuccess && (
          <div className="mt-10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => go(prevOf(step))}
              disabled={step === firstStep || loading}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-3 text-[14px] font-semibold text-ink-500 transition-colors hover:text-ink-900 disabled:invisible"
            >
              <Arrow className="rotate-180" /> Back
            </button>

            {step !== lastStep ? (
              <button
                type="button"
                onClick={() => (stepValid[step] ? go(nextOf(step)) : setError(stepErrors[step]))}
                className="group inline-flex items-center gap-2 rounded-lg bg-brand-600 px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md"
              >
                Continue <Arrow className="transition-transform group-hover:translate-x-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => (stepValid[step] ? createAccount() : setError(stepErrors[step]))}
                disabled={loading}
                aria-busy={loading}
                className="group inline-flex items-center gap-2 rounded-lg bg-brand-600 px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Spinner /> : <>Create workspace <Arrow className="transition-transform group-hover:translate-x-0.5" /></>}
              </button>
            )}
          </div>
        )}
        </main>
      </div>
    </div>
  );
}
