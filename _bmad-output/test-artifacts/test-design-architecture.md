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

# Test Design for Architecture: todo-app

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by Architecture/Dev teams. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-07-17
**Author:** Master Test Architect (TEA)
**Status:** Architecture Review Pending
**Project:** todo-app
**PRD Reference:** `_bmad-output/planning-artifacts/prds/prd-todo-app-2026-07-17/prd.md`
**ADR Reference:** `_bmad-output/planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md` (AD-1…AD-12)

---

## Executive Summary

**Scope:** Full-stack single-user Todo app — CRUD todos with optimistic UI, undo-on-delete, and first-class empty/loading/error states. Three services (`web` Next.js + dumb BFF proxy · `api` layered Gin service · `db` PostgreSQL) brought up by one `docker compose up`. **Greenfield** — no code or tests exist yet.

**Business Context** (from PRD):

- **Revenue/Impact:** None direct — this is a portfolio-grade engineering showcase. The value is *reliability and polish* on a tiny surface (G1–G5).
- **Problem:** A dead-simple, no-signup personal task list that "just works" and demonstrates clean full-stack engineering that could grow to multi-user without a rewrite.
- **GA Launch:** Demo/portfolio target; numeric metrics are tunable `[ASSUMPTION]` defaults.

**Architecture** (from ARCHITECTURE-SPINE):

- **Key Decision 1 (AD-1/AD-3):** Layered backend with one-way dependency (`handler → service → repository`); Gin is the *sole* owner of business logic. The Next proxy is dumb pass-through.
- **Key Decision 2 (AD-4/AD-5):** TanStack Query is the sole owner of server state; every mutation is optimistic with a paired rollback. Delete is a client-side pending-delete lifecycle; only the commit crosses the network (with `sendBeacon` on unload).
- **Key Decision 3 (AD-6/AD-9/AD-10):** A fixed camelCase wire contract (timestamps nested under `metadata`, `[]`≠null, `""`≠null, partial PATCH), one uniform error contract, and server-authoritative validation mirrored on the client. Stack: Next.js 16.2 / TanStack Query 5 / Go 1.26 / Gin 1.12 / golang-migrate 4 / PostgreSQL 18.

**Expected Scale** (from PRD/ADR):

- Single-user. NFR1 targets optimistic render ≤100ms and API p95 ≤300ms "under normal single-user load" (load level unquantified — see U1). No multi-tenant, no auth in v1.

**Risk Summary:**

- **Total risks**: 11 (5 high-priority ≥6, 3 medium 3–5, 3 low 1–2)
- **High-priority (≥6)**: R1 optimistic rollback, R3 contract drift, R4 server-side validation/injection, R6 restart durability, R9 test time-nondeterminism
- **Test effort**: ~54 scenarios (~2–3 weeks for 1 QA/Dev-in-test incl. harness; ~1.5–2 weeks for 2)

---

## Quick Guide

### 🚨 BLOCKERS - Team Must Decide (Can't Proceed Without)

**Pre-Implementation Critical Path** — these MUST exist before integration/E2E tests can be written reliably:

1. **TC1: Test-data seed/reset seam** — a repository-level way (test-only helper, seed script, or truncate-between-runs) to inject known list states (empty / 1 / many / long-text / completed) and reset for parallel safety. Without it, setup is slow, UI-only, and flaky. (recommended owner: Backend/Dev)
2. **TC5: `api` health/readiness endpoint** — a lightweight route CI can gate E2E on. Compose declares `db→api→web` healthcheck ordering (AD-12) but no explicit `api` health route is defined. (recommended owner: Backend/Dev)
3. **U1: Quantify "normal single-user load"** — p95≤300ms needs a concrete load definition (RPS/concurrency) or an explicit "single-request smoke" interpretation, or NFR1 stays unverifiable. (recommended owner: PM + Dev)

**What we need from team:** Provide TC1 + TC5 pre-implementation and resolve U1, or perf/integration test development is blocked.

---

### ⚠️ HIGH PRIORITY - Team Should Validate (We Provide Recommendation, You Approve)

