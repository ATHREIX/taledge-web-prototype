/**
 * Stable fingerprint of the resume a round was conducted with — detects a
 * resume SWAP between interview and scoring (upload resume A → interview
 * grounds its questions in A → upload resume B → generate Fit Score → the
 * resume component silently scores B).
 *
 * Isomorphic (browser + server, no crypto import): the interview page
 * fingerprints the profile fields at interview start and stores the value
 * alongside the transcript; the fit-score page fingerprints the fields it is
 * about to submit; the server compares, flags a mismatch, and stores both in
 * the scoring-audit ledger. FNV-1a is enough here — the goal is change
 * detection in an honest flow, not adversarial collision resistance.
 *
 * Normalized (whitespace/case/order-insensitive on skills) so cosmetic
 * re-serialization does not trip it. No resume data at all → "" (callers
 * treat "" as "no fingerprint", never as a match or mismatch).
 */
export function resumeFingerprint(profile: {
  resumeSummary?: string | null;
  resumeSkills?: string[] | null;
  resumeProjects?: { title?: string; stack?: string[]; impact?: string }[] | null;
}): string {
  const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const summary = norm(profile.resumeSummary);
  const skills = (profile.resumeSkills || []).map(norm).filter(Boolean).sort();
  const projects = (profile.resumeProjects || [])
    .map((p) => `${norm(p?.title)}|${(p?.stack || []).map(norm).sort().join(",")}|${norm(p?.impact)}`)
    .filter((p) => p !== "||")
    .sort();
  if (!summary && !skills.length && !projects.length) return "";
  const input = JSON.stringify([summary, skills, projects]);

  // FNV-1a 32-bit, applied twice with different seeds for a 16-hex output.
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return fnv(0x811c9dc5) + fnv(0x9747b28c);
}
