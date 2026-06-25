import { getStudent } from "@/lib/data";
import { getCandidate } from "@/lib/talent-store";
import DnlaClient from "./dnla-client";

export default async function DnlaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Prefer the durable talent-store record (real/invited candidate with live
  // results) over the seed fallback so a real user sees their actual DNLA radar
  // instead of an empty profile. Demo mode keeps the seed personas unchanged.
  const base = getStudent(id);
  const stored = await getCandidate(id);
  const s = stored
    ? { ...base, ...stored, fit: { ...base.fit, ...(stored.fit ?? {}) }, dnla: stored.dnla ?? base.dnla }
    : base;

  return <DnlaClient student={s} />;
}
