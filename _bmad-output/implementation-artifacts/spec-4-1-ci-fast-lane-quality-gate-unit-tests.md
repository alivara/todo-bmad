---
title: 'Story 4.1: CI fast lane — quality gate + unit tests'
type: 'chore'
created: '2026-07-19'
status: 'done'
baseline_revision: '8873f12ab8db8ba2ac0d4942e7ee7dc7813c5cdc'
final_revision: '68c33a8d2fb93644798f00e4f469a29f64722a1b'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/api/.golangci.yml'
warnings: []
---

<intent-contract>

## Intent

**Problem:** The quality gate (`eslint`, `prettier --check`, `gofmt`, `golangci-lint`) and the unit suites (web Vitest, api Go) are committed but run only by hand, so style regressions and broken units can reach review and `main` unverified.

**Approach:** Add a single GitHub Actions workflow `.github/workflows/ci.yml` that triggers on every `pull_request` and every `push` to `main`, running two parallel jobs — a `web` job and an `api` job — each of which runs its quality gate then its unit tests over the existing scripts, with toolchain versions matched to the project and dependency caching enabled. No product code changes.

## Boundaries & Constraints

**Always:**
- Invoke the *existing* commands/scripts verbatim; introduce no new test infra, no new npm scripts, no new lint config. Web scripts: `npm run lint`, `npm run format:check`, `npm run test:unit`. Api: `gofmt` diff check, `golangci-lint run ./...`, `go test ./...`.
- Web steps run with working-directory `web/`; api steps with working-directory `api/` (the repo has no root JS project; the real lockfile is `web/package-lock.json`).
- Pin Go to `1.26` (matches `api/go.mod`) and Node to an LTS compatible with Next 16.2 / React 19 (Node `22`). Enable dependency caching for both ecosystems.
- Fast lane is unit-only and must need NO Postgres, NO Docker, NO browser: run `go test ./...` WITHOUT `-tags testseed` (the DB-touching test and reset seam are `testseed`-guarded and stay excluded); web unit tests are jsdom.
- Any nonzero step exit fails its job; a failed job reports the check red on the PR/commit.
- Use maintained official actions (`actions/checkout`, `actions/setup-node`, `actions/setup-go`, `golangci/golangci-lint-action`). golangci-lint must be a **v2.x** release (the committed `.golangci.yml` is `version: "2"`).

