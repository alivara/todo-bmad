---
stepsCompleted: ['step-01-preflight', 'step-02-select-framework', 'step-03-scaffold-framework', 'step-04-docs-and-scripts', 'step-05-validate-and-summary']
lastStep: 'step-05-validate-and-summary'
lastSaved: '2026-07-17'
runMode: 'design-only (greenfield — no manifests to install into)'
detectedStack: 'fullstack (intended: Next.js web + Go/Gin api + PostgreSQL) — per ARCHITECTURE-SPINE; no code on disk yet'
---

# Test Framework Setup — todo-app (DESIGN MODE)

## Step 1: Preflight

- **HALT on install prerequisites:** greenfield — no `package.json`, no `go.mod`, no `web/`/`api/`/`shared/`. The framework installs *into* those, which don't exist yet.
- **Decision (Alivara):** *Design now, install later.* Produce ready-to-drop config + fixtures under `test-artifacts/framework-design/`; nothing installed; won't collide with Epic 1 Story 1.1 scaffolding.
- **Intended stack (from `ARCHITECTURE-SPINE.md`):** `web` Next.js 16.2 / React / TanStack Query 5 · `api` Go 1.26 / Gin 1.12 · `db` PostgreSQL 18 · Docker Compose.
- Cross-checked `_bmad-output/test-artifacts/` — test-design + risk review confirm framework is downstream of Story 1.1, and pre-blockers TC1 (seed/reset seam) + TC5 (`/health`) gate it.

## Step 2: Framework Selection

- **`web` E2E + api-integration:** **Playwright** — fullstack, heavy API+UI integration, CI parallelism, network interception for optimistic-rollback failure injection (R1). Vanilla `@playwright/test` (runnable without proprietary deps); `@seontechnologies/playwright-utils` optional if the team adopts it (`tea_use_playwright_utils=true`).
- **`web` unit:** **Vitest + React Testing Library** — TanStack mutation logic, rollback reducers, relative-time formatter, rune-count parity.
- **`api` unit + integration:** **Go test + testify** — validation, status transitions, contract shape, injection, repository against Postgres (compose test profile).
- **Perf (nightly, later):** k6 — deferred until U1 load definition resolved.

## Step 3: Scaffold (as design files)

Produced under `_bmad-output/test-artifacts/framework-design/` — see that folder's `README.md`. Structure mirrors the architecture source tree so files drop straight into `web/` and `api/` once Story 1.1 scaffolds them.

Fixture architecture wired to the risk review:
- **TC1** seed/reset seam → `web/tests/support/fixtures.ts` (`seedTodos`/`resetTodos`) + `api/testhelpers/seed.go`.
- **TC5** `/health` readiness → Playwright `webServer`/global-setup gate + a Go health test.
- **R9** fake clock → `fixtures.ts` clock helper; undo-window + relative-time tests use it, never `waitForTimeout`.
- **R3** shared contract → `web/tests/support/contract.ts` asserts AD-6 invariants; Go contract test mirrors.
- **R1** optimistic rollback → `web/tests/e2e/optimistic-rollback.spec.ts` (the score-9 sample).

## Step 4: Docs & Scripts

- `framework-design/README.md` — drop-in instructions, structure, best practices, KB refs.
- `framework-design/web/package.scripts.md` — scripts to merge into `web/package.json`.
- Go test invocation documented for `api/`.

## Step 5: Validate & Summary

- Checklist (adapted for design mode): framework selected + justified ✓ · directory structure defined ✓ · config files provided (Playwright, Vitest) ✓ · fixtures/factories/helpers provided ✓ · sample tests per level ✓ · docs + scripts ✓ · no hard waits / self-cleaning patterns enforced (per `test-quality`) ✓.
- **Not done (by design):** dependency install, `npx playwright install`, actual test run — all deferred to post-Story-1.1. Entry criteria: repo scaffolded + TC1/TC5 present.
- **Next:** once Story 1.1 lands `web/package.json` + `api/go.mod`, re-run `/bmad-testarch-framework` (Create) to auto-detect and install, or copy the design files in directly, then run `/bmad-testarch-atdd` for red-phase P0 tests.
