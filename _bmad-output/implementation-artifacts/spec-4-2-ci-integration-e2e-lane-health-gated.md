---
title: 'Story 4.2: CI integration & E2E lane (health-gated)'
type: 'chore'
created: '2026-07-19'
status: 'done'
baseline_revision: '71e0216f7d0ac878cc5352c2e5e3ea7a0caae33f'
final_revision: '6663b1a'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/docker-compose.test.yml'
  - '{project-root}/web/playwright.config.ts'
warnings: [oversized]
---

<intent-contract>

## Intent

**Problem:** Cross-unit regressions (wire contract, optimistic flows, repository↔Postgres) are only caught by running the Dockerized stack and the E2E/integration suites by hand. Story 4.1 added the fast lane (lint + unit) but nothing exercises the real stack in CI.

**Approach:** Add a third job, `integration-e2e`, to the existing `.github/workflows/ci.yml`. It builds and starts the real stack with the test (testseed) compose profile, waits on `GET /health` before testing, runs the api integration tests (Go `testseed` suite) and the Playwright E2E/integration suite, uploads diagnostics on failure, and always tears the stack down. No product code change.

**Also (user-requested, same `ci.yml` file, beyond the Story 4.2 ACs):** (a) surface a Go test-results summary in the `api` job step summary — parity with the web job's built-in Vitest summary, which today has no api equivalent; (b) reduce the Node-20 action deprecation warnings by bumping the actions whose latest major moved to Node 24 (`actions/checkout@v5`, `actions/setup-node@v5`, `actions/setup-go@v6`) across all jobs. Note `golangci/golangci-lint-action` and `actions/upload-artifact` have NO Node-24 major yet, so their deprecation warnings are unavoidable and are left on their working majors.

## Boundaries & Constraints

