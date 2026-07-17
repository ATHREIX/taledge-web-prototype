import { ScoreRing, Sparkline } from "@/components/score-ring";
import { WorkspaceBack } from "@/components/workspace-back";
import { getStudent } from "@/lib/data";
import { getCandidate } from "@/lib/talent-store";
import { dnlaVideosByAxis, type DnlaDevVideo } from "@/lib/dnla-development-videos";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  ButtonLink,
  Badge,
  Stat,
  Heading,
  Eyebrow,
} from "@/components/ui";

const SHOW_PHASE_2 = false;

export default async function Development({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Prefer the durable talent-store record (real/invited candidate with live
  // results) over the seed fallback so real users see their actual scores and
  // quadrant, not a hollow all-zero "New Candidate". Demo mode keeps the seed.
  const base = getStudent(id);
  const stored = await getCandidate(id);
  const s = stored
    ? { ...base, ...stored, fit: { ...base.fit, ...(stored.fit ?? {}) }, dnla: stored.dnla ?? base.dnla }
    : base;

  const strengths = s.strengths ?? [];
  const developmentAreas = s.developmentAreas ?? [];

  return (
    <PageShell>
      {/* HERO */}
      <PageHeader
        eyebrow="Development Pathway"
        title={
          <span className="text-gradient-brand">
            Closing the gap to {s.targetRole}
          </span>
        }
        description="Personalized learning pathway synthesized from DNLA + AI interviews. Coach-matched, sprint-structured, longitudinally tracked."
        actions={
          <WorkspaceBack id={s.id} href="/dashboard" label="Back to Dashboard" />
        }
      />

      {/* Quadrant + Score ring */}
      <Card variant="frosted" className="overflow-hidden p-5 sm:p-7">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-3">
          <div
            className="flex flex-col items-center"
            role="img"
            aria-label={`Projected success probability: ${Math.round(
              s.fit.successProbability
            )} percent`}
          >
            <Eyebrow className="mb-3">Projected outcome</Eyebrow>
            <ScoreRing
              value={s.fit.successProbability}
              size={180}
              stroke={14}
              label="Success Probability"
              tone="dark"
            />
          </div>
          <div className="lg:col-span-2">
            <Eyebrow className="mb-3">The Quadrant</Eyebrow>
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
                items={strengths}
              />
              <Quadrant
                title="Technical · Develop"
                tone="warn"
                items={["System design articulation", "Trade-off framing"]}
              />
              <Quadrant
                title="Behavioural · Develop"
                tone="danger"
                items={developmentAreas}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Pathway */}
      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>The Pathway</Eyebrow>
            <Heading className="mt-3 text-gradient-brand">Learning pathway</Heading>
            <p className="mt-2 text-sm text-ink-500">
              Generated from your assessment evidence. Refreshed after each interview.
            </p>
          </div>
          <Badge tone="neutral">6 weeks · 3 sprints</Badge>
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

      {/* DNLA Social-Competency resource library */}
      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>The Resource Pool</Eyebrow>
            <Heading className="mt-3 text-gradient-brand">
              DNLA development videos
            </Heading>
            <p className="mt-2 max-w-2xl text-sm text-ink-500">
              A short lesson for each of the 17 Social-Competency factors DNLA
              measures. Work on any factor your profile scored below its
              benchmark. The videos load only when you press play.
            </p>
          </div>
          <Badge tone="warn">In German</Badge>
        </div>

        <div className="space-y-8">
          {dnlaVideosByAxis().map((grp) => (
            <div key={grp.axis}>
              <div className="mb-3 flex items-center gap-2">
                <Eyebrow>{grp.label}</Eyebrow>
                <span className="text-xs text-ink-400">
                  {grp.videos.length} factor{grp.videos.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grp.videos.map((v) => (
                  <ResourceVideo key={v.factor} video={v} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Phase 2 role-transition preview remains in code but hidden for Phase 1. */}
      {SHOW_PHASE_2 && <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Phase 02 Preview</Eyebrow>
            <Heading className="mt-3 text-gradient-brand">Role transition</Heading>
            <p className="mt-2 text-sm text-ink-500">
              Want to pivot to a different role? Here's the gap.
            </p>
          </div>
        </div>
        <Card variant="frosted" className="overflow-hidden p-5 sm:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Eyebrow>If you target Data Scientist · Prompt Eng.</Eyebrow>
              <div className="mt-3 flex flex-wrap items-center gap-3 h-headline text-xl sm:text-2xl md:text-3xl">
                <span>{s.targetRole}</span>
                <span className="text-ink-300" aria-hidden="true">→</span>
                <span>Data Scientist</span>
              </div>
            </div>
            <ButtonLink href="/coach-ai" variant="primary" size="lg">
              Open AI Coach
              <ArrowRight />
            </ButtonLink>
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
        </Card>
      </section>}

      {/* Coaching */}
      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>The Coaches</Eyebrow>
            <Heading className="mt-3 text-gradient-brand">Matched coaches</Heading>
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
          <Eyebrow>The Trend</Eyebrow>
          <Heading className="mt-3 text-gradient-brand">Progress so far</Heading>
        </div>
        <Card variant="frosted" className="overflow-hidden p-5 sm:p-7">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Trend label="Fit Score" data={[55, 58, 60, 62, 65, 68, 70, 72]} />
            <Trend label="Behavioural" data={[40, 42, 45, 48, 52, 55, 56, 58]} />
            <Trend label="Technical" data={[72, 74, 75, 78, 80, 82, 83, 84]} />
          </div>
        </Card>
      </section>
    </PageShell>
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
  const list = items ?? [];
  return (
    <div className={`rounded-xl2 border ${cls} p-4 sm:p-5`}>
      <Eyebrow>{title}</Eyebrow>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">No items recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm text-ink-700">
          {list.map((i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
                aria-hidden="true"
              />
              {i}
            </li>
          ))}
        </ul>
      )}
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
  const list = items ?? [];
  return (
    <Card
      variant="default"
      hover
      className={`p-5 sm:p-6 ${accent === "dark" ? "ring-1 ring-ink-900" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-3xl font-bold tracking-tight text-ink-900">{n}</div>
        <Badge tone="neutral">{tag}</Badge>
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-ink-900">{title}</h3>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">Activities to be scheduled.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-ink-700">
          {list.map((i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500"
                aria-hidden="true"
              />
              {i}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 border-t border-ink-100 pt-3 text-xs font-medium text-ink-500">
        {foot}
      </div>
    </Card>
  );
}

function ResourceVideo({ video }: { video: DnlaDevVideo }) {
  return (
    <Card variant="default" className="overflow-hidden p-0">
      <video
        controls
        preload="none"
        playsInline
        className="aspect-video w-full bg-ink-900"
        aria-label={`DNLA lesson: ${video.en} (${video.de}), in German`}
      >
        <source src={video.url} type="video/mp4" />
        Your browser does not support embedded video.{" "}
        <a href={video.url} className="underline">
          Open the video
        </a>
        .
      </video>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-ink-900">
            {video.en}
          </h3>
          <span className="shrink-0 text-[11px] text-ink-400">{video.de}</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{video.blurb}</p>
      </div>
    </Card>
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
    <Card variant="flat" className="overflow-hidden rounded-xl3 p-4 sm:p-5">
      <Eyebrow>{title}</Eyebrow>
      <ul className="mt-3 list-disc space-y-1 pl-4 text-sm leading-relaxed text-ink-700">
        {children}
      </ul>
    </Card>
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
    <Card variant="frosted" hover className="overflow-hidden p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div
          className="grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-sm font-bold text-white"
          aria-hidden="true"
        >
          {name
            .split(" ")
            .map((p) => p[0])
            .join("")}
        </div>
        <div>
          <div className="text-base font-semibold tracking-tight text-ink-900">
            {name}
          </div>
          <div className="text-xs text-ink-500">{focus}</div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs text-ink-600">
        <span className="inline-flex items-center gap-1 font-semibold">
          <StarIcon /> {rating}
        </span>
        <span>{sessions} sessions</span>
      </div>
      <Button type="button" variant="soft" disabled className="mt-5 w-full">
        Book session · coming soon
      </Button>
    </Card>
  );
}

function Trend({ label, data }: { label: string; data: number[] }) {
  const series = data ?? [];
  if (series.length === 0) {
    return (
      <Card variant="flat" className="overflow-hidden rounded-xl3 p-4 sm:p-5">
        <Eyebrow>{label}</Eyebrow>
        <p className="mt-2 text-sm text-ink-500">No trend data yet.</p>
      </Card>
    );
  }
  const last = series[series.length - 1];
  const delta = last - series[0];
  return (
    <Card variant="flat" className="overflow-hidden rounded-xl3 p-4 sm:p-5">
      <Stat
        label={label}
        value={<span className="tabular-nums">{last}</span>}
        sub={
          <span
            className={`text-xs font-semibold ${
              delta >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            <span aria-hidden="true">{delta >= 0 ? "▲" : "▼"}</span>{" "}
            {delta >= 0 ? "+" : "-"}
            {Math.abs(delta)} over period
          </span>
        }
      />
      <div
        className="mt-3"
        role="img"
        aria-label={`${label} trend, from ${series[0]} to ${last}`}
      >
        <Sparkline data={series} />
      </div>
    </Card>
  );
}

/* Icons */
function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5" />
    </svg>
  );
}