1. **R1: Optimistic rollback integrity** — Recommend every mutation pairs `onMutate` with a snapshot-restoring `onError`, and that a post-rollback refetch equals server truth (guards CM2 "no silent divergence"). Dev Lead to approve the rollback pattern. (implementation phase)
2. **R3: Wire-contract drift** — Recommend a single shared contract fixture asserting every AD-6 invariant (`[]`/`""`≠null, camelCase, `metadata` nesting, partial-PATCH, 201/200/204, 404-as-success), exercised at the `api` boundary. Dev + QA to approve ownership. (implementation phase)
3. **R4: Server-side validation is the only safety net** (no auth) — Recommend parameterized SQL everywhere + server-authoritative validation with malicious/boundary payload integration tests; React default escaping verified on render. Dev Lead + reviewer to approve. (implementation phase)

**What we need from team:** Review recommendations and approve (or suggest changes).

---

### 📋 INFO ONLY - Solutions Provided (Review, No Decisions Needed)

1. **Test strategy**: level split — pure logic → **unit** (Go `testing`+testify on `api`; Vitest/RTL on `web`), boundaries/persistence/contract → **integration** (api↔db, proxy↔api), user journeys/optimistic UX → **E2E** (Playwright through `web`). Duplicate-coverage guard applied.
2. **Tooling**: Playwright (E2E, incl. route interception for failure injection + fake clock for the undo window), Go test + testify, Vitest + React Testing Library, light k6 for NFR1, `eslint`/`prettier` + `gofmt`/`golangci-lint` for NFR6.
3. **Tiered CI/CD**: **PR** = all unit + all integration + P0/P1 E2E (<15 min); **Nightly** = full E2E + responsive matrix + light k6 + cold `compose up` smoke.
4. **Coverage**: ~54 scenarios prioritized P0–P3, each linked to a risk and mapped to a story (see QA doc).
5. **Quality gates**: P0 100% / P1 ≥95% pass; all 5 HIGH-risk mitigations green before release; ≥80% unit/integration coverage on `api` + `web` logic.

**What we need from team:** Just review and acknowledge (we already have the solution).

---

## For Architects and Devs - Open Topics 👷

### Risk Assessment

**Total risks identified**: 11 (5 high-priority score ≥6, 3 medium, 3 low)

#### High-Priority Risks (Score ≥6) - IMMEDIATE ATTENTION

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **R1** | **DATA/BUS** | Optimistic UI diverges from server on failure — user sees state never persisted (violates CM2) | 2 | 3 | **6** | Force server rejection on every mutation; assert visible rollback + post-rollback refetch equals server | Dev+QA | Pre-GA |
| **R3** | **TECH** | Independently-built `web`/`api` drift on the AD-6 wire contract | 3 | 2 | **6** | Boundary contract tests asserting each AD-6 invariant from a shared fixture | Dev+QA | Pre-GA |
| **R4** | **SEC** | Server-side validation/sanitization bypass — the only safety layer (no auth): SQLi/XSS/oversize | 2 | 3 | **6** | Malicious + boundary payload integration tests; parameterized SQL; XSS-escaping render test | Dev+QA | Pre-GA |
| **R6** | **DATA** | Persistence not durable across restart — named-volume/migration misconfig loses todos (violates G2/NFR3) | 2 | 3 | **6** | Integration test: create → restart → intact; verify named volume + idempotent migrations | Dev | Pre-GA |
| **R9** | **TECH** | Test-suite flakiness from real timers (undo ~5s, relative time) | 3 | 2 | **6** | Mandate fake/controllable clock; no `waitForTimeout`; network-first waits | QA | Harness setup |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R2 | DATA | `sendBeacon`/keepalive commit-on-unload fails → deleted todo reappears or is lost | 2 | 2 | 4 | E2E delete→reload-within-window assertion; api receives commit; fallback path covered | Dev+QA |
| R7 | OPS/TECH | Migrations race/fail on boot — `api` serves before schema ready, or partial migration | 2 | 2 | 4 | Cold `compose up` smoke reaches serving state; migration failure surfaces (no half-serve) | Dev |
| R10 | OPS | No readiness signal → flaky CI E2E startup | 2 | 2 | 4 | Add `api` health route (TC5); CI gates E2E on it | Dev |

#### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R11 | DATA | Ordering/tiebreak wrong — list reorders/flickers on optimistic-add settle | 2 | 1 | 2 | Monitor (covered by 1.3 tests) |
| R8 | BUS | Rune-count cap parity (client UTF-16 vs server runes) | 2 | 1 | 2 | Monitor (covered by 3.3 parity unit) |
| R5 | PERF | p95 >300ms / optimistic >100ms under single-user load | 1 | 2 | 2 | Monitor (light perf check) |

#### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

### NFR Testability Requirements

**Purpose:** Capture what architecture must provide so NFR validation can be automated later. This is planning guidance, not final evidence assessment.

| NFR Category | Threshold / Requirement | Current Design Support | Gap / Decision Needed | Planned Evidence |
| --- | --- | --- | --- | --- |
| Security (NFR10) | Server-side validation + sanitization authoritative; parameterized SQL; React escaping | Supported by AD-10 (design mandate) | Verify actual parameterization; no auth exists by design (v1) | api integration w/ malicious+boundary payloads; XSS render test |
| Performance (NFR1/2) | optimistic ≤100ms; API p95 ≤300ms; loading immediate, no blank screen | Partial — targets defined but `[ASSUMPTION]` | **U1: load level unquantified** | light k6 on `api`; Playwright perceived render + skeleton assertion |
| Reliability (NFR3/4/9) | 0 data-loss across restart/session; rollback never corrupts; no unhandled exception | Supported by AD-7/AD-9/AD-12 + React error boundary | Add `api` health route (TC5) for readiness observability | restart-durability integration; error-injection E2E; error-boundary test |
| Maintainability (NFR6/7/8) | linter/formatter committed+passing; clone→run ≤10 min; extensible repo seam | Supported by AD-2/AD-11/AD-12 + conventions | None — repo seam (AD-2) verified by review, not runtime | CI lint jobs; compose smoke + README clone-run timing; architecture review note |

**Unknown thresholds:**
- **U1** — "normal single-user load" for p95≤300ms is unquantified. Treat as a clarification item; do not guess a concurrency/RPS number.
- **U2** — `prefers-reduced-motion` handling → **resolved: deferred to v2** (PRD OQ3, confirmed 2026-07-17). The motion-a11y scenario is out of v1 scope.
- **N/A for this scope:** DR/RTO-RPO, SLA/availability/redundancy, distributed tracing, `/metrics`, rate-limiting, multi-tenant segregation (ADR-checklist categories 3/4/6/7.2) — intentionally out of scope for a single-user portfolio app, not gaps.

**Assessment boundary:** Final PASS/CONCERNS/FAIL status belongs in `nfr-assess` after implementation evidence exists.

---

### Testability Concerns and Architectural Gaps

**🚨 ACTIONABLE CONCERNS - Architecture Team Must Address**

#### 1. Blockers to Fast Feedback (WHAT WE NEED FROM ARCHITECTURE)

| Concern | Impact | What Architecture Must Provide | Owner | Timeline |
| --- | --- | --- | --- | --- |
| **TC1 — No test-data seed/reset seam** | Can't inject list states or reset between parallel runs → slow, flaky setup | A repository-level seed/truncate path for the test profile (or seed script + truncate helper) | Backend/Dev | Pre-implementation |
| **TC5 — No `api` health/readiness endpoint** | CI E2E can't gate on "api ready" → flaky startup (R10) | A lightweight health route reporting migrated+serving | Backend/Dev | Pre-implementation |
| **TC2 — `sendBeacon` commit-on-unload** | Unload beacons non-deterministic in E2E; "close = committed" hard to assert (AD-5/FR15) | An injectable/fake-clock timer for the ~5s window + an api-observable commit `DELETE` | Dev | Implementation |
| **TC3 — Failure injection for rollback** | Rollback (the core trust promise) only fires on server rejection | Deterministic way to force `api` 5xx / constraint errors for integration; Playwright route interception for E2E | Dev+QA | Implementation |
| **TC4 — Time non-determinism** | Real timers (undo ~5s, relative time) → flaky suites (R9) | Server-authoritative timestamps (AD-7, already present) + client fake-clock hook | Dev+QA | Harness setup |
| **TC6 — Contract drift** | Separately-built `web`/`api` drift silently on AD-6 | A shared contract fixture consumed by both sides | Dev+QA | Implementation |

