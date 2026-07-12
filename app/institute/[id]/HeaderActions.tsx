"use client";

import { useState } from "react";
import { Button, ButtonLink, useToast } from "@/components/ui";
import { authedFetch } from "@/lib/api-client";
import { downloadCsv } from "@/lib/csv";

// Client island for the institute dashboard header actions. The page itself is
// a Server Component, so the interactive buttons (which need onClick) live here.
export function HeaderActions({
  isExam,
  cohort,
  instituteId,
  cohortRows,
}: {
  isExam: boolean;
  cohort: number;
  instituteId: string;
  cohortRows: Record<string, unknown>[];
}) {
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);

  const exportCohort = () => {
    const n = downloadCsv(`${instituteId}-cohort.csv`, cohortRows);
    toast(n ? `Exported ${n} learner${n === 1 ? "" : "s"} to CSV.` : "Nothing to export.", n ? "success" : "info");
  };

  // Generate a scoped, expiring recruiter access link for this institute (§4.6)
  // and copy it to the clipboard to share with a recruiter.
  const generateShareLink = async () => {
    setSharing(true);
    try {
      const res = await authedFetch("/api/institute/share-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instituteId }),
      });
      const data = await res.json();
      if (data?.ok && data.path) {
        const url = `${window.location.origin}${data.path}`;
        try {
          await navigator.clipboard.writeText(url);
          toast("Recruiter link copied - share it to give scoped access to this cohort.", "success");
        } catch {
          toast(`Recruiter link: ${url}`, "info");
        }
      } else {
        toast("Could not generate the recruiter link. Please try again.", "info");
      }
    } catch {
      toast("Could not generate the recruiter link. Please try again.", "info");
    } finally {
      setSharing(false);
    }
  };

  // The placement/exam toggle links to the two SEED demo tenants. For a real
  // institute admin those links point at tenants they don't administer, so
  // only render the toggle when the current workspace IS a seed tenant.
  const isSeedTenant = instituteId === "institute-placement" || instituteId === "institute-exam";

  return (
    <div className="flex flex-wrap gap-2">
      {/* Switch between the placement and competitive-exam institute dashboards (demo tenants only). */}
      {isSeedTenant && (
        <ButtonLink href={isExam ? "/institute/institute-placement" : "/institute/institute-exam"} variant="ghost" size="lg">
          {isExam ? "Placement institute" : "Exam institute"}
        </ButtonLink>
      )}
      <Button type="button" variant="ghost" size="lg" onClick={exportCohort}>
        <IconDownload /> Export cohort CSV
      </Button>
      {!isExam ? (
        <Button type="button" variant="primary" size="lg" onClick={generateShareLink} disabled={sharing}>
          {sharing ? "Generating…" : "Generate recruiter link"}
          <IconArrow />
        </Button>
      ) : (
        <ButtonLink href="#interventions" variant="primary" size="lg">
          Plan interventions
          <IconArrow />
        </ButtonLink>
      )}
    </div>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
