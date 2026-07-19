---
type: sprint-change-proposal
project: todo-app
date: 2026-07-19
author: Alivara
mode: batch
change_scope: moderate
status: proposed
---

# Sprint Change Proposal — Add CI/CD Epic (GitHub Actions test pipeline)

## Section 1 — Issue Summary

**Trigger:** New requirement from the team lead (Alivara) — "add a new epic for CI/CD on GitHub Actions for test, so on push it runs CI/CD to do tests."

**Category:** New requirement emerged from stakeholders (not a defect or failed approach).

**Problem statement:** The project has a complete, runnable test suite and quality tooling — `web` (Vitest unit, Playwright E2E, eslint/prettier), `api` (Go test + testify, gofmt/golangci-lint), and a dedicated `docker-compose.test.yml` (testseed) for integration/E2E — but **none of it runs automatically**. There is no `.github/` directory and no CI pipeline. Tests and quality gates are enforced only by developer discipline, so a regression can merge to `main` undetected. Epic 1 is done and Epics 2–3 (backlog) will add three more mutation paths and the systematized-rollback story (R1, the top-scored risk) — exactly the work most in need of an automated safety net.

**Supporting evidence (verified in repo):**
- `.github/` does **not** exist (no workflows).
- `web/package.json` scripts present: `lint`, `format:check`, `test:unit` (Vitest), `test:e2e` / `test:e2e:p0` (Playwright).
- `api/` has Go tests, `testhelpers/`, and a `testseed`-tagged reset seam; `docker-compose.test.yml` already exists to bring up the stack for integration/E2E.
- Architecture **already anticipates CI** — `ARCHITECTURE-SPINE.md`: `GET /health` "drives the compose healthcheck **and CI E2E gating**"; Tooling row: quality gate "committed and **CI-checkable** (NFR6)". This change *operationalizes* those existing anchors rather than adding new architecture.

## Section 2 — Impact Analysis

### Epic Impact
- **Epic 1 (done):** No change. Its tests/quality tooling become the first things CI runs.
- **Epic 2 & 3 (backlog):** No scope change. They *benefit* — every future story lands behind a green pipeline.
- **New epic required:** Yes — **Epic 4: Continuous Integration & Quality Gate**. This is the only structural change.
- **Sequencing:** Epic 4 is added at the end of the list (number 4) but **prioritized to run next**, before Epic 2 development resumes, so the regression net exists before more mutation paths are built.

### Artifact Conflicts
| Artifact | Conflict? | Action |
|---|---|---|
| **PRD** | None | No change. Epic 4 operationalizes existing NFR6 (quality gate) — no requirement is modified, added, or removed. |
| **Architecture** | None | No change required. Spine already names "CI E2E gating" (via `GET /health`) and "CI-checkable" quality gate (AR15). Epic 4 realizes these anchors. |
| **UX Design** | None (N/A) | No user-facing surface. |
| **Epics doc** (`epics.md`) | Additive | Add Epic 4 to the Epic List + a full Epic 4 section with stories. |
| **Sprint status** (`sprint-status.yaml`) | Additive | Add `epic-4` + its story entries at `backlog`. |
| **CI/CD pipeline** | Missing → created | New `.github/workflows/ci.yml` is the primary deliverable of Epic 4 (built during story execution, not in this proposal). |
| **README** | Minor | Add a CI status badge + a short "Continuous Integration" note (Story 4.3). |

### Technical Impact
- New files under `.github/workflows/` (created during dev, not now).
- No production code change; no schema change; no wire-contract change.
- CI reuses existing scripts and `docker-compose.test.yml` verbatim — no new test infrastructure invented.
- **MVP impact: none.** The defined MVP remains fully achievable; this strengthens NFR6/AR15 enforcement.

## Section 3 — Recommended Approach

**Selected path: Option 1 — Direct Adjustment (add a new epic within the existing plan).**

