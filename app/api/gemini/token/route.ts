import { NextResponse } from "next/server";

/**
 * DEPRECATED. This route previously returned a WebSocket URL containing the
 * raw GEMINI_API_KEY, leaking the secret to the browser. It now refuses to
 * run. Clients must mint a short-lived ephemeral token via
 * POST /api/gemini/live-token and connect with that token instead.
 */
export async function GET() {
  return NextResponse.json(
    { error: "Deprecated. Use POST /api/gemini/live-token." },
    { status: 410 }
  );
}
