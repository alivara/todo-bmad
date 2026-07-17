---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-07-17'
mode: 'system-level'
detectedStack: 'fullstack (Next.js web + Go/Gin api + PostgreSQL) — GREENFIELD, no code yet'
userDirective: 'Define test scenarios for unit, integration, and E2E as part of the story definitions'
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-todo-app-2026-07-17/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - knowledge/risk-governance.md
  - knowledge/test-levels-framework.md
  - knowledge/test-quality.md
  - knowledge/nfr-criteria.md
  - knowledge/adr-quality-readiness-checklist.md
---

# Test Design Progress — todo-app

## Step 1: Detect Mode & Prerequisites

- **Mode:** System-Level (confirmed by user)
- **Rationale:** Both PRD/architecture and epics exist; no `sprint-status.yaml`. Rule-based default (prefer System-Level when both present), confirmed by Alivara.
- **Prerequisites verified:**
  - PRD: `_bmad-output/planning-artifacts/prds/prd-todo-app-2026-07-17/prd.md` ✓
  - Architecture: `_bmad-output/planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md` (+ C4 model, reviews) ✓
  - Supporting: `epics.md`, UX designs, SPEC ✓

## Step 2: Load Context & Knowledge Base

- **Config:** `tea_use_playwright_utils=true`, `tea_use_pactjs_utils=false`, `tea_pact_mcp=none`, `tea_browser_automation=auto`, `test_stack_type=auto`, `risk_threshold=p1`.
- **Stack detected:** fullstack — `web` (Next.js 16.2 / React / TanStack Query 5), `api` (Go 1.26 / Gin 1.12 / golang-migrate), `db` (PostgreSQL 18), orchestrated via Docker Compose. **Greenfield** — no source or tests exist yet, so no browser exploration and no existing-coverage scan (nothing to explore).
- **Playwright Utils profile:** Full UI+API profile applies (fullstack) — used as design guidance for E2E scenario shape.
- **Knowledge fragments loaded (System-Level required):** `risk-governance`, `test-levels-framework`, `test-quality`, `nfr-criteria`, `adr-quality-readiness-checklist`.
- **User directive folded in:** deliverable must express unit / integration / E2E test scenarios *per story*, ready to attach to story definitions.

## Step 3: Testability & Risk Assessment

### 3.1 System-Level Testability Review

#### 🚨 Testability Concerns (actionable)

| # | Concern | Grounded in | Why it hurts testing | Required enabler |
|---|---------|-------------|----------------------|------------------|
| TC1 | **No test-data seeding / reset seam** | Greenfield; ADR-checklist 1.3, 2.3 | Integration & E2E need to inject known list states (empty, 1, many, long text, completed) and reset between parallel runs; UI-only setup is slow and flaky | A repository-level seed/truncate path for the test profile (e.g. a test-only seed helper or migration + truncate in test setup) |
| TC2 | **Pending-delete commit-on-unload via `sendBeacon`/`keepalive`** | AD-5, FR15 | Unload beacons are notoriously non-deterministic in E2E; asserting "close = committed" reliably is hard | A controllable ~5s timer (injectable/fake-clock) + an api-side assertion that the commit `DELETE` was received |
| TC3 | **Failure injection for optimistic rollback** | AD-4, FR23, NFR4, CM2 | Rollback is the product's central trust promise but only fires on server rejection — tests must force 4xx/5xx and network failure deterministically | Playwright route interception (web) + a way to force `api` 5xx / constraint errors (integration) |
| TC4 | **Time non-determinism** | AD-5 (~5s undo), FR6 relative time ("2 hours ago") | Real timers → flaky suites; relative-time rendering drifts | Fake/controllable clock in web unit + E2E; server-authoritative timestamps (AD-7) make api-side deterministic |
| TC5 | **No `api` health/readiness endpoint specified** | AD-12 (compose healthcheck-gated); ADR-checklist 6.x | CI E2E must gate on "api ready" — compose healthchecks are declared for `db`→`api`→`web` but no explicit `api` health route is defined | Define + expose a lightweight `api` health endpoint (also feeds NFR reliability) |
| TC6 | **Independently-built client & api can drift on the wire contract** | AD-6 (camelCase, `metadata` nesting, `[]`≠null, `""`≠null, PATCH partial, 201/200/204, 404-as-success) | `web` and `api` are separate epics/units; subtle shape drift ships silently without a shared guard | Contract tests at the api boundary asserting every AD-6 invariant, ideally from a shared fixture |

