import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Trivial liveness endpoint used by the pre-flight system check to measure
// round-trip latency. Intentionally does NO work and touches NO paid service —
// it's just a tiny, uncached 200 so the client can time the network.
export function GET() {
  return NextResponse.json(
    { ok: true, t: Date.now() },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

export function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
