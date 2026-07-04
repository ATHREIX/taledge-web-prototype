"use client";

import { Section } from "@/components/glass";
import { Bar, ScoreRing } from "@/components/score-ring";
import { recruiterPool } from "@/lib/data";
import { authedFetch } from "@/lib/api-client";
import { downloadCsv } from "@/lib/csv";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from "@/components/motion";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { containerVariants } from "@/lib/motion";
import {
  PageShell,
  Card,
  Button,
  ButtonLink,
  Badge,
  Heading,
  Input,
  Textarea,
  Select,
  useToast,
  Drawer,
} from "@/components/ui";
import { DashboardHeader, KPIGrid, EmptyState } from "@/components/dashboard";

type Segment = "all" | "freshers" | "oneToThree";
type JobType = "all" | "job" | "internship";
type DnlaStatus = "all" | "available" | "pending";
type SortKey = "fit" | "success" | "technical" | "behavioural" | "recent";
type AdvancedChip =
  | "interviewReady"
  | "highSuccess"
  | "dnlaReady"
  | "noRedFlags"
  | "published"
  | "highDrive"
  | "strongInterpersonal"
  | "strongExecution"
  | "highResilience";

const activeJobs: {
  id: string;
  title: string;
  type: "job" | "internship";
  segment: string;
  location: string;
  reqs: number;
  applicants: number;
  shortlisted: number;
  minFit: number;
  status: string;
}[] = [];

const candidateMeta: Record<
  string,
  {
    experience: "Fresher" | "1-3 years";
    jobType: "Job" | "Internship";
    activeJobId: string;
    roleFit: string;
    interview: "Complete" | "Technical complete" | "Pending behavioural";
    dnla: "Available" | "Pending";
    dnlaSignals: string[];
    availability: string;
    notice: string;
    lastUpdated: string;
  }
> = {};

const advancedFilters: { id: AdvancedChip; label: string }[] = [
  { id: "published", label: "Published to me" },
  { id: "interviewReady", label: "Interview-ready" },
  { id: "highSuccess", label: "Success >= 75%" },
  { id: "dnlaReady", label: "DNLA available" },
  { id: "noRedFlags", label: "No red flags" },
  // DNLA group competencies (PRD §4.5 multi-criteria) - each ≥ 70/100.
  { id: "highDrive", label: "High drive / initiative" },
  { id: "strongInterpersonal", label: "Strong interpersonal" },
  { id: "strongExecution", label: "Strong execution" },
  { id: "highResilience", label: "High resilience" },
];


