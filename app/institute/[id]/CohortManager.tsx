"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, Button, ButtonLink, Badge, Eyebrow, useToast } from "@/components/ui";
import { authedFetch } from "@/lib/api-client";

// One student row as the institute dashboard needs it (serialisable from the
// server page). Performance band is derived client-side from the fit score.
export type CohortStudent = {
  id: string;
  name: string;
  branch: string;
  dept: string;
  year: string;
  semester: number | null;
  fit: number;
  status: string;
  published: boolean;
  targetRole: string;
};

type CampusDrive = {
  company: string;
  role: string;
  date: string;
  openings: number;
  status: "Confirmed" | "In discussion" | "Scheduled";
};

type Band = "top" | "core" | "support";
type PendingInvite = { token: string; name: string; email: string; cohort: string; status: string; link: string };
type Tab = "students" | "add" | "drives";

const BAND_META: Record<Band, { label: string; sub: string; cls: string; bar: string; badge: "success" | "warn" | "danger" }> = {
  top: { label: "Top profiles", sub: "Top 20% by Fit", cls: "text-emerald-700", bar: "bg-emerald-500", badge: "success" },
  core: { label: "Core cohort", sub: "Middle 60%", cls: "text-amber-700", bar: "bg-amber-400", badge: "warn" },
  support: { label: "Needs support", sub: "Bottom 20%", cls: "text-rose-700", bar: "bg-rose-500", badge: "danger" },
};

// 20-60-20 split: rank by Fit, slice the top/bottom 20% and the middle 60%.
function bandsFor(students: CohortStudent[]): Map<string, Band> {
  const ranked = [...students].sort((a, b) => b.fit - a.fit);
  const n = ranked.length;
  const topN = Math.round(n * 0.2);
  const bottomN = Math.round(n * 0.2);
  const map = new Map<string, Band>();
  ranked.forEach((s, i) => {
    map.set(s.id, i < topN ? "top" : i >= n - bottomN ? "support" : "core");
  });
  return map;
}

// A normal-distribution curve split into the three 20·60·20 plateaus by AREA
// (the honest shape of a bell curve: equal-percentile tails are wider but
// shorter). Left tail = bottom 20% (poor), middle = 60% (average), right tail =
// top 20% (best). Each zone is clickable to filter the list.
function BellCurve({
  counts,
  total,
  active,
  onPick,
}: {
  counts: Record<Band, number>;
  total: number;
  active: "all" | Band;
  onPick: (b: Band) => void;
}) {
  const W = 640;
  const H = 188;
  const baseY = 150;
  const padTop = 16;
  // Gaussian height at pixel x (z in [-3,3] mapped across the width).
  const yAt = (px: number) => {
    const z = (px / W) * 6 - 3;
    return baseY - Math.exp(-(z * z) / 2) * (baseY - padTop);
  };
  const zToX = (z: number) => (W * (z + 3)) / 6;
  const b1 = zToX(-0.8416); // 20th percentile boundary
  const b2 = zToX(0.8416); //  80th percentile boundary
  const area = (xlo: number, xhi: number) => {
    let d = `M ${xlo.toFixed(1)} ${baseY} L ${xlo.toFixed(1)} ${yAt(xlo).toFixed(1)}`;
    for (let px = xlo; px <= xhi; px += 4) d += ` L ${px.toFixed(1)} ${yAt(px).toFixed(1)}`;
    d += ` L ${xhi.toFixed(1)} ${yAt(xhi).toFixed(1)} L ${xhi.toFixed(1)} ${baseY} Z`;
    return d;
  };
  const curve =
    `M 0 ${yAt(0).toFixed(1)} ` +
    Array.from({ length: W / 4 }, (_, i) => `L ${((i + 1) * 4).toFixed(1)} ${yAt((i + 1) * 4).toFixed(1)}`).join(" ");

  const zones: { band: Band; xlo: number; xhi: number; fill: string; label: string }[] = [
    { band: "support", xlo: 0, xhi: b1, fill: "#f43f5e", label: "Needs support" },
    { band: "core", xlo: b1, xhi: b2, fill: "#f59e0b", label: "Core" },
    { band: "top", xlo: b2, xhi: W, fill: "#10b981", label: "Top profiles" },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full select-none" role="img" aria-label="Cohort performance bell curve, 20-60-20 split by Fit score">
      {zones.map((z) => {
        const dim = active !== "all" && active !== z.band;
        const pct = Math.round((counts[z.band] / total) * 100);
        const cx = (z.xlo + z.xhi) / 2;
        return (
          <g key={z.band} className="cursor-pointer" opacity={dim ? 0.4 : 1} onClick={() => onPick(z.band)}>
            <path d={area(z.xlo, z.xhi)} fill={z.fill} fillOpacity={0.22} />
            <text x={cx} y={z.band === "core" ? 70 : baseY - 30} textAnchor="middle" className="fill-ink-900" style={{ fontSize: 18, fontWeight: 800 }}>
              {counts[z.band]}
            </text>
            <text x={cx} y={H - 16} textAnchor="middle" className="fill-ink-600" style={{ fontSize: 11, fontWeight: 700 }}>
              {z.label}
            </text>
            <text x={cx} y={H - 3} textAnchor="middle" className="fill-ink-400" style={{ fontSize: 10 }}>
              {pct}%
            </text>
          </g>
        );
      })}
      {/* boundary dividers + baseline + curve outline */}
      {[b1, b2].map((x, i) => (
        <line key={i} x1={x} y1={padTop} x2={x} y2={baseY} stroke="#0f172a" strokeOpacity="0.18" strokeDasharray="3 3" />
      ))}
      <line x1="0" y1={baseY} x2={W} y2={baseY} stroke="#0f172a" strokeOpacity="0.25" />
      <path d={curve} fill="none" stroke="#0f172a" strokeOpacity="0.55" strokeWidth="2" />
    </svg>
  );
}

