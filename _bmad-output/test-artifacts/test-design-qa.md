---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-07-17'
workflowType: 'testarch-test-design'
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-todo-app-2026-07-17/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
---

# Test Design for QA: todo-app

**Purpose:** Test execution recipe for QA. Defines what to test, how to test it, at which level, and what QA needs from other teams. Scenarios are organized **per story** so they can be lifted directly into story acceptance criteria.

**Date:** 2026-07-17
**Author:** Master Test Architect (TEA)
**Status:** Draft
**Project:** todo-app

**Related:** See Architecture doc (`test-design-architecture.md`) for testability concerns and architectural blockers.

---

## Executive Summary

**Scope:** All functional testing for the v1 core loop (create/view/edit/complete/delete-with-undo), the fixed wire contract, durable persistence, optimistic UX + rollback, and the trustworthy empty/loading/error layer. Fullstack: `web` (Next.js/TanStack Query), `api` (Go/Gin), `db` (PostgreSQL), one `docker compose up`.

**Risk Summary:**

- Total Risks: 11 (5 high-priority ≥6, 3 medium, 3 low)
- Critical Categories: DATA (R1, R6, R2, R11), TECH (R3, R9, R7), SEC (R4)

**Coverage Summary:**

- P0 tests: ~24 (core loop, wire contract, validation/injection, rollback, durability)
- P1 tests: ~18 (validation edges, ordering, error/loading states, responsive, a11y floor)
- P2 tests: ~8 (theme, char-counter polish, optional description)
- P3 tests: ~2 (placeholder avatar, cosmetic)
- **Total**: ~54 tests (~2–3 weeks with 1 engineer incl. harness)

Level split: **unit ≈16, integration ≈18, E2E ≈20.**

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Auth / RBAC / multi-user** | Not in v1 (PRD §7); no auth surface exists | Repo seam (AD-2) reviewed; revisit when auth lands |
| **Load/stress/spike/endurance perf** | Single-user app; only a light p95 smoke is meaningful | Light k6 nightly; full perf deferred (U1) |
| **DR / failover / backups (RTO/RPO)** | Out of scope for a single-user portfolio app | N/A — documented as intentional |
| **Full WCAG / screen-reader coverage** | PRD-deferred (UX-DR28) | v1 a11y *floor* tested (3.4-E2E-003); full coverage flagged deferred |
| **`prefers-reduced-motion` degrade** | Deferred to v2 (PRD OQ3, resolved 2026-07-17) | Revisit in v2 a11y hardening |

**Note:** Items here are accepted out-of-scope pending PM/Dev confirmation.

---

## Dependencies & Test Blockers

**CRITICAL:** QA cannot proceed on integration/E2E without these.

### Backend/Architecture Dependencies (Pre-Implementation)

**Source:** See Architecture doc "Quick Guide".

1. **TC1 — Test-data seed/reset seam** — Backend/Dev — pre-implementation
   - QA needs: inject list states (empty/1/many/long-text/completed) + reset between parallel runs.
   - Blocks: fast, isolated integration & E2E setup (else UI-only, slow, flaky).

2. **TC5 — `api` health/readiness endpoint** — Backend/Dev — pre-implementation
   - QA needs: a route to gate CI E2E startup on.
   - Blocks: deterministic CI E2E (R10).

3. **U1 — "normal single-user load" definition** — PM+Dev — before perf scenario
   - QA needs: a concrete load target or an explicit single-request smoke interpretation for NFR1.

### QA Infrastructure Setup (Pre-Implementation)

1. **Test Data Factories** — QA
   - `todo` factory with faker-based randomization (unique titles, multi-byte/emoji boundary variants).
   - Auto-cleanup fixtures for parallel safety (per `test-quality`).

2. **Fake-clock harness** — QA
   - Controllable clock for the ~5s undo window (2.3) and relative-time render (1.4) — kills R9 flakiness.

3. **Shared contract fixture** — QA+Dev
   - Single source of AD-6 invariants consumed by api-boundary tests and `web` decode tests (R3).

