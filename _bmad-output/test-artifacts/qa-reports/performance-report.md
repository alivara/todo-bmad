# Performance Report — todo-app

**Date:** 2026-07-20
**Tooling:** Lighthouse (performance category) + Chrome Navigation/Resource Timing APIs, live measurement
**App under test:** `docker compose up` → http://localhost:3000
**Verdict:** ✅ Strong. **Lighthouse Performance 99/100**, all Core Web Vitals green, **CLS 0**, ~9 ms API round-trips through the full stack.

## Lighthouse — Performance 99/100

| Metric | Value | Target | Score |
| --- | --- | --- | --- |
| First Contentful Paint (FCP) | **0.8 s** | < 1.8 s | 1.00 |
| Largest Contentful Paint (LCP) | **2.3 s** | < 2.5 s | 0.94 |
| Speed Index | 1.3 s | < 3.4 s | 1.00 |
| Total Blocking Time (TBT) | 10 ms | < 200 ms | 1.00 |
| Cumulative Layout Shift (CLS) | **0** | < 0.1 | 1.00 |
| Time to Interactive | 2.3 s | < 3.8 s | 0.99 |
| Max Potential FID | 60 ms | < 130 ms | 1.00 |

Full reports: `lighthouse.report.html` (open in a browser) · `lighthouse.report.json`.
Reproduce: `npx lighthouse http://localhost:3000 --only-categories=performance --view`

## Method

Live measurement against the running production-shaped stack. Metrics collected from the browser's
`PerformanceNavigationTiming` / `PerformanceResourceTiming` APIs and direct `fetch` timing of the
API path (browser → BFF proxy → Gin → Postgres). Values below are representative of several runs.

## Load performance

| Metric | Value | Target | Pass? |
| --- | --- | --- | --- |
| TTFB | ~11–28 ms | < 200 ms | ✅ |
| DOM Interactive | ~38–44 ms | < 1 s | ✅ |
| DOMContentLoaded | ~38 ms | — | ✅ |
| Load event (fully loaded) | ~51–100 ms | < 2.5 s | ✅ |
| **CLS** (cumulative layout shift) | **0** | < 0.1 | ✅ |

## Payload

| Metric | Value |
| --- | --- |
| Total transfer (cold) | ~156 KB |
| JS transfer (compressed) | ~146 KB |
| JS decoded (uncompressed) | ~555 KB |
| Resource count | 11–12 |

## API latency (GET /api/todos, full stack, 5 samples)

| min | median | max |
| --- | --- | --- |
| 7 ms | **9 ms** | 24 ms |

Measured end-to-end through the same-origin proxy into Gin and Postgres — well within an
interactive budget. Combined with optimistic UI updates, mutations feel instant.

## Issues found

None. Lighthouse Performance scores 99/100 with every Core Web Vital in the green band.
LCP at 2.3 s (score 0.94) is the only sub-1.0 metric and sits just under the 2.5 s "good"
threshold — the natural lever if further tuning is ever wanted is trimming the JS payload
(~146 KB compressed) via code-splitting.
