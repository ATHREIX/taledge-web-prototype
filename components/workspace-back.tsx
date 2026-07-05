"use client";

import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui";

/**
 * "Back" to the candidate's workspace hub, in the CORRECT namespace. Pages under
 * /student/[id] are re-exported under /exam/[id] for exam aspirants, so a
 * hard-coded /student/... back link dropped exam aspirants into the wrong
 * namespace. Derives /exam vs /student from the live pathname.
 */
export function WorkspaceBack({ id, label = "Back" }: { id: string; label?: string }) {
  const pathname = usePathname();
  const base = pathname?.startsWith("/exam") ? "/exam" : "/student";
  return (
    <ButtonLink href={`${base}/${id}`} variant="ghost" size="sm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </ButtonLink>
  );
}