4. **Test Environments** — QA
   - Local: `docker compose up` (web+api+db), test profile with seed/reset (TC1).
   - CI/CD: compose-based; E2E gated on `api` health (TC5); Playwright sharded.

**Example factory / api-contract test pattern** — uses the configured `playwright-utils` `apiRequest` fixture (`tea_use_playwright_utils=true`); `expect` still comes from `@playwright/test` (the utils package does not re-export it). If the project chooses not to adopt playwright-utils, swap the import for vanilla `@playwright/test` `request`.

```typescript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

test('@p0 @api @contract POST /todos returns AD-6-shaped resource', async ({ apiRequest }) => {
  const title = `task-${faker.string.uuid()}`;

  const { status, body: todo } = await apiRequest({
    method: 'POST',
    path: '/api/todos',
    body: { title },
  });

  expect(status).toBe(201);
  expect(todo.id).toMatch(/^[0-9a-f-]{36}$/);          // server UUID v4
  expect(todo.status).toBe('active');                   // server default
  expect(todo.description).toBe('');                    // "" never null
  expect(todo.metadata.createdAt).toMatch(/Z$/);        // RFC3339 UTC, nested under metadata
  expect(todo).not.toHaveProperty('created_at');        // camelCase on the wire
});
```

---

## Risk Assessment

**Note:** Full risk details in the Architecture doc. This summarizes what QA validates.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Score | QA Test Coverage |
| --- | --- | --- | --- | --- |
| **R1** | DATA/BUS | Optimistic UI diverges from server on failure | **6** | 3.2-E2E-001…004, 3.2-UNIT-001 (rollback + post-rollback refetch = server) |
| **R3** | TECH | web/api wire-contract drift | **6** | 1.2-INT-001, 1.3-INT-002, 2.1-INT-001, 2.3-INT-001 (contract fixture) |
| **R4** | SEC | Server-side validation/injection bypass | **6** | 1.2-INT-004, 3.3-INT-001, XSS render assertion |
| **R6** | DATA | Not durable across restart | **6** | 1.1-INT-001/002 + restart-durability integration test |
| **R9** | TECH | Timer-driven flakiness | **6** | fake-clock harness; 2.3-UNIT-001/002, 1.4-UNIT-001 |

### Medium/Low-Priority Risks

| Risk ID | Category | Description | Score | QA Test Coverage |
| --- | --- | --- | --- | --- |
| R2 | DATA | sendBeacon commit-on-unload fails | 4 | 2.3-E2E-003 + api-side commit assertion |
| R7 | OPS/TECH | Migration race/fail on boot | 4 | 1.1-INT-002/005 (cold compose smoke) |
| R10 | OPS | No readiness signal | 4 | 1.1-INT-004 (health route) |
| R11 | DATA | Ordering/tiebreak wrong | 2 | 1.3-UNIT-001, 1.3-INT-001, 1.4-E2E-001 |
| R8 | BUS | Rune-count parity | 2 | 3.3-UNIT-001 |
| R5 | PERF | p95/optimistic latency | 2 | light k6 + 1.4-E2E perceived render |

---

## NFR Test Coverage Plan

**Purpose:** Map NFRs to planned validation. Defines evidence to create; does not assign final PASS/CONCERNS/FAIL.

| NFR Category | Requirement / Threshold | Planned Validation | Tool / Level | Evidence Artifact | Priority |
| --- | --- | --- | --- | --- | --- |
| Security (NFR10) | Server-side validation + sanitization; parameterized SQL | Malicious/boundary payloads reject + DB intact; XSS escaped on render | api integration + E2E | test run + assertion log | P0 |
| Performance (NFR1/2) | optimistic ≤100ms; API p95 ≤300ms; no blank screen | Light load p95; perceived render + skeleton assertion | k6 (nightly) + Playwright | k6 summary; E2E trace | P2 (U1 pending) |
| Reliability (NFR3/4/9) | 0 data-loss on restart; rollback safe; no unhandled exception | Restart-durability; error-injection across mutations; error-boundary | integration + E2E | test run | P0 |
| Maintainability (NFR6/7/11) | linter/formatter pass; clone→run ≤10 min; single compose up | CI lint jobs; cold `compose up` smoke; README timing | CI / static analysis | CI logs | P1 |

