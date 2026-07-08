// Load profiles. Pick one with SCENARIO=<name>; default is `load`.
//   smoke  - 1 VU, 30s. Correctness gate. Run in CI on every push.
//   load   - ramp to 10 VUs, steady. "Does normal traffic stay healthy?"
//   stress - ramp to 100 VUs. Find the knee where latency/errors climb.
//   spike  - slam 150 VUs fast, then drop. Cold-start / autoscale behaviour.
//   soak   - 15 VUs for 30m. Leak / degradation over time.

const SCENARIOS = {
  smoke: {
    executor: "constant-vus",
    vus: 1,
    duration: "30s",
  },
  load: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "30s", target: 10 },
      { duration: "2m", target: 10 },
      { duration: "30s", target: 0 },
    ],
  },
  stress: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "1m", target: 25 },
      { duration: "2m", target: 50 },
      { duration: "2m", target: 100 },
      { duration: "2m", target: 100 },
      { duration: "1m", target: 0 },
    ],
  },
  spike: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "10s", target: 150 },
      { duration: "1m", target: 150 },
      { duration: "10s", target: 0 },
    ],
  },
  soak: {
    executor: "constant-vus",
    vus: 15,
    duration: "30m",
  },
};

export const SCENARIO_NAME = __ENV.SCENARIO || "load";

export function selectedScenario() {
  const s = SCENARIOS[SCENARIO_NAME];
  if (!s) {
    throw new Error(
      `Unknown SCENARIO="${SCENARIO_NAME}". Use one of: ${Object.keys(SCENARIOS).join(", ")}`
    );
  }
  return { platform: s };
}