- **Option 1 (Direct Adjustment) — VIABLE ✅ (chosen).** Add Epic 4 with 3 stories; no changes to existing epics/stories. Effort: **Medium**. Risk: **Low** (additive, reuses existing scripts/compose).
- **Option 2 (Rollback) — NOT VIABLE.** Nothing to roll back; no completed work conflicts with adding CI.
- **Option 3 (MVP Review) — NOT VIABLE / unnecessary.** MVP scope is unaffected; no reduction or redefinition needed.

**Rationale:** The tests and quality tooling already exist and pass locally; the gap is purely orchestration. A new, self-contained epic is the cleanest fit — it maps 1:1 to existing anchors (AR15/NFR6, `GET /health` CI gating), adds a durable regression net before Epics 2–3 add more mutation paths, and touches no existing story. Prioritizing it *now* (before Epic 2 resumes) maximizes value: every subsequent story merges green.

## Section 4 — Detailed Change Proposals

### 4A — `epics.md`: add Epic 4 to the Epic List

**Location:** `## Epic List`, appended after the Epic 3 entry (line ~186).

```
### Epic 4: Continuous Integration & Quality Gate
Every push and pull request is automatically verified by a GitHub Actions pipeline
that runs the committed quality gate and the full test suite — operationalizing the
"CI-checkable" quality gate (AR15/NFR6) and the spine's `GET /health`-driven CI E2E
gating. A fast lane (lint/format + unit tests) gives quick signal; a health-gated
integration/E2E lane runs the api integration tests and Playwright E2E against the
`docker-compose.test.yml` (testseed) stack. Triggered on pull_request and on push to
`main`; a red pipeline blocks merge. No product code changes — this wires existing,
already-passing scripts into automation and makes green CI the precondition for every
future story in Epics 2 and 3.
**FRs covered:** none (infrastructure/quality epic) — enforces NFR6
**Anchors:** AR15 (eslint+prettier / gofmt+golangci-lint, CI-checkable) · NFR6 (clean,
linted, passing) · GET /health CI E2E gating (spine) · reuses docker-compose.test.yml
[TC1 reset seam] and GET /health [TC5]
**Priority note:** Sequenced to run NEXT (before Epic 2 dev resumes) so the regression
net exists before more mutation paths (Epics 2–3) are built.
```

### 4B — `epics.md`: add the full Epic 4 section

**Location:** appended at end of file (after Story 3.5).