**Missing thresholds or evidence sources:** U1 (load definition for p95) needs a stakeholder decision before the perf scenario runs. U2 (`prefers-reduced-motion`) is resolved — deferred to v2 (PRD OQ3).

---

## Entry Criteria

- [ ] Story slate + acceptance criteria agreed by QA, Dev, PM (see per-story scenarios below)
- [ ] Test environments provisioned (`docker compose up` test profile)
- [ ] TC1 seed/reset seam available
- [ ] TC5 `api` health route available (CI gate)
- [ ] Fake-clock harness + shared contract fixture ready
- [ ] Feature deployed to the test environment

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing ≥95% (failures triaged and accepted)
- [ ] No open high-priority / high-severity bugs
- [ ] All 5 HIGH-risk mitigations (R1, R3, R4, R6, R9) green
- [ ] ≥80% unit/integration coverage on `api` service + `web` logic
- [ ] Perceived-perf smoke acceptable (or U1 resolved and NFR1 measured)

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2/P3 = **priority/risk level**, NOT execution timing. See "Execution Strategy" for when tests run.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (≥6) + No workaround.

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **1.1-INT-001** | Cold compose up serving; only web exposed | Integration | R6/R7 | Topology + boot |
| **1.1-INT-002** | Migrations apply before serve | Integration | R6/R7 | AD-11 |
| **1.1-INT-003** | Empty `GET /todos` → `200 []` (never null) | Integration | R3 | AD-6 |
| **1.2-UNIT-001** | Title validation (empty reject, ≤200 runes trim) | Unit | R4 | AD-10 |
| **1.2-UNIT-003** | New-todo defaults; client id/status ignored | Unit | R3 | AD-6/7/8 |
| **1.2-INT-001** | POST valid → 201 + AD-6 shape | Integration | R3 | contract |
| **1.2-INT-002** | POST empty title → 400 validation_error | Integration | R4 | AD-9 |
| **1.2-INT-004** | Injection/sanitization safe; DB intact | Integration | R4 | NFR10 |
| **1.3-INT-001** | List newest-first + tiebreak | Integration | R11 | FR8 |
| **1.3-INT-002** | List items match AD-6 shape | Integration | R3 | contract |
| **1.4-UNIT-002** | Add onMutate prepend temp id; swap on success | Unit | R1 | AD-4/7 |
| **1.4-E2E-001** | Create → top → persists → survives reload | E2E | R1/R6 | core loop |
| **2.1-UNIT-001** | Partial-PATCH sends only changed fields | Unit | R3 | AD-6 |
| **2.1-INT-001** | PATCH title → 200, updatedAt refreshed | Integration | R3 | AD-6/7 |
| **2.1-E2E-001** | Inline edit saves optimistically + persists | E2E | R1 | FR9/10 |
| **2.2-INT-001** | Toggle status persists both ways | Integration | R3 | FR12 |
| **2.2-E2E-001** | Toggle → completed styling, persists | E2E | R1 | FR7/12 |
| **2.3-UNIT-001** | Pending-delete timer; no network in window; fires on elapse | Unit | R9/R2 | AD-5 |
| **2.3-UNIT-002** | Undo cancels timer, no round-trip, restores | Unit | R9 | FR14 |
| **2.3-INT-001** | Commit DELETE → 204; 404-as-success | Integration | R3 | AD-6 |
| **2.3-E2E-001** | Delete → toast → Undo restores (fake clock) | E2E | R1/R9 | FR13/14 |
| **2.3-E2E-002** | Window elapse → committed; reload confirms gone | E2E | R2 | FR15 |
| **3.1-UNIT-001** | Error-class mapper 4xx-inline / 5xx-retry | Unit | R1 | AD-9 |
| **3.1-E2E-003** | Injected 500 → error state; Retry recovers | E2E | R1 | FR22/NFR9 |
| **3.2-UNIT-001** | Each onError restores pre-action snapshot | Unit | R1 | AD-4 |
| **3.2-E2E-001** | Add rejected → visible rollback | E2E | R1 | FR23/CM2 |
| **3.2-E2E-002** | Edit rejected → reverts | E2E | R1 | CM2 |
| **3.2-E2E-003** | Toggle rejected → reverts | E2E | R1 | CM2 |
| **3.2-E2E-004** | Post-rollback refetch = server truth | E2E | R1 | CM2 |