**Block If:**
- Running any of the six gate/test commands locally on this branch does NOT pass (a red baseline means CI would be red on merge for reasons outside this story's scope) — HALT `blocked`, condition `pre-existing gate/test failure on baseline`.

**Never:**
- No E2E, integration, Playwright, `docker compose`, or DB service in this workflow — that is Story 4.2.
- No branch-protection / required-status configuration — that is Story 4.3.
- No changes to product source, test source, lint configs, or package scripts. The only new file is `.github/workflows/ci.yml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PR opened/updated | `pull_request` event | Both `web` and `api` jobs run all gate + unit steps | n/a |
| Push to `main` | `push` to `main` | Both jobs run | n/a |
| Push to a non-`main` branch (no PR) | `push` to other branch | Workflow does NOT run (only `pull_request` + `push:main`) | n/a |
| Lint / format violation | e.g. unformatted file | The offending step exits nonzero → job red → check red | Job fails fast on first nonzero step |
| Unit test failure | failing Vitest or `go test` | Test step exits nonzero → job red | Job red |
</intent-contract>

## Code Map

- `.github/workflows/ci.yml` -- NEW: the entire deliverable (workflow definition).
- `web/package.json` -- source of `lint` / `format:check` / `test:unit` scripts (do not modify).
- `web/package-lock.json` -- real lockfile → `npm ci` + setup-node cache key.
- `api/go.mod` -- Go version source (`go 1.26`); `api/go.sum` → setup-go cache key.
- `api/.golangci.yml` -- committed v2 lint config; run as `golangci-lint run ./...` from `api/`.

## Tasks & Acceptance

**Execution:**
- [x] `.github/workflows/ci.yml` -- Create the workflow. On-triggers: `pull_request` (default types) and `push` to `main`. Add a `concurrency` group keyed on ref that cancels superseded in-progress runs. Two jobs, `runs-on: ubuntu-latest`, running in parallel:
  - `web`: `actions/checkout` → `actions/setup-node` (node-version `22`, `cache: npm`, `cache-dependency-path: web/package-lock.json`) → `npm ci` → `npm run lint` → `npm run format:check` → `npm run test:unit`, all with `working-directory: web`.
  - `api`: `actions/checkout` → `actions/setup-go` (go-version `1.26`, cache on `api/go.sum`) → gofmt diff check that fails with the file list when nonempty → `golangci/golangci-lint-action` (v2.x, `working-directory: api`) → `go test ./...` in `api`.

**Acceptance Criteria:**
- Given a pull request or a push to `main`, when the pipeline runs, then the workflow at `.github/workflows/ci.yml` triggers (on `pull_request` and `push` to `main`).
- Given the web job, when the quality gate runs, then `eslint` and `prettier --check` run in `web` and any violation fails the job.
- Given the api job, when the quality gate runs, then a `gofmt` diff check and `golangci-lint run ./...` run in `api` and any violation fails the job.
- Given either job, when unit tests run, then web Vitest (`npm run test:unit`) and api `go test ./...` run and a nonzero exit fails the job — with no DB/Docker/browser required.
- Given job initialization, when toolchains are set up, then Node `22` and Go `1.26` are installed and dependency caching is enabled for both.
- Given any step fails, when the workflow completes, then the check is reported red on the PR/commit.

## Spec Change Log

_No bad_spec loopbacks — the review pass produced only patches and defers._

## Review Triage Log

### 2026-07-19 — Review pass
Reviewers (per REVIEW OVERRIDE): GOPHER (agent-go-engineer) on the api job; PIXEL (agent-frontend-engineer) on the web job.
- intent_gap: 0
- bad_spec: 0
- patch: 5: (high 1, medium 1, low 3)
- defer: 3: (medium 1, low 2)
- reject: 4
- addressed_findings:
  - `[high]` `[patch]` `golangci/golangci-lint-action@v6` cannot run golangci-lint v2 (the committed config is `version: "2"`; v6 targets v1) → the api quality gate would never pass. Bumped the action to `@v7` (verified: v7 "supports golangci-lint v2 only", still exposes `version`/`working-directory` inputs; `v2.1.6` release exists). golangci-lint AC now honestly enforceable.
  - `[medium]` `[patch]` `cancel-in-progress: true` cancelled superseded push-to-`main` runs, leaving a main commit with a non-green (cancelled) check — undercuts the honest merge signal. Scoped cancellation to PRs: `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`.
  - `[low]` `[patch]` No least-privilege token scope (flagged by both reviewers). Added top-level `permissions: { contents: read }`.
  - `[low]` `[patch]` `go-version: '1.26'` duplicated `api/go.mod` (drift risk). Switched to `go-version-file: api/go.mod` (single source of truth).
  - `[low]` `[patch]` Redundant `working-directory: api` on the gofmt step (job default already applies). Removed for consistency.

### 2026-07-19 — Review pass 2 (surfaced by the real CI run on PR #11)
The first PR CI run made the api job fail fast — verification that only an actual Actions run could provide (the flagged residual risk materialized).
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 1)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` golangci-lint refused to run: "the Go language version (go1.24) used to build golangci-lint is lower than the targeted Go version (1.26)". No prebuilt golangci-lint release is yet built with Go ≥1.26 (latest v2.12.2 is built with Go 1.25), so `install-mode: binary` cannot satisfy a module targeting Go 1.26. Fixed by pinning `version: v2.12.2` with `install-mode: goinstall`, so the action compiles golangci-lint from source using the setup-go Go 1.26 toolchain — the binary's embedded build-Go version then satisfies the check. Workflow-only change; `api/go.mod` (go 1.26) left untouched.

## Design Notes

gofmt diff check (no wrapper target exists), run in `api/`:
```yaml
- name: gofmt (diff check)
  working-directory: api
  run: |
    unformatted="$(gofmt -l .)"
    if [ -n "$unformatted" ]; then
      echo "gofmt needs to run on:"; echo "$unformatted"; exit 1
    fi
```
Two jobs (not one) so each ecosystem caches independently, runs in parallel, and surfaces as its own status check (Story 4.3 can later mark them required). `setup-go` module/build-caches from `go.sum` automatically. Set `golangci-lint-action`'s `version:` to a concrete v2 release for reproducibility (config is v2 schema).

## Verification

**Commands:** (run from the worktree root; these prove the gate would be green in CI — GitHub Actions itself cannot run locally)
- `cd web && npm ci && npm run lint && npm run format:check && npm run test:unit` -- expected: all pass, exit 0.
- `cd api && test -z "$(gofmt -l .)"` -- expected: no output, exit 0.
- `cd api && golangci-lint run ./...` -- expected: no issues, exit 0 (if `golangci-lint` v2 is unavailable locally, note it and rely on the CI step).
- `cd api && go test ./...` -- expected: all packages pass.
- Lint the YAML: confirm `.github/workflows/ci.yml` parses (valid YAML) and keys/triggers/jobs match the tasks above.

**Manual checks:**
- Confirm the workflow file references only existing scripts/paths and adds no product/test/config source changes (git diff shows only the new workflow file).

## Auto Run Result

Status: **done** · followup_review_recommended: **true**

**Change summary:** Added the first GitHub Actions CI workflow — a fast lane (quality gate + unit tests, no Docker/DB/browser) that runs on every `pull_request` and every `push` to `main`. Two parallel jobs: `web` (`npm ci` → eslint → prettier `--check` → Vitest, in `web/`, Node 22, npm cache) and `api` (gofmt diff check → golangci-lint v2 → `go test ./...`, in `api/`, Go from `go.mod`, module cache). No product/test/config source changed. Built in an isolated worktree on branch `story/4-1-ci-fast-lane-quality-gate-unit-tests` (based on `main`).

**Files changed:**
- `.github/workflows/ci.yml` — NEW: the entire deliverable (the CI fast-lane workflow).
- `_bmad-output/implementation-artifacts/spec-4-1-ci-fast-lane-quality-gate-unit-tests.md` — this spec (planning + review record).
- `_bmad-output/implementation-artifacts/epic-4-context.md` — NEW: compiled Epic 4 planning context.
- `_bmad-output/implementation-artifacts/deferred-work.md` — appended 3 deferred findings from this review.

**Review findings breakdown** (GOPHER on api, PIXEL on web — per REVIEW OVERRIDE):
- Patches applied (5): golangci-lint-action `@v6 → @v7` (v6 cannot run golangci-lint v2 — HIGH, gate was inoperable); `cancel-in-progress` scoped to PRs so main commits keep an honest check (medium); added `permissions: contents: read` (low); `go-version` → `go-version-file: api/go.mod` (low); removed redundant `working-directory` on the gofmt step (low).
- Deferred (3): testseed-tagged code uncompiled/unlinted by the fast lane (4.2 scope); `@types/node@^24` vs Node 22 runtime; no committed Node version pin (`.nvmrc`/`engines`).
- Rejected (4): informational cache-path note, first-run cache note, web-scoped-prettier boundary note, and a false-alarm "gofmt broken" note (an artifact of an abbreviated reviewer prompt — the real gofmt step was verified correct against disk).

**Verification performed** (GitHub Actions cannot execute locally; commands prove the gate would be green):
- web: `npm ci && npm run lint && npm run format:check && npm run test:unit` → all pass (30 unit tests). ✔
- api: `gofmt -l .` clean; `go test ./...` → `handler` + `service` pass, no DB needed (testseed excluded). ✔
- golangci-lint: not installed locally (not run); action pairing verified upstream — `golangci-lint-action@v7` "supports golangci-lint v2 only" and exposes `version`/`working-directory`; `golangci-lint v2.1.6` release exists (HTTP 200). Config `api/.golangci.yml` is `version: "2"`.
- YAML parses; triggers = `pull_request` + `push:[main]`; jobs = `web`, `api`; `permissions.contents: read`. ✔
- `git status`: only `.github/workflows/ci.yml` is a new tracked deliverable (no product/test/config source touched).

**Residual risks:** The actual GitHub Actions execution cannot be exercised until a real PR/push runs it — the golangci-lint v7-action/v2-binary step and the toolchain/cache setup are validated by upstream facts and local equivalents, not an actual CI run. `golangci-lint v2.1.6` is a floating-minor pin choice; a future config feature could need a newer v2 patch. `node-version: '22'` floats within the 22.x line (see deferred pin). This is why an independent follow-up review is recommended before merge.