export default function Recruiter() {
  const [q, setQ] = useState("");
  const [minFit, setMinFit] = useState(0);
  const [minSuccess, setMinSuccess] = useState(0);
  const [segment, setSegment] = useState<Segment>("all");
  const [jobType, setJobType] = useState<JobType>("all");
  const [selectedJob, setSelectedJob] = useState("all");
  const [dnlaStatus, setDnlaStatus] = useState<DnlaStatus>("all");
  const [sort, setSort] = useState<SortKey>("fit");
  const [chips, setChips] = useState<AdvancedChip[]>([]);
  // ── Enterprise table UI state (presentation only) ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [quickView, setQuickView] = useState<any | null>(null);
  const { toast } = useToast();
  // Gate the data loaders on Firebase auth being restored - authedFetch only
  // attaches a token once auth.currentUser is set, so firing before auth is
  // ready 401s in enforced mode and silently leaves the demo seed in place.
  const { user, loading } = useAuth();

  // Live candidate pool from the durable talent store (seed today; real results
  // once candidates complete the interview flow). Seeded initial value so the
  // table renders instantly, then replaced with the fetched pool on mount.
  const [pool, setPool] = useState<any[]>(recruiterPool ?? []);
  // Recruiter's persisted job/internship postings + shortlist.
  const [jobs, setJobs] = useState<any[]>([]);
  const [shortlist, setShortlist] = useState<string[]>([]);
  // Post-a-job modal.
  const [showPostJob, setShowPostJob] = useState(false);
  const [postingJob, setPostingJob] = useState(false);
  const [jobForm, setJobForm] = useState({ title: "", type: "job", experience: "1-3", location: "", ctc: "", skills: "", description: "" });
  // Off-campus upload → quotation → pay → invite flow (PRD §4.5).
  const [showUpload, setShowUpload] = useState(false);
  const [uploadJobId, setUploadJobId] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ queued: number; batch: string; invites: { name: string; email: string; link: string }[]; emailsSent: number } | null>(null);
  // Live status of this recruiter's previously-sent invites (invited→started→completed).
  const [sentInvites, setSentInvites] = useState<{ token: string; name: string; email: string; status: string }[]>([]);
  const PRICE_PER_CANDIDATE = 499; // ₹ per off-campus assessment seat
  // Client mirror of the server PAYMENTS_ENABLED gate. Off (pilot default) ⇒
  // invites are free and the copy reflects that; on ⇒ a real charge is implied.
  const paymentsEnabled = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";

  useEffect(() => {
    // Wait for auth to restore (mirrors app/recruiter/shared/[token]/page.tsx),
    // then load - and refetch once auth flips from loading→ready. In enforced
    // mode a failed/empty response clears state instead of leaving the demo seed
    // masquerading as live data.
    if (loading) return;
    const enforced = process.env.NEXT_PUBLIC_AUTH_ENFORCED === "true";
    authedFetch("/api/recruiter/candidates")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && Array.isArray(d.candidates)) {
          setPool(d.candidates.map((r: any) => ({ ...r, poolId: r.studentId })));
        } else if (enforced) {
          setPool([]);
        }
      })
      .catch(() => { if (enforced) setPool([]); });
    authedFetch("/api/recruiter/jobs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && Array.isArray(d.jobs)) setJobs(d.jobs);
        else if (enforced) setJobs([]);
      })
      .catch(() => { if (enforced) setJobs([]); });
    authedFetch("/api/recruiter/shortlist")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && Array.isArray(d.candidateIds)) setShortlist(d.candidateIds);
        else if (enforced) setShortlist([]);
      })
      .catch(() => { if (enforced) setShortlist([]); });
  }, [user, loading]);

  // Load sent-invite statuses whenever the off-campus modal opens or a new
  // batch is sent, so the recruiter sees invited→started→completed progress.
  useEffect(() => {
    if (!showUpload) return;
    authedFetch("/api/recruiter/candidate-list")
      .then((r) => r.json())
      .then((d) => { if (d?.ok && Array.isArray(d.invites)) setSentInvites(d.invites); })
      .catch(() => {});
  }, [showUpload, uploadResult]);

  const enrichedPool = useMemo(() => {
    return (pool ?? []).map((candidate) => {
      const flags = candidate.flags ?? [];
      const meta = candidateMeta[candidate.studentId] ?? {};
      // Derive sensible per-row meta from the existing recruiterPool fields so
      // the table always renders even when candidateMeta has no entry.
      const interview: string =
        meta.interview ??
        (candidate.tech > 0 && candidate.behav > 0
          ? "Complete"
          : candidate.tech > 0
            ? "Technical complete"
            : "Pending behavioural");
      const dnla: string = meta.dnla ?? (candidate.fit >= 70 ? "Available" : "Pending");
      const experience: string =
        meta.experience ?? (candidate.success >= 75 ? "1-3 years" : "Fresher");
      const jobType: string =
        meta.jobType ?? (candidate.role.toLowerCase().includes("intern") ? "Internship" : "Job");
      const roleFit: string =
        meta.roleFit ??
        (candidate.fit >= 80
          ? "Strong role match"
          : candidate.fit >= 65
            ? "Solid role match"
            : "Emerging match");

      return {
        ...candidate,
        ...meta,
        flags,
        interview,
        dnla,
        experience,
        jobType,
        roleFit,
        // A real candidate's own posting link wins; fall back to demo metadata.
        activeJobId: (candidate as { jobId?: string }).jobId || meta.activeJobId || "all",
        dnlaSignals: meta.dnlaSignals ?? [],
        availability: meta.availability ?? "Available now",
        notice: meta.notice ?? "Immediate",
        lastUpdated: meta.lastUpdated ?? "Today",
      };
    });
  }, [pool]);

  const rows = useMemo(() => {
    return enrichedPool
      .filter((r) => r.fit >= minFit)
      .filter((r) => r.success >= minSuccess)
      .filter((r) => {
        if (!q) return true;
        const roleFit = r.roleFit ?? "";
        const dnlaSignals = r.dnlaSignals ?? [];
        return `${r.name} ${r.college} ${r.role} ${roleFit} ${dnlaSignals.join(" ")}`
          .toLowerCase()
          .includes(q.toLowerCase());
      })
      .filter((r) => {
        const experience = r.experience ?? "Fresher";
        if (segment === "freshers") return experience === "Fresher";
        if (segment === "oneToThree") return experience === "1-3 years";
        return true;
      })
      .filter((r) => {
        const type = r.jobType ?? "Job";
        if (jobType === "job") return type === "Job";
        if (jobType === "internship") return type === "Internship";
        return true;
      })
      .filter((r) => {
        if (selectedJob === "all") return true;
        const aj = r.activeJobId ?? "all";
        // General/published pool (unassigned) matches any posting; invitees match
        // only the posting they came in through. So selecting a posting narrows
        // to that posting's candidates WITHOUT hiding the whole discoverable pool.
        return aj === "all" || aj === selectedJob;
      })
      .filter((r) => {
        const dnla = r.dnla ?? "Pending";
        if (dnlaStatus === "available") return dnla === "Available";
        if (dnlaStatus === "pending") return dnla === "Pending";
        return true;
      })
      .filter((r) =>
        chips.includes("interviewReady") ? r.fit >= 70 && (r.interview ?? "Pending") === "Complete" : true
      )
      .filter((r) => (chips.includes("highSuccess") ? r.success >= 75 : true))
      .filter((r) => (chips.includes("dnlaReady") ? (r.dnla ?? "Pending") === "Available" : true))
      .filter((r) => (chips.includes("noRedFlags") ? (r.flags ?? []).length === 0 : true))
      .filter((r) => (chips.includes("published") ? !!r.published : true))
      // DNLA group competency filters (PRD §4.5 multi-criteria) - each ≥ 70/100.
      .filter((r) => (chips.includes("highDrive") ? (r.dnlaGroups?.achievement ?? 0) >= 70 : true))
      .filter((r) => (chips.includes("strongInterpersonal") ? (r.dnlaGroups?.interpersonal ?? 0) >= 70 : true))
      .filter((r) => (chips.includes("strongExecution") ? (r.dnlaGroups?.execution ?? 0) >= 70 : true))
      .filter((r) => (chips.includes("highResilience") ? (r.dnlaGroups?.resilience ?? 0) >= 70 : true))
      .sort((a, b) => {
        // Candidates who just published to recruiters surface first, so a freshly
        // published candidate is immediately visible (then the chosen sort).
        if (!!a.published !== !!b.published) return a.published ? -1 : 1;
        if (a.published && b.published && a.publishedAt !== b.publishedAt) return (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
        if (sort === "technical") return b.tech - a.tech;
        if (sort === "behavioural") return b.behav - a.behav;
        if (sort === "success") return b.success - a.success;
        if (sort === "recent") return recencyScore(b.lastUpdated ?? "Today") - recencyScore(a.lastUpdated ?? "Today");
        return b.fit - a.fit;
      });
  }, [chips, dnlaStatus, enrichedPool, jobType, minFit, minSuccess, q, segment, selectedJob, sort]);

  const shortlisted = rows.filter((r) => r.fit >= 72 && r.success >= 70);
  const dnlaAvailable = enrichedPool.filter((r) => (r.dnla ?? "Pending") === "Available").length;
  const avgFit = enrichedPool.length
    ? Math.round(enrichedPool.reduce((sum, r) => sum + r.fit, 0) / enrichedPool.length)
    : 0;
  const avgSuccess = enrichedPool.length
    ? Math.round(enrichedPool.reduce((sum, r) => sum + r.success, 0) / enrichedPool.length)
    : 0;

  // Map persisted postings → the job-card shape, deriving applicant/shortlist
  // counts from the live candidate pool so the card reflects real matching.
  const jobCards = useMemo(
    () =>
      jobs.map((j) => {
        const seg = j.experience === "1-3" ? "1–3 years" : "Fresher";
        // Real per-job linkage (same rule as the table filter ~224-229): the
        // general/discoverable pool (activeJobId "all") counts toward every
        // posting; invitees count only for the posting they came in through. So a
        // brand-new posting shows 0 of its own (non-general) applicants instead of
        // a fabricated experience-band count.
        const linkedToJob = (c: any) => {
          const aj = c.activeJobId ?? "all";
          return aj === "all" || aj === j.id;
        };
        const applicants = enrichedPool.filter(linkedToJob).length;
        const shortlistedN = enrichedPool.filter(
          (c) => linkedToJob(c) && shortlist.includes(c.studentId)
        ).length;
        return {
          id: j.id,
          title: j.title,
          type: j.type,
          segment: seg,
          location: j.location || "Remote / Hybrid",
          reqs: Math.max(1, (j.skills?.length ?? 0)),
          applicants,
          shortlisted: shortlistedN,
          minFit: 70,
          status: j.status === "open" ? "Live" : "Closed",
        };
      }),
    [jobs, enrichedPool, shortlist]
  );

  // Auto-select the first posting when the off-campus invite modal opens, so the
  // recruiter doesn't have to manually pick a role before generating interview
  // invite links. They can still change it; the placeholder stays as a fallback.
  useEffect(() => {
    if (showUpload && !uploadJobId && jobCards.length > 0) {
      setUploadJobId(jobCards[0].id);
    }
  }, [showUpload, jobCards, uploadJobId]);

  // Top & trending colleges (PRD §4.5) - ranked by average candidate Fit Score
  // across the live pool, with the candidate count for context.
  const trendingColleges = useMemo(() => {
    const byCollege = new Map<string, { sum: number; count: number }>();
    for (const r of enrichedPool) {
      const c = (r.college as string) || "Unknown";
      const cur = byCollege.get(c) ?? { sum: 0, count: 0 };
      cur.sum += r.fit;
      cur.count += 1;
      byCollege.set(c, cur);
    }
    return Array.from(byCollege.entries())
      .map(([name, { sum, count }]) => ({ name, avg: Math.round(sum / count), count }))
      .sort((a, b) => b.avg - a.avg || b.count - a.count)
      .slice(0, 6);
  }, [enrichedPool]);

  // Publish a job (1–3 yr) or internship (fresher) posting (PRD §4.5).
  const submitJob = async () => {
    if (!jobForm.title.trim()) { toast("Add a role title first.", "info"); return; }
    setPostingJob(true);
    try {
      const res = await authedFetch("/api/recruiter/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobForm),
      });
      const data = await res.json();
      if (data?.ok && data.job) {
        setJobs((j) => [data.job, ...j]);
        setShowPostJob(false);
        setJobForm({ title: "", type: "job", experience: "1-3", location: "", ctc: "", skills: "", description: "" });
        toast(`${data.job.type === "internship" ? "Internship" : "Job"} posted.`, "success");
      } else {
        toast("Could not post the role. Please try again.", "info");
      }
    } catch {
      toast("Could not post the role. Please try again.", "info");
    } finally {
      setPostingJob(false);
    }
  };

  // Export candidate rows to a real CSV file (PRD §4.5 candidate intelligence).
  const exportRows = (data: any[], name: string) => {
    const n = downloadCsv(
      name,
      data.map((r) => ({
        Name: r.name,
        College: r.college,
        Role: r.role,
        Experience: (r.experience === "1-3" ? "1-3 years" : r.experience === "fresher" ? "Fresher" : r.experience) ?? "",
        Fit: r.fit,
        Technical: r.tech,
        Behavioural: r.behav,
        Success: `${r.success}%`,
        DNLA: r.dnla ?? (r.dnlaReady ? "Available" : "Pending"),
        Status: r.status ?? "",
        Flags: (r.flags ?? []).join("; "),
      }))
    );
    toast(n ? `Exported ${n} candidate${n === 1 ? "" : "s"} to CSV.` : "Nothing to export.", n ? "success" : "info");
  };

  // Close (delete) a posting (owner-scoped on the server). authedFetch never
  // throws on a non-2xx (e.g. a 404 on uid-mismatch), so we reconcile against
  // res.ok / the response body and roll the posting back if it wasn't deleted.
  const removeJob = async (id: string) => {
    const removed = jobs.find((x) => x.id === id);
    setJobs((j) => j.filter((x) => x.id !== id)); // optimistic
    try {
      const res = await authedFetch(`/api/recruiter/jobs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok !== false) {
        toast("Posting closed.", "info");
      } else {
        if (removed) setJobs((j) => [removed, ...j]); // rollback
        toast("Could not close the posting.", "info");
      }
    } catch {
      if (removed) setJobs((j) => [removed, ...j]); // rollback
      toast("Could not close the posting.", "info");
    }
  };

  // Persist the currently-selected candidates into the recruiter's shortlist.
  const shortlistSelected = async () => {
    const ids = Array.from(
      new Set(rows.filter((r) => selected.has(r.poolId)).map((r) => r.studentId))
    );
    const prev = shortlist;
    const next = Array.from(new Set([...shortlist, ...ids]));
    setShortlist(next); // optimistic
    try {
      const res = await authedFetch("/api/recruiter/shortlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds: next }),
      });
      const data = await res.json();
      if (data?.ok) {
        setShortlist(data.candidateIds);
        toast(`Added ${ids.length} to your shortlist (${data.candidateIds.length} total).`, "success");
        setSelected(new Set());
      } else {
        setShortlist(prev); // rollback - the save did not persist
        toast("Could not save the shortlist. Please try again.", "info");
      }
    } catch {
      setShortlist(prev); // rollback - the save did not persist
      toast("Could not save the shortlist. Please try again.", "info");
    }
  };

  // Parse the pasted off-campus list ("Name, email" / "Name <email>" / "email"
  // per line) into invite candidates with a valid email.
  const parsedUploads = useMemo(() => {
    return uploadText
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const email = line.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] ?? "";
        let name = line.replace(email, "").replace(/[,<>]/g, "").trim();
        if (!name) name = email.split("@")[0] || "Candidate";
        return { name, email, experienceBand: "1-3" as const };
      })
      .filter((c) => c.email);
  }, [uploadText]);

  // Quotation + (demo) pay + send assessment/interview invite links (PRD §4.5).
  const sendInvites = async () => {
    if (!uploadJobId) { toast("Select which role these candidates are for.", "info"); return; }
    if (parsedUploads.length === 0) { toast("Add at least one candidate (name + email).", "info"); return; }
    setUploading(true);
    try {
      const res = await authedFetch("/api/recruiter/candidate-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: uploadJobId, paid: true, candidates: parsedUploads }),
      });
      const data = await res.json();
      if (data?.ok && data.status === "links_queued") {
        const sent = data.emailsSent ?? 0;
        setUploadResult({ queued: data.queued, batch: data.inviteBatchId, invites: data.invites ?? [], emailsSent: sent });
        toast(
          sent > 0
            ? `${sent} invite email${sent === 1 ? "" : "s"} sent automatically.`
            : `${data.queued} invite link${data.queued === 1 ? "" : "s"} generated.`,
          "success"
        );
      } else if (data?.status === "payment_required") {
        toast("Payment is required before links are sent.", "info");
      } else {
        toast("Could not send the invites. Please try again.", "info");
      }
    } catch {
      toast("Could not send the invites. Please try again.", "info");
    } finally {
      setUploading(false);
    }
  };

  function toggleChip(chip: AdvancedChip) {
    setChips((current) =>
      current.includes(chip) ? current.filter((item) => item !== chip) : [...current, chip]
    );
  }

  // ── Selection (bulk actions) ──
  // Identity is per-row (poolId), not per-candidate (studentId) - the pool can
  // list the same candidate for two roles, and keying selection on studentId
  // made those duplicate rows toggle together and mis-count the bulk selection.
  const visibleIds = rows.map((r) => r.poolId);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visibleIds.some((id) => selected.has(id));
  const toggleAll = () =>
    setSelected(() => (allSelected ? new Set() : new Set(visibleIds)));
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // ── Sortable column headers (drive the existing `sort` state) ──
  const setSortKey = (key: SortKey) => setSort(key);

  // ── Active-filter chip summary (each chip resets just that filter) ──
  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (q) activeFilters.push({ key: "q", label: `Search: "${q}"`, clear: () => setQ("") });
  if (minFit !== 0) activeFilters.push({ key: "fit", label: `Fit ≥ ${minFit}`, clear: () => setMinFit(0) });
  if (minSuccess !== 0) activeFilters.push({ key: "succ", label: `Success ≥ ${minSuccess}%`, clear: () => setMinSuccess(0) });
  if (segment !== "all") activeFilters.push({ key: "seg", label: segment === "freshers" ? "Freshers" : "1–3 yrs", clear: () => setSegment("all") });
  if (jobType !== "all") activeFilters.push({ key: "jt", label: jobType === "job" ? "Jobs" : "Internships", clear: () => setJobType("all") });
  if (dnlaStatus !== "all") activeFilters.push({ key: "dnla", label: `DNLA: ${dnlaStatus === "available" ? "Ready" : "Pending"}`, clear: () => setDnlaStatus("all") });
  chips.forEach((c) => {
    const def = advancedFilters.find((a) => a.id === c);
    if (def) activeFilters.push({ key: c, label: def.label, clear: () => toggleChip(c) });
  });

  const rowPad = density === "compact" ? "py-2.5" : "py-5";
  const avatarSize = density === "compact" ? "h-9 w-9" : "h-12 w-12";

  return (
    <PageShell width="wide" className="pb-32">
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        {/* Header Section - shared dashboard header (matches student/coach) */}
        <DashboardHeader
          eyebrow="Recruiter Console"
          title="Hiring Intelligence"
          description="Command center for jobs, internships, candidate pools, and deep analytics. Manage role fit and success probability effortlessly."
          actions={
            <>
              <Button type="button" variant="ghost" className="group" onClick={() => { setShowUpload(true); setUploadResult(null); }}>
                <IconUpload className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" /> Upload candidates
              </Button>
              <Button type="button" variant="primary" className="group" onClick={() => setShowPostJob(true)}>
                Post job / internship
                <IconArrow className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </>
          }
        />

        {/* KPIs - shared KPIGrid/KPICard */}
        <KPIGrid
          items={[
            { label: "Active postings", value: `${jobCards.length}`, hint: jobCards.length ? "Live job & internship postings" : "Post a job to start matching", tone: "brand", icon: <IconPost className="w-4 h-4" /> },
            { label: "Shortlist-ready", value: `${shortlisted.length}`, hint: "Fit >= 72 and success >= 70%", tone: "success", icon: <IconTarget className="w-4 h-4" /> },
            { label: "Avg Fit Score", value: `${avgFit}`, hint: `Avg success ${avgSuccess}%`, tone: "brand", icon: <IconGauge className="w-4 h-4" /> },
            { label: "DNLA imports", value: `${dnlaAvailable}/${enrichedPool.length}`, hint: "Available after provider import", tone: "neutral", icon: <IconShield className="w-4 h-4" /> },
          ]}
        />
      </motion.div>

      {/* Jobs Section */}
      <motion.div
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        className="mb-16"
      >
        <div className="flex items-center justify-between mb-8">
          <Heading as="h2" className="text-2xl flex items-center gap-3">
            <span className="p-2 bg-brand-100 rounded-xl2 text-brand-600"><IconPost className="w-5 h-5"/></span>
            Hiring Demand Surface
          </Heading>
        </div>
        {jobCards.length === 0 ? (
          <EmptyState
            icon={<IconPost className="w-6 h-6" />}
            title="No active postings"
            description="Post a job or internship to start matching candidates against your hiring demand."
            action={<Button type="button" variant="primary" onClick={() => setShowPostJob(true)}>Post your first role</Button>}
          />
        ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {jobCards.map((job, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -4, scale: 1.01 }}
              key={job.id}
            >
              <Card variant="frosted" hover className="relative overflow-hidden p-6">
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div>
                    <Badge tone={job.status === "Live" ? "success" : "warn"}>{job.status}</Badge>
                    <h3 className="mt-3 text-lg font-bold text-ink-900">{job.title}</h3>
                    <p className="mt-1 text-sm font-medium text-ink-500">
                      {job.type === "job" ? "Full-time" : "Internship"} · {job.segment}
                    </p>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl2 bg-ink-100 text-sm font-bold text-ink-700 ring-1 ring-inset ring-ink-200">
                    {job.reqs}
                  </span>
                </div>
                <div className="space-y-3 mb-8">
                  <MetricRow label="Applicants" value={`${job.applicants}`} />
                  <MetricRow label="Shortlisted" value={`${job.shortlisted}`} />
                  <MetricRow label="Min Fit Score" value={`${job.minFit}`} />
                  <MetricRow label="Location" value={job.location} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => removeJob(job.id)}>Close</Button>
                  <Button type="button" variant="primary" size="md" className="flex-1" onClick={() => toast("Candidate invites are sent after the paid upload step.", "info")}>Invite</Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
        )}
      </motion.div>

      {/* Filters Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="mb-16"
      >
        <Card variant="default" className="rounded-xl2 p-6 sm:p-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <Heading as="h2" className="text-2xl flex items-center gap-3">
              <span className="p-2 bg-brand-100 rounded-xl2 text-brand-600"><IconFilter className="w-5 h-5"/></span>
              Candidate Discovery
            </Heading>
            <Button
              type="button"
              variant="link"
              onClick={() => { setQ(""); setMinFit(0); setMinSuccess(0); setSegment("all"); setJobType("all"); setSelectedJob("all"); setDnlaStatus("all"); setSort("fit"); setChips([]); }}
              className="text-ink-500 hover:text-ink-900"
            >
              Clear filters
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4 mb-8">
            <FilterField label="Search" htmlFor="recruiter-search">
              <input id="recruiter-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, college, role..." className="w-full rounded-xl2 border-0 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200 focus:ring-2 focus:ring-brand-600 transition-all placeholder:text-ink-400" />
            </FilterField>
            <FilterField label="Posting" htmlFor="recruiter-posting">
              <select id="recruiter-posting" value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} className="w-full rounded-xl2 border-0 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200 focus:ring-2 focus:ring-brand-600 transition-all">
                <option value="all">All postings</option>
                {jobCards.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
              </select>
            </FilterField>
            <FilterField label="Experience">
              <SegmentedControl ariaLabel="Experience" options={[["all", "All"], ["freshers", "Freshers"], ["oneToThree", "1-3 yrs"]]} value={segment} onChange={(v) => setSegment(v as Segment)} />
            </FilterField>
            <FilterField label="Opening Type">
              <SegmentedControl ariaLabel="Opening Type" options={[["all", "All"], ["job", "Jobs"], ["internship", "Interns"]]} value={jobType} onChange={(v) => setJobType(v as JobType)} />
            </FilterField>
            <FilterField label="Min Fit Score" htmlFor="recruiter-min-fit">
              <RangeControl id="recruiter-min-fit" ariaLabel="Min Fit Score" value={minFit} min={0} max={95} onChange={setMinFit} />
            </FilterField>
            <FilterField label="Min Success Prob" htmlFor="recruiter-min-success">
              <RangeControl id="recruiter-min-success" ariaLabel="Min Success Prob" value={minSuccess} min={0} max={95} onChange={setMinSuccess} suffix="%" />
            </FilterField>
            <FilterField label="DNLA Status">
              <SegmentedControl ariaLabel="DNLA Status" options={[["all", "All"], ["available", "Ready"], ["pending", "Pending"]]} value={dnlaStatus} onChange={(v) => setDnlaStatus(v as DnlaStatus)} />
            </FilterField>
            <FilterField label="Sort By" htmlFor="recruiter-sort">
              <select id="recruiter-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-full rounded-xl2 border-0 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200 focus:ring-2 focus:ring-brand-600 transition-all">
                <option value="fit">Fit Score</option>
                <option value="success">Success Probability</option>
                <option value="technical">Technical</option>
                <option value="behavioural">Behavioural</option>
                <option value="recent">Recently Updated</option>
              </select>
            </FilterField>
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t border-ink-200/50">
            {advancedFilters.map((chip) => {
              const isActive = chips.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => toggleChip(chip.id)}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-bold transition-all ${isActive ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200' : 'bg-white text-ink-600 hover:bg-ink-50 ring-1 ring-inset ring-ink-200'}`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Table Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <Heading as="h2" className="text-2xl flex items-center gap-3">
            <span className="p-2 bg-emerald-100 rounded-xl2 text-emerald-600"><IconTarget className="w-5 h-5"/></span>
            {rows.length} Candidates Matching
          </Heading>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5" role="group" aria-label="Row density">
              {(["comfortable", "compact"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDensity(d)}
                  aria-pressed={density === d}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold capitalize transition-colors ${density === d ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:text-ink-900"}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <Button type="button" variant="ghost" onClick={() => exportRows(rows, "taledge-candidates.csv")}><IconDownload className="w-4 h-4"/> Export</Button>
            <Button type="button" variant="primary" onClick={() => toast(`Generated group report for ${rows.length} candidates (demo)`, "info")}><IconReport className="w-4 h-4"/> Group Report</Button>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Active</span>
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.clear}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
              >
                {f.label}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            ))}
          </div>
        )}

        <Card variant="default" className="rounded-xl2 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="md:min-w-[1080px]">
              <div className="hidden md:grid grid-cols-12 bg-ink-50/50 px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 border-b border-ink-200/50">
                <div className="col-span-3 flex items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label="Select all candidates"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-ink-300 accent-brand-600"
                  />
                  Candidate
                </div>
                <div className="col-span-2">Opening / Segment</div>
                <div className="col-span-1">
                  <button type="button" onClick={() => setSortKey("fit")} className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider transition-colors ${sort === "fit" ? "text-brand-700" : "text-ink-500 hover:text-ink-700"}`}>
                    Fit<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden className={sort === "fit" ? "opacity-100" : "opacity-40"}><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                </div>
                <div className="col-span-2">
                  <button type="button" onClick={() => setSortKey("technical")} className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider transition-colors ${sort === "technical" ? "text-brand-700" : "text-ink-500 hover:text-ink-700"}`}>
                    Interview<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden className={sort === "technical" ? "opacity-100" : "opacity-40"}><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={() => setSortKey("success")} className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider transition-colors ${sort === "success" ? "text-brand-700" : "text-ink-500 hover:text-ink-700"}`}>
                    Success<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden className={sort === "success" ? "opacity-100" : "opacity-40"}><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                </div>
                <div className="col-span-2">DNLA / Role Fit</div>
                <div className="col-span-1 text-right">Action</div>
              </div>
              <div className="divide-y divide-ink-100">
                <AnimatePresence>
                  {rows.map((r, idx) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: Math.min(idx, 8) * 0.03 }}
                      key={r.poolId}
                      className={`flex flex-col gap-3 md:grid md:grid-cols-12 md:items-center md:gap-0 px-6 ${rowPad} text-sm transition-colors group ${selected.has(r.poolId) ? "bg-brand-50/50" : "hover:bg-ink-50/60"}`}
                    >
                      <div className="col-span-3 flex min-w-0 items-center gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.name}`}
                          checked={selected.has(r.poolId)}
                          onChange={() => toggleOne(r.poolId)}
                          className="h-4 w-4 shrink-0 rounded border-ink-300 accent-brand-600"
                        />
                        <div className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-xl2 bg-gradient-to-br from-brand-600 to-accent-500 text-sm font-bold text-white shadow-sm`}>
                          {initials(r.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-bold text-ink-900 group-hover:text-brand-600 transition-colors">{r.name}</span>
                            {r.verified && (
                              <span title="Authenticated account" className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700">
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                                Verified
                              </span>
                            )}
                            {r.published && (
                              <span className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">Published</span>
                            )}
                          </div>
                          <div className="truncate text-xs font-medium text-ink-500">{r.college}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-600">{r.experience ?? "Fresher"}</span>
                            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-600">{r.availability ?? "Available now"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 pr-4">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-400 md:hidden">Opening / Segment</span>
                        <div className="font-bold text-ink-900 truncate">{r.role}</div>
                        <div className="mt-1 text-xs font-medium text-ink-500 truncate">{postingTitle(r.activeJobId ?? "all")}</div>
                      </div>
                      <div className="col-span-1 flex items-center justify-between md:block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 md:hidden">Fit</span>
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl2 bg-white text-xl font-black text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200">
                          {r.fit}
                        </div>
                      </div>
                      <div className="col-span-2 space-y-2.5 pr-6">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400 md:hidden">Interview</span>
                        <ScoreBarLine label="Tech" value={r.tech} />
                        <ScoreBarLine label="Behav" value={r.behav} />
                      </div>
                      <div className="col-span-1 flex items-center justify-between md:block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 md:hidden">Success</span>
                        <span className={`inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs font-bold ${r.success >= 75 ? 'bg-emerald-100 text-emerald-700' : r.success >= 65 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                          {r.success}%
                        </span>
                      </div>
                      <div className="col-span-2 pr-4">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-400 md:hidden">DNLA / Role Fit</span>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${(r.dnla ?? 'Pending') === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            DNLA {r.dnla ?? 'Pending'}
                          </span>
                          {(r.flags ?? [])[0] && (
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${r.flags[0].toLowerCase().includes('flag') || r.flags[0].toLowerCase().includes('defensive') ? 'bg-rose-100 text-rose-700' : 'bg-brand-100 text-brand-700'}`}>
                              {r.flags[0]}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs font-bold text-ink-600">{r.roleFit ?? "Solid role match"}</div>
                      </div>
                      <div className="col-span-1 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setQuickView(r)}
                          aria-label={`Quick view ${r.name}`}
                          className="grid h-8 w-8 place-items-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-brand-600"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
                        <ButtonLink
                          variant="ghost"
                          size="sm"
                          href={`/student/${r.studentId}/fit-score?view=recruiter`}
                          aria-label={`View ${r.name}'s Fit Score report`}
                        >
                          View
                        </ButtonLink>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {rows.length === 0 && (
                <div className="px-6 py-20 text-center">
                  <div className="mx-auto h-16 w-16 rounded-xl2 bg-ink-100 flex items-center justify-center text-ink-400 mb-4">
                    <IconFilter className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-ink-900">No candidates found</h3>
                  <p className="mt-2 text-sm text-ink-500">Try adjusting your filters or search terms.</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Sticky bulk-action bar (appears when rows are selected) */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-3xl border border-ink-200 bg-white px-3 py-2 shadow-[0_16px_44px_-18px_rgba(16,24,40,0.35)]">
            <span className="px-2 text-sm font-bold text-ink-900">{selected.size} selected</span>
            <span className="hidden h-5 w-px bg-ink-200 sm:block" />
            <Button type="button" variant="primary" size="sm" onClick={shortlistSelected}>
              <IconTarget className="w-4 h-4" /> Shortlist
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => exportRows(rows.filter((r) => selected.has(r.poolId)), "taledge-selected.csv")}>
              <IconDownload className="w-4 h-4" /> Export
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => toast(`Group report for ${selected.size} candidates (demo)`, "info")}>
              <IconReport className="w-4 h-4" /> Group report
            </Button>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Post a role modal (PRD §4.5) ── */}
      <Modal open={showPostJob} onClose={() => { if (!postingJob) setShowPostJob(false); }} label="Post a role">
            <Card variant="frosted" className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <Heading as="h3" className="text-xl">Post a role</Heading>
                <button type="button" aria-label="Close" onClick={() => setShowPostJob(false)} className="grid h-8 w-8 place-items-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  {([["job", "Job · 1–3 yrs"], ["internship", "Internship · Fresher"]] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setJobForm((f) => ({ ...f, type: v, experience: v === "internship" ? "fresher" : "1-3" }))}
                      className={`flex-1 rounded-xl2 px-3 py-2 text-sm font-bold transition-all ${jobForm.type === v ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <Input
                  aria-label="Role title"
                  value={jobForm.title}
                  onChange={(e) => setJobForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Role title (e.g. Backend Engineer)"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    aria-label="Location"
                    value={jobForm.location}
                    onChange={(e) => setJobForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="Location"
                  />
                  <Input
                    aria-label={jobForm.type === "internship" ? "Stipend" : "CTC range"}
                    value={jobForm.ctc}
                    onChange={(e) => setJobForm((f) => ({ ...f, ctc: e.target.value }))}
                    placeholder={jobForm.type === "internship" ? "Stipend" : "CTC range"}
                  />
                </div>
                <Input
                  aria-label="Key skills"
                  value={jobForm.skills}
                  onChange={(e) => setJobForm((f) => ({ ...f, skills: e.target.value }))}
                  placeholder="Key skills (comma separated)"
                />
                <Textarea
                  aria-label="Description"
                  value={jobForm.description}
                  onChange={(e) => setJobForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description (optional)"
                  rows={3}
                  className="resize-none"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setShowPostJob(false)} disabled={postingJob}>Cancel</Button>
                  <Button type="button" variant="primary" onClick={submitJob} disabled={postingJob}>
                    {postingJob ? "Posting…" : "Publish posting"}
                  </Button>
                </div>
              </div>
            </Card>
      </Modal>

      {/* ── Off-campus upload → quotation → pay → invite (PRD §4.5) ── */}
      <Modal open={showUpload} onClose={() => { if (!uploading) setShowUpload(false); }} label="Upload off-campus candidates">
            <Card variant="frosted" className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <Heading as="h3" className="text-xl">Off-campus candidate list</Heading>
                <button type="button" aria-label="Close" onClick={() => setShowUpload(false)} className="grid h-8 w-8 place-items-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
              {uploadResult ? (
                <div className="py-2">
                  <div className="text-center">
                    <div aria-hidden className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">✓</div>
                    <p className="text-sm font-bold text-ink-900">
                      {uploadResult.emailsSent > 0
                        ? `${uploadResult.emailsSent} invite${uploadResult.emailsSent === 1 ? "" : "s"} sent`
                        : `${uploadResult.queued} invite link${uploadResult.queued === 1 ? "" : "s"} generated`}
                    </p>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-ink-500">Each link starts the candidate at profile → DNLA → AI interview.</p>
                  </div>
                  {uploadResult.invites.length > 0 && (
                    <div className="mt-4 max-h-44 space-y-1.5 overflow-y-auto rounded-xl2 bg-ink-50/70 p-3 ring-1 ring-inset ring-ink-200/60">
                      {uploadResult.invites.map((inv) => (
                        <div key={inv.link} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-ink-800">{inv.name}</div>
                            <div className="truncate font-mono text-[10px] text-ink-400">{inv.link}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(inv.link).then(() => toast("Link copied.", "success")).catch(() => {})}
                            className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
                          >Copy</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {uploadResult.emailsSent > 0 ? (
                    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-700">
                      ✓ <b>{uploadResult.emailsSent} invite email{uploadResult.emailsSent === 1 ? "" : "s"} sent automatically.</b> The links below are saved for your records too.
                    </div>
                  ) : (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700">
                      Links are generated &amp; saved. <b>Add RESEND_API_KEY</b> to auto-send the emails - for now, copy &amp; send them.
                    </div>
                  )}
                  <div className="mt-3 flex justify-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => navigator.clipboard?.writeText(uploadResult.invites.map((i) => `${i.name}: ${i.link}`).join("\n")).then(() => toast("All links copied.", "success")).catch(() => {})}
                    >Copy all</Button>
                    <Button type="button" variant="primary" onClick={() => setShowUpload(false)}>Done</Button>
                  </div>
                </div>
              ) : jobCards.length === 0 ? (
                <div className="py-4 text-center">
                  <div aria-hidden className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">📋</div>
                  <p className="text-sm font-bold text-ink-900">Post a role first</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-ink-500">Off-campus invites attach to a job or internship. Create one, then come back to upload your candidate list.</p>
                  <div className="mt-5 flex justify-center gap-2">
                    <Button type="button" variant="ghost" onClick={() => setShowUpload(false)}>Cancel</Button>
                    <Button type="button" variant="primary" onClick={() => { setShowUpload(false); setShowPostJob(true); }}>Post a role</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="upload-role" className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Role (invites attach to a posting)</label>
                    <Select
                      id="upload-role"
                      value={uploadJobId}
                      onChange={(e) => setUploadJobId(e.target.value)}
                      className="mt-1"
                    >
                      <option value="">Select a posted role…</option>
                      {jobCards.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="upload-list" className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Candidates · one per line: Name, email</label>
                    <Textarea
                      id="upload-list"
                      value={uploadText}
                      onChange={(e) => setUploadText(e.target.value)}
                      rows={5}
                      placeholder={"Aarav Mehta, aarav@example.com\nDiya Sharma, diya@example.com"}
                      className="mt-1 resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl2 bg-ink-50/70 p-3 ring-1 ring-inset ring-ink-200/60">
                    <div className="text-xs text-ink-600">
                      <span className="font-bold text-ink-900">{parsedUploads.length}</span> candidate{parsedUploads.length === 1 ? "" : "s"}
                      {paymentsEnabled ? ` · ₹${PRICE_PER_CANDIDATE}/assessment seat` : " · assessment seats"}
                    </div>
                    <div className="text-base font-black text-ink-900">
                      {paymentsEnabled ? `₹${(parsedUploads.length * PRICE_PER_CANDIDATE).toLocaleString("en-IN")}` : "Free · pilot"}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" onClick={() => setShowUpload(false)} disabled={uploading}>Cancel</Button>
                    <Button type="button" variant="primary" onClick={sendInvites} disabled={uploading || parsedUploads.length === 0 || !uploadJobId}>
                      {uploading
                        ? "Processing…"
                        : `${paymentsEnabled ? "Pay & send" : "Send"} ${parsedUploads.length || ""} invite${parsedUploads.length === 1 ? "" : "s"}`}
                    </Button>
                  </div>
                  <p className="text-center text-[10px] text-ink-400">
                    {paymentsEnabled
                      ? "Confirms a real charge before assessment links are sent."
                      : "Free during the pilot - assessment invite links are sent immediately."}
                  </p>
                </div>
              )}

              {/* Live status of previously-sent invites (invited→started→completed). */}
              {sentInvites.length > 0 && (
                <div className="mt-4 border-t border-ink-200/60 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Sent invites · live status</p>
                  <div className="mt-2 max-h-44 space-y-1 overflow-auto">
                    {sentInvites.map((inv) => (
                      <div key={inv.token} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-ink-700">{inv.name} · {inv.email}</span>
                        <Badge tone={inv.status === "completed" ? "success" : inv.status === "started" ? "warn" : "neutral"}>{inv.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
      </Modal>

      {/* Candidate quick-view drawer */}
      <Drawer
        open={!!quickView}
        onClose={() => setQuickView(null)}
        title={quickView?.name ?? "Candidate"}
        width="md"
        footer={
          quickView && (
            <div className="w-full space-y-2">
              {/* Candidate reports access (PRD §4.5): consolidated Fit Score, the
                  AI interview report, and the core DNLA report. */}
              <div className="grid grid-cols-3 gap-2">
                <ButtonLink href={`/student/${quickView.studentId}/fit-score?view=recruiter`} variant="ghost" size="sm" className="justify-center">Fit Score</ButtonLink>
                <ButtonLink href={`/student/${quickView.studentId}/report/ai`} variant="ghost" size="sm" className="justify-center">AI report</ButtonLink>
                <ButtonLink href={`/student/${quickView.studentId}/report/dnla`} variant="ghost" size="sm" className="justify-center">DNLA</ButtonLink>
              </div>
              <ButtonLink href={`/student/${quickView.studentId}/fit-score?view=recruiter`} className="w-full justify-center">
                View Fit Score report
                <IconArrow className="w-4 h-4" />
              </ButtonLink>
            </div>
          )
        }
      >
        {quickView && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl2 bg-gradient-to-br from-brand-600 to-accent-500 text-sm font-bold text-white">
                {initials(quickView.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-ink-900">{quickView.name}</p>
                <p className="truncate text-sm text-ink-500">{quickView.role} · {quickView.college}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                ["Fit Score", String(quickView.fit)],
                ["Success", `${quickView.success}%`],
                ["DNLA", quickView.dnla ?? "Pending"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-ink-200 bg-white p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{l}</p>
                  <p className="mt-1 text-lg font-extrabold text-ink-900">{v}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Interview scores</p>
              <ScoreBarLine label="Technical" value={quickView.tech} />
              <ScoreBarLine label="Behavioural" value={quickView.behav} />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-ink-500">Experience</dt>
                <dd className="font-semibold text-ink-800">{quickView.experience ?? "Fresher"}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Availability</dt>
                <dd className="font-semibold text-ink-800">{quickView.availability ?? "Available now"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-ink-500">Role match</dt>
                <dd className="font-semibold text-ink-800">{quickView.roleFit ?? "-"}</dd>
              </div>
            </dl>

            {(quickView.flags ?? []).length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Signals</p>
                <div className="flex flex-wrap gap-1.5">
                  {(quickView.flags ?? []).map((f: string) => (
                    <span key={f} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Bottom Modules */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BottomCard
          icon={<IconUpload className="w-6 h-6"/>} title="Private hiring assessment"
          desc="Upload external candidates, issue invite links, collect evidence, compare against shared pools."
          action="Create batch" secAction="Pricing" delay={0.1}
          onAction={() => toast("Private hiring batches are coming soon in the live build.", "info")}
          onSecAction={() => toast("Pricing details are coming soon.", "info")}
        >
          <div className="space-y-3 my-6">
            <WorkflowStep label="1" title="Upload CSV / resumes" detail="Candidate details, role, email, experience." />
            <WorkflowStep label="2" title="Confirm credits" detail="Payment-gated invites before interviews." />
            <WorkflowStep label="3" title="Send secure links" detail="Unique links per candidate with expiry." />
          </div>
        </BottomCard>

        <BottomCard
          icon={<IconReport className="w-6 h-6"/>} title="Reports & Shortlisting"
          desc="Generate comprehensive analytics from your current filtered views."
          action="Generate report" delay={0.2}
          onAction={() => toast(`Generated group report for ${rows.length} candidates (demo)`, "info")}
        >
          <div className="flex items-center gap-5 my-6">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-brand-50">
              <svg
                role="img"
                aria-label={`${Math.round((shortlisted.length / Math.max(rows.length, 1)) * 100)}% of matching candidates are shortlist-ready`}
                className="absolute inset-0 h-full w-full -rotate-90 transform"
                viewBox="0 0 100 100"
              >
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-brand-100" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-brand-600" strokeDasharray={`${Math.round((shortlisted.length / Math.max(rows.length, 1)) * 100) * 2.51} 251`} strokeLinecap="round" />
              </svg>
              <div className="text-2xl font-black text-brand-900">{Math.round((shortlisted.length / Math.max(rows.length, 1)) * 100)}%</div>
            </div>
            <div>
              <div className="text-3xl font-black text-ink-900">{shortlist.length}</div>
              <div className="text-sm font-medium text-ink-500 leading-tight mt-1">Candidates in<br/>your shortlist</div>
            </div>
          </div>
          <div className="space-y-2 mb-6">
            <MetricRow label="Evidence" value="Resume, Interview, DNLA" />
            <MetricRow label="Action" value="Share with hiring manager" />
          </div>
        </BottomCard>

        <BottomCard
          icon={<IconLink className="w-6 h-6"/>} title="Top & Trending Colleges"
          desc="Colleges ranked by the average Fit Score of their candidates in your pool."
          action="View all" delay={0.3} secondaryBtn
          onAction={() => toast("Full college rankings open in the live build.", "info")}
        >
          <div className="space-y-3 my-6">
            {trendingColleges.length === 0 ? (
              <div className="rounded-xl2 bg-white/50 p-4 ring-1 ring-inset ring-ink-200/50 text-sm text-ink-500">
                No candidate data yet - colleges rank as candidates complete assessments.
              </div>
            ) : (
              trendingColleges.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between rounded-xl2 bg-white/50 p-3 shadow-sm ring-1 ring-inset ring-ink-200/50">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-ink-900">{i + 1}. {c.name}</div>
                    <div className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide mt-0.5">{c.count} candidate{c.count === 1 ? "" : "s"} · avg fit</div>
                  </div>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm ${c.avg >= 75 ? "bg-emerald-600" : c.avg >= 60 ? "bg-ink-900" : "bg-amber-600"}`}>
                    {c.avg}
                  </div>
                </div>
              ))
            )}
          </div>
        </BottomCard>
      </div>
    </PageShell>
  );
}