**Total P0:** ~24 tests

---

### P1 (High)

**Criteria:** Important features + medium risk + common workflows.

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **1.1-INT-004** | `api` health route healthy once migrated | Integration | R10 | TC5 |
| **1.1-INT-005** | Migration failure surfaces (no half-serve) | Integration | R7 | AD-11 |
| **1.2-UNIT-002** | Description optional ≤2000 runes | Unit | R4 | AD-10 |
| **1.2-INT-003** | Persisted UUID + RFC3339 UTC timestamps | Integration | R3 | AD-7 |
| **1.3-UNIT-001** | Ordering comparator + tiebreak | Unit | R11 | conventions |
| **1.4-UNIT-001** | Relative-time formatter (fake clock) | Unit | R9 | FR6 |
| **1.4-UNIT-003** | Client-mirror title validation = server | Unit | R4 | AD-10 parity |
| **1.4-E2E-002** | Input clears + stays focused; type-Enter×2 | E2E | — | FR4/UX-DR22 |
| **1.4-E2E-003** | Empty title → inline validation, no row | E2E | R4 | FR3 |
| **2.1-UNIT-002** | Edit empty title reject+revert; desc clearable | Unit | R4 | FR11 |
| **2.1-INT-002** | Clear description → ""; empty title → 400 | Integration | R4 | AD-6/10 |
| **2.1-E2E-002** | Esc cancels edit, reverts, no request | E2E | R1 | FR10 |
| **2.2-UNIT-001** | Status transition validator (enum sync) | Unit | R3 | AD-8 |
| **2.2-INT-002** | Invalid status → 400 validation_error | Integration | R4 | AD-8 |
| **2.3-E2E-003** | Reload/close while pending → commit flush | E2E | R2 | FR15/sendBeacon |
| **3.1-INT-001** | Proxy synthesizes AD-9 502/504 on api down | Integration | R10 | AD-3 |
| **3.1-E2E-001** | Empty state friendly prompt | E2E | — | FR20 |
| **3.1-E2E-002** | Loading skeleton → content, no blank | E2E | — | FR21/NFR2 |
| **3.3-UNIT-001** | Rune-count parity (multi-byte/emoji @cap) | Unit | R8 | AD-10 |
| **3.3-INT-001** | Server rejects >200/>2000 even if client bypassed | Integration | R4 | NFR10 |
| **3.4-E2E-001** | Layout polished @375px + desktop | E2E | — | NFR5/UX-DR17 |
| **3.4-E2E-003** | a11y floor: keyboard core path + focus ring | E2E | — | UX-DR27 |

**Total P1:** ~18 tests

---

### P2 (Medium)

**Criteria:** Secondary features + low risk + edge cases.

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **1.4-E2E-004** | Optional description renders on row | E2E | — | FR1/6 |
| **3.3-E2E-001** | Counter hidden at rest, appears/escalates near cap | E2E | R8 | UX-DR6/23 |
| **3.4-E2E-002** | Theme toggle persists across reload | E2E | — | UX-DR12 |
| **perf-smoke** | Light k6 p95 on `api` (pending U1) | k6 | R5 | NFR1 |

**Total P2:** ~8 tests (incl. viewport/theme variants)

---

### P3 (Low)

| Test ID | Requirement | Test Level | Notes |
| --- | --- | --- | --- |
| **3.4-E2E-004** | Placeholder avatar present, non-functional | E2E | UX-DR13 |
| **motion-a11y** | `prefers-reduced-motion` degrade — **deferred to v2** (PRD OQ3) | E2E | UX-DR28 |

