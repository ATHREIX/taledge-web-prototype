import { z } from "zod";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Taledge Firestore data model — single source of truth.
 * ─────────────────────────────────────────────────────────────────────────────
 *  This file is intentionally PURE: it imports only `zod`. No `firebase`,
 *  no `firebase-admin`, no `server-only`. That lets it be imported from:
 *    - client components, - server routes, - and the standalone seed script
 *  without dragging in environment-specific code. Keep it that way.
 *
 *  Every collection name lives in COLLECTIONS so call sites never hard-code
 *  strings (a single typo'd "candidate" vs "candidates" is how data layers rot).
 *  Every document schema is a zod schema so writes can be validated at the
 *  boundary — bad data never reaches Firestore. Types are inferred from the
 *  schemas, so the type and the validator can never drift apart.
 */

// ── Collection names — THE single source of truth ────────────────────────────
// Every collection actually written in production is listed here exactly once,
// and every store sources its name from this map (lib/talent-store COL, the
// session/scoring-audit/dnla/coaching/rate-limit stores). Do NOT hard-code a
// collection string anywhere else and do NOT keep a second list — that is how
// two registries drift apart. The STRING VALUES are load-bearing (they are the
// live Firestore collection ids); never change a value without a data migration.
export const COLLECTIONS = {
  users: "users",
  candidates: "candidates",
  examAspirants: "examAspirants",
  institutes: "institutes",
  recruiterJobs: "recruiterJobs",
  recruiterInvites: "recruiterInvites",
  recruiterShortlists: "recruiterShortlists",
  shareLinks: "shareLinks",
  interventions: "interventions",
  coachingSessions: "coachingSessions",
  dnlaSessions: "dnlaSessions",
  interviewSessions: "interviewSessions",
  scoringAudits: "scoringAudits",
  rateLimits: "rateLimits",
  codeTestCases: "codeTestCases",

  // ── Reserved: SEEDED by scripts/seed.ts for demo data, but NOT read by the
  //    current app (no runtime .collection() access). Kept so the seed script
  //    stays typed and the list is honest about what exists in the database;
  //    do not build new reads against these without a decision to make them
  //    first-class. (`reports` was removed — it was never written OR read.)
  organisations: "organisations",
  recruiters: "recruiters",
  coaches: "coaches",
  recruiterPool: "recruiterPool",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

// ── Roles ─────────────────────────────────────────────────────────────────────
// Mirrors lib/roles.ts. Kept as a literal here to avoid importing app code into
// the seed script's module graph.
export const ROLE_VALUES = ["candidate", "recruiter", "coach", "institute"] as const;
export const roleSchema = z.enum(ROLE_VALUES);
export type RoleName = z.infer<typeof roleSchema>;

// ── Shared field helpers ───────────────────────────────────────────────────────
const shortText = z.string().trim().max(120);
const longText = z.string().trim().max(2000);
// Timestamps are stored as ISO strings on the client path and Firestore
// Timestamps on the admin path; both round-trip through this loose schema.
const timestamp = z.union([z.string(), z.number(), z.any()]).optional();

const auditFields = {
  createdAt: timestamp,
  updatedAt: timestamp,
};

// ── User profile (users/{uid}) ─────────────────────────────────────────────────
// The canonical per-account record. `role` decides routing + access; `linkId`
// points at the demo/domain document this account drives during the pilot.
export const userProfileSchema = z.object({
  title: shortText.optional(),
  organisation: shortText.optional(),
  phone: shortText.optional(),
  location: shortText.optional(),
  bio: longText.optional(),
  avatar: shortText.optional(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const userDocSchema = z.object({
  uid: z.string().min(1).max(128),
  email: z.string().email().max(200),
  name: shortText,
  role: roleSchema,
  published: z.boolean().default(false),
  /** Demo/domain document this account is bound to (e.g. "candidate-001"). */
  linkId: z.string().max(120).optional(),
  profile: userProfileSchema.optional(),
  ...auditFields,
});
export type UserDoc = z.infer<typeof userDocSchema>;

/**
 * The subset a user may edit about themselves via PUT /api/profile.
 * Identity-defining fields (uid, email, role) are deliberately excluded — those
 * change only through auth/admin flows, never a profile form.
 */
export const userProfileEditableSchema = z
  .object({
    name: shortText.optional(),
    profile: userProfileSchema.optional(),
  })
  .strict();
export type UserProfileEditable = z.infer<typeof userProfileEditableSchema>;

// ── Domain documents ────────────────────────────────────────────────────────
// These mirror the shapes in lib/data.ts so seeded test data matches the UI.
// They are validated loosely (passthrough) on seed: the goal is a strong,
// stable contract for the fields the app reads, not a straitjacket on extras.

const fitSchema = z.object({
  technical: z.number(),
  behavioural: z.number(),
  fit: z.number(),
  successProbability: z.number(),
});

const dnlaScoreSchema = z.object({
  competency: z.string(),
  group: z.enum(["Achievement Dynamics", "Interpersonal Skills", "Execution", "Stress & Resilience"]),
  score: z.number(),
  benchmark: z.number(),
  insight: z.string(),
});

export const candidateDocSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    college: z.string().optional(),
    targetRole: z.string().optional(),
    fit: fitSchema.optional(),
    dnla: z.array(dnlaScoreSchema).optional(),
    status: z.string().optional(),
    published: z.boolean().default(false),
    ownerUid: z.string().optional(),
    ...auditFields,
  })
  .passthrough();
export type CandidateDoc = z.infer<typeof candidateDocSchema>;

export const examAspirantDocSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    exam: z.string().optional(),
    institute: z.string().optional(),
    ...auditFields,
  })
  .passthrough();
export type ExamAspirantDoc = z.infer<typeof examAspirantDocSchema>;

export const instituteDocSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(["placement", "exam"]).optional(),
    ...auditFields,
  })
  .passthrough();
export type InstituteDoc = z.infer<typeof instituteDocSchema>;

export const organisationDocSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    sector: z.string().optional(),
    ...auditFields,
  })
  .passthrough();
export type OrganisationDoc = z.infer<typeof organisationDocSchema>;

export const recruiterPoolDocSchema = z
  .object({
    id: z.string(),
    studentId: z.string(),
    name: z.string(),
    ...auditFields,
  })
  .passthrough();
export type RecruiterPoolDoc = z.infer<typeof recruiterPoolDocSchema>;

export const coachingSessionDocSchema = z
  .object({
    id: z.string(),
    studentId: z.string(),
    topic: z.string(),
    status: z.string().optional(),
    ownerUid: z.string().optional(),
    ...auditFields,
  })
  .passthrough();
export type CoachingSessionDoc = z.infer<typeof coachingSessionDocSchema>;
