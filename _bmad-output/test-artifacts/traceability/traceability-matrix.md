---
stepsCompleted:
  ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-07-19'
workflowType: 'testarch-trace'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-2-1-complete-a-task-toggle-with-the-payoff.md'
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/project-context.md'
coverageBasis: 'acceptance_criteria'
oracleConfidence: 'high'
oracleResolutionMode: 'formal_requirements'
oracleSources:
  - '_bmad-output/implementation-artifacts/spec-2-1-complete-a-task-toggle-with-the-payoff.md (Acceptance Criteria + I/O & Edge-Case Matrix)'
externalPointerStatus: 'not_used'
tempCoverageMatrixPath: '/private/tmp/claude-501/-Users-alivara-Documents-code-task/aec9e2fa-5e9f-4aec-8a31-9633604e06c2/scratchpad/tea-trace-coverage-matrix-2026-07-19.json'
gateType: 'story'
decisionMode: 'deterministic'
thresholdResult: 'PASS'
gateDecision: 'CONCERNS'
---

# Traceability Matrix & Gate Decision — Story 2.1: Complete a task (toggle with the payoff)

**Target:** Story 2.1 — Complete a task (toggle with the payoff)
**Date:** 2026-07-19
**Evaluator:** Alivara (Murat, Master Test Architect)
**Coverage Oracle:** acceptance_criteria (formal requirements)
**Oracle Confidence:** high
**Oracle Sources:** `spec-2-1-complete-a-task-toggle-with-the-payoff.md` — 4 Acceptance Criteria + the 8-row I/O & Edge-Case Matrix; corroborated by `epic-2-context.md` and `project-context.md`
**Baseline revision:** `696b7ce`

**Oracle-granularity note:** The spec's explicit **I/O & Edge-Case Matrix** is the finest-grained formal statement of required behavior, so the trace is built from its enumerated scenarios (plus the one Acceptance-Criteria claim — the completed-state visual/motion payoff — that the matrix does not enumerate). The 4 prose Acceptance Criteria map cleanly onto these 9 requirements (see the AC → requirement crosswalk below).

> Note: This workflow does not generate tests, nor does it execute them. It traces the **existence and mapping** of tests to requirements. Where coverage gaps exist, run `*atdd` or `*automate`; where execution evidence is pending, run the suite at the CI/PR gate.

---

## AC → Requirement Crosswalk

| Acceptance Criterion (spec) | Traced requirement(s) |
| --- | --- |
| AC1 — active→completed optimistic (≤100ms) + persist; tap again → active | 2.1-R1, 2.1-R2, 2.1-R7 |
| AC2 — completed row visually distinct + bouncy spring settle that never gates | 2.1-R9 (+ functional distinctness in 2.1-R1) |
| AC3 — server rejects → visible rollback + non-disruptive error | 2.1-R8 |
| AC4 — invalid status→400; unknown id→404; valid→200 + AD-6 with bumped `updatedAt` | 2.1-R3, 2.1-R4, 2.1-R1 |

---

## PHASE 1: REQUIREMENTS TRACEABILITY

### Coverage Summary

| Priority  | Total Criteria | FULL Coverage | Coverage % | Status       |
| --------- | -------------- | ------------- | ---------- | ------------ |
| P0        | 5              | 5             | 100%       | ✅ PASS      |
| P1        | 1              | 1             | 100%       | ✅ PASS      |
| P2        | 3              | 2             | 67%        | ⚠️ WARN      |
| P3        | 0              | 0             | 100%       | ✅ PASS      |
| **Total** | **9**          | **8**         | **89%**    | **✅ PASS**  |

**Legend:** ✅ PASS — meets threshold · ⚠️ WARN — below threshold, not critical · ❌ FAIL — below minimum (blocker)

---

### Detailed Mapping

#### 2.1-R1: Toggle active→completed → `200` + full AD-6 resource, `updatedAt` bumped (P0)

