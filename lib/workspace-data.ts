/**
 * Per-account browser state lives in localStorage under the `taledge:` prefix
 * (résumé/workspace profile, interview transcripts, reports, fit-scores, cached
 * role). It is NOT namespaced by uid, so it must be wiped when the signed-in
 * account changes or signs out — otherwise account B, on the same browser, sees
 * account A's résumé/journey as already completed.
 *
 * Two keys are device-level UI preferences, not account data, so they survive.
 */
const DEVICE_PREF_KEYS = new Set<string>([
  "taledge:command-open", // command-palette "seen" hint
  "taledge:interview-difficulty", // last chosen difficulty
]);

/**
 * Remove every per-account `taledge:` localStorage entry (keeping only the
 * device-level UI prefs above). Browser-only and best-effort.
 */
export function clearWorkspaceData(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("taledge:") && !DEVICE_PREF_KEYS.has(k)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* no-op: storage blocked / private mode */
  }
}
