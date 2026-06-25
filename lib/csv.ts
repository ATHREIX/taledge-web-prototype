// Client-side CSV download helper (browser only — uses Blob + a temp anchor).
// Used by the recruiter candidate export and the institute cohort export.

/** RFC-4180-ish escape: wrap in quotes if the value contains a comma, quote or
 *  newline, and double any embedded quotes. */
function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a CSV from an array of flat objects (keys → header row) and trigger a
 * download. No-op for an empty list. Returns the row count actually exported.
 */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]): number {
  if (typeof window === "undefined" || !rows.length) return 0;
  const headers = Object.keys(rows[0]);
  const body = rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n");
  const csv = `${headers.join(",")}\n${body}`;
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return rows.length;
}
