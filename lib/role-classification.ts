/**
 * Is a target role / JD "technical"?
 *
 * TalEdge serves EVERY field — MBA, BA, BCom, design, sales, HR, finance, as
 * well as engineering. Round 1 used to be called "Technical Interview" and ran
 * technical/coding questions for everyone, which is wrong for a non-technical
 * candidate. This classifier lets the app:
 *   (a) label round 1 dynamically — "Technical Interview" vs "Skills Interview";
 *   (b) gate the coding challenge on/off;
 *   (c) tell the interview prompt which depth/style to run.
 *
 * It is a deterministic keyword match over the role title plus any parsed
 * résumé/JD skills. The interview PROMPT also self-adapts, so a miss here
 * degrades gracefully — a mislabelled role still gets a sensible interview.
 */

import { roleFamily } from "@/lib/interview-question-bank";

// Hard technical skills. A couple of these (even for a vague role title) mark
// the candidate as technical — a safety net for role titles roleFamily() reads
// as "general" but whose skills are clearly engineering.
const TECHNICAL_SKILL_HINTS = [
  "python", "java", "javascript", "typescript", "c++", "c#", "golang", " go ", "rust", "kotlin", "swift",
  "react", "node", "angular", "vue", "django", "spring", "kubernetes", "docker", "aws", "azure", "gcp",
  "sql", "nosql", "mongodb", "postgres", "mysql", "tensorflow", "pytorch", "pandas", "numpy", "scikit",
  "terraform", "linux", "graphql", "rest api", "microservices", "hadoop", "spark", "kafka", "redis",
];

/**
 * True when the role reads as technical. Source of truth is the existing
 * roleFamily() classifier (software / data families = technical); parsed skills
 * are a fallback so an engineering skill set still counts even when the title is
 * vague. Product / design / sales / finance / general → non-technical.
 */
export function isTechnicalRole(role?: string | null, skills?: string[] | null): boolean {
  const fam = roleFamily(role);
  if (fam === "software" || fam === "data") return true;
  const sk = (skills || []).map((s) => ` ${(s || "").toLowerCase()} `);
  const techSkillCount = sk.filter((s) => TECHNICAL_SKILL_HINTS.some((h) => s.includes(h))).length;
  return techSkillCount >= 2;
}

/** Round-1 display label: dynamic per the role's technicality. */
export function roundOneLabel(role?: string | null, skills?: string[] | null): string {
  return isTechnicalRole(role, skills) ? "Technical Interview" : "Skills Interview";
}

/** Short round-1 label (for tight chips / step tags). */
export function roundOneShort(role?: string | null, skills?: string[] | null): string {
  return isTechnicalRole(role, skills) ? "Technical" : "Skills";
}