**Total P3:** ~1 test in v1 (motion-a11y deferred to v2)

---

## Per-Story Test Scenarios (attach to story definitions)

> Lift these blocks straight into each story's **Acceptance Criteria / Test Notes**. Every story carries its own unit / integration / E2E set. IDs use `{EPIC}.{STORY}-{LEVEL}-{SEQ}`.

### Epic 1 — Foundation & Task Capture

**Story 1.1 — Walking skeleton** _(FR16/17 base; AD-11/12; risks R6, R7, R10)_
- **Integration:** 1.1-INT-001 cold compose up serving (only `web` exposed) · 1.1-INT-002 migrations apply before serve · 1.1-INT-003 empty `GET /todos` → `200 []` (never null) · 1.1-INT-004 `api` health route healthy once migrated · 1.1-INT-005 bad migration ⇒ no half-serve.
- **Unit / E2E:** none (infra story).

**Story 1.2 — Create API (`POST /todos`)** _(FR1/2/3/19; AD-6/7/8/10; risks R3, R4)_
- **Unit:** 1.2-UNIT-001 title validation (empty reject; trim then ≤200 runes) · 1.2-UNIT-002 description optional ≤2000 · 1.2-UNIT-003 defaults `active`+server id/timestamps, client id/status/metadata ignored.
- **Integration:** 1.2-INT-001 201 + AD-6 shape (`""`≠null, `metadata` nesting, camelCase) · 1.2-INT-002 empty title → 400 `validation_error` (no row) · 1.2-INT-003 UUID v4 + RFC3339 UTC `Z` · 1.2-INT-004 SQLi/oversize payload safe, DB intact.

**Story 1.3 — List API (`GET /todos`)** _(FR5/6/8; risk R11)_
- **Unit:** 1.3-UNIT-001 ordering comparator `created_at DESC, id DESC` tiebreak.
- **Integration:** 1.3-INT-001 newest-first + tiebreak · 1.3-INT-002 items match AD-6 shape (contract fixture).

**Story 1.4 — Capture UI** _(FR1/2/4/6; AD-4; risks R1 seed, R9)_
- **Unit:** 1.4-UNIT-001 relative-time formatter (fake clock) · 1.4-UNIT-002 add `onMutate` prepend temp id, swap on success · 1.4-UNIT-003 client-mirror title validation matches server.
- **E2E:** 1.4-E2E-001 create → top → persist → reload survives · 1.4-E2E-002 input clears + refocus, type-Enter×2 · 1.4-E2E-003 empty title inline validation, no row · 1.4-E2E-004 optional description renders.

### Epic 2 — Complete the Task Loop

**Story 2.1 — Edit in place (`PATCH` title/desc)** _(FR9/10/11; AD-6/10; risks R1, R3)_
- **Unit:** 2.1-UNIT-001 partial-PATCH sends only changed fields (absent ≠ zero-value) · 2.1-UNIT-002 empty-title edit reject+revert; description clearable.
- **Integration:** 2.1-INT-001 PATCH title → 200, `updatedAt` refreshed, description untouched · 2.1-INT-002 clear description → `""`; empty title → 400.
- **E2E:** 2.1-E2E-001 inline edit saves optimistically + persists · 2.1-E2E-002 Esc cancels+reverts, no request.

**Story 2.2 — Toggle completion (`PATCH` status)** _(FR7/12; AD-8; risk R1)_
- **Unit:** 2.2-UNIT-001 status transition validator (`active`↔`completed` only; enum sync).
- **Integration:** 2.2-INT-001 toggle persists both ways · 2.2-INT-002 invalid status → 400.
- **E2E:** 2.2-E2E-001 toggle → instant completed styling, persists across reload.

