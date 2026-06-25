"use client";

import { useState } from "react";
import { Card, Button, Badge, Heading, Eyebrow, useToast } from "@/components/ui";
import { authedFetch } from "@/lib/api-client";

type Intervention = {
  id: string;
  instituteId: string;
  title: string;
  category: string;
  audience: string;
  owner: string;
  status: "Planned" | "In progress" | "Completed";
  note: string;
  createdAt: number;
  updatedAt: number;
};

const STATUS_TONE: Record<Intervention["status"], "neutral" | "warn" | "success"> = {
  Planned: "neutral",
  "In progress": "warn",
  Completed: "success",
};

/**
 * Institute intervention planner + tracker (PRD §4 / §4.4): plan a targeted
 * intervention for the cohort / a batch / a learner, then advance its status
 * over time (Planned → In progress → Completed) to "track improvement".
 */
export function InterventionsPanel({
  instituteId,
  isExam,
  initial,
}: {
  instituteId: string;
  isExam: boolean;
  initial: Intervention[];
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<Intervention[]>(initial);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const categories = isExam
    ? ["Counselling", "Stress management", "Study plan", "Consistency", "Motivation"]
    : ["Coaching", "Communication", "Interview prep", "Behavioural", "Technical"];

  const [form, setForm] = useState({ title: "", category: categories[0], audience: "Whole cohort", owner: "", note: "" });

  const create = async () => {
    if (!form.title.trim()) { toast("Add an intervention title.", "info"); return; }
    setSaving(true);
    try {
      const res = await authedFetch("/api/institute/interventions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instituteId, ...form }),
      });
      const data = await res.json();
      if (data?.ok && data.intervention) {
        setItems((x) => [data.intervention, ...x]);
        setShow(false);
        setForm({ title: "", category: categories[0], audience: "Whole cohort", owner: "", note: "" });
        toast("Intervention planned.", "success");
      } else {
        toast("Could not save the intervention. Please try again.", "info");
      }
    } catch {
      toast("Could not save the intervention. Please try again.", "info");
    } finally {
      setSaving(false);
    }
  };

  const advance = async (iv: Intervention) => {
    const next: Intervention["status"] = iv.status === "Planned" ? "In progress" : "Completed";
    if (iv.status === "Completed") return;
    const prev = iv.status;
    setItems((x) => x.map((i) => (i.id === iv.id ? { ...i, status: next } : i))); // optimistic
    try {
      const res = await authedFetch("/api/institute/interventions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: iv.id, instituteId, status: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setItems((x) => x.map((i) => (i.id === iv.id ? { ...i, status: prev } : i)));
        toast("Could not update the status.", "info");
      }
    } catch {
      setItems((x) => x.map((i) => (i.id === iv.id ? { ...i, status: prev } : i)));
      toast("Could not update the status.", "info");
    }
  };

  return (
    <Card variant="frosted" className="rounded-xl3 p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Interventions</Eyebrow>
          <Heading as="h2" className="mt-1 text-2xl">Plan &amp; track interventions</Heading>
          <p className="mt-1 text-sm text-ink-500">
            {isExam
              ? "Counselling and support programs for at-risk aspirants - track each from planned to completed."
              : "Targeted training programs for development gaps - track each from planned to completed."}
          </p>
        </div>
        <Button type="button" variant="primary" size="lg" onClick={() => setShow(true)}>Plan intervention</Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white/50 p-8 text-center text-sm text-ink-500">
          No interventions yet. Plan one to start supporting {isExam ? "at-risk aspirants" : "students with development gaps"}.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((iv) => (
            <div key={iv.id} className="rounded-xl2 border border-ink-200/70 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone="brand">{iv.category}</Badge>
                    <Badge tone={STATUS_TONE[iv.status]}>{iv.status}</Badge>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-ink-900">{iv.title}</h3>
                  <p className="mt-0.5 text-xs text-ink-500">{iv.audience} · {iv.owner}</p>
                  {iv.note && <p className="mt-2 text-xs leading-snug text-ink-600">{iv.note}</p>}
                </div>
              </div>
              {iv.status !== "Completed" && (
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => advance(iv)}>
                    Mark {iv.status === "Planned" ? "in progress" : "completed"} →
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {show && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Plan intervention"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-900/50 backdrop-blur-sm p-4"
          onClick={() => { if (!saving) setShow(false); }}
        >
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <Card variant="frosted" className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <Heading as="h3" className="text-xl">Plan intervention</Heading>
                <button type="button" aria-label="Close" onClick={() => setShow(false)} className="text-lg text-ink-400 hover:text-ink-900">✕</button>
              </div>
              <div className="space-y-3">
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={isExam ? "e.g. Weekly resilience counselling" : "e.g. Panel communication bootcamp"}
                  className="w-full rounded-xl2 border-0 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200 focus:ring-2 focus:ring-brand-600 transition-all"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl2 border-0 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200 focus:ring-2 focus:ring-brand-600 transition-all"
                  >
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    value={form.owner}
                    onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                    placeholder={isExam ? "Counsellor" : "Coach"}
                    className="w-full rounded-xl2 border-0 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200 focus:ring-2 focus:ring-brand-600 transition-all"
                  />
                </div>
                <input
                  value={form.audience}
                  onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                  placeholder="Audience (whole cohort / a batch / a learner)"
                  className="w-full rounded-xl2 border-0 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200 focus:ring-2 focus:ring-brand-600 transition-all"
                />
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Plan / notes (optional)"
                  rows={3}
                  className="w-full resize-none rounded-xl2 border-0 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200 focus:ring-2 focus:ring-brand-600 transition-all"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setShow(false)} disabled={saving}>Cancel</Button>
                  <Button type="button" variant="primary" onClick={create} disabled={saving}>{saving ? "Saving…" : "Add intervention"}</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </Card>
  );
}
