"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/api-client";

/**
 * Live DNLA assessment state for a candidate workspace.
 *
 * Talks to the real partner-backed endpoints:
 *   POST /api/dnla/start   → create a TAN, get the DNLA-hosted `start_url`
 *   GET  /api/dnla/status  → owner-scoped poll; normalized axes once complete
 *
 * The DNLA questionnaire itself is hosted by the licensed provider (Germany) —
 * we only start it, deep-link the candidate to it, and consume the normalized
 * result once their completion webhook lands. Scores here are 0–100 (see
 * lib/dnla-mapping.ts); the 1–7 UI/Fit-Score contracts convert at their edge.
 */

export type DnlaLiveItem = {
  competency: string;
  group: string;
  score: number; // 0–100
  benchmark: number; // 0–100
  insight: string;
};

export type DnlaLiveData = {
  axes: Record<string, number>;
  baseline: number; // 0–100
  dnla: DnlaLiveItem[];
  strengths: string[];
  developmentAreas: string[];
  risks: string[];
  finishedAt: string | null;
};

/**
 * loading         – initial status poll in flight
 * not-configured  – provider key absent on this deployment (start returned 503)
 * none            – no assessment started yet for this candidate
 * pending         – questionnaire issued, awaiting the completion webhook
 * complete         – normalized result available
 * error           – start failed, or scoring failed after completion
 */
export type DnlaPhase =
  | "loading"
  | "not-configured"
  | "none"
  | "pending"
  | "complete"
  | "error";

const POLL_MS = 8000;

function toArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function useDnlaLive(candidateId: string) {
  const [phase, setPhase] = useState<DnlaPhase>("loading");
  const [data, setData] = useState<DnlaLiveData | null>(null);
  const [startUrl, setStartUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aliveRef = useRef(true);
  // Mirror phase into a ref so refresh()'s error branch can't clobber a real
  // terminal state (complete/error) on a transient network blip.
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const applyStatus = useCallback((d: any) => {
    if (!aliveRef.current) return;
    const status = String(d?.status || "none");
    setStartUrl(typeof d?.startUrl === "string" ? d.startUrl : null);
    if (status === "complete") {
      setData({
        axes: (d?.axes && typeof d.axes === "object" ? d.axes : {}) as Record<string, number>,
        baseline: Number(d?.baseline) || 0,
        dnla: Array.isArray(d?.dnla)
          ? d.dnla.map((it: any) => ({
              competency: String(it?.competency || ""),
              group: String(it?.group || "DNLA"),
              score: Number(it?.score) || 0,
              benchmark: Number(it?.benchmark) || 0,
              insight: String(it?.insight || ""),
            }))
          : [],
        strengths: toArray(d?.strengths),
        developmentAreas: toArray(d?.developmentAreas),
        risks: toArray(d?.risks),
        finishedAt: typeof d?.finishedAt === "string" ? d.finishedAt : null,
      });
      setPhase("complete");
    } else if (status === "pending") {
      setPhase("pending");
    } else if (status === "error") {
      setError("Your assessment could not be scored. Please restart it.");
      setPhase("error");
    } else {
      setPhase("none");
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await authedFetch(
        `/api/dnla/status?candidateId=${encodeURIComponent(candidateId)}`
      );
      if (!r.ok) {
        // status is owner-scoped and never 503s for config; a non-OK here means
        // no readable session yet — treat as "not started".
        if (aliveRef.current && phaseRef.current === "loading") setPhase("none");
        return;
      }
      const d = await r.json();
      applyStatus(d);
    } catch {
      if (aliveRef.current && phaseRef.current === "loading") setPhase("none");
    }
  }, [candidateId, applyStatus]);

  // Initial load.
  useEffect(() => {
    aliveRef.current = true;
    void refresh();
    return () => {
      aliveRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  // Poll only while pending; stop as soon as it resolves.
  useEffect(() => {
    if (phase !== "pending") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(() => void refresh(), POLL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [phase, refresh]);

  /** Create a DNLA session; returns the questionnaire URL to open (or null). */
  const start = useCallback(
    async (opts?: { firstname?: string; lastname?: string; email?: string }): Promise<string | null> => {
      setStarting(true);
      setError("");
      try {
        const r = await authedFetch("/api/dnla/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId, ...opts }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 503) {
          // Provider not configured on this deployment.
          setPhase("not-configured");
          return null;
        }
        if (!r.ok || !d?.ok || !d?.startUrl) {
          setError(d?.error || "Could not start the DNLA assessment. Please try again.");
          setPhase("error");
          return null;
        }
        setStartUrl(d.startUrl);
        setPhase("pending");
        return d.startUrl as string;
      } catch (e: any) {
        setError(e?.message || "Network error starting the assessment.");
        setPhase("error");
        return null;
      } finally {
        setStarting(false);
      }
    },
    [candidateId]
  );

  return { phase, data, startUrl, error, starting, start, refresh };
}

export type DnlaLive = ReturnType<typeof useDnlaLive>;