#### 2. Architectural Improvements Needed (WHAT SHOULD BE CHANGED)

1. **Expose an `api` health/readiness endpoint (TC5)**
   - **Current problem**: compose declares healthcheck ordering but no explicit `api` health route is defined.
   - **Required change**: add a lightweight route reporting migrated+serving status.
   - **Impact if not fixed**: flaky CI E2E startup (R10); no readiness observability.
   - **Owner**: Backend/Dev · **Timeline**: pre-implementation.

2. **Provide a test-only seed/reset seam (TC1)**
   - **Current problem**: greenfield, no way to set list states or reset between runs.
   - **Required change**: repository-level seed helper + truncate for the test profile (dev/test only, never prod-reachable).
   - **Impact if not fixed**: UI-only setup → slow, brittle, non-parallel-safe tests.
   - **Owner**: Backend/Dev · **Timeline**: pre-implementation.

---

### Testability Assessment Summary

**📊 CURRENT STATE - FYI**

#### What Works Well

- ✅ **API-first / headless (AD-1/AD-3)** — Gin owns *all* business logic and is fully reachable via REST with no UI dependency; critical paths testable without a browser (ADR-checklist 1.2 = covered).
- ✅ **Repository interface as a mock seam (AD-2)** — the service layer can be isolated from Postgres for fast, deterministic unit/integration tests.
- ✅ **Deterministic response shapes (AD-6/AD-9)** — fixed wire contract + one uniform error contract make assertions exact and stable.
- ✅ **Server-authoritative identity/time (AD-7)** — UUIDs and RFC3339-UTC timestamps set server-side remove client clock skew from the api layer.
- ✅ **Reproducible environment (AD-11/AD-12)** — migrations-on-boot + healthcheck-gated `docker compose up` give a one-command, repeatable test environment.

#### Accepted Trade-offs (No Action Required)

For todo-app v1, the following trade-offs are acceptable:

- **No auth / single-user** — security surface is limited to input validation + injection; RBAC/authn scenarios are out of scope by design (NFR8 seam prepared, not built).
- **Last-write-wins, no optimistic concurrency** — acceptable for single-user; revisit when multi-user (AD-2) lands.
- **`[ASSUMPTION]` numeric targets** — SM/NFR numbers are tunable demo defaults; perf is a light check, not a hard gate, until U1 is resolved.

This is acceptable for v1 and should be revisited when auth/multi-user is introduced.

---

### Risk Mitigation Plans (High-Priority Risks ≥6)

**Purpose**: Detailed mitigation strategies for all 5 high-priority risks (score ≥6). These MUST be addressed before demo/GA.

#### R1: Optimistic UI diverges from server on failure (Score: 6) - HIGH

**Mitigation Strategy:**
1. Every mutation pairs `onMutate` (snapshot + optimistic apply) with `onError` (restore exact snapshot) — AD-4.
2. E2E forces server rejection on add/edit/toggle and asserts visible rollback to pre-action state.
3. Assert a post-rollback refetch equals server truth (no silent divergence — CM2).

**Owner:** Dev+QA · **Timeline:** Pre-GA · **Status:** Planned
**Verification:** 3.2-E2E-001…004 green; web-unit `onError` snapshot restore (3.2-UNIT-001).

#### R3: Wire-contract drift between web and api (Score: 6) - HIGH

