---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-assess-and-gate']
lastStep: 'step-04-assess-and-gate'
lastSaved: '2026-07-19'
workflowType: 'testarch-nfr'
nfrFocus: 'performance'
evidenceMethod: 'Chrome DevTools (claude-in-chrome MCP) — live measurement against the docker test stack'
baselineRevision: '01faf69'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md (NFR1–NFR11)'
  - '_bmad-output/planning-artifacts/ux-designs/ux-todo-app-2026-07-17/DESIGN.md (UX-DR17/18)'
  - '_bmad-output/implementation-artifacts/spec-2-1-complete-a-task-toggle-with-the-payoff.md'
  - '_bmad-output/project-context.md'
---

# NFR Evidence Audit — Performance

**Evaluator:** Alivara (Murat, Master Test Architect)
**Date:** 2026-07-19
**Scope:** Performance NFRs only (per request). Security / reliability / maintainability out of scope for this run.
**Evidence method:** Live Chrome DevTools measurement (claude-in-chrome MCP `javascript_tool` — Navigation Timing, PerformanceObserver, `fetch` timing) against the running `docker-compose.test.yml` stack.
**Environment:** localhost Docker (web + api + Postgres 18), single-user, warm. Desktop viewport 1735×1589.

> ⚠️ **Measurement caveat (read before citing numbers):** all figures below were captured on a **local Docker stack on a dev machine** — no network RTT, no concurrency, no production resource limits. NFR1 is scoped to "normal single-user load", which this matches; but real deployments add network latency and contention. The p95 API numbers carry ~250ms of headroom under the 300ms bar, so they remain comfortable once realistic network latency is added — but this is **not** a load/soak test (k6 is deferred per project-context).

---

## Performance NFRs & Thresholds

| ID | Requirement | Threshold | Source |
| --- | --- | --- | --- |
| **NFR1a** | Optimistic UI updates render fast | **≤ 100 ms** (click → visible state change) | epics.md NFR1 / UX-DR18 |
| **NFR1b** | API responds promptly under single-user load | **p95 ≤ 300 ms** | epics.md NFR1 |
| **NFR2** | Initial list load is prompt; loading state immediate; no blank screen | Prompt load, no intervening blank | epics.md NFR2 |
| **UX-DR18** | Motion decorates but never **gates** the ≤100ms optimistic render | Optimistic flip independent of the ~350ms spring | DESIGN.md / spec 2.1 |
| **NFR5** | Functional + polished from ~375px up | No horizontal scroll / broken layout at 375px | epics.md NFR5 |

---

## Evidence Gathered (live)

### NFR1a — Optimistic render latency (the flagship floor)
Measured click → `aria-checked` DOM flip on the real toggle checkbox via `MutationObserver` + `performance.now()`, 6 samples (network PATCH in flight, so this isolates the optimistic cache flip):

```
samples (ms): 4.2, 8.7, 3.7, 22.7, 5.3, 3.4
min 3.4 · avg 8.0 · max 22.7
```

**Budget usage: 22.7 ms worst-case = 23% of the 100 ms floor.** The optimistic flip lands ~4–23 ms after the click, long before the server responds.

### NFR1b — API response latency (client-observed, through the AD-3 proxy → api → db)
`fetch` timing from the page context (full round-trip incl. the dumb proxy hop):

| Endpoint | n | p50 | p95 | max |
| --- | --- | --- | --- | --- |
| `GET /todos` | 20 | 5.3 ms | **45.6 ms** | 45.6 ms |
| `PATCH /todos/:id` | 10 | 8.7 ms | **14.7 ms** | 14.7 ms |
| `POST /todos` | 5 | 6.5 ms | **9.8 ms** | 9.8 ms |

**Worst p95 = 45.6 ms = 15% of the 300 ms budget** (~6.5× headroom).

### NFR2 — Load performance
Navigation Timing (two loads, cold then warm):

