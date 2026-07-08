// Gemini-route protection test under load.
//
// The paid Gemini routes run auth (getPrincipal) BEFORE any Gemini call, so an
// anonymous request is rejected before a single token is spent. This test slams
// every Gemini-backed route with up to 100 VUs as an ANONYMOUS caller and proves:
//   - they always reject (401/403/405/429) — never 200, never a paid call,
//   - they never 5xx or fall over under load,
//   - the ceiling that trips is YOUR auth/rate gate, not Google's wallet.
//
// COST: zero. No request reaches Gemini (auth blocks first). Safe to run at 100 VUs.
//
// To test REAL Gemini capacity you must (a) supply a valid auth token and accept
// per-call cost, and (b) stay well under Google's per-key RPM — do that at 5-10
// VUs, not 100. See loadtest/README.md.
//
//   SCENARIO=stress k6 run loadtest/gemini-gate.test.js

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";
import { BASE } from "./config.js";
import { selectedScenario, SCENARIO_NAME } from "./scenarios.js";

// Anonymous callers must be rejected, never served, never crashed.
const ACCEPTABLE = [400, 401, 403, 404, 405, 415, 429];
http.setResponseCallback(http.expectedStatuses(...ACCEPTABLE));

const gateHeld = new Rate("gemini_gate_held");      // rejected, not served
const noPaidCall = new Rate("gemini_no_paid_call"); // never a 2xx (would mean a real Gemini call)
const noServerError = new Rate("gemini_no_5xx");    // never fell over

// POST-only Gemini/AI routes. Empty body → auth rejects before body/Gemini.
const GEMINI_ROUTES = [
  "/api/gemini/live-token",
  "/api/gemini/token",
  "/api/parse-resume",
  "/api/generate-fit-score",
  "/api/interview/start",
  "/api/interview/results",
  "/api/interview/voice",
  "/api/interview/verify-face",
  "/api/interview/proctor",
  "/api/code/question",
  "/api/code/grade",
  "/api/code/run",
];

export const options = {
  scenarios: selectedScenario(),
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "30s" }],
    "http_req_duration{kind:gemini}": ["p(95)<1500"], // rejection should be fast (no Gemini wait)
    checks: ["rate>0.99"],
    gemini_gate_held: ["rate==1"],
    gemini_no_paid_call: ["rate==1"],
    gemini_no_5xx: ["rate==1"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function setup() {
  // Don't hard-abort on a non-200 here: an edge 403 (Google Front End abuse
  // throttle after prior load) still lets us verify the routes *reject* — that's
  // the whole point of this test. Only a total DNS/connect failure is fatal.
  const probe = http.get(`${BASE}/api/health`, { tags: { name: "health", kind: "api" } });
  if (probe.status === 0) {
    throw new Error(`Target ${BASE} unreachable (connect/DNS failure).`);
  }
  if (probe.status !== 200) {
    console.warn(`health returned ${probe.status} (edge throttle?) — proceeding; routes should still reject.`);
  }
}

export default function () {
  group("gemini routes reject anon under load", () => {
    for (const path of GEMINI_ROUTES) {
      const r = http.post(`${BASE}${path}`, "{}", {
        headers: { "Content-Type": "application/json" },
        tags: { name: `gemini${path}`, kind: "gemini" },
      });
      const held = ACCEPTABLE.includes(r.status);
      const paid = r.status >= 200 && r.status < 300; // a 2xx = anon reached Gemini = BUG
      const err5xx = r.status >= 500;
      gateHeld.add(held);
      noPaidCall.add(!paid);
      noServerError.add(!err5xx);
      check(r, {
        [`${path} rejects anon (no paid call)`]: () => held && !paid,
        [`${path} no 5xx`]: () => !err5xx,
      });
    }
  });
  sleep(1);
}

export function handleSummary(data) {
  const stamp = { test: "gemini-gate", scenario: SCENARIO_NAME, base: BASE, ...data };
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "loadtest/summary-gemini.json": JSON.stringify(stamp, null, 2),
  };
}
