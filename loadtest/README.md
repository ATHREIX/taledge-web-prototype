# Load & smoke tests (k6)

Whole-platform k6 suite: verifies the public pages render, protected pages stay
gated, the auth-enforcement APIs reject anonymous callers, the security headers
(CSP/HSTS/nosniff/frame-options) hold **under load**, and — optionally — that the
DNLA development videos still stream (206 range) with a fast start.

## Install k6

```bash
# macOS
brew install k6
# Debian / Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys \
  C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

No-sudo fallback: download the static binary from
https://github.com/grafana/k6/releases and run it directly.

## Run

```bash
pnpm loadtest              # default `load` profile vs prod
pnpm loadtest:smoke        # 1 VU / 30s correctness gate (use in CI)
pnpm loadtest:stress       # ramp to 100 VUs, find the knee
SCENARIO=spike k6 run loadtest/platform.test.js
SCENARIO=soak  k6 run loadtest/platform.test.js
```

### Config (all env-driven)

| Var           | Default                                                     | Meaning                                             |
| ------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| `BASE`        | prod App Hosting URL                                        | target origin — point at localhost / preview / prod |
| `SCENARIO`    | `load`                                                      | `smoke` \| `load` \| `stress` \| `spike` \| `soak`  |
| `VIDEO`       | `.../DLoad/Motivation.mp4`                                  | which DNLA MP4 to probe                              |
| `VIDEO_PROBE` | `0`                                                        | `1` = also range-fetch dnla.de (off in CI by default) |

`VIDEO_PROBE` is **off by default** so CI runs don't hammer a third-party origin.
Turn it on for a full playback check.

## What "green" means

Thresholds (a breach exits non-zero → CI fails):

- `http_req_failed rate<0.01` — genuine 5xx / unexpected 4xx only. Expected auth
  redirects (302/307), auth rejections (401/403) and video ranges (206) are
  registered as expected statuses and do **not** count as failures.
- `http_req_duration{kind:page} p95<2s, p99<4s` and `{kind:api} p95<1.5s`.
- `checks rate>0.99` — every functional assertion holds.
- `auth_enforced_correct rate==1` — the protected surface never leaks under load.
- `csp_media_allowed rate==1` — CSP keeps allowing the dnla video origin.
- `video_ttfb p95<1s` — start-of-playback stays fast (only when `VIDEO_PROBE=1`).

## Output

- Human summary to stdout.
- `loadtest/summary.json` — machine-readable, for CI artifacts / dashboards
  (git-ignored).

## CI

Run `smoke` on every push (fast, deterministic), `load`/`stress` on a schedule or
before a release. k6 exits non-zero on any threshold breach, so no extra glue is
needed — the step fails the pipeline on its own.