export function CohortManager({
  instituteId,
  students,
  campusDrives,
}: {
  instituteId: string;
  students: CohortStudent[];
  campusDrives: CampusDrive[];
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("students");

  const bandMap = useMemo(() => bandsFor(students), [students]);
  const counts = useMemo(() => {
    const c = { top: 0, core: 0, support: 0 } as Record<Band, number>;
    for (const b of bandMap.values()) c[b]++;
    return c;
  }, [bandMap]);
  const total = students.length || 1;

  // Filters
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("all");
  const [year, setYear] = useState("all");
  const [band, setBand] = useState<"all" | Band>("all");

  const branches = useMemo(() => Array.from(new Set(students.map((s) => s.dept || s.branch).filter(Boolean))).sort(), [students]);
  const years = useMemo(() => Array.from(new Set(students.map((s) => s.year).filter(Boolean))).sort(), [students]);

  const filtered = useMemo(() => {
    return students
      .filter((s) => (branch === "all" ? true : (s.dept || s.branch) === branch))
      .filter((s) => (year === "all" ? true : s.year === year))
      .filter((s) => (band === "all" ? true : bandMap.get(s.id) === band))
      .filter((s) => (q ? s.name.toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => b.fit - a.fit);
  }, [students, branch, year, band, q, bandMap]);

  // ── Shortlist selection → send to recruiter ──────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ link: string; count: number; skipped: number; emailed: boolean } | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filteredIds = useMemo(() => filtered.map((s) => s.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  const clearSelection = () => {
    setSelected(new Set());
    setShareResult(null);
    setRecruiterEmail("");
  };

  const sendToRecruiter = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setSharing(true);
    setShareResult(null);
    try {
      const res = await authedFetch("/api/institute/share-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instituteId,
          studentIds: ids,
          recruiterEmail: recruiterEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setShareResult({
          link: `${window.location.origin}${data.path}`,
          count: data.count ?? ids.length,
          skipped: data.skipped ?? 0,
          emailed: !!data.emailed,
        });
        toast(data.emailed ? "Shortlist emailed to recruiter." : "Recruiter link created.", "success");
      } else {
        toast(data?.error || "Could not create the link.", "error");
      }
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div>
      {/* Tabs */}
      <div role="tablist" aria-label="Cohort views" className="mb-6 flex flex-wrap gap-2">
        {([
          ["students", `Students (${students.length})`],
          ["add", "Add students"],
          ["drives", `Campus drives (${campusDrives.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={
              "rounded-full border px-4 py-2 text-sm font-semibold transition-colors " +
              (tab === key
                ? "border-transparent bg-ink-900 text-white"
                : "border-ink-200/70 bg-white/80 text-ink-600 hover:bg-ink-50 hover:text-ink-900")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "students" && (
        <>
          {/* 20-60-20 distribution - bell curve */}
          <Card variant="frosted" className="rounded-xl3 p-6">
            <Eyebrow>Performance distribution - bell curve (20 · 60 · 20)</Eyebrow>
            <p className="mt-1 text-xs text-ink-500">
              Cohort ranked by Fit. Tails are the top &amp; bottom 20%; the middle 60% is the core. Click a zone to filter the list.
            </p>
            <BellCurve counts={counts} total={total} active={band} onPick={(b) => setBand(band === b ? "all" : b)} />
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["top", "core", "support"] as Band[]).map((b) => (
                <button
                  key={b}
                  onClick={() => setBand(band === b ? "all" : b)}
                  className={
                    "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors " +
                    (band === b ? "border-ink-900 bg-ink-50" : "border-ink-200/70 hover:bg-ink-50")
                  }
                >
                  <span>
                    <span className={`block text-sm font-bold ${BAND_META[b].cls}`}>{BAND_META[b].label}</span>
                    <span className="block text-xs text-ink-500">{BAND_META[b].sub}</span>
                  </span>
                  <span className="text-2xl font-extrabold text-ink-900">{counts[b]}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Filters */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name…"
              className="h-10 min-w-[200px] flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-brand-400"
            />
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-700">
              <option value="all">All branches / depts</option>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-700">
              <option value="all">All years / semesters</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {(branch !== "all" || year !== "all" || band !== "all" || q) && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setBranch("all"); setYear("all"); setBand("all"); setQ(""); }}>
                Clear
              </Button>
            )}
            <span className="ml-auto text-sm text-ink-500">{filtered.length} of {students.length}</span>
          </div>

          {/* Shortlist → recruiter action bar (visible once any student is picked) */}
          {selected.size > 0 && (
            <div className="mt-4 rounded-xl border border-brand-300 bg-brand-50/70 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-ink-900">{selected.size} student{selected.size === 1 ? "" : "s"} shortlisted</span>
                <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <input
                    type="email"
                    value={recruiterEmail}
                    onChange={(e) => setRecruiterEmail(e.target.value)}
                    placeholder="recruiter@company.com (optional)"
                    className="h-9 w-[230px] rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-brand-400"
                  />
                  <Button type="button" variant="primary" size="sm" disabled={sharing} onClick={sendToRecruiter}>
                    {sharing ? "Sending…" : "Send shortlist to recruiter"}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                Only consented (<b>Shared</b>) students are included. A scoped, expiring link is generated; add an email to send it directly.
              </p>
              {shareResult && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-emerald-800">
                      Shared {shareResult.count} candidate{shareResult.count === 1 ? "" : "s"}
                      {shareResult.emailed ? " · emailed" : ""}
                      {shareResult.skipped ? ` · ${shareResult.skipped} skipped (not consented)` : ""}
                    </span>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(shareResult.link); toast("Link copied.", "success"); }}
                      className="shrink-0 text-sm font-semibold text-brand-600 hover:underline"
                    >
                      Copy link
                    </button>
                  </div>
                  <div className="mt-1 truncate text-xs text-ink-500">{shareResult.link}</div>
                </div>
              )}
            </div>
          )}

          {/* Students list */}
          <Card variant="frosted" className="mt-4 rounded-xl3 p-0 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-500">No students match these filters.</div>
            ) : (
              <div className="divide-y divide-ink-200/60">
                <div className="flex items-center gap-3 bg-ink-50/50 px-4 py-2.5 text-xs font-medium text-ink-600">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAllFiltered}
                    aria-label="Select all filtered students"
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span>{allFilteredSelected ? "All selected" : "Select all"} ({filtered.length})</span>
                  {selected.size > 0 && <span className="ml-auto">{selected.size} shortlisted</span>}
                </div>
                {filtered.map((s) => {
                  const b = bandMap.get(s.id) ?? "core";
                  return (
                    <div key={s.id} className="flex flex-wrap items-center gap-4 p-4 hover:bg-ink-50/60">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        aria-label={`Shortlist ${s.name}`}
                        className="h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <div className="min-w-[160px] flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-900">{s.name}</span>
                          <Badge tone={BAND_META[b].badge}>{BAND_META[b].label}</Badge>
                          {s.published && <Badge tone="brand">Shared</Badge>}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-500">
                          {(s.dept || s.branch) || "-"} · {s.year || "-"}{s.semester ? ` · Sem ${s.semester}` : ""} · {s.targetRole || "-"}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-extrabold text-ink-900">{s.fit || "-"}</div>
                        <div className="text-[10px] uppercase tracking-wide text-ink-400">Fit</div>
                      </div>
                      <Badge tone={s.status === "Interview-ready" ? "success" : s.status === "In progress" ? "warn" : "neutral"}>{s.status || "-"}</Badge>
                      <ButtonLink href={`/student/${s.id}/fit-score?view=institute`} variant="ghost" size="sm">Drill down →</ButtonLink>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {tab === "add" && <AddStudents instituteId={instituteId} onDone={(n) => toast(`${n} invite link${n === 1 ? "" : "s"} created.`, "success")} />}

      {tab === "drives" && (
        <Card variant="frosted" className="rounded-xl3 p-0 overflow-hidden">
          {campusDrives.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-500">No campus drives planned yet.</div>
          ) : (
            <div className="divide-y divide-ink-200/60">
              {campusDrives.map((d, i) => (
                <div key={i} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-[180px] flex-1">
                    <div className="font-semibold text-ink-900">{d.company}</div>
                    <div className="text-xs text-ink-500">{d.role} · {d.openings} openings</div>
                  </div>
                  <span className="text-sm text-ink-600">{d.date}</span>
                  <Badge tone={d.status === "Confirmed" ? "success" : d.status === "Scheduled" ? "brand" : "warn"}>{d.status}</Badge>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-ink-200/60 bg-ink-50/40 px-4 py-3 text-xs text-ink-500">
            Use <b>Generate recruiter link</b> in the header to share interview-ready profiles with these companies (scoped, consent-gated).
          </div>
        </Card>
      )}
    </div>
  );
}

// ───────────────────────── Add students (upload group) ─────────────────────
function AddStudents({ instituteId, onDone }: { instituteId: string; onDone: (n: number) => void }) {
  const { toast } = useToast();
  const [cohort, setCohort] = useState("");
  const [bulk, setBulk] = useState("");
  const [manual, setManual] = useState<{ name: string; email: string }[]>([{ name: "", email: "" }]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ name: string; email: string; link: string }[] | null>(null);
  const [pending, setPending] = useState<PendingInvite[]>([]);

  const loadPending = useCallback(async () => {
    try {
      const r = await authedFetch(`/api/institute/cohort?instituteId=${encodeURIComponent(instituteId)}`);
      const j = await r.json();
      if (j?.ok) setPending(j.invites || []);
    } catch { /* non-fatal */ }
  }, [instituteId]);

  useEffect(() => { loadPending(); }, [loadPending]);

  // Parse "Name, email" / "Name <email>" / "email" lines into {name,email}.
  const parsedBulk = useMemo(() => {
    return bulk
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const email = (line.match(/[^\s,<>]+@[^\s,<>]+\.[^\s,<>]+/) || [])[0] || "";
        let name = line.replace(email, "").replace(/[,<>]/g, " ").trim();
        if (!name) name = email.split("@")[0];
        return { name, email };
      })
      .filter((s) => s.email);
  }, [bulk]);

  const allStudents = useMemo(() => {
    const m = manual.filter((s) => s.name.trim() && s.email.trim());
    return [...parsedBulk, ...m];
  }, [parsedBulk, manual]);

  const send = async () => {
    if (allStudents.length === 0) { toast("Add at least one student (name + email).", "info"); return; }
    setBusy(true);
    setResult(null);
    try {
      const res = await authedFetch("/api/institute/cohort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instituteId, cohort, track: "placement", students: allStudents }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setResult(data.invites || []);
        onDone(data.queued || 0);
        setBulk("");
        setManual([{ name: "", email: "" }]);
        loadPending();
      } else {
        toast(data?.error || "Could not create invites.", "error");
      }
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: the builder */}
      <Card variant="frosted" className="rounded-xl3 p-6">
        <Eyebrow>Upload a group of students</Eyebrow>
        <p className="mt-1 text-xs text-ink-500">Paste a list, or add rows manually. Each gets a unique assessment-invite link; results flow back into this cohort.</p>

        <label className="mt-4 block text-xs font-semibold text-ink-700">Cohort label (optional)</label>
        <input value={cohort} onChange={(e) => setCohort(e.target.value)} placeholder="e.g. CSE 2026" className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-brand-400" />

        <label className="mt-4 block text-xs font-semibold text-ink-700">Bulk paste (one per line: “Name, email”)</label>
        <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} placeholder={"Aarav Mehta, aarav@college.edu\nPriya Singh, priya@college.edu"} className="mt-1 w-full rounded-lg border border-ink-200 bg-white p-3 text-sm outline-none focus:border-brand-400" />
        {parsedBulk.length > 0 && <p className="mt-1 text-xs text-emerald-600">{parsedBulk.length} parsed from paste.</p>}

        <div className="mt-4">
          <label className="block text-xs font-semibold text-ink-700">Or add manually</label>
          {manual.map((row, i) => (
            <div key={i} className="mt-2 flex gap-2">
              <input value={row.name} onChange={(e) => setManual((m) => m.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} placeholder="Name" className="h-10 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-brand-400" />
              <input value={row.email} onChange={(e) => setManual((m) => m.map((r, j) => j === i ? { ...r, email: e.target.value } : r))} placeholder="email@college.edu" className="h-10 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-brand-400" />
              {manual.length > 1 && <button onClick={() => setManual((m) => m.filter((_, j) => j !== i))} className="px-2 text-ink-400 hover:text-rose-600" aria-label="Remove row">×</button>}
            </div>
          ))}
          <button onClick={() => setManual((m) => [...m, { name: "", email: "" }])} className="mt-2 text-sm font-semibold text-brand-600 hover:underline">+ Add row</button>
        </div>

        <Button type="button" variant="primary" className="mt-5 w-full" disabled={busy || allStudents.length === 0} onClick={send}>
          {busy ? "Sending…" : `Send assessment invites (${allStudents.length})`}
        </Button>

        {result && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-sm font-semibold text-emerald-800">{result.length} invite link{result.length === 1 ? "" : "s"} created.</p>
            <div className="mt-2 max-h-40 space-y-1 overflow-auto">
              {result.map((inv) => (
                <div key={inv.link} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-ink-600">{inv.name} · {inv.email}</span>
                  <button onClick={() => { navigator.clipboard?.writeText(inv.link); toast("Link copied.", "success"); }} className="shrink-0 font-semibold text-brand-600 hover:underline">Copy link</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Right: pending invite status */}
      <Card variant="frosted" className="rounded-xl3 p-6">
        <Eyebrow>Invited - awaiting assessment</Eyebrow>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No pending invites. Invited students appear here until they complete their assessment, then move into the cohort list.</p>
        ) : (
          <div className="mt-3 divide-y divide-ink-200/60">
            {pending.map((inv) => (
              <div key={inv.token} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink-800">{inv.name}</div>
                  <div className="truncate text-xs text-ink-500">{inv.email}{inv.cohort ? ` · ${inv.cohort}` : ""}</div>
                </div>
                <Badge tone={inv.status === "completed" ? "success" : inv.status === "started" ? "warn" : "neutral"}>{inv.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