#### ✅ Testability Assessment Summary (already strong)

- **Controllability — high.** AD-1/AD-3 make **Gin the single owner of all business logic**, fully reachable via REST with no UI dependency (ADR-checklist 1.2 = ✅). AD-2's **repository interface** is a clean mock/seam for isolating the service from Postgres.
- **Observability — high.** AD-9's **one uniform error contract** (`{ error: { code, message } }`, fixed vocabulary) and AD-6's **fixed wire shape** make responses deterministically assertable; structured logging in `api` + a React error boundary in `web` (conventions/AR14) give failure-path visibility.
- **Reliability/reproducibility — high.** AD-11 **migrations-on-boot** + AD-12 **healthcheck-gated `docker compose up`** yield a reproducible environment from a single command; AD-7 **server-authoritative UUID/timestamps** remove client clock skew.

#### Architecturally Significant Requirements (ASRs)

| ASR | Source | Class |
|-----|--------|-------|
| Fixed `web↔api` wire contract (shape, envelopes, partial PATCH, success codes, 404-as-success) | AD-6 | **ACTIONABLE** — contract tests |
| Optimistic apply + visible rollback across all 4 mutations | AD-4, FR23, CM2 | **ACTIONABLE** |
| Client-side pending-delete lifecycle + commit-on-unload | AD-5, FR13–15 | **ACTIONABLE** |
| Server-authoritative validation mirrored client-side; rune-count caps; parameterized SQL | AD-10, FR3/11/24, NFR10 | **ACTIONABLE** |
| Durable persistence across restart/refresh/session | NFR3, AD-12 (named volume) | **ACTIONABLE** |
| Server-authoritative id/timestamps + temp-id swap on settle | AD-7 | **ACTIONABLE** |
| Newest-first ordering with deterministic tiebreak; optimistic-add prepend matches settle | conventions (`created_at DESC, id DESC`), FR8 | **ACTIONABLE** |
| Migrations applied automatically before serving | AD-11 | **ACTIONABLE** — smoke |
| Repository interface as multi-user seam (no speculative scope today) | AD-2, NFR8 | **FYI** — architectural/review, not a runtime test today |
| Extensible `status` text-enum + CHECK, kept in sync in exactly two places | AD-8, FR19 | **ACTIONABLE** (current values) + **FYI** (future states) |

### 3.2 Risk Assessment (Probability × Impact, 1–3 scale)

| ID | Cat | Risk | P | I | Score | Level | Mitigation (test-side) | Owner |
|----|-----|------|---|---|-------|-------|------------------------|-------|
| R1 | DATA/BUS | Optimistic UI diverges from server on failure — user sees state that was never persisted (violates CM2 "no silent divergence") | 2 | 3 | **6** | HIGH | Force server rejection on every mutation; assert visible rollback to pre-action state (E2E + web unit on mutation `onError`) | Dev+QA |
| R3 | TECH | Independently-built `web`/`api` drift on the AD-6 wire contract (`[]`≠null, `""`≠null, camelCase, `metadata` nesting, partial PATCH, 404-as-success) | 3 | 2 | **6** | HIGH | Boundary contract tests asserting each AD-6 invariant from a shared fixture | Dev+QA |
| R4 | SEC | Server-side validation/sanitization bypass — the *only* safety layer (no auth): SQLi / XSS / oversize input | 2 | 3 | **6** | HIGH | Integration tests with malicious + boundary payloads; verify parameterized SQL + server-side reject; XSS-escaping render test | Dev+QA |
| R6 | DATA | Persistence not durable across restart — named-volume/migration misconfig loses todos (violates G2/NFR3) | 2 | 3 | **6** | HIGH | Integration test: create → restart `api`/compose → data intact; verify named volume + idempotent migrations | Dev |
| R9 | TECH | Test-suite flakiness from real timers (undo ~5s, relative time) | 3 | 2 | **6** | HIGH | Mandate fake/controllable clock; no `waitForTimeout`; network-first waits (per `test-quality`) | QA |
| R2 | DATA | `sendBeacon`/`keepalive` commit-on-unload fails → deleted todo reappears or is lost unexpectedly | 2 | 2 | 4 | MED | E2E: delete → reload within window → assert not present; api receives commit `DELETE`; fallback path covered | Dev+QA |
| R7 | OPS/TECH | Migrations race/fail on boot — `api` serves before schema ready, or partial migration | 2 | 2 | 4 | MED | Smoke: cold `compose up` reaches serving state; migration-failure surfaces (no half-serve) | Dev |
| R10 | OPS | No readiness signal → flaky CI E2E startup | 2 | 2 | 4 | MED | Add `api` health route; CI gates E2E on it (ties to TC5) | Dev |
| R11 | DATA | Ordering/tiebreak wrong — list reorders/flickers on optimistic-add settle | 2 | 1 | 2 | LOW | Integration: `ORDER BY created_at DESC, id DESC`; E2E: added item stays at top through settle | Dev |
| R8 | BUS | Rune-count cap parity (client UTF-16 vs server runes) — client says OK, server rejects (or vice versa) | 2 | 1 | 2 | LOW | Unit (both sides) with multi-byte/emoji at 200/2000 boundary; trim-before-count parity | Dev |
| R5 | PERF | p95 >300ms / optimistic >100ms under normal single-user load | 1 | 2 | 2 | LOW | Light perf check on `api` timings; Playwright perceived-render assertion | QA |

