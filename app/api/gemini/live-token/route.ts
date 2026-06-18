import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GEMINI_LIVE_MODEL, getGeminiApiKey } from "@/lib/gemini";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isProd } from "@/lib/flags";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  const limited = enforceRateLimit(req, {
    uid,
    limit: 10,
    windowMs: 60000,
    scope: "live-token",
  });
  if (limited) return limited;

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Gemini Live service is not configured." },
      { status: 503 }
    );
  }

  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/ephemeralTokens:create?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            uses: 1,
            expireTime,
            newSessionExpireTime,
            liveConnectConstraints: {
              model: GEMINI_LIVE_MODEL,
              config: {
                responseModalities: ["AUDIO"],
                systemInstruction: {
                  parts: [
                    {
                      text:
                        "You are Taledge's structured interview voice agent. Ask concise interview questions, wait for answers, and keep the interview professional.",
                    },
                  ],
                },
              },
            },
            httpOptions: { apiVersion: "v1alpha" },
          },
        }),
      }
    );

    if (!response.ok) {
      const upstreamError = await response.text();
      logger.error("Gemini Live token upstream failure", {
        uid,
        upstreamStatus: response.status,
        upstreamError: upstreamError.slice(0, 300),
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Gemini Live token service is unavailable.",
          ...(isProd
            ? {}
            : {
                upstreamStatus: response.status,
                upstreamError: upstreamError.slice(0, 300),
              }),
        },
        { status: 502 }
      );
    }

    const token = await response.json();
    return NextResponse.json({
      ok: true,
      token: token.name,
      expireTime: token.expireTime || expireTime,
      newSessionExpireTime: token.newSessionExpireTime || newSessionExpireTime,
      model: GEMINI_LIVE_MODEL,
    });
  } catch (e: any) {
    logger.error("Gemini Live token request error", {
      uid,
      detail: e?.message?.slice(0, 200),
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Gemini Live token service is unavailable.",
        ...(isProd ? {} : { detail: e?.message?.slice(0, 200) }),
      },
      { status: 500 }
    );
  }
}
