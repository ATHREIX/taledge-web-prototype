// Taledge whole-platform k6 test.
// Production-grade: env-driven, scenario-switchable, per-endpoint tagged metrics,
// abort-on-fail thresholds, and machine + human summary export.
//
//   SCENARIO=smoke  BASE=http://localhost:3000  k6 run loadtest/platform.test.js
//   SCENARIO=load                                k6 run loadtest/platform.test.js
//   SCENARIO=stress VIDEO_PROBE=1                k6 run loadtest/platform.test.js
//
// See loadtest/README.md for the full matrix.

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";
import {
  BASE,
  ENFORCED,
  VIDEO,
  VIDEO_PROBE,
  PUBLIC_PAGES,
  PROTECTED_PAGES,
  GUARDED_API,
  EXPECTED_STATUSES,
} from "./config.js";
import { selectedScenario, SCENARIO_NAME } from "./scenarios.js";

// Treat the expected auth/redirect/range statuses as non-failures. MUST run in
// init context (module scope) so every VU inherits it — setting it inside setup()
// does not propagate to VUs.
http.setResponseCallback(http.expectedStatuses(...EXPECTED_STATUSES));

// ── custom metrics ──────────────────────────────────────────────────────────
const videoTTFB = new Trend("video_ttfb", true);
const authEnforced = new Rate("auth_enforced_correct"); // protected surface stays gated
const cspCorrect = new Rate("csp_media_allowed");       // CSP still lets dnla video load

// Thresholds adapt to the target: the auth-enforcement checks only make sense
// against an AUTH_ENFORCED deployment (prod), not a local demo-mode server.
function buildThresholds() {
  const t = {
    // Genuine transport/5xx failures only. abortOnFail stops a doomed run early.
    http_req_failed: [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "30s" }],
    // Latency budget for browser docs + APIs (video excluded via its own tag).
    "http_req_duration{kind:page}": ["p(95)<2000", "p(99)<4000"],
    "http_req_duration{kind:api}": ["p(95)<1500"],
    // Every functional assertion must hold.
    checks: ["rate>0.99"],
    // CSP must keep allowing the dnla video origin (scored only on real responses).
    csp_media_allowed: ["rate>0.99"],
    // Video start-of-playback budget (only meaningful when VIDEO_PROBE=1).
    video_ttfb: ["p(95)<1000"],
  };
  if (ENFORCED) {
    // Security posture must never regress under load — enforced targets only.
    t.auth_enforced_correct = ["rate==1"];
  }
  return t;
}

// ── options ─────────────────────────────────────────────────────────────────
export const options = {
  scenarios: selectedScenario(),

  // Count 4xx/redirects that are EXPECTED (auth gate, video range) as passes so
  // http_req_failed only flags genuine breakage (5xx, unexpected 4xx).
  // Applied globally in setup() via http.setResponseCallback.

  thresholds: buildThresholds(),

  // Fail the process on threshold breach so CI goes red.
  // (k6 exits non-zero automatically on threshold failure.)
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// ── lifecycle ───────────────────────────────────────────────────────────────
export function setup() {
  // Fail fast if the target is unreachable before spinning up VUs.
  const probe = http.get(`${BASE}/api/health`, { tags: { name: "health", kind: "api" } });
  if (probe.status !== 200) {
    throw new Error(`Target ${BASE} health check failed: status ${probe.status}`);
  }
  return { startedAt: new Date().toISOString() };
}

// ── virtual-user flow ───────────────────────────────────────────────────────
export default function () {
  group("public pages", () => {
    for (const path of PUBLIC_PAGES) {
      const r = http.get(`${BASE}${path}`, {
        redirects: 0,
        tags: { name: `page${path === "/" ? "/root" : path}`, kind: "page" },
      });
      check(r, {
        [`${path} serves (2xx/3xx)`]: (res) => res.status >= 200 && res.status < 400,
      });
    }
  });

  group("security headers", () => {
    const r = http.get(`${BASE}/login`, {
      redirects: 0,
      tags: { name: "page/login", kind: "page" },
    });
    // A timed-out/dropped request (status 0) under saturation has no headers —
    // that's a capacity limit, not a CSP regression, so don't score it here.
    if (r.status !== 0) {
      const csp = r.headers["Content-Security-Policy"] || "";
      const mediaOk = csp.includes("https://www.dnla.de");
      cspCorrect.add(mediaOk);
      check(r, {
        "csp present": () => !!csp,
        "csp allows dnla media": () => mediaOk,
        "hsts present": () => !!r.headers["Strict-Transport-Security"],
        "nosniff present": () => r.headers["X-Content-Type-Options"] === "nosniff",
        "frame-options deny": () => r.headers["X-Frame-Options"] === "DENY",
      });
    }
  });

  group("protected pages gated", () => {
    for (const path of PROTECTED_PAGES) {
      const r = http.get(`${BASE}${path}`, {
        redirects: 0,
        tags: { name: `protected${path}`, kind: "page" },
      });
      const gated = r.status >= 300 && r.status < 400; // login redirect
      const okRendered = r.status === 200; // demo mode (open) or valid session
      // In an enforced target an anonymous VU MUST be redirected; in demo mode a
      // 200 is expected. Only score the security metric where enforcement applies.
      if (ENFORCED && r.status !== 0) authEnforced.add(gated);
      check(r, {
        [`${path} ${ENFORCED ? "gated" : "reachable"}`]: () =>
          ENFORCED ? gated : gated || okRendered,
      });
    }
  });

  group("api auth enforcement", () => {
    const health = http.get(`${BASE}/api/health`, {
      tags: { name: "health", kind: "api" },
    });
    check(health, { "health 200": (r) => r.status === 200 });

    const guarded = http.get(`${BASE}${GUARDED_API}`, {
      tags: { name: "api/guarded", kind: "api" },
    });
    // Enforced: anon MUST be rejected. Demo mode: the route runs open, so any
    // non-5xx is fine — only assert the hard rejection where auth is enforced.
    const rejected = [401, 403, 404, 405].includes(guarded.status);
    if (ENFORCED && guarded.status !== 0) authEnforced.add(rejected);
    check(guarded, {
      "protected api handled": () =>
        ENFORCED ? rejected : guarded.status > 0 && guarded.status < 500,
    });
  });

  if (VIDEO_PROBE) {
    group("dnla video playback path", () => {
      // First 1 MB range = exactly what the browser <video> fetches to start.
      const vid = http.get(VIDEO, {
        headers: { Range: "bytes=0-1048575" },
        tags: { name: "video/range", kind: "video" },
      });
      videoTTFB.add(vid.timings.waiting);
      check(vid, {
        "video 206 partial": (r) => r.status === 206,
        "video is mp4": (r) => (r.headers["Content-Type"] || "").includes("mp4"),
        "video accepts ranges": (r) => !!r.headers["Content-Range"],
      });
    });
  }

  sleep(1);
}

// ── summary export ──────────────────────────────────────────────────────────
// Human-readable to stdout + machine-readable JSON for CI artifacts/dashboards.
export function handleSummary(data) {
  const stamp = { scenario: SCENARIO_NAME, base: BASE, ...data };
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "loadtest/summary.json": JSON.stringify(stamp, null, 2),
  };
}
