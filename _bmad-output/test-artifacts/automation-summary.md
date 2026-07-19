---
stepsCompleted:
  ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-04-execute-and-measure']
lastStep: 'step-04-execute-and-measure'
lastSaved: '2026-07-19'
workflowType: 'testarch-automate'
mode: 'BMad-Integrated'
detectedStack: 'fullstack'
baselineRevision: '01faf69'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-2-1-complete-a-task-toggle-with-the-payoff.md'
  - '_bmad-output/test-artifacts/traceability/traceability-matrix.md'
  - '_bmad-output/project-context.md'
---

# Test Automation Expansion — Story 2.1 gaps + coverage bars

**Evaluator:** Alivara (Murat, Master Test Architect)
**Date:** 2026-07-19
**Stack:** fullstack (Next.js `web` + Go `api`), BMad-Integrated
**Base:** `main` @ `01faf69` (Story 2.1 merged + traceability committed)
**Scope:** Close the two Story 2.1 trace gaps (2.1-R8, 2.1-R9) and make the two release bars (≥70% coverage, ≥5 passing E2E) real + enforceable — driven by "test traces and coverages".

> Followed the codebase's **bespoke** patterns (vanilla `@playwright/test` fixtures `seedTodos`/`resetTodos`, Vitest+RTL, Go stdlib tests), not the `playwright-utils` library — per the project-context "the code owns this" rule, despite `tea_use_playwright_utils=true` in config.

---

## What was executed (real evidence, this host)

| Suite | Command | Result |
| --- | --- | --- |
| web unit + component | `vitest run` | **43/43 passed** (was 36; +7 added) |
| web coverage | `vitest run --coverage` (v8) | **82.81% stmts · 84.07% lines · 83.21% branch · 79.31% funcs** |
| api unit | `go test ./handler/... ./service/...` | green — **handler 91.7%, service 82.4%** |
| E2E (Playwright, live Docker test stack) | `playwright test --project=e2e` | **13/13 passed** (was 12; +1 added), 3.4s |
| lint / format / types | `eslint` · `prettier --check` · `tsc --noEmit` | clean |

Docker test stack (`docker-compose.test.yml`) was brought up (db + api healthy, web on :3000); the E2E ran against it — so E2E "passing" is **verified**, not pending CI.

---

## Coverage: before → after (web)

| Metric | Before | After | Bar |
| --- | --- | --- | --- |
| Statements | 66.96% | **82.81%** | ≥70% ✅ |
| Lines | 67.16% | **84.07%** | ≥70% ✅ |
| Branches | 65.73% | **83.21%** | ≥70% ✅ |
| Functions | 70.68% | **79.31%** | ≥70% ✅ |

**Root cause of the miss:** `app/api/[...path]/route.ts` (the AD-3 BFF proxy) was at **0%** — its AD-9 error synthesis (502 unreachable / 504 timeout), hop-by-hop header stripping, and null-body (204) handling were entirely untested at unit level. Covering it (0% → **100% lines**) both fixed the bar and closed a real correctness blind spot.

Remaining 0% files (`page.tsx`, `layout.tsx`, `error.tsx`, `providers.tsx`, `Wordmark.tsx`) are React composition/boilerplate exercised by the E2E suite; the bar is met with them included.

---

## Tests added

1. **`web/tests/api-proxy.test.ts` (NEW, 6 cases)** — the BFF proxy (2.1 uses it for every PATCH):
   verbatim forward (status + JSON body + content-type), hop-by-hop/host header stripping, POST body forwarding, 204 null-body handling (no `Response` throw), **AD-9 502 on unreachable**, **AD-9 504 on timeout (AbortError)**. Upstream `fetch` stubbed; no network.
2. **`web/tests/use-toggle-todo.test.tsx` (+1 case)** — closes **2.1-R8**: rollback on a **network-class failure** (`fetch` rejects, no `Response`), not just a 5xx — covering the full AC3 "5xx / network / timeout" wording.
3. **`web/tests/e2e/toggle.spec.ts` (+1 case, `2.1-E2E-003`)** — closes **2.1-R9**: under `prefers-reduced-motion: reduce`, the toggle still flips to completed AND the card recedes to the ~0.85-opacity "done" treatment — proving **motion decorates but never gates** the state change (robust opacity assertion, no brittle color matching).

## Instrumentation wired (makes the coverage bar enforceable)

- Added `@vitest/coverage-v8` (devDep) + a `coverage` block in `vitest.config.ts` with `include: ['app/**','lib/**']` and **70% thresholds** on all four metrics.
- Added `npm run test:coverage` (`vitest run --coverage`) — fails the run if any metric drops below 70%.
- Coverage/report output dirs already gitignored (`web/coverage/`, `web/playwright-report/`, `web/test-results/`).

---

## Gate impact (re-gate of the Story 2.1 traceability)

The trace gate was **CONCERNS**, held there by: Bar A unmeasured, Bar B unexecuted, and gaps 2.1-R8 / 2.1-R9. All are now resolved with first-hand evidence:

| Item | Trace status | Now |
| --- | --- | --- |
| Bar A — ≥70% code coverage | ❌ UNVERIFIED | ✅ **82.81% web / 91.7% + 82.4% api** (measured + enforced) |
| Bar B — ≥5 passing Playwright | ⚠️ CONDITIONAL | ✅ **13/13 passing** (verified on live stack) |
| 2.1-R8 network/timeout rollback | ⚠️ partial (5xx only) | ✅ network-class case added |
| 2.1-R9 completed visual/motion | ⚠️ PARTIAL (P2) | ✅ reduced-motion + recessed-card E2E added |

**→ Story 2.1 gate now clears to PASS.** (The api `repository`/`model`/`main` packages remain outside host unit coverage by design — repository is covered by the `testseed` integration suite that runs inside the container/CI, per AD-12 internal-only db.)

---

## Follow-ups (optional, low priority)
- Wire the same coverage floor into CI (Epic 4 CI lane) for both `web` (`test:coverage`) and `api` (`go test -coverprofile`).
- Consider a container-run `go test -tags testseed -coverprofile` job so `repository` coverage is measured (needs the internal db, so CI/container only).
