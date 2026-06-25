import "server-only";
import { logger } from "@/lib/logger";

/**
 * DNLA Partner API client (server-only).
 *
 * Implements the Backend Partner API from https://backend.dnla.com/api/documentation:
 *   - POST /partner-api/tan/create        → create a participant TAN + start_url
 *   - GET  /partner-api/results/{id}       → structured psychometric result (values)
 *   - GET  /partner-api/results/{id}/reports/{template} → PDF report
 *
 * Auth is a single partner `api_key` (query param). It NEVER leaves the server —
 * only the resulting `start_url` (which embeds the public TAN) is sent to the
 * browser. Configure via env:
 *   DNLA_API_KEY   (required to go live)
 *   DNLA_API_BASE  (default https://backend.dnla.com)
 *   DNLA_AREA      (product/area, e.g. "ESK")
 */

const DEFAULT_BASE = "https://backend.dnla.com";

export function getDnlaApiKey(): string | null {
  const k = process.env.DNLA_API_KEY?.trim();
  return k ? k : null;
}
export function getDnlaBase(): string {
  return (process.env.DNLA_API_BASE?.trim() || DEFAULT_BASE).replace(/\/+$/, "");
}
export function getDnlaArea(): string {
  return process.env.DNLA_API_AREA?.trim() || process.env.DNLA_AREA?.trim() || "ESK";
}
/** True once the partner key is configured. Until then callers should no-op. */
export function isDnlaConfigured(): boolean {
  return getDnlaApiKey() !== null;
}

/* ----------------------------- response shapes ---------------------------- */
// Mirrors the OpenAPI spec exactly (see screenshots / api-docs.json).

export type DnlaTan = {
  tan_nummer: string;
  start_url: string;
};

export type DnlaCreateTanResponse = {
  status: string; // "ok"
  tan: DnlaTan;
};

export type DnlaReportItem = { url: string; label: string };

export type DnlaResults = {
  tan: string;
  finished_at: string; // ISO date-time
  profile: string;
  /** Factor keys → display values; keys vary by product type (e.g. esk_*). */
  values: Record<string, string | number>;
  reports: DnlaReportItem[];
  /** Optional blocks such as language/logic/pc tests: { result, max }. */
  additional_tests?: Record<string, unknown> | null;
};

export class DnlaError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "DnlaError";
    this.status = status;
  }
}

function withKey(url: string): string {
  const key = getDnlaApiKey();
  const u = new URL(url);
  if (key) u.searchParams.set("api_key", key);
  return u.toString();
}

/**
 * Create a participant TAN and start URL. The candidate is then sent to
 * `start_url` (DNLA-hosted questionnaire).
 */
export async function createTan(params: {
  email?: string;
  firstname?: string;
  lastname?: string;
  jobId?: string;
  jobAreaId?: string;
  area?: string;
}): Promise<DnlaCreateTanResponse> {
  const key = getDnlaApiKey();
  if (!key) throw new DnlaError("DNLA is not configured (DNLA_API_KEY missing).", 503);

  const body = {
    api_key: key, // the spec accepts api_key in the body OR query; send in body here
    area: params.area || getDnlaArea(),
    ...(params.email ? { email: params.email } : {}),
    ...(params.firstname ? { firstname: params.firstname } : {}),
    ...(params.lastname ? { lastname: params.lastname } : {}),
    ...(params.jobId ? { job_id: params.jobId } : {}),
    ...(params.jobAreaId ? { job_area_id: params.jobAreaId } : {}),
  };

  const res = await fetch(`${getDnlaBase()}/partner-api/tan/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 403 = invalid api_key / no price model for area; 422 = validation error.
    logger.error("[dnla] tan/create failed", { status: res.status, err: data?.error });
    throw new DnlaError(data?.error || `DNLA tan/create failed (${res.status})`, res.status);
  }
  if (!data?.tan?.tan_nummer || !data?.tan?.start_url) {
    throw new DnlaError("DNLA tan/create returned an unexpected shape.", 502);
  }
  return data as DnlaCreateTanResponse;
}

/**
 * Fetch the structured result document for a COMPLETED session.
 * `id` is DNLA's internal numeric session id (NOT the tan_nummer) — we learn it
 * from the completion webhook.
 */
export async function getResults(id: string | number): Promise<DnlaResults> {
  if (!getDnlaApiKey()) throw new DnlaError("DNLA is not configured (DNLA_API_KEY missing).", 503);

  const res = await fetch(withKey(`${getDnlaBase()}/partner-api/results/${id}`), {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 403 = session not owned by partner; 404 = unknown session id.
    logger.error("[dnla] results fetch failed", { id, status: res.status });
    throw new DnlaError(data?.error || `DNLA results fetch failed (${res.status})`, res.status);
  }
  return data as DnlaResults;
}

/**
 * Download a report (e.g. template "esk_zertifikat") as a PDF buffer.
 * Returns null if the report isn't available.
 */
export async function getReport(
  id: string | number,
  template: string
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  if (!getDnlaApiKey()) throw new DnlaError("DNLA is not configured (DNLA_API_KEY missing).", 503);

  const res = await fetch(
    withKey(`${getDnlaBase()}/partner-api/results/${id}/reports/${encodeURIComponent(template)}`),
    { method: "GET", headers: { Accept: "application/pdf" }, signal: AbortSignal.timeout(20000) }
  );
  if (!res.ok) {
    logger.error("[dnla] report fetch failed", { id, template, status: res.status });
    return null;
  }
  return {
    bytes: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") || "application/pdf",
  };
}