No score-9 blockers. **Five HIGH risks (≥6): R1, R3, R4, R6, R9** — these drive P0/P1 coverage. `risk_threshold=p1`, so all HIGH map to must-cover.

### 3.3 NFR Planning Assessment

_Planning only — final PASS/CONCERNS/FAIL comes from `nfr-assess` after implementation evidence exists._

| NFR | Category | Threshold (from docs) | Planned evidence | Status |
|-----|----------|-----------------------|------------------|--------|
| NFR1 | PERF | optimistic ≤100ms; API p95 ≤300ms `[ASSUMPTION]` | k6/light api timing; Playwright perceived render | Threshold present but load definition UNKNOWN |
| NFR2 | PERF/QoE | loading state immediate, no blank screen | E2E skeleton-then-content assertion (UX-DR14) | Defined |
| NFR3 | DATA | 0 data-loss across refresh/session/restart | Restart-durability integration test | Defined |
| NFR4 | RELIABILITY | failure never corrupts state (rollback) | Error-injection E2E across 4 mutations | Defined (= R1) |
| NFR5 | COMPAT | functional+polished ≥375px | Playwright viewport tests (375 / desktop) | Defined |
| NFR6 | MAINT | linter/formatter committed + passing | CI lint jobs (`eslint`+`prettier`, `gofmt`+`golangci-lint`) | Defined |
| NFR7 | MAINT | clone→run ≤10 min, no undocumented steps | CI `docker compose up` smoke + README check | Defined |
| NFR8 | EXTENSIBILITY | user-scoping addable without rewrite | Architecture review of repo seam (not runtime) | FYI |
| NFR9 | RELIABILITY | no unhandled exception surfaces | Error boundary + 4xx/5xx split E2E (AD-9) | Defined |
| NFR10 | SEC | server-side validation + sanitization authoritative | api integration w/ malicious payloads (= R4) | Defined |
| NFR11 | OPS | single `docker compose up` brings up full stack | CI compose smoke (= R7) | Defined |

**UNKNOWNs / clarifications (do not guess):**
- **U1 — "normal single-user load" for p95≤300ms is unquantified** (concurrency/RPS?). Numeric targets are flagged `[ASSUMPTION]` in the PRD. → clarify or treat as tunable demo target.
- **U2 — `prefers-reduced-motion` handling is an OPEN QUESTION** (UX-DR28 / SPEC). Affects whether bouncy check-off / pop-to-top must degrade → gates a motion-a11y scenario.
- **N/A for this scope (single-user portfolio app):** DR/RTO-RPO, SLA/availability/redundancy, distributed tracing, `/metrics`, rate-limiting, multi-tenant segregation — ADR-checklist categories 3/4/6/7.2 are intentionally out of scope, not gaps.

### 3.4 Top Risk Summary

