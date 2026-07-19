---
title: 'Story 4.3: Merge protection, status surface & docs'
type: 'chore'
created: '2026-07-19'
status: 'done'
baseline_revision: 'f8ea299'
final_revision: 'f145697'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/.github/workflows/ci.yml'
warnings: []
---

<intent-contract>

## Intent

**Problem:** CI now runs on every PR/push (Stories 4.1 + 4.2), but nothing surfaces it: the README has no status badge, no "what runs / how to run it locally" section, and the fact that merging into `main` should require green CI is neither documented nor enforced. A contributor can't see CI health or know the gate.

**Approach:** Add a CI status badge and a concise "Continuous Integration" section to `README.md` documenting what runs on push/PR, the **exact** local commands CI invokes (NFR7 parity), and the required-status-checks / branch-protection settings for merging into `main` (PRs must be green). Also fix the now-stale README note claiming the test suite is "installed in a later story." Docs only — no code, workflow, or product change. Actually applying the GitHub branch-protection setting is a repo-admin step, documented here (and offered separately), not part of the committed artifact.

## Boundaries & Constraints

**Always:**
- The badge must point to the real workflow: `https://github.com/alivara/todo-bmad/actions/workflows/ci.yml`.
- Every local command the docs present as "what CI runs" must be **verbatim** what `.github/workflows/ci.yml` actually invokes — cross-check against the shipped file, do not invent scripts. Keep local==CI (NFR7): no new manual setup step.
- Name the three real required status checks exactly as GitHub shows them (the job `name:` values): `web (lint / format / unit)`, `api (gofmt / golangci-lint / go test)`, `integration-e2e (dockerized stack)`.
- Document the branch-protection intent plainly: merging into `main` requires a PR whose three CI checks are all green.

**Block If:**
- The shipped `ci.yml` cannot be read to source exact job names/commands — HALT `blocked`, condition `cannot source CI facts from ci.yml`.

