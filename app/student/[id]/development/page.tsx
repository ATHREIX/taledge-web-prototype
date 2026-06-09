import { notFound } from "next/navigation";
import Link from "next/link";
import { ScoreRing, Sparkline } from "@/components/score-ring";
import { getStudent } from "@/lib/data";

const SHOW_PHASE_2 = false;

export default async function Development({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = getStudent(id);
  if (!s) notFound();

  return (
    <div className="relative overflow-x-hidden">
      
      {/* Jaw-dropping animated background */}
      <div className="fixed inset-0 -z-20 min-h-screen bg-slate-50 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-amber-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
      </div>
{/* HERO */}
      <section className="relative border-b border-white/40 pt-8 pb-8 sm:pt-12 sm:pb-10">
        <div className="container mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-500 uppercase rounded-full bg-indigo-50/50 border border-indigo-200/50 backdrop-blur-md shadow-sm animate-fade-in">
              <SparkIcon /> Development Pathway
            </div>
            <Link href={`/student/${s.id}`} className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 bg-white/40 border border-white/40 rounded-2xl hover:bg-white/80 hover:shadow-lg hover:shadow-slate-200/20 hover:-translate-y-0.5 active:scale-95 backdrop-blur-md !py-2 text-xs">
              <ArrowLeft /> Back
            </Link>
          </div>

          <h1 className="mt-7 max-w-4xl text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
            Closing the gap to {s.targetRole}
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-500 sm:text-base">
            Personalized learning pathway synthesized from DNLA + AI interviews.
            Coach-matched, sprint-structured, longitudinally tracked.
          </p>
        </div>
      </section>

      <div className="container mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {/* Quadrant + Score ring */}
        <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 p-5 sm:p-7">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-3">
            <div className="flex flex-col items-center">
              <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-3">Projected outcome</div>
              <ScoreRing
                value={s.fit.successProbability}
                size={180}
                stroke={14}
                label="Success Probability"
                tone="dark"
              />
            </div>
            <div className="lg:col-span-2">
              <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-3">The Quadrant</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Quadrant
                  title="Technical · Strong"
                  tone="success"
                  items={[
                    "Structured reasoning",
                    "Clean problem decomposition",
                    "Strong fundamentals",
                  ]}
                />
                <Quadrant
                  title="Behavioural · Strong"
                  tone="success"
                  items={s.strengths}
                />
                <Quadrant
                  title="Technical · Develop"
                  tone="warn"
                  items={["System design articulation", "Trade-off framing"]}
                />
                <Quadrant
                  title="Behavioural · Develop"
                  tone="danger"
                  items={s.developmentAreas}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pathway */}
        <section className="mt-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-500 uppercase rounded-full bg-indigo-50/50 border border-indigo-200/50 backdrop-blur-md shadow-sm">
                <FlowIcon /> The Pathway
              </div>
              <h2 className="mt-4 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
                Learning pathway
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Generated from your assessment evidence. Refreshed after each interview.
              </p>
            </div>
            <span className="inline-flex items-center px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100/50 border border-white/40 rounded-full backdrop-blur-sm">6 weeks · 3 sprints</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Sprint
              n="01"
              tag="Weeks 1-2"
              title="Communication & ownership"
              items={[
                "1:1 coaching · Receiving feedback (2 sessions)",
                "Self-paced · STAR storytelling lab",
                "Drill · 6 mock behavioural prompts",
              ]}
              foot="Expected lift: +9 behavioural · +4 fit"
              accent="dark"
            />
            <Sprint
              n="02"
              tag="Weeks 3-4"
              title="System design depth"
              items={[
                "Course · Designing data-intensive systems (ch 1-4)",
                "Project · Add observability to a production service",
                "Drill · 4 system design mocks",
              ]}
              foot="Expected lift: +6 technical · +3 fit"
            />
            <Sprint
              n="03"
              tag="Weeks 5-6"
              title="Panel readiness"
              items={[
                "3 full mock interviews (panel format)",
                "1:1 · Assertiveness lab",
                "Reattempt assessment to verify lift",
              ]}
              foot="Expected fit at end of pathway: 84"
            />
          </div>
        </section>

        {/* Phase 2 role-transition preview remains in code but hidden for Phase 1. */}
        {SHOW_PHASE_2 && <section className="mt-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-500 uppercase rounded-full bg-indigo-50/50 border border-indigo-200/50 backdrop-blur-md shadow-sm">
                <SwitchIcon /> Phase 02 Preview
              </div>
              <h2 className="mt-4 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
                Role transition
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Want to pivot to a different role? Here's the gap.
              </p>
            </div>
          </div>
          <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 p-5 sm:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">If you target Data Scientist · Prompt Eng.</div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">
                  <span>{s.targetRole}</span>
                  <span className="text-slate-300">→</span>
                  <span>Data Scientist</span>
                </div>
              </div>
              <Link href="/coach-ai" className="relative inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 hover:shadow-xl hover:shadow-slate-900/20 hover:-translate-y-0.5 active:scale-95 overflow-hidden ring-1 ring-white/10">
                Open AI Coach
                <ArrowRight />
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <GapCol title="Key skills to develop">
                <li>Prompt engineering patterns</li>
                <li>LLM evaluation methodology</li>
                <li>Statistics refresher</li>
                <li>RAG architectures</li>
              </GapCol>
              <GapCol title="Recommended courses">
                <li>DeepLearning.AI · Prompt Engineering</li>
                <li>Fast.ai · Practical Deep Learning</li>
                <li>StatQuest · Stats fundamentals</li>
              </GapCol>
              <GapCol title="Projects to attempt">
                <li>Build & eval an LLM-powered tutor</li>
                <li>RAG over college policy docs</li>
                <li>Contribute to an OSS eval framework</li>
              </GapCol>
            </div>
          </div>
        </section>}

        {/* Coaching */}
        <section className="mt-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-500 uppercase rounded-full bg-indigo-50/50 border border-indigo-200/50 backdrop-blur-md shadow-sm">
                <MentorIcon /> The Coaches
              </div>
              <h2 className="mt-4 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
                Matched coaches
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <CoachCard
              name="Meera Iyer"
              focus="Communication & confidence"
              rating={4.9}
              sessions={184}
            />
            <CoachCard
              name="Vikram Sahay"
              focus="Tech leadership panels"
              rating={4.8}
              sessions={132}
            />
            <CoachCard
              name="Ananya Bose"
              focus="Behavioural interview lab"
              rating={4.9}
              sessions={211}
            />
          </div>
        </section>

        {/* Longitudinal */}
        <section className="mt-12">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-indigo-500 uppercase rounded-full bg-indigo-50/50 border border-indigo-200/50 backdrop-blur-md shadow-sm">
              <ChartIcon /> The Trend
            </div>
            <h2 className="mt-4 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 drop-shadow-sm">
              Progress so far
            </h2>
          </div>
          <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 p-5 sm:p-7">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <Trend label="Fit Score" data={[55, 58, 60, 62, 65, 68, 70, 72]} />
              <Trend label="Behavioural" data={[40, 42, 45, 48, 52, 55, 56, 58]} />
              <Trend label="Technical" data={[72, 74, 75, 78, 80, 82, 83, 84]} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Quadrant({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "success" | "warn" | "danger";
  items: string[];
}) {
  const cls = {
    success: "border-emerald-200 bg-emerald-50/50",
    warn: "border-amber-200 bg-amber-50/50",
    danger: "border-rose-200 bg-rose-50/50",
  }[tone];
  const dot = {
    success: "bg-emerald-500",
    warn: "bg-amber-500",
    danger: "bg-rose-500",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-4 sm:p-5`}>
      <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">{title}</div>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sprint({
  n,
  tag,
  title,
  items,
  foot,
  accent,
}: {
  n: string;
  tag: string;
  title: string;
  items: string[];
  foot: string;
  accent?: "dark";
}) {
  return (
    <div
      className={`card p-5 sm:p-6 ${
        accent === "dark" ? "ring-1 ring-ink-900" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-3xl font-bold tracking-tight text-slate-900">{n}</div>
        <span className="inline-flex items-center px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100/50 border border-white/40 rounded-full backdrop-blur-sm">{tag}</span>
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
            {i}
          </li>
        ))}
      </ul>
      <div className="mt-5 border-t border-slate-100 pt-3 text-xs font-medium text-slate-500">
        {foot}
      </div>
    </div>
  );
}

function GapCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative bg-slate-50/40 backdrop-blur-xl border border-slate-200/40 rounded-3xl overflow-hidden p-4 sm:p-5">
      <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">{title}</div>
      <ul className="mt-3 list-disc space-y-1 pl-4 text-sm leading-relaxed text-slate-700">
        {children}
      </ul>
    </div>
  );
}

function CoachCard({
  name,
  focus,
  rating,
  sessions,
}: {
  name: string;
  focus: string;
  rating: number;
  sessions: number;
}) {
  return (
    <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:bg-white/60 hover:-translate-y-1 transition-all duration-300 cursor-pointer p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white">
          {name
            .split(" ")
            .map((p) => p[0])
            .join("")}
        </div>
        <div>
          <div className="text-base font-semibold tracking-tight text-slate-900">
            {name}
          </div>
          <div className="text-xs text-slate-500">{focus}</div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs text-slate-600">
        <span className="inline-flex items-center gap-1 font-semibold">
          <StarIcon /> {rating}
        </span>
        <span>{sessions} sessions</span>
      </div>
      <button className="relative inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 hover:shadow-xl hover:shadow-slate-900/20 hover:-translate-y-0.5 active:scale-95 overflow-hidden ring-1 ring-white/10 mt-5 w-full">Book session</button>
    </div>
  );
}

function Trend({ label, data }: { label: string; data: number[] }) {
  const last = data[data.length - 1];
  const delta = last - data[0];
  return (
    <div className="relative bg-slate-50/40 backdrop-blur-xl border border-slate-200/40 rounded-3xl overflow-hidden p-4 sm:p-5">
      <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">{label}</div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-3xl font-bold tracking-tight tabular-nums text-slate-900 sm:text-4xl">
          {last}
        </span>
        <span
          className={`mb-1.5 text-xs font-semibold ${
            delta >= 0 ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}
        </span>
      </div>
      <div className="mt-3">
        <Sparkline data={data} />
      </div>
    </div>
  );
}

/* Icons */
function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M19 12H5M11 19l-7-7 7-7" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.7L20 10l-5 4 1.5 6L12 17l-4.5 3L9 14l-5-4 6.1-1.3z" />
    </svg>
  );
}
function FlowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="6" height="6" rx="1" />
      <rect x="16" y="15" width="6" height="6" rx="1" />
      <path d="M5 9v3a3 3 0 0 0 3 3h8" />
    </svg>
  );
}
function SwitchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
function MentorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <circle cx="17" cy="6" r="3" />
      <path d="M21 14a3 3 0 0 0-3-3" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m7 17 4-4 4 4 5-5" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5" />
    </svg>
  );
}