- **Coverage:** FULL ✅
- **Tests:**
  - `2.1-API-H01` — api/handler/handler_test.go:277 (`TestUpdateTodo_ValidStatusReturns200AD6Shape`)
    - **Given:** an active row and a pointer-decoded PATCH body carrying only `status`
    - **When:** `PATCH /todos/:id {status:'completed'}`
    - **Then:** `200`; title/description forwarded as `nil` (unchanged), status set; body is camelCase + `metadata` nesting with the bumped `updatedAt` (`…T15:00:00Z`)
  - `2.1-API-R01` — api/repository/repository_update_test.go:22 (`TestUpdateTodo_Integration`, testseed)
    - **Given:** a live Postgres row (docker-compose.test.yml)
    - **When:** multi-field partial UPDATE applied
    - **Then:** provided fields applied, `updatedAt` bumped (`After` created), `id`/`createdAt` stable
  - `2.1-API-S02` — api/service/service_test.go:182 · `2.1-WEB-C03` — web/tests/todo-row.test.tsx:132 · `2.1-E2E-001` — web/tests/e2e/toggle.spec.ts:15
- **Recommendation:** None — defense-in-depth across API + component + E2E.

#### 2.1-R2: Toggle completed→active → `200` + resource (P0)

- **Coverage:** FULL ✅
- **Tests:**
  - `2.1-WEB-C04` — web/tests/todo-row.test.tsx:144 (`clicking a completed checkbox PATCHes status=active`)
  - `2.1-E2E-001` — web/tests/e2e/toggle.spec.ts:44 (reload → still completed → toggle back observes `PATCH {status:'active'}` → unchecked)
  - `2.1-API-S02` — api/service/service_test.go:182 (both allow-list values reach the repo)

#### 2.1-R3: Invalid status (e.g. `archived`) → `400 validation_error`, never reaches repo/DB (AD-8) (P0)

- **Coverage:** FULL ✅
- **Tests:**
  - `2.1-API-H02` — api/handler/handler_test.go:324 (`TestUpdateTodo_InvalidStatusIs400`)
  - `2.1-API-S01` — api/service/service_test.go:164 (`…RejectedNeverReachesRepo`; asserts `repo.updateCalls == 0` for `archived`, `ACTIVE`, `""`, `done`)

#### 2.1-R4: Unknown or malformed id → `404 not_found` (never `500`) (AD-9) (P1)

- **Coverage:** FULL ✅
- **Tests:**
  - `2.1-API-H03` — api/handler/handler_test.go:343 (`TestUpdateTodo_UnknownIdIs404`)
  - `2.1-API-S03` — api/service/service_test.go:208 (`NotFoundError` propagates, not masked as validation)
  - `2.1-API-R01b` — api/repository/repository_update_test.go:60 (well-formed absent id **and** malformed `22P02` id both → `NotFoundError`, covering the G1 review fix)

#### 2.1-R5: Empty patch `{}` → `200` + current resource, unchanged (no-op) (P2)

- **Coverage:** FULL ✅
- **Tests:** `2.1-API-S05` — api/service/service_test.go:242 (`…EmptyPatchPassesThrough`; `updateCalls == 1`, no validation error)

#### 2.1-R6: Title patch (contract-only) — trimmed, ≤200 code points, `400` over cap (P2)

- **Coverage:** FULL ✅ (contract-level; 2.1 ships no edit UI — Design Note 1)
- **Tests:** `2.1-API-S04` — api/service/service_test.go:222 (shared trim/rune-cap helper; over-cap rejected pre-repo) · `2.1-API-R01c` — repository_update_test.go:43 (multi-field incl. title)

#### 2.1-R7: Optimistic flip — status flips in the query cache in ≤100ms, independent of the in-flight PATCH (AD-4) (P0)

- **Coverage:** FULL ✅
- **Tests:**
  - `2.1-WEB-U01` — web/tests/use-toggle-todo.test.tsx:57 (`flips status optimistically… before the server settles`; PATCH held on a gate, cache flips to completed while in flight)
  - `2.1-WEB-C03` — web/tests/todo-row.test.tsx:132

#### 2.1-R8: Toggle rejected (5xx) → visible id-scoped rollback + non-disruptive error (AC3) (P0)