1. **R1 / NFR4 — optimistic rollback integrity** is the single highest-value target: it *is* the product's trust promise (CM2). Cover with forced-failure E2E on all four mutations + web-unit rollback tests.
2. **R3 — contract drift** between separately-built `web` and `api`: cheap to prevent with boundary contract tests, expensive if it ships. 
3. **R4 / NFR10 — server-side validation is the only safety net** (no auth): injection + boundary payload integration tests.
4. **R6 / NFR3 — restart durability**: one decisive integration test (create → restart → intact).
5. **R9 — control time in the suite** (fake clock, no hard waits) so the undo window and relative-time never make the suite flaky.

## Step 4: Coverage Plan & Execution Strategy

### 4.0 Story decomposition (test-scenario carrier)

`epics.md` fixes epic goals + FR→epic mapping but leaves the story template unfilled. To honor the directive *"define test scenarios as part of the story definitions,"* the plan attaches scenarios to this proposed story slate (aligned to the FR Coverage Map). Story titles/IDs are a testing-side proposal — reconcile with `bmad-create-story` when stories are authored.

- **Epic 1 — Foundation & Task Capture:** 1.1 Walking skeleton (scaffold + compose + migrations + empty list) · 1.2 Create API (POST) · 1.3 List API (GET, ordering) · 1.4 Capture UI (optimistic add, clear+refocus, inline validation, relative time)
- **Epic 2 — Complete the Task Loop:** 2.1 Edit in place (PATCH title/desc) · 2.2 Toggle completion (PATCH status) · 2.3 Delete with undo (pending-delete + commit-on-unload)
- **Epic 3 — Trustworthy, Polished Experience:** 3.1 Empty/loading/error states + retry · 3.2 Optimistic rollback across all mutations · 3.3 Char-limit feedback + caps · 3.4 Theme + responsive + a11y floor

Test-ID format: `{EPIC}.{STORY}-{LEVEL}-{SEQ}` (LEVEL ∈ UNIT/INT/E2E). Level split follows `test-levels-framework` (logic→unit, boundaries/persistence→integration, journeys/UX→E2E) with the duplicate-coverage guard applied.

### 4.1 Coverage Matrix — per story, per level

#### Epic 1

**Story 1.1 — Walking skeleton** (FR16/17 base, AD-11/12; risks R6, R7, R10)
| ID | Level | Scenario | Pri |
|----|-------|----------|-----|
| 1.1-INT-001 | INT | Cold `docker compose up` reaches serving state; only `web` port exposed, `api`/`db` internal | P0 |
| 1.1-INT-002 | INT | Migrations apply automatically on boot before `api` serves; schema matches TODO table | P0 |
| 1.1-INT-003 | INT | `GET /todos` on empty DB returns `200` + `[]` (bare array, **never `null`**) — AD-6 | P0 |
| 1.1-INT-004 | INT | `api` health/readiness endpoint returns healthy once migrated (enabler TC5) | P1 |
| 1.1-INT-005 | INT | Migration failure surfaces (no half-serve): bad migration ⇒ `api` does not accept traffic | P1 |

**Story 1.2 — Create API (POST /todos)** (FR1/2/3/19, AD-6/7/8/10; risks R3, R4)
| ID | Level | Scenario | Pri |
|----|-------|----------|-----|
| 1.2-UNIT-001 | UNIT | Title validation: empty/whitespace-only rejected; trimmed-then-≤200-runes accepted (multi-byte/emoji at boundary) | P0 |
| 1.2-UNIT-002 | UNIT | Description optional: blank allowed; trimmed ≤2000 runes; >2000 rejected | P1 |
| 1.2-UNIT-003 | UNIT | New-todo defaults: `status=active`, server-set id/timestamps; client `id`/`status`/`metadata` ignored | P0 |
| 1.2-INT-001 | INT | `POST` valid ⇒ `201` + full resource, camelCase, timestamps nested under `metadata`, `description:""` when omitted (never null) — AD-6 | P0 |
| 1.2-INT-002 | INT | `POST` empty title ⇒ `400` `{error:{code:"validation_error",message}}` — AD-9; no row persisted | P0 |
| 1.2-INT-003 | INT | Persisted `id` is server UUID v4; `createdAt`/`updatedAt` RFC3339 UTC `Z`, second precision — AD-7 | P1 |
| 1.2-INT-004 | INT | Injection/sanitization: SQLi payload in title stored/rejected safely via parameterized SQL; DB intact — R4/NFR10 | P0 |

