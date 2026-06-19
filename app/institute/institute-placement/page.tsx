"use client";

import React from "react";
import {
  Users,
  Sparkles,
  Gauge,
  AlertTriangle,
  Upload,
  Search,
  Share2,
  X,
  Building2,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardBody,
  Button,
  ButtonLink,
  Badge,
  Stat,
  Heading,
} from "@/components/ui";
import {
  DashboardShell,
  DashboardHeader,
  KPIGrid,
  Section,
  EmptyState,
} from "@/components/dashboard";
import { Bar } from "@/components/score-ring";
import { BellCurve } from "@/components/institute/bell-curve";
import {
  students as seedStudents,
  organisations,
  studentBranches,
  studentSemesters,
  type Student,
} from "@/lib/data";
import { scoreToTone } from "@/lib/dashboard-theme";
import { cn } from "@/lib/utils";

type Tier = "best" | "average" | "below";

type Row = Student & { tier: Tier };

const TIER_META: Record<Tier, { label: string; tone: "brand" | "warn" | "danger"; badge: "brand" | "warn" | "danger" }> = {
  best: { label: "Best", tone: "brand", badge: "brand" },
  average: { label: "Average", tone: "warn", badge: "warn" },
  below: { label: "Below par", tone: "danger", badge: "danger" },
};

const STATUS_TONE: Record<Student["status"], "neutral" | "brand" | "success" | "warn"> = {
  "Not started": "neutral",
  "In progress": "warn",
  "Interview-ready": "success",
  Published: "brand",
};

const ORG_TONE: Record<string, "brand" | "warn" | "success"> = {
  Planning: "brand",
  Scheduled: "warn",
  Visited: "success",
};

/**
 * Split a list of students into 20/60/20 tiers by fit.fit (descending).
 * Returns each student annotated with a tier and the band aggregates.
 */
function computeSplit(list: Student[]) {
  const safe = Array.isArray(list) ? list.filter(Boolean) : [];
  const n = safe.length;
  const sorted = [...safe].sort((a, b) => (b.fit?.fit ?? 0) - (a.fit?.fit ?? 0));
  const bestCount = Math.round(n * 0.2);
  const belowCount = Math.round(n * 0.2);
  const tierOf = new Map<string, Tier>();
  sorted.forEach((s, i) => {
    let tier: Tier = "average";
    if (i < bestCount) tier = "best";
    else if (i >= n - belowCount) tier = "below";
    tierOf.set(s.id, tier);
  });
  const rows: Row[] = safe.map((s) => ({ ...s, tier: tierOf.get(s.id) ?? "average" }));
  const counts = { best: 0, average: 0, below: 0 };
  rows.forEach((r) => (counts[r.tier] += 1));
  const pct = (c: number) => (n === 0 ? 0 : Math.round((c / n) * 100));
  return {
    rows,
    bands: {
      best: { key: "best" as const, label: "Best 20%", count: counts.best, pct: pct(counts.best) },
      average: { key: "average" as const, label: "Average 60%", count: counts.average, pct: pct(counts.average) },
      below: { key: "below" as const, label: "Below 20%", count: counts.below, pct: pct(counts.below) },
    },
    total: n,
  };
}

let uploadSeq = 0;

/** Parse pasted CSV / file text into student-like rows: "Name, Branch, Semester". */
function parseUpload(text: string): Student[] {
  if (!text) return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Student[] = [];
  for (const line of lines) {
    const cells = line.split(",").map((c) => c.trim());
    const name = cells[0];
    if (!name) continue;
    // Skip an obvious header row.
    if (/^name$/i.test(name)) continue;
    const branch = cells[1] || studentBranches[0] || "Computer Science";
    const semRaw = parseInt(cells[2] ?? "", 10);
    const semester = Number.isFinite(semRaw) ? semRaw : studentSemesters[0] ?? 6;
    // Default fit when not provided: mid-band so it lands in "average".
    const fit = Number.isFinite(parseInt(cells[3] ?? "", 10)) ? parseInt(cells[3], 10) : 68;
    const initials = name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    uploadSeq += 1;
    out.push({
      id: `upload-${Date.now()}-${uploadSeq}`,
      name,
      avatar: initials || "NA",
      branch,
      dept: branch,
      semester,
      year: "Final Year",
      college: "TalEdge School of Engineering",
      cgpa: 7.5,
      targetRole: "Software Engineer",
      resumeSummary: "",
      projects: [],
      skills: [],
      fit: {
        technical: fit,
        behavioural: fit,
        fit,
        successProbability: fit,
      },
      dnla: [],
      strengths: [],
      developmentAreas: [],
      risks: [],
      status: "Not started",
    });
  }
  return out;
}