- **Coverage:** FULL ✅
- **Tests:**
  - `2.1-WEB-U02` — web/tests/use-toggle-todo.test.tsx:86 (rolls back visibly to prior status on `500`)
  - `2.1-WEB-U03` — web/tests/use-toggle-todo.test.tsx:122 (rollback is **id-scoped** — a failed row A does not clobber a concurrently-settled row B; the P4 review fix)
  - `2.1-E2E-002` — web/tests/e2e/toggle.spec.ts:53 (route-fail the PATCH → `role="alert"` visible + checkbox flips back; the rewritten non-tautological rollback test, P2 review fix)
- **Gaps:** AC3 wording spans "5xx / network / timeout" but only the **5xx** class is directly exercised (network-failure and timeout classes are not asserted). Low risk — the same `onError` path handles all three — but not proven.

#### 2.1-R9: Completed visual payoff — filled terracotta check, strikethrough + muted title, recessed card, bouncy check-pop spring, reduced-motion guard; motion never gates the ≤100ms change (P2)

- **Coverage:** PARTIAL ⚠️
- **Tests:**
  - `2.1-WEB-C02` — web/tests/todo-row.test.tsx:122 (completed row: `text-decoration: line-through` + `aria-checked='true'`)
  - `2.1-WEB-C01` — web/tests/todo-row.test.tsx:116 (active row: `aria-checked='false'`)
  - `2.1-E2E-001b` — web/tests/e2e/toggle.spec.ts:34 (`text-decoration-line: line-through` on the completed title)
- **Gaps:**
  - Missing: assertion of the terracotta fill (`--accent` circle + `--on-accent` check glyph)
  - Missing: assertion of the recessed completed card (transparent bg, shadow removed, ~0.85 opacity)
  - Missing: assertion of the `check-pop` spring keyframe / cubic-bezier overshoot
  - Missing: assertion of the `prefers-reduced-motion: reduce` guard (instant state change)
  - Missing: an explicit timing assertion that motion does **not** gate the ≤100ms optimistic change
- **Recommendation:** Add a browser-level (Playwright) assertion of the terracotta check + recessed card and a `prefers-reduced-motion` snapshot. Deliberately deferred by the story (CSS-only, browser-only; the spec sets `followup_review_recommended: true`). By the Test Priorities Matrix this untested slice is **UI polish/aesthetics = P2** — informational, non-blocking.

---

### Gap Analysis

#### Critical Gaps (BLOCKER) ❌
0 gaps found.

#### High Priority Gaps (PR BLOCKER) ⚠️
0 gaps found.

#### Medium Priority Gaps (Nightly) ⚠️
2 items to address:

1. **2.1-R9: Completed visual/motion payoff** (P2) — Current: PARTIAL. Add browser-level assertions for terracotta check, recessed card, and a reduced-motion snapshot.
2. **2.1-R8: Rollback error class** (P0 requirement, P2-severity gap) — Rollback proven for `5xx` only; add a network-failure/timeout-class rollback assertion.

#### Low Priority Gaps (Optional) ℹ️
0 gaps found.

---

### Coverage Heuristics Findings

#### Endpoint Coverage
- `PATCH /todos/:id` — directly exercised at handler (H01–H03), service (S01–S05), repository-integration (R01), component (C03/C04), and E2E (E2E-001/002). **0 endpoint gaps.**

#### Auth/Authz Negative-Path
- Not applicable — Story 2.1 introduces no auth/session/role gating (single-user; the repository multi-user seam is deliberately unused per AD-2). **0 gaps.**

#### Happy-Path-Only Criteria
- 1 flag: **2.1-R8** — rollback exercised for `5xx` only; network/timeout classes not directly asserted.

#### UI State Coverage
- 1 flag: **2.1-R9** — completed-state motion/visual (spring, color, recess, reduced-motion) not asserted; only the functional strikethrough + checkbox state is.

---

### Quality Assessment

**BLOCKER Issues** ❌ — none.

**WARNING Issues** ⚠️ — none. (Every 2.1 test uses role/label locators, Given-When-Then structure, network-first synchronization, and the seed/reset seam; no `waitForTimeout`/hard waits; the ~350ms spring is validated via a fake-clock-free stable-date strategy and gated unit assertions.)