**Story 2.3 — Delete with undo** _(FR13/14/15; AD-5; risks R1, R2, R9)_
- **Unit:** 2.3-UNIT-001 pending-delete controller (fake clock): ~5s timer, no network in window, fires on elapse · 2.3-UNIT-002 Undo cancels timer, no round-trip, restores.
- **Integration:** 2.3-INT-001 commit DELETE → 204; DELETE on gone id → 404 as **success**.
- **E2E:** 2.3-E2E-001 delete → toast → Undo restores (fake clock) · 2.3-E2E-002 window elapse → committed, reload gone · 2.3-E2E-003 reload/close while pending → commit flush (`sendBeacon`), no reappear.

### Epic 3 — Trustworthy, Polished Experience

**Story 3.1 — Empty/loading/error + retry** _(FR20/21/22; AD-3/9; NFR2/9; risk R10)_
- **Unit:** 3.1-UNIT-001 error-class mapper (4xx inline / 5xx+network+timeout → retry).
- **Integration:** 3.1-INT-001 proxy synthesizes AD-9 `502`/`504` on `api` down (never HTML/thrown fetch).
- **E2E:** 3.1-E2E-001 empty state prompt · 3.1-E2E-002 skeleton→content, no blank · 3.1-E2E-003 injected 500 → non-disruptive error, Retry recovers.

**Story 3.2 — Optimistic rollback across all mutations** _(FR23; NFR4; CM2; risk R1 — highest value)_
- **Unit:** 3.2-UNIT-001 each mutation `onError` restores exact pre-action cache snapshot.
- **E2E:** 3.2-E2E-001 add rejected → visible rollback · 3.2-E2E-002 edit rejected → revert · 3.2-E2E-003 toggle rejected → revert · 3.2-E2E-004 post-rollback refetch equals server truth (no silent divergence).

**Story 3.3 — Char-limit feedback + caps** _(FR24; AD-10; UX-DR6/23; risk R8)_
- **Unit:** 3.3-UNIT-001 rune-count parity (client vs server, multi-byte/emoji at 200/2000, trim-before-count).
- **Integration:** 3.3-INT-001 server rejects >200/>2000 even if client bypassed.
- **E2E:** 3.3-E2E-001 counter hidden at rest, appears/escalates near cap.

**Story 3.4 — Theme + responsive + a11y floor** _(NFR5; UX-DR12/13/17/27/28; U2)_
- **E2E:** 3.4-E2E-001 layout polished @375px + desktop · 3.4-E2E-002 theme toggle persists · 3.4-E2E-003 a11y floor (keyboard core path, focus ring, semantic controls) · 3.4-E2E-004 placeholder avatar non-functional · _motion-a11y (`prefers-reduced-motion`) — **deferred to v2** (PRD OQ3)._

---

## Execution Strategy

**Philosophy:** Run everything fast in PRs unless there's real infrastructure overhead. Playwright + Go/Vitest parallelize well.

### Every PR (~10–15 min)
- **All unit** (Go `testing`+testify on `api`; Vitest/RTL on `web`).
- **All integration** (api↔db via compose test profile; proxy↔api).
- **P0 + P1 E2E** (Playwright, sharded), gated on `api` health (TC5).
- Fail fast on: core loop, wire contract, validation/injection, rollback, durability.

### Nightly (~30–60 min)
- Full E2E incl. P2/P3 (theme, char-counter polish, avatar).
- Responsive matrix (375 / tablet / desktop).
- Light **k6** p95 smoke on `api` (once U1 resolved).
- Cold `docker compose up` smoke (fresh volume) → serving.

### Weekly / Manual
- README clone→run ≤10 min check (NFR7) — manual or scripted.
- No chaos/DR/failover suites (out of scope).

Tag `@p0`…`@p3`, `@contract`, `@api`, `@e2e` for selective runs.

---

## QA Effort Estimate

**Dev-in-test effort** (single engineer; excludes app implementation):

| Priority | Count | Effort Range | Notes |
| --- | --- | --- | --- |
| Harness/enablers | — | ~12–20 h | seed/reset (TC1), fake-clock, contract fixture, compose CI |
| P0 | ~24 | ~30–45 h | contract, injection, rollback, durability, core loop |
| P1 | ~18 | ~18–30 h | validation edges, states, responsive, a11y floor |
| P2 | ~8 | ~6–14 h | theme, counter polish, perf smoke |
| P3 | ~2 | ~1–3 h | avatar, cosmetic |
| **Total** | ~54 | **~67–112 h** | **≈ 2–3 focused weeks, 1 engineer** |