**Story 1.3 — List API (GET /todos)** (FR5/6/8, ordering convention; risk R11)
| ID | Level | Scenario | Pri |
|----|-------|----------|-----|
| 1.3-UNIT-001 | UNIT | Ordering comparator: newest-first with `created_at DESC, id DESC` deterministic tiebreak on equal timestamps | P1 |
| 1.3-INT-001 | INT | `GET /todos` returns todos newest-first; equal-timestamp rows tie-broken by id — FR8 | P0 |
| 1.3-INT-002 | INT | Response array items match AD-6 shape exactly (contract test, shared fixture) — R3 | P0 |

**Story 1.4 — Capture UI** (FR1/2/4/6, AD-4; risks R1 seed, R9)
| ID | Level | Scenario | Pri |
|----|-------|----------|-----|
| 1.4-UNIT-001 | UNIT | Relative-time formatter (fake clock): `createdAt` → "2 hours ago" etc.; deterministic — R9 | P1 |
| 1.4-UNIT-002 | UNIT | Add mutation `onMutate` prepends optimistic todo with temp id; `onSuccess` swaps to server UUID — AD-4/AD-7 | P0 |
| 1.4-UNIT-003 | UNIT | Client-mirror title validation matches server rule (empty rejected, ≤200 runes) — AD-10 parity | P1 |
| 1.4-E2E-001 | E2E | Create happy path: type title + Enter ⇒ row appears at top optimistically, persists, survives reload — FR1/2/8/17 | P0 |
| 1.4-E2E-002 | E2E | After add, input clears and stays focused; type-Enter-type-Enter adds two without mouse — FR4/UX-DR22 | P1 |
| 1.4-E2E-003 | E2E | Empty/whitespace title ⇒ inline validation, no row created — FR3 | P1 |
| 1.4-E2E-004 | E2E | Optional description added at creation renders on the row — FR1/6 | P2 |

#### Epic 2

**Story 2.1 — Edit in place (PATCH title/description)** (FR9/10/11, AD-6 partial PATCH, AD-10; risks R1, R3)
| ID | Level | Scenario | Pri |
|----|-------|----------|-----|
| 2.1-UNIT-001 | UNIT | Partial-PATCH builder sends only changed fields; absent field ≠ zero-value overwrite — AD-6 | P0 |
| 2.1-UNIT-002 | UNIT | Edit validation: empty title rejected + reverts to prior; description may be cleared — FR11 | P1 |
| 2.1-INT-001 | INT | `PATCH` title only ⇒ `200` + full resource, `updatedAt` refreshed, description untouched — AD-6/7 | P0 |
| 2.1-INT-002 | INT | `PATCH` clearing description ⇒ persists `""`; `PATCH` empty title ⇒ `400 validation_error` | P1 |
| 2.1-E2E-001 | E2E | Inline edit: click row → edit → Enter saves optimistically + persists; reload confirms — FR9/10 | P0 |
| 2.1-E2E-002 | E2E | Esc cancels edit and reverts to prior title (no request) — FR10/UX-DR9 | P1 |

**Story 2.2 — Toggle completion (PATCH status)** (FR7/12, AD-8; risk R1)
| ID | Level | Scenario | Pri |
|----|-------|----------|-----|
| 2.2-UNIT-001 | UNIT | Status transition validator: only `active`↔`completed` accepted; unknown value rejected (enum sync) — AD-8 | P1 |
| 2.2-INT-001 | INT | `PATCH status=completed` ⇒ `200`, persisted; toggling back to `active` persists — FR12 | P0 |
| 2.2-INT-002 | INT | Invalid status value ⇒ `400 validation_error` (CHECK + service in sync) — AD-8 | P1 |
| 2.2-E2E-001 | E2E | Toggle checkbox ⇒ instant completed styling (strikethrough+muted), persists across reload — FR7/12 | P0 |

