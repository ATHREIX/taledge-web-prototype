"use client";

import { notFound, useParams, usePathname } from "next/navigation";
import { getStudent, type DnlaScore } from "@/lib/data";
import {
  PageShell,
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  ButtonLink,
  Badge,
  Stat,
  Heading,
  Eyebrow,
  Label,
} from "@/components/ui";
import { Bar } from "@/components/score-ring";
import { cn } from "@/lib/utils";

const GROUPS = [
  "Achievement Dynamics",
  "Interpersonal Skills",
  "Execution",
  "Stress & Resilience",
] as const;

type Tone = "neutral" | "brand" | "success" | "warn" | "danger";

/** Score (1-7) → semantic tone. >=6 success, 4-5 brand, <4 amber/rose. */
function scoreTone(score: number): Tone {
  if (score >= 6) return "success";
  if (score >= 4) return "brand";
  if (score >= 3) return "warn";
  return "danger";
}

const barTone: Record<Tone, "success" | "dark" | "warn" | "danger" | "muted"> = {
  success: "success",
  brand: "dark",
  neutral: "muted",
  warn: "warn",
  danger: "danger",
};

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Radar (spider) chart of competency scores vs benchmark on a 1-7 scale. */
function CompetencyRadar({ items }: { items: DnlaScore[] }) {
  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 56;
  const maxScore = 7;
  const n = items.length;
  if (n < 3) return null;

  const point = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (Math.max(0, Math.min(maxScore, value)) / maxScore) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const toPath = (accessor: (d: DnlaScore) => number) =>
    items.map((d, i) => point(i, accessor(d)).join(",")).join(" ");

  const rings = [2, 4, 6, 7];
  const ariaLabel = `Radar chart of ${n} DNLA competencies on a 1 to 7 scale. ${items
    .map((d) => `${d.competency} ${d.score} versus benchmark ${d.benchmark}`)
    .join("; ")}.`;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto w-full max-w-[420px]"
      role="img"
      aria-label={ariaLabel}
    >
      {/* grid rings */}
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={Array.from({ length: n }, (_, i) =>
            point(i, ring).join(",")
          ).join(" ")}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      ))}
      {/* spokes + labels */}
      {items.map((d, i) => {
        const [x, y] = point(i, maxScore);
        const [lx, ly] = point(i, maxScore + 1.15);
        const anchor =
          Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
        return (
          <g key={d.competency}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#eef2f7" strokeWidth={1} />
            <text
              x={lx}
              y={ly}
              textAnchor={anchor as "start" | "middle" | "end"}
              dominantBaseline="middle"
              className="fill-ink-500"
              style={{ fontSize: 9.5, fontWeight: 600 }}
            >
              {d.competency}
            </text>
          </g>
        );
      })}
      {/* benchmark polygon */}
      <polygon
        points={toPath((d) => d.benchmark)}
        fill="none"
        stroke="#a5b4fc"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      {/* score polygon */}
      <polygon
        points={toPath((d) => d.score)}
        fill="rgba(79,70,229,0.16)"
        stroke="#4f46e5"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {items.map((d, i) => {
        const [x, y] = point(i, d.score);
        return <circle key={d.competency} cx={x} cy={y} r={3.2} fill="#4f46e5" />;
      })}
    </svg>
  );
}