**INFO Issues** ℹ️
- `2.1-E2E-002` intentionally asserts the **observable end state** (flip-back + `role=alert`) rather than the fleeting optimistic `true`, delegating the intermediate-state proof to the gated unit test `2.1-WEB-U02` — a deliberate, sound split (documented in the spec's review triage, P2 fix).

**Tests Passing Quality Gates:** 19/19 (100%) meet the quality checklist ✅

---

### Duplicate Coverage Analysis

#### Acceptable Overlap (Defense in Depth)
- **2.1-R1 / R2 (toggle):** unit (cache flip) + component (PATCH body) + E2E (persist) + API (server contract) — justified; each level asserts a different concern.
- **2.1-R3 (invalid status):** handler (HTTP mapping) + service (never-reaches-repo) — justified; distinct layers of AD-8.
- **2.1-R4 (404):** handler + service + repository-integration — justified; the malformed-`22P02` path is only reachable at the live-DB layer.

#### Unacceptable Duplication ⚠️
- None detected.

---

### Coverage by Test Level

| Test Level | Tests  | Criteria Covered | Coverage % |
| ---------- | ------ | ---------------- | ---------- |
| E2E        | 2      | 4                | 44%        |
| API        | 4      | 5                | 56%        |
| Component  | 5      | 4                | 44%        |
| Unit       | 8      | 6                | 67%        |
| **Total**  | **19** | **9 (unique)**   | **100%**   |

_Level mapping: Go handler + testseed repo-integration → API; Go service + web hook (TanStack) → Unit; RTL `TodoRow` → Component; Playwright → E2E._

---

### Traceability Recommendations

#### Immediate Actions (Before PR Merge)
1. **Run the deferred suites at the CI/PR gate and attach the run** — the `@p0` E2E (`toggle.spec.ts`) and the `testseed` repo-integration (`repository_update_test.go`) are the **sole** coverage for browser-only (spring/recede, `role=alert`) and live-DB (malformed-id→404, dynamic `$n` UPDATE) behaviors, and are currently authored-but-unexecuted on host. The story flags `followup_review_recommended: true`.

#### Short-term Actions (This Milestone)
1. **Complete 2.1-R9** — add a browser-level assertion for the terracotta check + recessed card and a `prefers-reduced-motion` snapshot.
2. **Broaden 2.1-R8 error class** — assert rollback on a network-failure/timeout class, not only `5xx`.

#### Long-term Actions (Backlog)
1. Fold the title/description PATCH path (2.1-R6, contract-only today) into UI coverage when **Story 2.2** (edit-in-place) lands.

---

## PHASE 2: QUALITY GATE DECISION

**Gate Type:** story
**Decision Mode:** deterministic (+ Test-Architect residual-risk overlay)

### Evidence Summary

#### Test Execution Results
- **web unit (Vitest/RTL):** ✅ **re-verified first-hand on merged `main` at trace time — 6 files, 36/36 passed (1.05s).** eslint + prettier + `tsc --noEmit` clean (per spec verification).
- **api (Go, in container):** `gofmt` clean; `go vet` + `go build` + `go test ./...` green; `go vet -tags testseed` clean.
- **Playwright E2E suite:** **12 test cases** (`create` 5, `list` 4, `optimistic-rollback` 1, `toggle` 2) — authored; **run at CI / the docker test stack — not executed on host.** ⚠️ Pending passing evidence.
- **Code coverage:** ❌ **NOT MEASURED** — no coverage provider configured in either `web` or `api`; no coverage report artifact exists.

#### Coverage Summary (from Phase 1)
- **P0 criteria:** 5/5 covered (100%) ✅
- **P1 criteria:** 1/1 covered (100%) ✅
- **P2 criteria:** 2/3 covered (67%) — 1 PARTIAL (informational)
- **Overall:** 8/9 fully covered (89%)

#### Non-Functional Requirements
- **Security:** PASS ✅ — parameterized SQL, **static-whitelisted** UPDATE columns (no dynamic identifiers), all values bound; verified clean by the Go expert review. SQL-injection surface: none introduced.
- **Reliability:** PASS ✅ — visible, id-scoped rollback with server reconciliation; empty-patch no-op; error contract (AD-9) upheld across 400/404/500.
- **Performance:** NOT_ASSESSED — ≤100ms optimistic target is asserted functionally (motion-independent flip) but not timed; no k6 (deferred).
- **Maintainability:** PASS ✅ — extracted shared validators (no CreateTodo duplication), AD-1 layering preserved, CSS-only motion (zero new deps).

#### Flakiness Validation
- Burn-in: not available (no CI burn-in run attached).

---

### Decision Criteria Evaluation

#### P0 Criteria (Must ALL Pass)

| Criterion             | Threshold | Actual | Status  |
| --------------------- | --------- | ------ | ------- |
| P0 Coverage           | 100%      | 100%   | ✅ PASS |
| P0 Test Pass Rate     | 100%      | 100% (unit/component/API green; E2E pending CI) | ⚠️ PARTIAL |
| Security Issues       | 0         | 0      | ✅ PASS |
| Critical NFR Failures | 0         | 0      | ✅ PASS |
| Flaky Tests           | 0         | 0 (no burn-in data) | ✅ PASS |

**P0 Evaluation:** ✅ Coverage + contract PASS; the one qualifier is that the flagship `@p0` E2E execution evidence is pending CI.

#### P1 Criteria

| Criterion              | Threshold | Actual | Status  |
| ---------------------- | --------- | ------ | ------- |
| P1 Coverage            | ≥90% (min 80%) | 100% | ✅ PASS |
| Overall Coverage       | ≥80%      | 89%    | ✅ PASS |

**P1 Evaluation:** ✅ ALL PASS

#### Deterministic Threshold Result

> P0 coverage 100% · P1 coverage 100% (≥90%) · overall coverage 89% (≥80%) → **deterministic result = PASS** (step-05 Rule 4).

---

### Custom Gate Bars (project-defined)

Two additional, explicit release bars are evaluated alongside the coverage thresholds:

| Bar | Requirement | Actual | Status |
| --- | --- | --- | --- |
| **A — Code coverage** | ≥ 70% meaningful code coverage | **NOT MEASURED** — no coverage provider wired up (`@vitest/coverage-v8` absent; Go commands use no `-coverprofile`); no coverage report artifact exists | ❌ **UNVERIFIED** |
| **B — E2E tests** | ≥ 5 passing Playwright tests | **12 test cases** across 4 specs (`create` 5, `list` 4, `optimistic-rollback` 1, `toggle` 2) — 240% of the bar by inventory; all 4 describes carry `@p0`. **Passing not proven on host** (needs the docker test stack). | ⚠️ **CONDITIONAL** (count MET, execution pending) |

**Bar A** cannot be asserted today — a threshold you have not measured is not a threshold you have met. This is a distinct, blocking-if-enforced concern independent of requirement-coverage %.
**Bar B** is satisfied by inventory (12 ≥ 5) but its *passing* clause is unproven on host; it collapses into the same pending-CI-execution risk as the flagship `@p0` suite.

---

### GATE DECISION: ⚠️ CONCERNS

**Deterministic threshold result:** PASS. **Test-Architect calibrated decision:** **CONCERNS** (a conservative downgrade for documented residual risk — never an upgrade of a failing gate).

### Rationale

Story 2.1 is genuinely well-tested. Every **functional** behavior of the toggle — both directions, the ≤100ms optimistic cache flip, the visible **id-scoped** rollback with a `role=alert` error surface, and the full server contract (`400` invalid status / `404` unknown-and-malformed id / `200` + AD-6 with a bumped `updatedAt`, plus the empty-patch no-op and the contract-only title path) — is covered, most with defense-in-depth across two or three levels. P0 coverage is 100%, there are **zero** critical or high gaps, security is clean, and no unacceptable duplication exists. On coverage thresholds alone this is a clean PASS.

I am attaching **CONCERNS** — not PASS — because of one project-bar miss plus three residual risks, all invisible to the requirement-coverage-percentage engine:

0. **Code-coverage bar (A) unverified.** The project requires ≥70% meaningful code coverage, but no coverage instrumentation is wired up and no coverage report exists — the bar is **unmeasured**, so it cannot be declared met. On its own this keeps the gate off a clean PASS.
1. **Pending execution evidence for the flagship `@p0` suite (and Bar B's "passing" clause).** `toggle.spec.ts` (E2E) and `repository_update_test.go` (testseed integration) are authored but not executed on host — and they are the **only** coverage for browser-only behavior (the spring/recede, the `role=alert` rollback surface) and live-DB behavior (the malformed-`22P02`→404 path, the dynamic `$n` UPDATE builder). The E2E suite is 12 cases (≥5 bar met by count) but "passing" is unproven on host. The story itself sets `followup_review_recommended: true`. Coverage exists; proof of green does not yet.
2. **Untested completed-visual payoff (2.1-R9, PARTIAL).** The terracotta check, recessed card, `check-pop` spring, and `prefers-reduced-motion` guard have no automated assertion — a deliberate, documented deferral, and correctly a **P2** (aesthetics) concern.
3. **Partial error-class coverage (2.1-R8).** Rollback is proven for `5xx` only; the network-failure and timeout classes named in AC3 are not directly asserted.

Requirement coverage is strong (P0 100%, overall 89%) and no P0/functional gap exists — so this is not a FAIL. But with the code-coverage bar unmeasured and the E2E/integration suites unexecuted, it is not a clean PASS either. This is textbook CONCERNS: **proceed with caution, close the gaps at the CI/PR gate.**

#### Residual Risks (tracked)

1. **Code-coverage bar (≥70%) unmeasured** — no coverage provider is wired up.
   - Probability: Medium / Impact: Medium / **Score: 4 (MONITOR)**
   - Mitigation: add `@vitest/coverage-v8` to `web` (`vitest run --coverage`) and `go test -coverprofile=cover.out ./...` in `api`; publish both and enforce the 70% floor in CI. Until measured, treat the bar as **not met**.
2. **@p0 E2E + testseed integration unexecuted on host (also Bar B's "passing" clause)**
   - Priority: P0-scope / Probability: Low / Impact: Medium / **Score: 4 (MONITOR)**
   - Mitigation: run `npm run test:e2e:p0` (or full `test:e2e` — 12 cases) + `go test -tags testseed` on the docker test stack and attach the run before merge.
3. **Completed visual/motion payoff unasserted (2.1-R9)**
   - Priority: P2 / Probability: Low / Impact: Low / **Score: 2 (DOCUMENT)**
   - Mitigation: manual check per the spec's Manual Checks; add browser assertion in follow-up.
4. **Rollback proven for 5xx only, not network/timeout (2.1-R8)**
   - Priority: P1 / Probability: Low / Impact: Low / **Score: 2 (DOCUMENT)**
   - Mitigation: add a network-abort/timeout rollback case.

**Overall Residual Risk: LOW–MEDIUM** (the unmeasured coverage bar is the one item that could become blocking once measured, if a layer lands below 70%).

---

### Gate Recommendations (CONCERNS)

1. **Deploy/merge with the CI gate enforced** — do not merge until the `@p0` E2E and testseed integration runs are green and attached; they are already written, so this is an execution step, not new authoring.
2. **Create a small remediation backlog:** (a) browser assertion for 2.1-R9 visual/reduced-motion; (b) network/timeout rollback case for 2.1-R8.
3. **Ratify Design-Note-1** at the PR gate — the PATCH endpoint accepts title/description at the contract level while 2.1 ships no edit UI (Story 2.2 scope).

### Next Steps
- **Immediate (24–48h):** (a) wire coverage instrumentation (`@vitest/coverage-v8` in `web`; `go test -coverprofile` in `api`) and confirm the **≥70%** bar; (b) run + attach the 12-case Playwright suite + testseed integration at CI to satisfy Bar B's "passing" clause.
- **Follow-up (this milestone):** land the 2.1-R9 visual assertion and the 2.1-R8 network/timeout error-class case.
- **Re-gate:** once coverage ≥70% is proven and the E2E/integration suites are green, this gate clears to **PASS** (all requirement thresholds already met).
- **Comms:** Notify PM/DEV lead — *Story 2.1 gate = CONCERNS (LOW–MEDIUM residual risk); requirement coverage strong (P0 100%, overall 89%, 12 E2E tests ≥ the 5-bar); blockers to a clean PASS are the **unmeasured ≥70% coverage bar** and **pending CI execution** — both mechanical, no new test authoring for E2E.*

---

## Integrated YAML Snippet (CI/CD)

```yaml
traceability_and_gate:
  traceability:
    story_id: '2.1'
    date: '2026-07-19'
    coverage: { overall: 89, p0: 100, p1: 100, p2: 67, p3: 100 }
    gaps: { critical: 0, high: 0, medium: 2, low: 0 }
    quality: { passing_tests: 19, total_tests: 19, blocker_issues: 0, warning_issues: 0 }
    recommendations:
      - 'Execute + attach the @p0 E2E (toggle.spec.ts) and testseed repo-integration at the CI/PR gate'
      - 'Add browser assertion for the completed visual/reduced-motion payoff (2.1-R9)'
  gate_decision:
    decision: 'CONCERNS'
    threshold_result: 'PASS'
    gate_type: 'story'
    decision_mode: 'deterministic'
    criteria:
      p0_coverage: 100
      p1_coverage: 100
      overall_coverage: 89
      security_issues: 0
      critical_nfrs_fail: 0
      flaky_tests: 0
    thresholds: { min_p0_coverage: 100, min_p1_coverage: 90, min_overall_coverage: 80 }
    custom_bars:
      code_coverage: { required_pct: 70, actual: 'not_measured', status: 'UNVERIFIED' }
      e2e_passing_tests: { required: 5, present: 12, passing: 'pending_ci', status: 'CONDITIONAL' }
    evidence:
      test_results: 'web unit 36 green; go test ./... green; 12 Playwright cases + testseed pending CI; code coverage not measured'
      traceability: '_bmad-output/test-artifacts/traceability/traceability-matrix.md'
    next_steps: 'Wire coverage instrumentation and prove >=70%; run the 12-case Playwright suite + testseed green at CI; then re-gate toward PASS.'
```

---

## Related Artifacts

- **Story/Spec:** `_bmad-output/implementation-artifacts/spec-2-1-complete-a-task-toggle-with-the-payoff.md`
- **Epic Context:** `_bmad-output/implementation-artifacts/epic-2-context.md`
- **Project Context:** `_bmad-output/project-context.md`
- **Machine-readable summary:** `_bmad-output/test-artifacts/traceability/e2e-trace-summary.json`
- **Gate signal:** `_bmad-output/test-artifacts/traceability/gate-decision.json`
- **Test Files:** `api/handler/handler_test.go`, `api/service/service_test.go`, `api/repository/repository_update_test.go`, `web/tests/todo-row.test.tsx`, `web/tests/use-toggle-todo.test.tsx`, `web/tests/e2e/toggle.spec.ts`

---

## Sign-Off

**Phase 1 — Traceability:** Overall 89% · P0 100% ✅ · P1 100% ✅ · Critical gaps 0 · High gaps 0
**Phase 2 — Gate:** **CONCERNS** ⚠️ (requirement thresholds PASS; held off a clean PASS by the unmeasured ≥70% coverage bar + pending E2E execution) · P0 ✅ · P1 ✅ · Custom Bar A ❌ unverified · Custom Bar B ⚠️ conditional (12 ≥ 5, passing pending) · Residual risk LOW–MEDIUM

**Overall Status:** ⚠️ CONCERNS — clears to PASS once (1) ≥70% code coverage is measured and met, and (2) the 12-case Playwright suite + testseed integration run green at CI. Two medium test-gaps tracked for follow-up.

**Generated:** 2026-07-19
**Workflow:** testarch-trace (Coverage Traceability & Quality Gate)

<!-- Powered by BMAD-CORE™ -->
