# Epic 4 Context: Continuous Integration & Quality Gate

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Automate the project's already-committed quality gate and test suite on GitHub Actions so every pull request and every push to `main` is verified without manual steps, making a green pipeline the precondition for merge. This is an infrastructure/quality epic: it wires existing, already-passing scripts and the existing Dockerized test-compose profile into automation, introducing no product code, schema, or wire-contract change and no new test infrastructure. The pipeline is split into a fast lane (lint/format + unit tests) for quick signal and a health-gated integration/E2E lane (api integration + Playwright) that runs against the real Dockerized stack; a red result on either lane blocks merge. It is deliberately sequenced to run before Epic 2 development resumes so the regression net exists before more mutation paths are built.

## Stories

- Story 4.1: CI fast lane — quality gate + unit tests
- Story 4.2: CI integration & E2E lane (health-gated)
- Story 4.3: Merge protection, status surface & docs

## Requirements & Constraints

- Operationalizes the "clean, linted, passing, CI-checkable" quality-gate requirement (NFR6) and the committed lint/format toolchain. This epic maps no product feature requirements — it enforces existing ones.
- Reuse existing scripts and the existing test compose profile verbatim. Invent no new test infrastructure; add no product code change.
- Triggers: on `pull_request` and on `push` to `main`. If any step fails, the overall check must report red on the PR/commit and block merge — the merge signal must be honest.
- Both lanes must pass for CI to be green; either lane red makes the combined/aggregate status red.
- Local/CI parity (NFR7, clone→run ≤10 min, no undocumented steps): CI must invoke the same commands a developer runs locally, and the docs must add no manual local setup step, so local and CI behavior stay identical.
- Toolchains must match project versions (Node for Next.js 16.2, Go 1.26) with dependency caching enabled for reasonable run times.
- Success surface: a CI status badge and a short "Continuous Integration" section in the README (what runs on push/PR, plus the exact local commands CI uses), and the required-status-check / branch-protection expectations for merging into `main` captured in the README/CONTRIBUTING note.

## Technical Decisions

- **Workflow location:** a single GitHub Actions workflow at `.github/workflows/ci.yml`, structured as two lanes.
- **Fast lane (quick signal):** runs the quality gate — `eslint` + `prettier --check` in `web`, and `gofmt` (diff check) + `golangci-lint` in `api` — plus unit tests: `web` Vitest (`npm run test:unit`) and `api` Go unit tests (`go test ./...`). Any non-zero exit fails the job.
- **Integration/E2E lane (health-gated):** brings the stack up with `docker compose -f docker-compose.yml -f docker-compose.test.yml up --build`. The testseed profile compiles the test-only reset seam at `/internal/test/reset` (build-tag `testseed` guarded, never prod-reachable). It then runs the `api` integration tests and the Playwright E2E suite (`npm run test:e2e`; at minimum the `@p0` set via `test:e2e:p0`). All must pass.
- **Readiness gating:** wait on `GET /health` reporting migrated + serving before any test runs — no fixed sleeps, bounded timeout that polls health. Startup is healthcheck-gated (`db` healthy → `api` migrate then serve → `web`), so health readiness is the correct signal that migrations have applied. `GET /health` is the same endpoint that drives the compose healthcheck.
- **Teardown & diagnostics:** stop/clean the compose stack after the run (pass or fail); on failure upload the Playwright report and relevant logs as workflow artifacts for debugging.
- **Ports & secrets:** only `web` exposes a host port (`api`/`db` internal-only), so tests reach `api` through the proxy; `BASE_URL` comes from env, never hardcoded, and no secrets appear in the workflow or test files. Config is 12-factor env with working defaults baked into compose, so bringing the stack up in CI needs no extra setup.
- **Monorepo layout the workflow spans:** `web/` (Node/Next client), `api/` (Go service), `shared/` (wire-contract type), with `docker-compose.yml` and `docker-compose.test.yml` at the root.
- **Note on test conventions:** the suite already forbids hard waits (`waitForTimeout`) in favor of network-first sync and a fake clock; CI does not change this — it only executes the existing suites, so relative-time and ~5s undo-window tests stay deterministic. The flagship P0 coverage is optimistic-rollback and the create core-loop E2E.

## Cross-Story Dependencies

- Story ordering is incremental: 4.1 (fast lane) → 4.2 (integration/E2E lane) → 4.3 (merge protection + README badge/docs). 4.3's combined-status and merge-gate work assumes both lanes from 4.1 and 4.2 exist.
- Depends on Epic 1 deliverables already in the repo: the `web`/`api` npm and Go scripts, the linter/formatter configs, `docker-compose.test.yml` with the testseed `/internal/test/reset` seam [TC1], and the `GET /health` readiness route [TC5] — all scaffolded in Epic 1's infra walking-skeleton story. Epic 4 consumes these; it does not create them.
- Sequenced ahead of Epics 2 and 3: green CI becomes the precondition for every future mutation-path story, including the flagship systematized-rollback (P0) work in Epic 3.
