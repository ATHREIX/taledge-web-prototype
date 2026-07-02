# DNLA Partner API — Integration Test Findings (2026-06-27)

**Verdict: integration is blocked by two server-side defects on DNLA's end.
Our partner `api_key` is valid (it matches the value shown in DNLA's own docs)
and our request format matches their OpenAPI spec. Nothing is wrong on our side.**

Tested against `https://backend.dnla.com` using the partner `api_key`, the
documented `POST /partner-api/tan/create` and `GET /partner-api/results/{id}`,
and the published spec at `https://backend.dnla.com/docs?api-docs.json`.

---

## Blocker 1 — Spec `servers[].url` is `null` (breaks Swagger "Try it out")

The OpenAPI document literally contains:

```json
"servers": [
  { "url": null, "description": "Backend API" },
  { "url": null, "description": "Frontend API" }
]
```

Because the server URL is `null`, Swagger UI builds the request URL as
`https://backend.dnla.com``null``/partner-api/tan/create` — i.e. the host
`backend.dnla.com``null`, which does not exist. In the browser DevTools this
shows as **failed requests, "provisional headers", and "0 B transferred"** (plus
a CORS preflight to the same bad host). So **Swagger's "Try it out" cannot reach
the API at all** — it is not a working test path.

**Ask:** what is the correct `servers[].url`? Please publish a non-null base URL
in the OpenAPI spec.

---

## Blocker 2 — Every `/partner-api/*` call returns `500 Server Error` (before validation)

Calling the **correct** host server-to-server (no `null`), the endpoint is
reachable but throws an unhandled `500` on every request. Crucially, the 500
happens **before request validation**, which proves it is not about our
`api_key` or `area` values.

| # | Request | Documented response | Actual |
|---|---------|--------------------|--------|
| 1 | `POST tan/create` — valid key + `area:ESK` (body) | `200` + TAN | **500** |
| 2 | `POST tan/create` — valid key + `area:AZS` | `200` or `403` | **500** |
| 3 | `POST tan/create` — valid key, **no `area`** | `422` "area field is required" | **500** |
| 4 | `POST tan/create` — **no api_key at all** | `403` "invalid api_key" | **500** |
| 5 | key in query / body / `Authorization: Bearer` / `X-API-KEY` | — | **500** (all) |
| 6 | with session+CSRF cookies, and with browser `Origin`/`Referer`/UA | — | **500** |
| 7 | `GET /partner-api/results/1` | `403` / `404` | **500** (Laravel error page) |
| 8 | `GET /api/documentation` | `200` | `200` ✓ (API host is up) |
| 9 | `GET /partner-api/tan/create` (wrong method) | `405` | `405` ✓ (route exists) |

Tests #3 and #4 are the proof: a missing required field should yield `422` and a
missing key should yield `403`, but both yield `500`. The handler is crashing
before it validates input — so this is a server-side fault (likely the partner
account not being provisioned for the area, or an unhandled exception), not a
client problem.

**Ask:** with our `api_key`, `POST /partner-api/tan/create` `{area:"ESK"}` returns
`500`. Please check your server logs for our key/request and confirm our partner
account is provisioned for ESK (and/or AZS).

---

## Blocker 3 (clarification) — `api_key` placement is ambiguous

The security scheme declares `api_key` as `in: query`; the prose says "query
parameter or in the request body." We tried both (and headers) — all `500`.

**Ask:** which placement is authoritative for the Backend API?

---

## What is NOT a problem

- **The api_key** — 25 chars, identical to the value pre-filled in DNLA's own
  docs. Valid.
- **Our request shape** — matches the spec's required fields (`api_key`, `area`
  ∈ {ESK, AZS}).
- **Our integration path** — we call server-to-server (see `lib/dnla-client.ts`),
  so the Swagger `null`-URL and CORS issues do not affect production. Our only
  real blocker is the `500`.

## Definition of "unblocked"

A server-to-server `POST https://<correct-base>/partner-api/tan/create` with our
`api_key` + `area` returns `200` with `tan.tan_nummer` and `tan.start_url`. Once
that works, we wire the confirmed scale/factor mapping (`lib/dnla-mapping.ts`) and
take the integration off the feature flag.

---

## Ready-to-send email to DNLA

> **Subject: Partner API blocked — 500 on every call + null server URL in the spec**
>
> Hi [name],
>
> Ahead of our call, we ran the Partner API end-to-end and hit two blockers we
> think are on the server side. Details so you can check the logs beforehand:
>
> **1. `500 Server Error` on every `/partner-api/*` call.**
> Server-to-server `POST https://backend.dnla.com/partner-api/tan/create` with
> our `api_key` and `{"area":"ESK"}` returns `500`. It also returns `500` when we
> send **no `area`** (expected `422`) and when we send **no `api_key`** (expected
> `403`) — so it's crashing before validation. `GET /partner-api/results/{id}`
> also returns `500`. The host is clearly up (`/api/documentation` is `200`, and
> `GET tan/create` correctly returns `405`). Could you check your logs for our
> key and confirm our account is provisioned for ESK/AZS?
>
> **2. OpenAPI `servers[].url` is `null`.**
> In `https://backend.dnla.com/docs?api-docs.json`, both servers have
> `"url": null`, so Swagger "Try it out" calls `backend.dnla.com``null`/... and
> fails (0 bytes transferred). What is the correct base URL?
>
> **3.** Is `api_key` meant to be in the query, the body, or a header? The spec
> says `in: query`; the text says body too.
>
> Our integration is ready on our end — once `tan/create` returns a TAN, we can
> proceed immediately. Thanks!
>
> [your name]