**Always:**
- Bring the stack up with exactly `docker compose -f docker-compose.yml -f docker-compose.test.yml up --build` (plus detach/wait flags) — the testseed profile compiles the `/internal/test/reset` seam (per TC1). Use a fixed compose project name (e.g. `-p todoci`) so the network name and teardown are deterministic.
- Gate on `GET /health` reporting migrated+serving **before any test runs**: no fixed-duration sleep as the gate — use compose `--wait` and/or a bounded retry poll of `http://localhost:3000/api/health` (the proxied path; `db`/`api` are host-unreachable) with a bounded timeout (per TC5).
- Run the **api integration tests** — the Go `testseed`-tagged suite that needs a live Postgres — inside a one-off `golang:1.26-alpine` container **joined to the compose network**, with `DATABASE_URL=postgres://todo:todo@db:5432/todo?sslmode=disable`, invoking `go test -tags testseed ./...`. (db is internal-only per AD-12 and the api runtime image has no Go toolchain, so this is the only path that respects the pinned bring-up command.)
- Run the **Playwright suite** on the runner against the running stack: `npm ci` + `npx playwright install --with-deps chromium webkit` in `web/` (webkit is required — the `e2e-mobile` project's `devices['iPhone SE']` defaults to WebKit), then `npm run test:e2e` (its `e2e`, `e2e-mobile`, `integration` projects; all specs are `@p0`). In CI the config self-detects (`process.env.CI`) and uses the external stack via `BASE_URL` (default `http://localhost:3000`).
- On failure, upload the Playwright report and stack logs as workflow artifacts. Always tear the stack down (`down -v`) even on failure.
- This lane is a **peer job** (no `needs` on the fast lane); its own red status blocks merge. Both lanes green = combined green.

**Block If:**
- The stack cannot be made ready within the bounded timeout on a clean checkout (i.e. `docker compose … up --wait` / the `/health` poll never succeeds) AND the cause is a genuine product/compose defect rather than the workflow — HALT `blocked`, condition `stack never reaches healthy on baseline`.

**Never:**
- No new compose file, no new npm/Go scripts, no new test framework or seam — orchestrate the existing compose + existing suites only.
- No product, schema, or wire-contract change. Test-source changes are limited to the minimal locator disambiguation below — no new tests, no behavior change, no assertion weakening.
- No branch-protection / required-status config or README badge — that is Story 4.3.
- No publishing of the `db`/`api` host ports; do not modify `docker-compose.yml`/`docker-compose.test.yml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PR / push to main | trigger fires | `integration-e2e` job runs alongside fast lane | n/a |
| Stack starts | `up --build -d --wait` | Waits for db+api healthchecks; `/api/health` poll returns 200 before tests | Bounded timeout → job fails (no infinite wait) |
| api integration tests | testseed container on compose net | `go test -tags testseed ./...` connects to `db:5432`, passes | Nonzero exit → job red |
| Playwright suite | stack up, `CI=true` | `npm run test:e2e` passes (e2e + mobile + integration) | Nonzero exit → job red |
| Any test fails | failing test | Job red; Playwright report + compose logs uploaded as artifacts | Artifacts uploaded on failure only |
| Job ends (pass/fail) | teardown | `docker compose … down -v` runs (`if: always()`) | Stack always cleaned up |

</intent-contract>

## Code Map

- `.github/workflows/ci.yml` -- MODIFY: add the `integration-e2e` job (existing `web`/`api` fast-lane jobs, triggers, concurrency, `permissions: contents: read` stay unchanged).
- `docker-compose.yml` / `docker-compose.test.yml` -- bring-up inputs (do not modify). Only `web` publishes `:3000`; `db`/`api` internal-only; test profile sets api build-arg `GO_BUILD_TAGS=testseed`.
- `api/Dockerfile` -- already accepts `GO_BUILD_TAGS`; runtime image is binary-only (no Go toolchain).
- `api/repository/repository_injection_test.go`, `repository_update_test.go`, `api/testhelpers/seed.go` -- `testseed` Go integration tests; read `DATABASE_URL`, skip if unset.
- `web/playwright.config.ts` -- CI mode expects external stack; `BASE_URL` env; projects `e2e`/`e2e-mobile`/`integration`; default reporter `list`.

## Tasks & Acceptance

**Execution:**
- [x] `.github/workflows/ci.yml` -- Add job `integration-e2e` (`runs-on: ubuntu-latest`, peer to `web`/`api`): checkout → `actions/setup-node@v5` (node 22, `cache: npm`, `cache-dependency-path: web/package-lock.json`) → `npm ci` and `npx playwright install --with-deps chromium webkit` (working-directory `web`; webkit needed for the iPhone SE `e2e-mobile` project) → bring up: `docker compose -p todoci -f docker-compose.yml -f docker-compose.test.yml up --build -d --wait --wait-timeout 240` → health gate: bounded retry poll of `http://localhost:3000/api/health` until 200 (fail after the bound) → api integration tests: `docker run --rm --network todoci_default -v "$GITHUB_WORKSPACE/api":/app -w /app -e DATABASE_URL=postgres://todo:todo@db:5432/todo?sslmode=disable golang:1.26-alpine go test -tags testseed ./...` → Playwright: `npm run test:e2e -- --reporter=list,html` (working-directory `web`, env `BASE_URL=http://localhost:3000`) → on failure (`if: failure()`): write `docker compose -p todoci … logs --no-color > compose-logs.txt` and `actions/upload-artifact@v4` for `web/playwright-report`, `web/test-results`, `compose-logs.txt` → teardown (`if: always()`): `docker compose -p todoci -f docker-compose.yml -f docker-compose.test.yml down -v`.
- [x] `.github/workflows/ci.yml` (`api` job) -- Surface a Go test-results summary (user request). Replace the plain `go test ./...` step with a `go test -json ./...` run that preserves the test exit status and writes a Markdown report (passed / failed / skipped counts + any failed test names) to `$GITHUB_STEP_SUMMARY` using `jq` (preinstalled on ubuntu runners). No new tool/dependency.
- [x] `.github/workflows/ci.yml` (all jobs) -- Bump actions to their Node-24 majors to clear deprecation warnings: `actions/checkout@v5`, `actions/setup-node@v5`, `actions/setup-go@v6`. Leave `golangci/golangci-lint-action@v7` and `actions/upload-artifact@v4` as-is (no Node-24 major exists yet). Keep all existing inputs (node 22, `go-version-file: api/go.mod`, caches, `golangci-lint` version `v2.12.2` + `install-mode: goinstall`).
- [x] `web/tests/e2e/toggle.spec.ts` and `web/tests/e2e/edit.spec.ts` -- Fix the pre-existing ambiguous rollback assertion `expect(page.getByRole('alert')).toBeVisible()` (fails strict-mode on the `e2e-mobile` project because it also matches Next's empty `#__next-route-announcer__`). Disambiguate to the app's error alert only, copy-agnostic and without weakening the assertion (e.g. exclude the empty announcer / scope to the visible error alert). No behavior/product change; the test still asserts the rollback error alert is shown.

**Acceptance Criteria:**
- Given a PR or push to `main`, when the pipeline runs, then the `integration-e2e` job starts the app via `docker compose -f docker-compose.yml -f docker-compose.test.yml up --build` (testseed profile).
- Given the stack is starting, when the job waits for readiness, then it gates on `GET /health` (migrated+serving) with a bounded timeout and no fixed-sleep gate, before any test runs.
- Given a ready stack, when tests run, then the api integration tests (`go test -tags testseed ./...` against the live db) and the Playwright suite (`npm run test:e2e`, ≥ the `@p0` set) run and must pass.
- Given the run finishes (pass or fail), when the job tears down, then the compose stack is stopped/cleaned (`down -v`), and on failure the Playwright report and stack logs are uploaded as artifacts.
- Given either lane is red, when the pipeline aggregates, then the combined CI status is red (peer jobs; both must be green).
- Given the `api` job runs its Go tests, when it completes, then a Go test-results summary (pass/fail/skip counts, plus failed test names on failure) appears in the job step summary, and a real test failure still fails the job.
- Given any job initializes, when its actions load, then `checkout`/`setup-node`/`setup-go` run on Node 24 (no deprecation warning from those); only the unavoidable `golangci-lint-action` / `upload-artifact` Node-20 notices may remain.

## Spec Change Log

_No bad_spec loopbacks. Note: the review's HIGH finding (Go-report `|| true` clobbering `PIPESTATUS`) originated in this spec's Design Notes golden snippet; it was patched directly in both `ci.yml` and the Design Notes snippet above during the review pass, without a full re-derivation loopback (the fix is a localized shell correction)._

## Review Triage Log

### 2026-07-19 — Review pass
Reviewers (per REVIEW OVERRIDE): GOPHER (agent-go-engineer) on the api/Go slice; PIXEL (agent-frontend-engineer) on the web/Playwright slice.
- intent_gap: 0
- bad_spec: 0
- patch: 5: (high 1, medium 1, low 3)
- defer: 1: (low 1)
- reject: 1
- addressed_findings:
  - `[high]` `[patch]` Go-report step's trailing `|| true` clobbered `PIPESTATUS`, so a setup/command-level `go test` failure that writes only to stderr (e.g. a stale `go.sum`) exited 0 → silent green gate. Removed the `|| true`, capture `${PIPESTATUS[0]}` directly; verified a stderr-only failure now exits 1 and a pass exits 0. Fixed the same snippet in the spec Design Notes.
  - `[medium]` `[patch]` e2e rollback alert locator hardened. The initial `.filter({ hasText: /\S/ })` worked but could false-pass on a *different* non-empty alert; a `getByRole('alert', { name })` attempt FAILED (the `alert` role has name-from-content=false — caught by local re-verification). Final: `getByRole('alert').filter({ hasText: /something got in the way/i })` — role + copy-specific, excludes Next's empty announcer, won't false-pass on a different alert. Verified 14/14 (both projects) and full suite 38/38.
  - `[low]` `[patch]` `gotest.json` now written to `$RUNNER_TEMP` (not `api/`), avoiding a stray artifact / accidental local commit.
  - `[low]` `[patch]` `DATABASE_URL` quoted in the `docker run` (the `?` was an unquoted shell glob metachar).
  - `[low]` `[patch]` Health-gate `curl` now uses `-m 5` so a hung connection can't block until the 6h job timeout.

### 2026-07-19 — Review pass 2 (surfaced by the real CI run on PR #16)
The first PR CI run made `integration-e2e` red: all `[e2e-mobile]` tests failed at launch (`browserType.launch: Executable doesn't exist at .../webkit-2311`). Local runs passed because the dev machine already had WebKit installed — only the real CI run (clean browser cache) exposed it.
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 1)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` The Playwright install step installed only `chromium`, but the `e2e-mobile` project uses `devices['iPhone SE']`, whose `defaultBrowserType` is **WebKit** — so every mobile test failed to launch. Changed to `npx playwright install --with-deps chromium webkit` (spec's Always/Task also corrected — the original grounding wrongly assumed iPhone SE ran on mobile Chromium).

## Design Notes

Bring-up + health gate (compose `--wait` covers db+api healthchecks; the poll is the explicit AD/TC5 gate from the runner):
```bash
docker compose -p todoci -f docker-compose.yml -f docker-compose.test.yml up --build -d --wait --wait-timeout 240
for i in $(seq 1 60); do
  curl -fsS http://localhost:3000/api/health && break
  [ "$i" = 60 ] && { echo "stack not healthy"; exit 1; }
  sleep 2
done
```
Go test report for the `api` job (self-contained; `jq` is preinstalled on ubuntu runners; preserve exit status):
```bash
# Capture ${PIPESTATUS[0]} with NO trailing `|| true` (which runs `true` and clobbers
# PIPESTATUS, hiding stderr-only setup failures like a stale go.sum). Write JSON to a temp path.
gt="$RUNNER_TEMP/gotest.json"
set +e
go test -json ./... | tee "$gt" | jq -r 'select(.Action=="output") | .Output' | grep -E '^(ok|FAIL|---)'
status=${PIPESTATUS[0]}
set -e
pass=$(jq -r 'select(.Test and .Action=="pass").Test' "$gt" | wc -l | tr -d ' ')
fail=$(jq -r 'select(.Test and .Action=="fail").Test' "$gt" | wc -l | tr -d ' ')
skip=$(jq -r 'select(.Test and .Action=="skip").Test' "$gt" | wc -l | tr -d ' ')
{
  echo "## Go Test Report"
  echo "- ✅ Passed: $pass"
  echo "- ❌ Failed: $fail"
  echo "- ⏭️ Skipped: $skip"
  if [ "$fail" != "0" ]; then
    echo ""; echo "**Failed:**"
    jq -r 'select(.Test and .Action=="fail") | "- `" + .Test + "`"' gotest.json
  fi
} >> "$GITHUB_STEP_SUMMARY"
exit "$status"
```
`db` is reachable as host `db` on network `todoci_default` (compose project `todoci`). `go test -tags testseed ./...` also compiles the testseed reset seam/routes, closing the 4.1-deferred "testseed never compiled" gap. Reporter is added via CLI (`--reporter=list,html`) so no test-config file is edited; HTML lands in `web/playwright-report`, traces/screenshots in `web/test-results`. `CI` is set automatically by GitHub Actions, so `playwright.config.ts` uses the external stack (no self-started webServer).

## Verification

GitHub Actions cannot run locally; validate by dry-running the job's command sequence (bring-up + `/api/health` 200 → the `golang:1.26-alpine` testseed container passes → `CI=1 BASE_URL=http://localhost:3000 npm run test:e2e` passes → `down -v` cleans up) and confirming `.github/workflows/ci.yml` parses with three jobs (`web`, `api`, `integration-e2e`). `git diff` must show only `ci.yml` + the 2 e2e specs changed. The real PR CI run is the authoritative check (per 4.1's lesson): the `integration-e2e` check must be green on the PR.

## Auto Run Result

Status: **done** · followup_review_recommended: **true**

**Change summary:** Added the `integration-e2e` CI lane (3rd job in `.github/workflows/ci.yml`, peer to `web`/`api`): it brings the real stack up with the testseed compose profile, health-gates on `GET /api/health`, runs the Go `testseed` integration suite (in a `golang:1.26-alpine` container joined to the compose network, since `db` is internal-only per AD-12), runs the full Playwright suite (`e2e` + `e2e-mobile` + `integration`), uploads the Playwright report + compose logs on failure, and always tears the stack down. Also, per user request in the same file: a Go test-results summary in the `api` job step summary (parity with the web Vitest summary), and action bumps to Node-24 majors (`checkout@v5`, `setup-node@v5`, `setup-go@v6`) to cut deprecation warnings. Fixed a pre-existing `@p0` e2e-mobile locator bug the new lane exposed. Built in an isolated worktree on branch `story/4-2-ci-integration-e2e-lane-health-gated`.

**Files changed:**
- `.github/workflows/ci.yml` — added the `integration-e2e` job; api job now emits a Go test report; Node-24 action bumps.
- `web/tests/e2e/toggle.spec.ts`, `web/tests/e2e/edit.spec.ts` — disambiguated the rollback alert locator (excludes Next's empty route-announcer).
- `_bmad-output/implementation-artifacts/` — this spec, recompiled `epic-4-context.md`, `deferred-work.md` (+1 defer), `sprint-status.yaml` (4.1→done earlier this session).

**Review findings** (GOPHER on api/Go, PIXEL on web/Playwright — per REVIEW OVERRIDE): 5 patches applied — the load-bearing one (HIGH): the Go-report `|| true` clobbered `PIPESTATUS`, hiding stderr-only `go test` failures (silent green) — removed it, capture `${PIPESTATUS[0]}` directly. Also: hardened the alert locator (a `getByRole('alert',{name})` attempt failed locally — `alert` role has name-from-content=false — corrected to `.filter({ hasText })`); `gotest.json`→`$RUNNER_TEMP`; quoted `DATABASE_URL`; health-gate `curl -m 5`. 1 deferred (Go container has no module cache — reliability nit). 1 rejected (report counts include subtests — cosmetic).

**Verification (local Docker dry-run — the authoritative check is the PR's own CI run):**
- Stack: `up --build -d --wait` → db/api/web all healthy; `GET /api/health` → `{"status":"ok"}`. ✔
- Go testseed container (quoted DSN): handler/repository/service pass against live Postgres. ✔
- Full Playwright suite: **38 passed** (e2e + e2e-mobile + integration), incl. both rollback cases on desktop+mobile. ✔
- Go-report exit-status fix proven in isolation: stderr-only failure → exit 1; pass → exit 0. ✔
- YAML parses, 3 jobs; teardown `down -v` removed the stack/volume. ✔

**Residual risks:** The real GitHub Actions run is the authoritative check (a full CI run couldn't be executed locally — only its component commands). The Go integration container re-downloads modules each run (deferred). `golangci-lint-action@v7` and `upload-artifact@v4` still emit unavoidable Node-20 deprecation notices (no Node-24 major exists yet).
