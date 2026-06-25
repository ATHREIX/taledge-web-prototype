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
 * Client-safe mirror of AUTH_ENFORCED (the server-only flag can't reach the
 * browser bundle). When auth is enforced, every signed-in user owns a
 * uid-keyed workspace; in the demo/pilot all roles share one seeded persona id
 * so the seeded data stays browsable without a real login.
 */
const AUTH_ENFORCED_PUBLIC = process.env.NEXT_PUBLIC_AUTH_ENFORCED === "true";

/**
 * The workspace id for a role — single source of truth for both nav and
 * post-auth routing, so a real signed-in recruiter never lands on the seeded
 * `recruiter-001` workspace.
 *  - enforced auth + real uid -> the user's own uid (their private workspace)
 *  - demo / no uid            -> the seeded persona id (candidate-001, …)
 */
export function workspaceId(role: Role, uid?: string | null): string {
  if (AUTH_ENFORCED_PUBLIC && uid) return uid;
  return roleDef(role).demoId;
}

/**
 * Where a user lands after auth.
 * - Candidates run the onboarding/assessment funnel first.
 * - Other roles go straight to their (org-level) workspace.
 */
export function workspacePath(role: Role, uid?: string | null): string {
  const id = workspaceId(role, uid);
  switch (role) {
    case "candidate":
      return `/student/${id}`;
    case "recruiter":
      return `/recruiter/${id}`;
    case "coach":
      return `/coach/${id}`;
    case "institute":
      return `/institute/${id}`;
    default:
      return `/student/${id}`;
  }
}

export function postAuthPath(role: Role, uid?: string): string {
  // Every role lands on the unified /dashboard hub after auth (Coursera/ERP
  // style: greeting + quick links + account menu). Their role workspace, the
  // interview funnel, profile, etc. are all reachable from there.
  return "/dashboard";
}