export default function DnlaReport() {
  const params = useParams();
  const pathname = usePathname();
  const id = String(params.id);
  const s = getStudent(id);
  if (!s) notFound();

  // Shared by both tracks; keep navigation within the current namespace
  // (/exam for competitive-exam aspirants, /student for placement candidates).
  const flowBase = pathname && pathname.startsWith("/exam") ? "/exam" : "/student";

  const dnla = s.dnla ?? [];
  const hasData = dnla.length > 0;

  // Group rollups.
  const groupStats = GROUPS.map((group) => {
    const items = dnla.filter((d) => d.group === group);
    const average = avg(items.map((d) => d.score));
    return { group, items, average };
  }).filter((g) => g.items.length > 0);

  const overallAvg = avg(dnla.map((d) => d.score)); // 1-7
  const behaviouralIndex = hasData ? Math.round((overallAvg / 7) * 100) : 0;

  const sortedGroups = [...groupStats].sort((a, b) => b.average - a.average);
  const strongestGroup = sortedGroups[0];
  const developmentGroup = sortedGroups[sortedGroups.length - 1];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Step 1 · DNLA"
        title="DNLA behavioural competencies"
        description={`These behavioural competency scores are administered by the DNLA partner (Germany). The values shown here are sample / dummy data for the pilot and will be replaced by the licensed provider import. ${s.name}'s profile is visualised below to preview the experience.`}
        actions={
          <div className="flex items-center gap-3">
            <Badge tone="warn">Sample DNLA data · provider import pending</Badge>
            <ButtonLink href={`${flowBase}/${id}`} variant="ghost">
              Back to workspace
            </ButtonLink>
          </div>
        }
      />

      {!hasData ? (
        <Card variant="flat" className="mb-5">
          <CardHeader>
            <Eyebrow>No competency data</Eyebrow>
            <Heading as="h2" className="mt-1 text-lg sm:text-xl">
              DNLA report not available yet
            </Heading>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-600">
              There are no behavioural competency scores for {s.name} yet. Once the
              licensed DNLA provider import is connected, the full competency profile
              will appear here.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <>
          {/* Headline metrics */}
          <section className="mb-5 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <Stat
                  label="Behavioural index"
                  value={`${behaviouralIndex}`}
                  sub="Overall DNLA average, scaled to 100"
                  tone={
                    behaviouralIndex >= 80
                      ? "success"
                      : behaviouralIndex >= 57
                        ? "brand"
                        : "warn"
                  }
                />
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Stat
                  label="Strongest group"
                  value={strongestGroup?.group ?? "-"}
                  sub={
                    strongestGroup
                      ? `Avg ${strongestGroup.average.toFixed(1)} / 7`
                      : undefined
                  }
                  tone="success"
                />
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Stat
                  label="Development group"
                  value={developmentGroup?.group ?? "-"}
                  sub={
                    developmentGroup
                      ? `Avg ${developmentGroup.average.toFixed(1)} / 7`
                      : undefined
                  }
                  tone={
                    developmentGroup && developmentGroup.average < 4
                      ? "danger"
                      : "warn"
                  }
                />
              </CardHeader>
            </Card>
          </section>

          {/* Radar + group summary */}
          <section className="mb-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader>
                <Eyebrow>Competency profile</Eyebrow>
                <Heading as="h2" className="mt-1 text-lg sm:text-xl">
                  Score vs benchmark
                </Heading>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  Each axis is one competency on a 1–7 scale. The solid indigo shape
                  is {s.name}; the dashed outline is the top-performer benchmark.
                </p>
              </CardHeader>
              <CardBody>
                <CompetencyRadar items={dnla} />
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" aria-hidden />
                    Candidate
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-0 w-3 border-t-2 border-dashed border-brand-300"
                      aria-hidden
                    />
                    Benchmark
                  </span>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <Eyebrow>Group rollup</Eyebrow>
                <Heading as="h2" className="mt-1 text-lg sm:text-xl">
                  Behavioural groups
                </Heading>
              </CardHeader>
              <CardBody className="grid gap-3 sm:grid-cols-2">
                {groupStats.map((g) => {
                  const tone = scoreTone(g.average);
                  return (
                    <div
                      key={g.group}
                      className={cn(
                        "rounded-xl2 border p-4",
                        tone === "success" && "border-emerald-200 bg-emerald-50/50",
                        tone === "brand" && "border-brand-100 bg-brand-50/40",
                        tone === "warn" && "border-amber-200 bg-amber-50/50",
                        tone === "danger" && "border-rose-200 bg-rose-50/50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Label>{g.group}</Label>
                        <Badge tone={tone}>{g.average.toFixed(1)} / 7</Badge>
                      </div>
                      <div className="mt-3">
                        <Bar value={g.average} max={7} tone={barTone[tone]} />
                      </div>
                      <p className="mt-2 text-xs text-ink-500">
                        {g.items.length} competenc
                        {g.items.length === 1 ? "y" : "ies"}
                      </p>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          </section>

          {/* Per-competency detail grouped */}
          <section className="mb-5 grid gap-5 md:grid-cols-2">
            {groupStats.map((g) => (
              <Card key={g.group}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <Eyebrow>{g.group}</Eyebrow>
                    <Badge tone={scoreTone(g.average)}>
                      avg {g.average.toFixed(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardBody className="grid gap-4">
                  {g.items.map((d) => {
                    const tone = scoreTone(d.score);
                    return (
                      <div key={d.competency}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-ink-800">
                            {d.competency}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-ink-500">
                            {d.score} / 7
                            <span className="text-ink-400">
                              {" "}· bm {d.benchmark}
                            </span>
                          </span>
                        </div>
                        <div className="mt-2">
                          <Bar value={d.score} max={7} tone={barTone[tone]} />
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-ink-500">
                          {d.insight}
                        </p>
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            ))}
          </section>
        </>
      )}

      {/* CTA: AI interview (DNLA is the first step) */}
      <Card className="mb-5 border-brand-200/70 bg-brand-50/40">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Eyebrow>Next step</Eyebrow>
            <Heading as="h2" className="mt-1 text-lg sm:text-xl">
              AI interview
            </Heading>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-600">
              With DNLA complete, continue to the AI interview - a proctored
              technical round, followed by a behavioural round tailored to the DNLA
              competencies surfaced above for {s.name}.
            </p>
          </div>
          <ButtonLink
            href={`${flowBase}/${id}/interview/technical`}
            size="lg"
            className="w-full shrink-0 sm:w-auto"
          >
            Continue to AI interview
          </ButtonLink>
        </CardHeader>
      </Card>

      {/* Disclaimer */}
      <p className="text-xs leading-5 text-ink-400">
        Sample data. DNLA is a licensed external psychometric provider in Germany; its
        questionnaire and scoring are not hosted in TalEdge. The competency scores
        above are placeholder values for the pilot and will be replaced by the official
        provider import.
      </p>
    </PageShell>
  );
}