**Story 2.3 — Delete with undo** (FR13/14/15, AD-5; risks R1, R2, R9)
| ID | Level | Scenario | Pri |
|----|-------|----------|-----|
| 2.3-UNIT-001 | UNIT | Pending-delete controller (fake clock): starts ~5s timer, **no network during window**, fires `DELETE` on elapse — AD-5/R9 | P0 |
| 2.3-UNIT-002 | UNIT | Undo cancels timer with no round-trip; todo restored in place — FR14 | P0 |
| 2.3-INT-001 | INT | Commit `DELETE` ⇒ `204`; a `DELETE` on already-gone id ⇒ `404` treated as **success** — AD-6 | P0 |
| 2.3-E2E-001 | E2E | Delete ⇒ row vanishes + undo toast; Undo restores in place (fake clock, no hard wait) — FR13/14 | P0 |
| 2.3-E2E-002 | E2E | Window elapses without Undo ⇒ deletion committed; reload confirms gone — FR15 | P0 |
| 2.3-E2E-003 | E2E | Reload/close while delete pending ⇒ commit flushes (`sendBeacon`/keepalive), todo does not reappear — FR15/R2 | P1 |

#### Epic 3

**Story 3.1 — Empty/loading/error states + retry** (FR20/21/22, AD-9, NFR2/9; risk R10)
| ID | Level | Scenario | Pri |
|----|-------|----------|-----|
| 3.1-UNIT-001 | UNIT | Error-class mapper: `4xx validation`→inline (no retry); `5xx`/network/timeout→error state + Retry — AD-9 | P0 |
| 3.1-INT-001 | INT | Proxy synthesizes AD-9-shaped `502`/`504` when `api` unreachable/timeout (never HTML/thrown fetch) — AD-3 | P1 |
| 3.1-E2E-001 | E2E | Empty state renders friendly prompt when no todos — FR20/UX-DR15 | P1 |
| 3.1-E2E-002 | E2E | Loading shows skeleton immediately, resolves to content, no blank screen — FR21/NFR2/UX-DR14 | P1 |
| 3.1-E2E-003 | E2E | Injected list-fetch 500 ⇒ non-disruptive error; Retry re-issues and recovers — FR22/NFR9/R10 | P0 |

**Story 3.2 — Optimistic rollback across all mutations** (FR23, NFR4, CM2; risk R1 — highest value)
| ID | Level | Scenario | Pri |
|----|-------|----------|-----|
| 3.2-UNIT-001 | UNIT | Each mutation's `onError` restores exact pre-action cache snapshot (add/edit/toggle) — AD-4 | P0 |
| 3.2-E2E-001 | E2E | Add rejected by server ⇒ optimistic row rolls back visibly — FR23/CM2 | P0 |
| 3.2-E2E-002 | E2E | Edit rejected ⇒ reverts to prior title/description | P0 |
| 3.2-E2E-003 | E2E | Toggle rejected ⇒ checkbox/state reverts | P0 |
| 3.2-E2E-004 | E2E | No silent divergence: after any rollback, UI equals server truth (refetch matches) — CM2 | P0 |

**Story 3.3 — Char-limit feedback + caps** (FR24, AD-10, UX-DR6/23; risk R8)
| ID | Level | Scenario | Pri |
|----|-------|----------|-----|
| 3.3-UNIT-001 | UNIT | Rune-count parity: client counter and server cap agree at 200/2000 with multi-byte/emoji (code points, trim-before-count) — AD-10/R8 | P1 |
| 3.3-E2E-001 | E2E | Counter hidden at rest, appears approaching cap, escalates past it — UX-DR6/23 | P2 |
| 3.3-INT-001 | INT | Server rejects >200 title / >2000 description even if client bypassed — NFR10 | P1 |

**Story 3.4 — Theme + responsive + a11y floor** (NFR5, UX-DR12/17/27/28, U2)
| ID | Level | Scenario | Pri |
|----|-------|----------|-----|
| 3.4-E2E-001 | E2E | Layout functional + polished at 375px and desktop; single centered column — NFR5/UX-DR17 | P1 |
| 3.4-E2E-002 | E2E | Theme toggle switches light/dark; preference persists across reload — UX-DR12 | P2 |
| 3.4-E2E-003 | E2E | a11y floor: keyboard core path (Enter/Esc + persistent focus), visible focus ring, semantic controls — UX-DR27 | P1 |
| 3.4-E2E-004 | E2E | Placeholder avatar present but non-functional (wired to nothing) — UX-DR13 | P3 |
| — | — | `prefers-reduced-motion` degrade of bouncy check-off / pop-to-top — **BLOCKED on U2 (open question)** | (P2) |