**Never:**
- No change to product/code/test source, `.github/workflows/ci.yml`, or any compose/config file. The only changed file is `README.md` (a new `CONTRIBUTING.md` is acceptable only if used instead of the README section — but prefer the single README section).
- Do not invent npm/go scripts or CI steps that aren't in `package.json`/`ci.yml`.
- Do not reconfigure the live GitHub branch-protection setting as part of this committed artifact (it's a repo-admin action) — only document it.
- No new CI jobs, badges for non-existent workflows, or shields.io external services (use GitHub's native badge).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reader opens README | rendered md | CI badge visible near the top; "Continuous Integration" section present | n/a |
| Contributor wants to reproduce CI | reads CI section | Finds the exact `npm run` / `go test` / `docker compose` commands CI runs, no extra setup | n/a |
| Maintainer sets up merge gate | reads CI section | Finds the 3 required check names + "PRs must be green to merge into main" | n/a |
| Badge before first post-merge run | GitHub renders badge | Shows latest `ci.yml` status on the default branch | GitHub-owned; no repo action |

</intent-contract>

## Code Map

- `README.md` -- MODIFY: add the CI badge (under the title) + a "Continuous Integration" section; fix the stale "suite … installed in a later story" note (lines ~86–87).
- `.github/workflows/ci.yml` -- READ-ONLY source of truth for job names, triggers, and the exact commands to document (do not modify).
- `web/package.json` / `api/go.mod` -- READ-ONLY: confirm the local script names cited (`lint`, `format:check`, `test:unit`, `test:e2e`; `go test`, `gofmt`, `golangci-lint`).

## Tasks & Acceptance

**Execution:**
- [x] `README.md` -- (1) Add a GitHub CI status badge immediately under the `# todo-app` title, linking to the workflow's Actions page. (2) Add a `## Continuous Integration` section that documents: the triggers (every PR + every push to `main`); the three jobs and what each runs (fast lane — `web`: eslint + `prettier --check` + Vitest; `api`: gofmt diff + golangci-lint + `go test` with a step-summary report; and `integration-e2e`: brings up the Dockerized stack with the testseed compose profile, health-gates on `GET /api/health`, runs the Go `testseed` integration suite + the full Playwright suite, uploads report/logs on failure, tears down); the **exact local commands** CI invokes so a contributor can reproduce them (keep them consistent with the existing "Development & tests" section — NFR7 local==CI, no new setup); and a short **merge protection** note listing the three required status checks (`web (lint / format / unit)`, `api (gofmt / golangci-lint / go test)`, `integration-e2e (dockerized stack)`) and stating that a PR must have all three green before it can merge into `main` (with the one-line branch-protection setup a maintainer applies). (3) Fix the stale note that the Playwright/Vitest/Go integration suite is "scaffolded … installed in a later story" — it now runs locally and in CI.

**Acceptance Criteria:**
- Given the repository, when CI is established, then the required status checks for merging into `main` (PRs must be green) are documented in the README, naming the three checks.
- Given the README, when a reader opens it, then a CI status badge is shown and a "Continuous Integration" section explains what runs on push/PR and how to run the same checks locally (the exact `npm run` / `go test` / compose commands CI uses).
- Given NFR7 (clone→run ≤10 min, no undocumented steps), when a new developer reads the docs, then the CI story adds no manual local setup step — the documented local commands are the same ones CI invokes.

## Spec Change Log

_No bad_spec loopbacks. The review's findings were doc-completeness patches (the local commands didn't fully reproduce CI); the spec's intent — "documented local commands are the exact ones CI invokes" — was correct, so the fixes were applied directly to README.md._

## Review Triage Log

### 2026-07-19 — Review pass
Reviewers (per REVIEW OVERRIDE): GOPHER (agent-go-engineer) on the api/CI/merge-protection claims; PIXEL (agent-frontend-engineer) on the web/Playwright claims + markdown quality. Factual core verified correct by both (job names, triggers, badge, health paths, required-check names, stale-note fix).
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 1, medium 3, low 2)
- defer: 0
- reject: 1
- addressed_findings:
  - `[high]` `[patch]` Local E2E block omitted `npx playwright install` — `npm run test:e2e` fails on a fresh checkout (breaks NFR7/AC3). Added `npx playwright install --with-deps chromium webkit` before the run.
  - `[medium]` `[patch]` `golangci-lint run ./...` would hard-fail for contributors with a prebuilt binary (lags Go 1.26, refuses a `go 1.26` module). Added a note: CI builds v2.12.2 via `goinstall`; match locally with `go install …/golangci-lint@v2.12.2`.
  - `[medium]` `[patch]` No local command to reproduce the Go `testseed` integration suite (only Playwright was shown). Added the exact `docker run … golang:1.26-alpine go test -tags testseed ./...` on the compose network.
  - `[medium]` `[patch]` Local compose `up -d` lacked `--wait` and `-p todoci`, risking a race where Playwright's own webServer spawns a second, port-colliding stack, and a network-name mismatch for the Go step. Added `-p todoci --wait --wait-timeout 240` (consistent with the `--network todoci_default` used by the Go step).
  - `[low]` `[patch]` "run the same checks locally" used `npm install`; CI uses `npm ci` — switched to `npm ci` for parity (noted `npm install` also works).
  - `[low]` `[patch]` Called `docker-compose.test.yml` a "compose profile" (it's a compose override, no `profiles:` key); corrected wording. Also noted CI runs on Node 22.
  - Rejected (1): minor duplication between "Development & tests" and "Run the same checks locally" web blocks — acceptable (they serve different purposes and are cross-linked).

## Design Notes

Badge (GitHub-native, no external service):
```markdown
[![CI](https://github.com/alivara/todo-bmad/actions/workflows/ci.yml/badge.svg)](https://github.com/alivara/todo-bmad/actions/workflows/ci.yml)
```
Required-check names are the job `name:` values in `ci.yml` (that's what GitHub's branch-protection UI lists). Branch protection itself is applied by a maintainer (Settings → Branches → protect `main` → require PR + require those status checks), or via `gh api` — document it; do not apply it in the commit. Keep the CI section aligned with the existing "Development & tests" commands so there is one set of commands, not two.

## Verification

Docs-only change. Confirm: the badge URL matches `https://github.com/alivara/todo-bmad/actions/workflows/ci.yml/badge.svg`; every command in the CI section matches a script in `web/package.json` or a command in `ci.yml` (cross-check, no invented commands); the three required-check names match the `name:` fields in `ci.yml` exactly; `README.md` is valid Markdown and renders (headings/links/code fences well-formed); `git diff` shows only `README.md` changed. The badge's live status is GitHub-owned and needs no repo action.

## Auto Run Result

Status: **done** · followup_review_recommended: **true**

**Change summary:** Documentation-only story (README.md). Added a GitHub CI **status badge** under the title, a **`## Continuous Integration`** section (triggers, the three jobs and what each runs, "run the same checks locally" with the exact commands, and a **merge-protection** subsection naming the three required checks + the maintainer branch-protection setup), and fixed the now-stale note claiming the test suite was "installed in a later story." No code/workflow/product change. Built in an isolated worktree on `story/4-3-merge-protection-status-surface-docs`.

**Files changed:**
- `README.md` — CI badge, Continuous Integration section, merge-protection note, stale-note fix.
- `_bmad-output/implementation-artifacts/` — this spec, recompiled `epic-4-context.md`.

**Review** (GOPHER on api/CI/merge-protection, PIXEL on web/Playwright/markdown — per REVIEW OVERRIDE): factual core verified correct (job names, triggers, badge, health paths, required-check names). 6 patches applied to make the "run locally" commands actually reproduce CI (the crux of AC3/NFR7): added `npx playwright install --with-deps chromium webkit` (HIGH — E2E block failed on a fresh checkout), a golangci-lint v2.12.2/`goinstall` note (prebuilt binaries lag Go 1.26), a local Go `testseed` integration command, `-p todoci --wait` on the compose bring-up (race + network-name consistency), `npm ci` for parity, and a "compose override" wording fix. 1 rejected (minor web-block duplication, cross-linked).

**Verification:** badge URL correct; all documented commands cross-checked against `web/package.json` + `ci.yml` (no invented commands); three required-check names match the `name:` fields exactly; 14 code fences balanced, anchor links valid; `git diff` shows only `README.md`. (Docs render check is static; the badge goes live once CI runs on the merge commit.)

**Residual risks:** Applying the branch-protection setting itself is a repo-admin action (documented, not applied by this artifact) — a maintainer must enable it in GitHub Settings → Branches (or via `gh api`) for the merge gate to be enforced, not just documented. The badge shows a live status only after `ci.yml` runs on the branch/PR.