**Mitigation Strategy:**
1. Author one shared contract fixture encoding every AD-6 invariant.
2. Exercise it at the `api` boundary (integration) and reuse for `web` client decoding.
3. Assert `[]`≠null, `""`≠null, camelCase, `metadata` nesting, partial-PATCH semantics, 201/200/204, 404-as-success.

**Owner:** Dev+QA · **Timeline:** Pre-GA · **Status:** Planned
**Verification:** 1.2-INT-001, 1.3-INT-002, 2.1-INT-001, 2.3-INT-001 green.

#### R4: Server-side validation bypass / injection (Score: 6) - HIGH

**Mitigation Strategy:**
1. All SQL parameterized; validation server-authoritative (AD-10), mirrored (not gated) on client.
2. Integration tests with SQLi/oversize/whitespace/multi-byte payloads assert reject + DB intact.
3. Render test confirms React escaping neutralizes stored `<script>` payloads.

**Owner:** Dev+QA · **Timeline:** Pre-GA · **Status:** Planned
**Verification:** 1.2-INT-004, 3.3-INT-001, plus XSS render assertion.

#### R6: Persistence not durable across restart (Score: 6) - HIGH

**Mitigation Strategy:**
1. Named volume for `db` (AD-12); migrations idempotent and applied before serving (AD-11).
2. Integration test: create todos → restart `api`/compose → todos intact, no stale reads.

**Owner:** Dev · **Timeline:** Pre-GA · **Status:** Planned
**Verification:** 1.1-INT-001/002 + restart-durability test green.

#### R9: Test-suite flakiness from real timers (Score: 6) - HIGH

**Mitigation Strategy:**
1. Mandate a controllable clock for the ~5s undo window and relative-time rendering.
2. Ban `waitForTimeout`; use network-first waits (per `test-quality`).
3. Keep server-authoritative timestamps so api-side assertions are deterministic.

**Owner:** QA · **Timeline:** Harness setup · **Status:** Planned
**Verification:** 2.3-UNIT-001/002, 1.4-UNIT-001 deterministic; suite green under `--workers=4`.

---

### Assumptions and Dependencies

#### Assumptions

1. The proposed story slate (Epic 1: 1.1–1.4; Epic 2: 2.1–2.3; Epic 3: 3.1–3.4) will be reconciled with `bmad-create-story`; test IDs re-map cleanly if story numbers change.
2. Numeric SM/NFR targets are tunable demo defaults (`[ASSUMPTION]` in PRD), not user-validated constants.
3. One engineer wears the Dev-in-test hat (no dedicated QA org); estimates assume this.

#### Dependencies

1. **TC1 seed/reset seam** — required pre-implementation (blocks integration/E2E).
2. **TC5 `api` health route** — required pre-implementation (blocks CI E2E gating).
3. **U1 load definition** & **U2 reduced-motion decision** — required before perf and motion-a11y scenarios respectively.

#### Risks to Plan

- **Risk**: Story numbering diverges from this proposal.
  - **Impact**: Test IDs need re-mapping.
  - **Contingency**: IDs are keyed to FRs/ADs, which are stable — re-map is mechanical.
- **Risk**: `sendBeacon` proves untestable in the chosen CI browser.
  - **Impact**: FR15 close-while-pending path under-covered.
  - **Contingency**: assert the commit at the `api`/network layer + unit-test the controller's flush call, treat the beacon transport as a thin, manually-verified shim.

---

**End of Architecture Document**

**Next Steps for Architecture Team:**

1. Review Quick Guide (🚨/⚠️/📋) and prioritize the two pre-implementation blockers (TC1, TC5) + U1.
2. Assign owners/timelines for the 5 high-priority risks (R1, R3, R4, R6, R9).
3. Validate assumptions and dependencies.
4. Provide feedback to QA on the testability gaps.

**Next Steps for QA Team:**

1. Wait for TC1/TC5 to be resolved before integration/E2E build-out; begin harness (fake clock, contract fixture, seed helpers) now.
2. Refer to companion QA doc (`test-design-qa.md`) for the full scenario list and per-story attachments.
3. Stand up test infrastructure (factories, fixtures, compose-based environments).