**Totals:** ~54 scenarios — UNIT ≈16, INT ≈18, E2E ≈20. By priority: **P0 ≈24, P1 ≈18, P2 ≈8, P3 ≈2** (+1 blocked).

### 4.2 NFR Coverage & Evidence Plan (concise)

| NFR | Validation level/tool | Evidence for `nfr-assess` |
|-----|-----------------------|---------------------------|
| NFR1 (perf) | Light k6 on `api` + Playwright perceived render | timing report / trace (load def U1 pending) |
| NFR3 (durability) | Integration restart test (1.1/R6) | pass record of create→restart→intact |
| NFR4/9 (rollback, no unhandled) | E2E error-injection (3.2, 3.1) | Playwright run + error-boundary assertion |
| NFR5 (responsive) | Playwright viewport (3.4) | 375/desktop run |
| NFR6/7 (maintainability, run) | CI lint (`eslint`+`prettier`, `gofmt`+`golangci-lint`) + compose smoke | CI job logs, README clone-run timing |
| NFR10 (server validation) | api integration malicious/boundary (1.2/2.x/3.3) | test run |
| NFR11 (compose up) | CI compose smoke (1.1) | CI job |
| NFR8 (extensibility) | Architecture/code review of repo seam | review note (not runtime) |

### 4.3 Execution Strategy (PR / Nightly)
- **PR (< 15 min):** all UNIT + all INT + P0/P1 E2E. Fail fast on core loop, contract, validation, rollback, durability.
- **Nightly:** full E2E incl. P2/P3 (theme, char-counter polish, avatar), responsive matrix, light k6 perf, cold compose-up smoke.
- Ordering: P0 → P1 → P2 → P3 (tag `@p0`…`@p3` for selective runs).

### 4.4 Resource Estimates (ranges)
- Test infra/enablers (seed+reset seam TC1, fake-clock harness TC4, contract-fixture, compose CI) — **~12–20 h**
- P0 (~24) — **~30–45 h** · P1 (~18) — **~18–30 h** · P2 (~8) — **~6–14 h** · P3 (~2) — **~1–3 h**
- **Total ≈ 67–112 h**, roughly 2–3 focused weeks for one engineer incl. harness.

### 4.5 Quality Gates
- P0 pass rate **100%**; P1 pass rate **≥95%**.
- All **HIGH** risk mitigations (R1, R3, R4, R6, R9) covered by a green P0 before release.
- Coverage target **≥80%** unit/integration on `api` service + `web` logic (per priorities matrix).
- Every in-scope NFR has an identified evidence source (4.2); final NFR PASS/CONCERNS/FAIL deferred to `nfr-assess`.
- Blockers to clear before "done": TC1 seed/reset seam, TC5/api health route, U1 (perf load def), U2 (`prefers-reduced-motion`).

## Step 5: Generate Outputs & Validate

- **Execution mode:** config `tea_execution_mode=auto`; resolved to **sequential in-process** (single agent held all analysis — deterministic, no cross-worker reconciliation drift).
- **Outputs written:**
  - `_bmad-output/test-artifacts/test-design-architecture.md`
  - `_bmad-output/test-artifacts/test-design-qa.md`
  - `_bmad-output/test-artifacts/test-design/todo-app-handoff.md`
- **Validation (`checklist.md`):** risk matrix (unique IDs, P/I 1–3, P×I, ≥6 flagged, mitigations+owners+timelines) ✓ · coverage matrix per level, no duplicate coverage, priorities + risk links ✓ · PR/Nightly/Weekly execution ✓ · interval estimates ✓ · quality gates ✓ · two-doc structure + actionable-first ✓ · handoff populated ✓ · playwright-utils example aligned to `tea_use_playwright_utils=true` ✓. No browser/CLI sessions opened (nothing to clean up). All temp artifacts under `{test_artifacts}`.
- **Minor deviation:** architecture doc runs longer than the ~150–200-line target — the excess is five full high-risk mitigation plans + three risk tables (non-repetitive, all actionable), a conscious tradeoff for completeness.
- **`on_complete` hook:** empty in config → skipped.