**Assumptions:**
- Includes test design, implementation, debugging, CI integration.
- Excludes ongoing maintenance (~10%).
- Assumes TC1/TC5 delivered and harness ready.

**Dependencies from other teams:** see "Dependencies & Test Blockers" (TC1, TC5, U1, U2).

---

## Implementation Planning Handoff

| Work Item | Owner | Target Milestone | Dependencies/Notes |
| --- | --- | --- | --- |
| Test-data seed/reset seam (TC1) | Backend/Dev | Pre-implementation | Blocks integration/E2E |
| `api` health/readiness route (TC5) | Backend/Dev | Pre-implementation | Blocks CI E2E gate (R10) |
| Fake-clock harness | QA/Dev-in-test | Harness setup | Kills R9 flakiness |
| Shared AD-6 contract fixture | QA+Dev | Harness setup | Prevents R3 drift |
| Quantify NFR1 load (U1) | PM+Dev | Before perf smoke | Else NFR1 unverifiable |
| Decide `prefers-reduced-motion` (U2) | UX+Dev | Before motion-a11y | Unblocks P3 motion scenario |

---

## Tooling & Access

| Tool or Service | Purpose | Access Required | Status |
| --- | --- | --- | --- |
| Playwright | E2E + route interception + fake clock | repo dev dep | Pending (greenfield) |
| Go test + testify | `api` unit/integration | repo dev dep | Pending |
| Vitest + React Testing Library | `web` unit | repo dev dep | Pending |
| k6 | light NFR1 p95 smoke | CI runner | Pending (U1) |
| eslint/prettier + gofmt/golangci-lint | NFR6 quality gate | repo config | Pending |

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope | Validation Steps |
| --- | --- | --- | --- |
| **web** (Next.js + proxy) | New — owns optimistic UX, states | All E2E + web unit | PR E2E green |
| **api** (Gin) | New — owns rules, contract, persistence | All integration + api unit | PR integration green |
| **db** (PostgreSQL) | New — durability + migrations | 1.1 + restart-durability | Cold + restart compose smoke |

**Regression strategy:** greenfield — the P0/P1 suite *is* the baseline. Once established, the full PR suite must stay green before any merge; nightly guards the polish layer.

---

## Appendix A: Code Examples & Tagging

```typescript
import { test, expect } from '@playwright/test';

// P0: optimistic rollback — the product's core trust promise (R1/CM2)
test('@p0 @e2e add rolls back visibly when server rejects', async ({ page }) => {
  await page.route('**/api/todos', (route) =>
    route.fulfill({ status: 500, body: JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }) })
  );
  await page.goto('/');
  await page.getByPlaceholder('Add a task…').fill('Email Sam the Q3 numbers');
  await page.getByPlaceholder('Add a task…').press('Enter');

  // Optimistically appears, then rolls back visibly on failure
  await expect(page.getByText('Email Sam the Q3 numbers')).toBeHidden();
  await expect(page.getByText(/couldn.t|try again/i)).toBeVisible();
});
```

```bash
npx playwright test --grep @p0            # P0 smoke
npx playwright test --grep "@p0|@p1"      # PR core
npx playwright test --grep @contract      # AD-6 contract only
```

---

## Appendix B: Knowledge Base References

- **Risk Governance**: `risk-governance.md` — scoring methodology
- **Test Priorities Matrix**: `test-priorities-matrix.md` — P0-P3 criteria
- **Test Levels Framework**: `test-levels-framework.md` — E2E vs Integration vs Unit selection
- **Test Quality**: `test-quality.md` — Definition of Done (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **NFR Criteria**: `nfr-criteria.md` · **ADR Quality Readiness Checklist**: `adr-quality-readiness-checklist.md`

---

**Generated by:** BMad TEA Agent
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)
