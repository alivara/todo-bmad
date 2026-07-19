# Epic 4 Context: Continuous Integration & Quality Gate

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic makes the project's already-committed, already-passing quality tooling and test suite run automatically on GitHub Actions, so every pull request and every push to `main` is verified without manual steps and a green pipeline becomes the precondition for merge. The tests, linters, formatters, and the dedicated test compose profile already exist and pass locally — the only gap is orchestration. Epic 4 wires those existing scripts into automation, turning developer discipline into an enforced regression net. It is deliberately sequenced to run before Epic 2 development resumes, so the safety net exists before more mutation paths (Epics 2–3) are built. This is a pure infrastructure/quality epic: no product code, schema, or wire-contract changes.

## Stories

- Story 4.1: CI fast lane — quality gate + unit tests
- Story 4.2: CI integration & E2E lane (health-gated)
- Story 4.3: Merge protection, status surface & docs

## Requirements & Constraints

- Operationalizes the "clean, linted, passing, CI-checkable" quality-gate requirement (NFR6) and the committed lint/format toolchain. This epic maps no product feature requirements — it enforces existing ones.
- Reuse existing scripts and the existing test compose file verbatim. Invent no new test infrastructure; add no product code change.
- Preserve the zero-manual-setup guarantee (NFR7, clone→run ≤10 min): the commands CI runs must be the same ones a developer runs locally. CI adds no new local setup step, so local and CI behavior stay identical.
- Triggers: on `pull_request` and on `push` to `main`. A red pipeline must report red on the PR/commit and block merge — the merge signal must be honest.
- Both lanes must pass for CI to be green; either lane red makes the combined status red.
- Merge protection (required status checks / branch protection) and the CI story's docs must be captured in the README/CONTRIBUTING, including a status badge and the exact local commands CI invokes.

## Technical Decisions

- **Workflow location:** a single GitHub Actions workflow at `.github/workflows/ci.yml`, structured as two lanes.
- **Fast lane (quick signal):** runs the quality gate — `eslint` + `prettier --check` in `web`, and `gofmt` (diff check) + `golangci-lint` in `api` — plus unit tests: `web` Vitest (`npm run test:unit`) and `api` Go unit tests (`go test ./...`). Any non-zero exit fails the job.
- **Integration/E2E lane (health-gated):** brings the stack up with `docker compose -f docker-compose.yml -f docker-compose.test.yml up --build`. The test compose profile (testseed) compiles the test-only reset seam at `/internal/test/reset` (build-tag `testseed` guarded, never prod-reachable). It then runs the `api` integration tests and the Playwright E2E suite (`npm run test:e2e`; at minimum the `@p0` set via `test:e2e:p0`).
- **Readiness gating:** wait on `GET /health` reporting migrated + serving before any test runs — no fixed sleeps, bounded timeout. `GET /health` is the same readiness endpoint that drives the compose healthcheck.
- **Toolchains & caching:** Node toolchain matching Next.js 16.2 and Go 1.26; enable dependency caching for reasonable run times.
- **Teardown & diagnostics:** stop/clean the compose stack after the run; on failure upload the Playwright report and relevant logs as workflow artifacts.
- **Monorepo layout the workflow spans:** `web/` (Node/Next client), `api/` (Go service), `shared/` (wire-contract type), with `docker-compose.yml` and `docker-compose.test.yml` at the root.
- **Note on test conventions:** the suite already forbids hard waits (`waitForTimeout`) in favor of network-first sync and a fake clock; CI does not change this — it only executes the existing suites, so relative-time and the ~5s undo-window tests stay deterministic.

## Cross-Story Dependencies

- Story ordering is incremental: 4.1 (fast lane) → 4.2 (integration/E2E lane) → 4.3 (merge protection + README badge/docs). 4.3's combined-status and merge-gate work assumes both lanes from 4.1 and 4.2 exist.
- Depends on Epic 1 deliverables already in the repo: the `web`/`api` npm and Go scripts, the linter/formatter configs, `docker-compose.test.yml` with the testseed reset seam, and the `GET /health` endpoint. Epic 4 consumes these; it does not create them.
- Sequenced ahead of Epics 2 and 3: green CI becomes the precondition for every future mutation-path story, including the flagship systematized-rollback (P0) work in Epic 3.