function Avatar({ initials, tone = "brand" }: { initials: string; tone?: "brand" | "warn" | "danger" }) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700 border-brand-100",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
        tones[tone]
      )}
    >
      {initials}
    </span>
  );
}

export default function InstitutePlacementDashboard() {
  // Added (uploaded) students merged on top of the seed list.
  const [added, setAdded] = React.useState<Student[]>([]);
  const allStudents = React.useMemo(() => [...seedStudents, ...added], [added]);

  // Split + tiers recompute whenever the population changes.
  const { rows, bands, total } = React.useMemo(() => computeSplit(allStudents), [allStudents]);

  // KPI roll-ups from the existing cohort data (no new data sources).
  const kpis = React.useMemo(() => {
    const fits = allStudents.map((s) => s.fit?.fit ?? 0);
    const readyCount = fits.filter((f) => f >= 70).length;
    const avgFit = total === 0 ? 0 : Math.round(fits.reduce((sum, f) => sum + f, 0) / total);
    const readyPct = total === 0 ? 0 : Math.round((readyCount / total) * 100);
    return { readyCount, readyPct, avgFit };
  }, [allStudents, total]);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [branch, setBranch] = React.useState("");
  const [semester, setSemester] = React.useState("");
  const [tier, setTier] = React.useState<"" | Tier>("");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (branch && r.branch !== branch) return false;
      if (semester && String(r.semester ?? "") !== semester) return false;
      if (tier && r.tier !== tier) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, branch, semester, tier, query]);

  const clearFilters = () => {
    setBranch("");
    setSemester("");
    setTier("");
    setQuery("");
  };
  const hasFilters = Boolean(branch || semester || tier || query);

  // ── Selection / share ────────────────────────────────────────────────────
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const filteredIds = React.useMemo(() => filtered.map((r) => r.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });

  const selectedCount = selected.size;

  const [shareOpen, setShareOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState<string | null>(null);

  // ── Upload ───────────────────────────────────────────────────────────────
  const [pasteText, setPasteText] = React.useState("");
  const [uploadMsg, setUploadMsg] = React.useState<string | null>(null);

  const commitUpload = (text: string) => {
    const parsed = parseUpload(text);
    if (parsed.length === 0) {
      setUploadMsg("No valid rows found. Use: Name, Branch, Semester per line.");
      return;
    }
    setAdded((prev) => [...prev, ...parsed]);
    setUploadMsg(`${parsed.length} student${parsed.length === 1 ? "" : "s"} added.`);
    setPasteText("");
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => commitUpload(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <DashboardShell>
      <DashboardHeader
        eyebrow="Institute Placement Cell"
        title="Placement Command Center"
        description="Cohort distribution, candidate readiness, campus drives and profile sharing - everything you need to run a placement season."
        actions={
          <Badge tone="neutral" className="gap-1.5">
            <Gauge size={13} aria-hidden="true" /> Live · {total} students
          </Badge>
        }
      />

      {/* KPI strip — the shared top-line metric pattern every dashboard uses */}
      <KPIGrid
        items={[
          { label: "Cohort size", value: total, hint: "Students in the placement pool", tone: "brand", icon: <Users size={16} /> },
          { label: "Placement-ready", value: `${kpis.readyPct}%`, hint: `${kpis.readyCount} of ${total} at fit 70+`, tone: scoreToTone(kpis.readyPct), icon: <Sparkles size={16} /> },
          { label: "Average fit", value: kpis.avgFit, hint: "Overall fit across cohort", tone: scoreToTone(kpis.avgFit), icon: <Gauge size={16} /> },
          { label: "At-risk", value: bands.below.count, hint: `Bottom ${bands.below.pct}% — needs intervention`, tone: "danger", icon: <AlertTriangle size={16} /> },
        ]}
      />

      <div>
          {/* ── Section 1: KPI bell curve (20/60/20) ── */}
          <Section
            icon={<Gauge size={20} />}
            title="Cohort fit distribution"
            description={`${total} candidates split into a 20 / 60 / 20 readiness curve by overall fit.`}
          >
            <Card variant="frosted" className="rounded-xl3">
              <CardBody>
                <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-8 items-center">
                  <div className="rounded-xl2 border border-ink-200/60 bg-white/50 p-4">
                    <BellCurve best={bands.best} average={bands.average} below={bands.below} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
                    <Card variant="flat" className="p-4">
                      <Stat
                        label="Best profiles · top 20%"
                        value={bands.best.count}
                        sub={`${bands.best.pct}% of cohort · interview-ready edge`}
                        tone="brand"
                        icon={<Sparkles size={18} />}
                      />
                    </Card>
                    <Card variant="flat" className="p-4">
                      <Stat
                        label="Average · middle 60%"
                        value={bands.average.count}
                        sub={`${bands.average.pct}% of cohort · polish to convert`}
                        tone="warn"
                        icon={<Users size={18} />}
                      />
                    </Card>
                    <Card variant="flat" className="p-4">
                      <Stat
                        label="Below par · bottom 20%"
                        value={bands.below.count}
                        sub={`${bands.below.pct}% of cohort · needs intervention`}
                        tone="danger"
                        icon={<AlertTriangle size={18} />}
                      />
                    </Card>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Section>

          {/* ── Section 2: Bulk upload ── */}
          <Section
            icon={<Upload size={20} />}
            title="Upload students"
            description={
              <>
                Paste CSV rows or upload a .csv file - one student per line:{" "}
                <span className="font-mono text-ink-700">Name, Branch, Semester</span>.
              </>
            }
          >
            <Card variant="frosted">
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
                  <div>
                    <label htmlFor="paste-csv" className="label mb-1.5 block">Paste CSV rows</label>
                    <textarea
                      id="paste-csv"
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={4}
                      placeholder={"Riya Kapoor, Computer Science, 7\nKabir Anand, Mechanical, 6"}
                      className="w-full rounded-xl2 border border-ink-200 bg-white px-3.5 py-2.5 text-sm font-mono text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    />
                  </div>
                  <div className="flex flex-col gap-2 md:pt-7">
                    <Button type="button" onClick={() => commitUpload(pasteText)} disabled={!pasteText.trim()}>
                      Add pasted rows
                    </Button>
                    <label
                      htmlFor="file-csv"
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 shadow-sm transition-all hover:bg-ink-50 hover:border-ink-300"
                    >
                      <Upload size={15} aria-hidden="true" /> Upload .csv
                    </label>
                    <input id="file-csv" type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
                  </div>
                </div>
                {uploadMsg && (
                  <p
                    role="status"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                  >
                    <CheckCircle2 size={13} aria-hidden="true" /> {uploadMsg}
                  </p>
                )}
              </CardBody>
            </Card>
          </Section>

          {/* ── Section 3 + 4 + 7: Filters, list, selection, share ── */}
          <Section
            icon={<Users size={20} />}
            title="All students"
            description={
              <span aria-live="polite">
                {filtered.length} of {total} shown
                {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
              </span>
            }
            actions={
              <>
                {selectedCount > 0 && (
                  <Button type="button" variant="soft" size="sm" onClick={() => setSelected(new Set())}>
                    Clear selection
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setConfirmation(null);
                    setShareOpen(true);
                  }}
                  disabled={selectedCount === 0}
                >
                  <Share2 size={14} aria-hidden="true" /> Share selected
                </Button>
              </>
            }
          >
            <Card variant="frosted">
              {/* Filters */}
              <div className="px-5 sm:px-6 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="lg:col-span-2">
                    <label htmlFor="f-search" className="label mb-1 block">Search name</label>
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                      <input
                        id="f-search"
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search candidates..."
                        className="w-full rounded-xl2 border border-ink-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="f-branch" className="label mb-1 block">Branch</label>
                    <select
                      id="f-branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full rounded-xl2 border border-ink-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    >
                      <option value="">All branches</option>
                      {studentBranches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="f-sem" className="label mb-1 block">Semester</label>
                    <select
                      id="f-sem"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="w-full rounded-xl2 border border-ink-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    >
                      <option value="">All semesters</option>
                      {studentSemesters.map((s) => (
                        <option key={s} value={String(s)}>Sem {s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="f-tier" className="label mb-1 block">Tier</label>
                    <select
                      id="f-tier"
                      value={tier}
                      onChange={(e) => setTier(e.target.value as "" | Tier)}
                      className="w-full rounded-xl2 border border-ink-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    >
                      <option value="">All tiers</option>
                      <option value="best">Best (top 20%)</option>
                      <option value="average">Average (middle 60%)</option>
                      <option value="below">Below par (bottom 20%)</option>
                    </select>
                  </div>
                </div>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
                  >
                    <X size={12} aria-hidden="true" /> Clear filters
                  </button>
                )}
              </div>

              <CardBody className="pt-0">
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={<Search size={22} />}
                    title="No students match these filters."
                    description="Try widening the branch, semester or tier."
                    action={
                      hasFilters ? (
                        <Button type="button" variant="soft" size="sm" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl2 border border-ink-200/70">
                    <table className="w-full min-w-[920px] text-sm">
                      <thead>
                        <tr className="border-b border-ink-200/70 bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
                          <th scope="col" className="w-10 px-3 py-3">
                            <input
                              type="checkbox"
                              aria-label="Select all visible students"
                              checked={allFilteredSelected}
                              onChange={toggleAll}
                              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/40"
                            />
                          </th>
                          <th scope="col" className="px-3 py-3 font-semibold">Candidate</th>
                          <th scope="col" className="px-3 py-3 font-semibold">Branch / Sem</th>
                          <th scope="col" className="px-3 py-3 font-semibold">Tech</th>
                          <th scope="col" className="px-3 py-3 font-semibold">Behav</th>
                          <th scope="col" className="px-3 py-3 font-semibold w-44">Fit</th>
                          <th scope="col" className="px-3 py-3 font-semibold">Tier</th>
                          <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                          <th scope="col" className="px-3 py-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r) => {
                          const meta = TIER_META[r.tier];
                          const isSel = selected.has(r.id);
                          return (
                            <tr
                              key={r.id}
                              className={cn(
                                "border-b border-ink-100 last:border-0 transition-colors hover:bg-brand-50/30",
                                isSel && "bg-brand-50/50"
                              )}
                            >
                              <td className="px-3 py-3">
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${r.name}`}
                                  checked={isSel}
                                  onChange={() => toggleOne(r.id)}
                                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/40"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar initials={r.avatar} tone={meta.tone} />
                                  <div className="min-w-0">
                                    <div className="font-semibold text-ink-900 truncate">{r.name}</div>
                                    <div className="text-xs text-ink-500 truncate">{r.targetRole}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="text-ink-800">{r.branch}</div>
                                <div className="text-xs text-ink-500">
                                  {r.semester ? `Sem ${r.semester}` : r.year}
                                </div>
                              </td>
                              <td className="px-3 py-3 tabular-nums text-ink-700">{r.fit.technical}</td>
                              <td className="px-3 py-3 tabular-nums text-ink-700">{r.fit.behavioural}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-8 text-xs font-semibold tabular-nums text-ink-800">{r.fit.fit}</span>
                                  <div className="flex-1">
                                    <Bar value={r.fit.fit} tone={meta.tone === "brand" ? "dark" : meta.tone === "warn" ? "warn" : "danger"} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <Badge tone={meta.badge}>{meta.label}</Badge>
                              </td>
                              <td className="px-3 py-3">
                                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <ButtonLink href={`/student/${r.id}`} variant="ghost" size="sm">
                                  View <ChevronRight size={13} aria-hidden="true" />
                                </ButtonLink>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </Section>

          {/* ── Section 6: Organisations ── */}
          <Section
            icon={<Building2 size={20} />}
            title="Campus drives"
            description={`${organisations.length} organisations planning visits this season.`}
          >
            <Card variant="frosted">
              <CardBody>
                {organisations.length === 0 ? (
                  <EmptyState
                    icon={<Building2 size={22} />}
                    title="No campus drives scheduled yet."
                    description="Organisations planning visits this season will appear here."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {organisations.map((o) => (
                      <Card key={o.id} variant="flat" hover className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-ink-900">{o.name}</div>
                            <div className="text-xs text-ink-500 mt-0.5">{o.sector}</div>
                          </div>
                          <Badge tone={ORG_TONE[o.status] ?? "neutral"}>{o.status}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {(o.roles ?? []).map((role) => (
                            <span key={role} className="rounded-full bg-white border border-ink-200/70 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                              {role}
                            </span>
                          ))}
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-base font-bold text-ink-900 tabular-nums">{o.openings}</div>
                            <div className="text-[10px] uppercase tracking-wide text-ink-500">Openings</div>
                          </div>
                          <div>
                            <div className="text-base font-bold text-ink-900">{o.ctc}</div>
                            <div className="text-[10px] uppercase tracking-wide text-ink-500">CTC</div>
                          </div>
                          <div>
                            <div className="text-base font-bold text-ink-900">{o.date.split(",")[0]}</div>
                            <div className="text-[10px] uppercase tracking-wide text-ink-500">Drive</div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </Section>
      </div>

      {/* Confirmation toast */}
      {confirmation && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2" role="status" aria-live="polite">
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-panel">
            <CheckCircle2 size={16} aria-hidden="true" /> {confirmation}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setConfirmation(null)}
              className="ml-1 text-white/80 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <ShareDialog
        open={shareOpen}
        count={selectedCount}
        onClose={() => setShareOpen(false)}
        onConfirm={(orgName) => {
          setShareOpen(false);
          setConfirmation(`Shared ${selectedCount} profile${selectedCount === 1 ? "" : "s"} with ${orgName}`);
          setSelected(new Set());
        }}
      />
    </DashboardShell>
  );
}

/** Accessible share dialog: role=dialog, aria-modal, Escape to close, focus first control. */
function ShareDialog({
  open,
  count,
  onClose,
  onConfirm,
}: {
  open: boolean;
  count: number;
  onClose: () => void;
  onConfirm: (orgName: string) => void;
}) {
  const [orgId, setOrgId] = React.useState(organisations[0]?.id ?? "");
  const selectRef = React.useRef<HTMLSelectElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Focus the first control when opened.
    const t = setTimeout(() => selectRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;
  const org = organisations.find((o) => o.id === orgId) ?? organisations[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="relative w-full max-w-md rounded-xl3 border border-ink-200/70 bg-white shadow-panel"
      >
        <div className="flex items-start justify-between p-6 pb-3">
          <div>
            <Heading as="h2" id="share-title" className="text-xl">Share profiles</Heading>
            <p className="text-sm text-ink-500 mt-1">
              Send {count} selected profile{count === 1 ? "" : "s"} to a campus organisation.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-2">
          <label htmlFor="share-org" className="label mb-1.5 block">Organisation</label>
          <select
            id="share-org"
            ref={selectRef}
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="w-full rounded-xl2 border border-ink-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} - {o.sector}
              </option>
            ))}
          </select>
          {org && (
            <p className="mt-2 text-xs text-ink-500">
              {org.openings} openings · {org.ctc} · drive {org.date}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-6 pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            size="sm"
            disabled={count === 0 || !org}
            onClick={() => org && onConfirm(org.name)}
          >
            <Share2 size={14} aria-hidden="true" /> Confirm share
          </Button>
        </div>
      </div>
    </div>
  );
}