/**
 * Accessible modal shell: overlay + Escape close (respecting a busy guard via the
 * caller's onClose), body-scroll lock, focus-move-in, focus-trap, and focus-restore
 * (mirrors the Drawer pattern). Backdrop scrolls and the panel caps at 90dvh so
 * actions never clip on short screens.
 */
function Modal({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the effect on every render (which
  // would steal focus back into the modal while the user is typing).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const node = panelRef.current;
    const focusable = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null)
        : [];
    (focusable()[0] ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCloseRef.current(); return; }
      if (e.key === "Tab") {
        const f = focusable();
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-ink-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function FilterField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-500">{label}</label>
      {children}
    </div>
  );
}

function RangeControl({ id, ariaLabel, value, min, max, suffix = "", onChange }: { id?: string; ariaLabel?: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void; }) {
  return (
    <div className="flex items-center gap-4 bg-white/50 rounded-xl2 p-3 ring-1 ring-inset ring-ink-200/50 shadow-sm backdrop-blur-xl">
      <input id={id} aria-label={ariaLabel} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 h-2 bg-ink-200 rounded-lg appearance-none cursor-pointer accent-brand-600" />
      <span className="w-12 text-right text-lg font-black text-ink-900">{value}{suffix}</span>
    </div>
  );
}

function SegmentedControl({ options, value, onChange, ariaLabel }: { options: [string, string][]; value: string; onChange: (value: string) => void; ariaLabel?: string; }) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex rounded-xl2 bg-ink-200/50 p-1 backdrop-blur-xl ring-1 ring-inset ring-ink-200/50 shadow-inner">
      {options.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all ${value === id ? "bg-white text-brand-600 shadow-sm" : "text-ink-600 hover:text-ink-900"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function ScoreBarLine({ label, value }: { label: string; value: number }) {
  // Label column sizes to its content (min 44px) so long labels like
  // "Behavioural" aren't clipped or overlapped by the bar in the quick-view drawer.
  return (
    <div className="grid grid-cols-[minmax(44px,max-content)_1fr_34px] items-center gap-3">
      <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-200/50 shadow-inner">
        <motion.div initial={{ width: 0 }} whileInView={{ width: `${value}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500" />
      </div>
      <span className="text-right text-xs font-black text-ink-900">{value}</span>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm font-medium text-ink-500">{label}</span>
      <span className="text-sm font-bold text-ink-900">{value}</span>
    </div>
  );
}

function WorkflowStep({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div className="flex gap-4 rounded-xl2 bg-white/50 p-4 ring-1 ring-inset ring-ink-200/50 shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-black text-brand-600">
        {label}
      </span>
      <div>
        <div className="text-sm font-bold text-ink-900">{title}</div>
        <div className="mt-1 text-xs font-medium text-ink-500 leading-relaxed">{detail}</div>
      </div>
    </div>
  );
}

function BottomCard({ icon, title, desc, action, secAction, secondaryBtn, children, delay, onAction, onSecAction }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay }} className="h-full">
      <Card variant="frosted" className="flex flex-col h-full rounded-xl3 p-8 relative overflow-hidden">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl2 bg-ink-900 text-white shadow-panel mb-6">
          {icon}
        </div>
        <h3 className="text-xl font-bold text-ink-900">{title}</h3>
        <p className="mt-3 text-sm font-medium text-ink-600 leading-relaxed">{desc}</p>
        <div className="flex-1">{children}</div>
        <div className="mt-auto flex flex-wrap gap-3 pt-6">
          <Button
            type="button"
            variant={secondaryBtn ? "ghost" : "primary"}
            className="flex-1"
            onClick={onAction}
          >
            {action}
          </Button>
          {secAction && (
            <Button type="button" variant="ghost" onClick={onSecAction}>{secAction}</Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function initials(name: string) { return name.split(" ").map((p) => p[0]).join(""); }
function postingTitle(jobId: string) { return activeJobs.find((j) => j.id === jobId)?.title ?? "General pipeline"; }
function recencyScore(val: string) { if (val === "Today") return 4; if (val === "Yesterday") return 3; if (val.includes("2 days")) return 2; return 1; }

function IconBriefcase(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>; }
function IconUpload(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>; }
function IconTarget(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>; }
function IconLink(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>; }
function IconArrow(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>; }
function IconPost(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>; }
function IconGauge(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 14l4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>; }
function IconShield(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" /><path d="m9 12 2 2 4-4" /></svg>; }
function IconFilter(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" /></svg>; }
function IconDownload(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function IconReport(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>; }