```
## Epic 4: Continuous Integration & Quality Gate

Automate the already-committed quality gate and test suite on GitHub Actions so every
pull request and every push to main is verified without manual steps — a green pipeline
becomes the precondition for merge. Reuses existing scripts and the test compose profile
verbatim; introduces no new test infrastructure and no product code change.

### Story 4.1: CI fast lane — quality gate + unit tests

As a developer,
I want lint/format and unit tests to run automatically on every PR and push to main,
So that style regressions and broken units are caught in minutes, before review.

**Acceptance Criteria:**

**Given** a pull request or a push to `main`
**When** the pipeline runs
**Then** a GitHub Actions workflow at `.github/workflows/ci.yml` triggers on
`pull_request` and on `push` to `main`

**Given** the fast-lane job
**When** it runs the quality gate
**Then** it runs, and fails on any violation of: `eslint` + `prettier --check` in `web`
and `gofmt` (diff check) + `golangci-lint` in `api` (AR15/NFR6)

**Given** the fast-lane job
**When** it runs unit tests
**Then** `web` Vitest (`npm run test:unit`) and `api` Go unit tests (`go test ./...`)
both run and must pass; a non-zero exit fails the job

**Given** dependency setup
**When** the job initializes
**Then** Node and Go toolchains match the project versions (Node for Next.js 16.2, Go
1.26) and dependency caching is enabled for reasonable run times

**Given** any step fails
**When** the workflow completes
**Then** the overall check is reported red on the PR/commit (the merge signal is honest)

### Story 4.2: CI integration & E2E lane (health-gated)

As a developer,
I want the api integration tests and the Playwright E2E suite to run against the real
Dockerized stack in CI,
So that cross-unit regressions (wire contract, optimistic flows) are caught automatically.

**Acceptance Criteria:**

**Given** the integration/E2E job
**When** it starts the stack
**Then** it brings up the app via `docker compose -f docker-compose.yml -f
docker-compose.test.yml up --build` (the testseed profile compiles the
`/internal/test/reset` seam, per TC1)

**Given** the stack is starting
**When** the job waits for readiness
**Then** it gates on `GET /health` reporting migrated + serving before any test runs
(no fixed sleeps; per the spine's CI E2E gating [TC5]) with a bounded timeout

**Given** a ready stack
**When** the job runs tests
**Then** the `api` integration tests and the Playwright E2E suite (`npm run test:e2e`,
at minimum the `@p0` set via `test:e2e:p0`) run and must pass

**Given** the run finishes (pass or fail)
**When** the job tears down
**Then** the compose stack is stopped/cleaned up, and on failure the Playwright
report / relevant logs are uploaded as workflow artifacts for debugging

**Given** either the fast lane or this lane is red
**When** the pipeline aggregates
**Then** the combined CI status is red (both lanes must be green to pass)

### Story 4.3: Merge protection, status surface & docs

As a maintainer,
I want CI to be the enforced gate for merging and its status visible in the README,
So that no unverified change reaches main and contributors know the workflow.

**Acceptance Criteria:**

**Given** the repository
**When** CI is established
**Then** the required status checks for merging into `main` are documented (branch-
protection settings: PRs must be green to merge) in the README/CONTRIBUTING note

**Given** the README
**When** a reader opens it
**Then** a CI status badge for the workflow is shown and a short "Continuous
Integration" section explains what runs on push/PR and how to run the same checks
locally (the exact `npm run` / `go test` / compose commands CI uses)

**Given** NFR7 (clone→run ≤10 min, no undocumented steps)
**When** a new developer reads the docs
**Then** the CI story adds no manual local setup step — the documented local commands
are the same ones CI invokes, keeping local and CI behavior consistent
```

### 4C — `sprint-status.yaml`: add Epic 4 entries

**Location:** `development_status:` map, appended after the Epic 3 block.

```yaml
  # Epic 4: Continuous Integration & Quality Gate  (prioritized: run next)
  epic-4: backlog
  4-1-ci-fast-lane-quality-gate-unit-tests: backlog
  4-2-ci-integration-e2e-lane-health-gated: backlog
  4-3-merge-protection-status-surface-docs: backlog
  epic-4-retrospective: optional
```

Also update the top comment block's `last_updated` and add a provenance line noting Epic 4 was added via correct-course on 2026-07-19.

### 4D — Architecture / PRD / UX

No edits. Architecture already anticipates CI gating (`GET /health` + AR15 "CI-checkable"); PRD NFR6 is enforced, not changed; UX has no surface here.

## Section 5 — Implementation Handoff

**Change scope classification: MODERATE** (backlog reorganization — a new epic + stories added; no strategic replan, no architecture change).

**Handoff plan:**
1. **This workflow (on approval):** apply doc edits 4A–4C — update `epics.md` (Epic List + Epic 4 section) and `sprint-status.yaml`.
2. **Story creation (Product Owner / `create-story`):** generate the Story 4.1 context file (`ready-for-dev`) when Epic 4 starts; then 4.2, 4.3 in sequence, incorporating learnings.
3. **Developer agent (`dev-story` / `dev-auto`):** implement `.github/workflows/ci.yml`, wire the two lanes, add README badge + docs. Verify by pushing a branch and confirming the pipeline runs and is green.
4. **Sequencing:** Epic 4 runs **before** Epic 2 development resumes.

**Success criteria:**
- A PR and a push to `main` both trigger `.github/workflows/ci.yml`.
- Fast lane (lint/format + unit) and health-gated integration/E2E lane both run; a failure anywhere reports red.
- CI reuses existing scripts + `docker-compose.test.yml` with no new local setup steps (NFR7 preserved).
- README shows a CI badge; merge protection is documented.