| Metric | Cold | Warm |
| --- | --- | --- |
| TTFB | 44 ms | — |
| DOMContentLoaded | 64 ms | 22 ms |
| Load event | 86 ms | 38 ms |
| Cumulative Layout Shift | **0** | — |
| Doc transfer size | ~3 KB | — |
| Todos rendered on load | 3 | ✓ |

The list renders with the seeded rows present at load; **CLS = 0** (no layout jump — notable given the completed-row recede animation). FCP/LCP paint entries were **not exposed** through the DevTools harness in this environment (reported honestly as *not captured*, not as 0); DCL/Load stand as the load-performance evidence.

### UX-DR18 — Motion never gates the optimistic render
The optimistic flip measured at avg **8 ms** while the `check-pop` spring is a **~350 ms** decorative CSS animation — the state change is ~44× faster than the animation, confirming motion decorates rather than gates. Corroborated by automated tests `2.1-WEB-U01` (optimistic flip lands while PATCH in flight) and `2.1-E2E-003` (completed state applies under `prefers-reduced-motion: reduce`).

### NFR5 — Responsive from ~375px
Not re-measured in this performance run. Covered by the Playwright **`e2e-mobile`** project (iPhone SE / 375px) and assertion `1.3-E2E-004` ("a long unbroken title wraps and never forces horizontal scroll (~375px)"). Status carried as **test-evidenced**, not DevTools-measured here.

---

## Assessment

| NFR | Threshold | Measured | Status |
| --- | --- | --- | --- |
| **NFR1a** optimistic render | ≤100 ms | avg 8 ms / max 22.7 ms | ✅ **PASS** (strong) |
| **NFR1b** API p95 | ≤300 ms | max p95 45.6 ms | ✅ **PASS** (strong) |
| **NFR2** prompt load / no blank screen | prompt, no blank | Load 38–86 ms, CLS 0, rows present | ✅ **PASS** (FCP/LCP not captured — minor) |
| **UX-DR18** motion never gates | flip ≪ animation | 8 ms flip vs 350 ms spring | ✅ **PASS** |
| **NFR5** responsive 375px | no broken layout | test-evidenced (e2e-mobile) | ✅ **PASS (by tests)** — not measured here |

### Performance Gate: ✅ **PASS**

All in-scope performance thresholds are met with large margins under single-user conditions. No performance CONCERNS or blockers.

**Residual / not-evidenced (tracked, non-blocking):**
1. **No load/concurrency evidence.** Numbers are single-user localhost; NFR1's "single-user load" is satisfied, but multi-client throughput and sustained-load p95 are unmeasured (k6 deferred). *Probability Low · Impact Low · score 2 (DOCUMENT).*
2. **FCP/LCP not captured** via the DevTools harness. DCL/Load cover NFR2's intent; add Lighthouse/web-vitals in CI for a first-class LCP number. *score 1 (DOCUMENT).*
3. **Network latency headroom.** Production adds RTT; the ~250 ms API headroom and ~78 ms optimistic headroom make regressions unlikely to breach the floors, but re-measure against a deployed environment before GA. *score 2 (DOCUMENT).*

### Recommendations
- Add a **Lighthouse CI** (or `web-vitals`) check to the Epic 4 pipeline to track FCP/LCP/CLS + a perf-budget on the ≤100ms interaction and 300ms API p95 as regression guards.
- Optionally add a lightweight **k6** smoke (e.g. 10–50 VUs) to evidence p95 ≤300ms beyond single-user before GA.

---

## Related Artifacts
- **NFR sources:** `_bmad-output/planning-artifacts/epics.md` (NFR1–NFR11), `DESIGN.md` (UX-DR17/18)
- **Corroborating tests:** `web/tests/use-toggle-todo.test.tsx` (2.1-WEB-U01), `web/tests/e2e/toggle.spec.ts` (2.1-E2E-003), `web/tests/e2e/list.spec.ts` (1.3-E2E-004)
- **Traceability + gate:** `_bmad-output/test-artifacts/traceability/traceability-matrix.md`

**Generated:** 2026-07-19 · **Workflow:** testarch-nfr (performance focus, Chrome DevTools MCP evidence)
