# Epic 4 Context: Continuous Integration & Quality Gate

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Automate the project's already-committed quality gate and test suite on GitHub Actions so every pull request and every push to `main` is verified without manual steps, making a green pipeline the precondition for merge. This is an infrastructure/quality epic: it wires existing, already-passing scripts and the existing Dockerized test-compose profile into automation, introducing no product code, schema, or wire-contract change and no new test infrastructure. Signal is split into a fast lane (lint/format + unit tests) for quick feedback and a health-gated integration/E2E lane (api integration + Playwright) that runs against the real Dockerized stack; a red result anywhere blocks merge. The epic is deliberately sequenced ahead of Epic 2/3 development so the regression net exists before more mutation paths are built.

## Stories

- Story 4.1: CI fast lane — quality gate + unit tests (DONE, merged)
- Story 4.2: CI integration & E2E lane, health-gated (DONE, merged)
- Story 4.3: Merge protection, status surface & docs (active — about to be developed)

## Requirements & Constraints

- Operationalizes the "clean, linted, passing, CI-checkable" quality-gate requirement (NFR6). This epic maps no product feature requirements — it enforces existing ones.
- Reuse existing scripts and the existing test compose profile verbatim. Invent no new test infrastructure; make no product code change.
- The pipeline (workflow + both lanes) already exists and passes from Stories 4.1/4.2. Story 4.3 adds only documentation and the human-facing merge gate — no workflow logic change is required, though 4.3 must name the workflow's check(s) accurately when documenting required status checks.
- **Local/CI parity (NFR7):** the commands CI runs must be the exact commands a developer runs locally, and the docs must add no manual local setup step. The "run the same checks locally" section must transcribe the commands the workflow actually invokes — do not invent new scripts or wrappers.
- **Merge gate must be honest:** documented branch-protection expectations for `main` are "PRs must be green to merge"; any red lane blocks merge.
- **Success surface (4.3 deliverables):** a CI status badge in the README, a short "Continuous Integration" section (what runs on push/PR + the exact local commands), and the required-status-check / branch-protection settings captured in the README and/or a CONTRIBUTING note.

## Technical Decisions

- **Workflow:** a single file at `.github/workflows/ci.yml`, triggered on `pull_request` and on `push` to `main`. It is structured as **three jobs**, not one — `web` (lint/format/unit), `api` (gofmt/golangci-lint/go test), and `integration-e2e` (dockerized stack). Conceptually the two `web`/`api` jobs are the "fast lane" and `integration-e2e` is the slow lane; all three must pass. 4.3 docs should describe checks in terms of these actual job names.
- **Fast lane commands (must match docs):** `web` → `npm run lint`, `npm run format:check`, `npm run test:unit`; `api` → `gofmt` diff check, `golangci-lint`, `go test ./...`. Any non-zero exit fails the job.
- **Integration/E2E lane:** stack up via `docker compose -f docker-compose.yml -f docker-compose.test.yml up --build` (project-scoped, `-d --wait`); the testseed profile compiles the test-only reset seam (`/internal/test/reset`, build-tag `testseed`, never prod-reachable). Then Go integration tests (`go test -tags testseed ./...` in a container on the compose network) and Playwright E2E (`npm run test:e2e`) run and must pass.
- **Readiness gating:** poll `GET /api/health` **through the proxy** (`http://localhost:3000/api/health`) with a bounded retry loop — no fixed sleeps. `api`/`db` are host-unreachable (only `web` exposes a port, AD-12), so the proxied path is the only reachable health surface. Health-ready implies migrations applied (startup is healthcheck-gated: `db` healthy → `api` migrate+serve → `web`).
- **Teardown & diagnostics:** stack is torn down with `down -v` in an `always()` step; on failure the Playwright report and compose logs upload as workflow artifacts.
- **Toolchain versions:** Node 22 (setup-node, npm cache) and Go from `api/go.mod` (setup-go). Note: `golangci-lint` is installed via `goinstall` (built from source with Go 1.26) because prebuilt release binaries lag the module's Go version — a real constraint if the workflow is ever touched.
- **Ports & secrets:** tests reach `api` only through the `web` proxy; `BASE_URL` comes from env, never hardcoded; no secrets in the workflow or test files. `permissions: contents: read` (least privilege).

## Cross-Story Dependencies

- **Within Epic 4:** 4.1 (fast lane) and 4.2 (integration/E2E lane) are merged; 4.3's badge, "same commands locally," and required-status-check docs describe the pipeline those two stories built — 4.3 must read the shipped `.github/workflows/ci.yml` and `README.md` for exact job names and commands rather than inventing them.
- **On Epic 1:** the pipeline consumes Epic 1 deliverables already in the repo — the `web` npm scripts, the `api` Go scripts, the committed linter/formatter configs, `docker-compose.test.yml` with the testseed `/internal/test/reset` seam [TC1], and the `GET /health` readiness route [TC5]. Epic 4 does not create these.
- **On Epics 2 & 3:** green CI becomes the precondition for every future mutation-path story, including the flagship systematized-rollback (P0) work in Epic 3.
