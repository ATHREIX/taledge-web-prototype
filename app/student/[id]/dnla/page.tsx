"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { getStudent } from "@/lib/data";

type ImportStatus = "idle" | "queueing" | "queued" | "error";

export default function DnlaReport() {
  const params = useParams();
  const id = String(params.id);
  const s = getStudent(id);
  if (!s) notFound();

  const [status, setStatus] = useState<ImportStatus>("idle");
  const [message, setMessage] = useState("");

  async function queueImport() {
    setStatus("queueing");
    setMessage("");
    try {
      const response = await fetch("/api/dnla/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: id,
          track: "placement",
          requestedBy: "candidate",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || "Could not queue DNLA import.");
      }
      setStatus("queued");
      setMessage(`Import request queued. Reference: ${data.reportId}`);
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message || "DNLA import queue is unavailable.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              DNLA Import
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight">
              DNLA integration pending
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {s.name} can continue the Phase 1 assessment now. DNLA scoring will be
              imported after the licensed provider integration is connected; no
              placeholder psychometric scores are shown here.
            </p>
          </div>
          <Link href={`/student/${id}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">
            Back to workspace
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 py-8 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black">What is ready now</h2>
          <div className="mt-5 grid gap-3">
            {[
              "Candidate identity and track context",
              "Consent-controlled future import path",
              "Fit Score can run provisionally without DNLA",
              "Recruiter and institute views mark DNLA as pending until import",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black">Provider import queue</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use this action only to verify that the product workflow is wired. It
            does not create or display DNLA scores until the provider API is live.
          </p>
          <button
            type="button"
            onClick={queueImport}
            disabled={status === "queueing"}
            className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {status === "queueing" ? "Queueing..." : "Queue DNLA import"}
          </button>
          {message && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                status === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {message}
            </div>
          )}
          <Link
            href={`/student/${id}/interview/behavioural`}
            className="mt-3 block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-800"
          >
            Continue to behavioural interview
          </Link>
        </div>
      </section>
    </main>
  );
}
