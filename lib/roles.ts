/**
 * Role registry - the four services Taledge serves. Drives the register role
 * picker, post-auth routing, and marketing copy. Pure data (no JSX) so it can
 * be imported anywhere.
 */
export type Role = "candidate" | "recruiter" | "coach" | "institute";

export interface RoleDef {
  key: Role;
  label: string;
  initial: string;
  blurb: string;
  /** Seeded demo workspace id used when there is no real per-user record yet. */
  demoId: string;
}

export const ROLES: RoleDef[] = [
  {
    key: "candidate",
    label: "Candidate",
    initial: "C",
    blurb: "Get assessed by AI, earn a Fit Score, and follow a coaching pathway.",
    demoId: "candidate-001",
  },
  {
    key: "recruiter",
    label: "Recruiter",
    initial: "R",
    blurb: "Shortlist on verified interview evidence, not résumé keywords.",
    demoId: "recruiter-001",
  },
  {
    key: "coach",
    label: "Coach",
    initial: "T",
    blurb: "Run risk-ranked coaching sessions with every gap in view.",
    demoId: "coach-001",
  },
  {
    key: "institute",
    label: "Institute",
    initial: "I",
    blurb: "Make whole cohorts interview-ready with readiness heatmaps.",
    demoId: "institute-placement",
  },
];

export function roleDef(role: string | null | undefined): RoleDef {
  return ROLES.find((r) => r.key === role) ?? ROLES[0];
}

/**
 * Where a user lands after auth.
 * - Candidates run the onboarding/assessment funnel first.
 * - Other roles go straight to their (org-level) workspace.
 */
export function workspacePath(role: Role, uid?: string): string {
  switch (role) {
    case "candidate":
      // Pilot: all candidate stages (onboarding, DNLA, interview, fit-score) run
      // under ONE demo id so the funnel never splits across uid vs candidate-001.
      return `/student/candidate-001`;
    case "recruiter":
      return `/recruiter/recruiter-001`;
    case "coach":
      return `/coach/coach-001`;
    case "institute":
      return `/institute/institute-placement`;
    default:
      return `/student/candidate-001`;
  }
}

export function postAuthPath(role: Role, uid?: string): string {
  // Every role lands on the unified /dashboard hub after auth (Coursera/ERP
  // style: greeting + quick links + account menu). Their role workspace, the
  // interview funnel, profile, etc. are all reachable from there.
  return "/dashboard";
}
