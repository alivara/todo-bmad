# Issue: Feed test-design risk review back into PRD / Architecture / Stories

**Date:** 2026-07-17
**Source:** Party-mode risk review of `test-design-architecture.md` + `test-design-qa.md`
**Project:** todo-app
**Type:** Correction / change request across planning artifacts

---

## Context

A risk review re-scored the five HIGH risks against *this* product's real stakes (single-user, no auth, no money, polish-is-the-product) and separated risks the PRD already owned from gaps the test-design lens actually surfaced. Result:

| Risk | Old | New | Verdict |
|---|---|---|---|
| **R1** optimistic rollback | 6 | **9** 🔴 | the one true blocker |
| **R6** durability | 6 | **6** 🟠 | real medium |
| **R4** injection | 6 | **4** 🟡 | medium — don't gold-plate |
| **R3** contract drift | 6 | **4 → 2** 🟡 | conditional; collapses once a shared type lands |
| **R9** timer flakiness | 6 | *off product register* ⚪ | dev-hygiene, not a product risk |
| **TC1 / TC5** seed seam / health route | — | *blockers* 🔧 | testability gaps to build first |

Three artifacts need edits: the **PRD** (2 unknowns), the **Architecture spine** (2 genuine gaps), and the **Stories** (attach scenarios + tasks). Fix-order that unblocks the rest: **TC5 + TC1 → R3 shared type → R1 → R6, R4 → R9 harness.**

---

## 1. PRD changes

**File:** `_bmad-output/planning-artifacts/prds/prd-todo-app-2026-07-17/prd.md`

- [ ] **U1 — quantify or reframe NFR1 load.** `NFR1`/`SM3` state "API p95 ≤300ms under normal single-user load" but "normal single-user load" is undefined (numbers already flagged `[ASSUMPTION]`). Either give a concrete figure (e.g. "single sequential user, ≤N req/s") **or** explicitly reframe as a single-request smoke target so NFR1 is verifiable. *(Resolves U1; unblocks the perf smoke.)*
- [ ] **U2 — resolve `prefers-reduced-motion`.** Open question in §Future/UX-DR28. Decide for v1: does the bouncy check-off / pop-to-top degrade to instant under `prefers-reduced-motion`? A yes/no here unblocks one a11y scenario. *(Resolves U2.)*
- [ ] **Elevate CM2 visibility (optional but recommended).** R1 is now the top risk and CM2 ("instant-feel never hides errors — optimistic updates roll back visibly, no silent divergence") is exactly what it guards. Consider promoting CM2 from a counter-metric note to an explicit acceptance-level requirement so it can't be quietly dropped.

*No change needed for R4/R6 substance — the PRD already owns them (G2/SM2 durability; NFR10 server-side validation). The re-score only changed their priority, not the requirement.*

---

## 2. Architecture changes

**File:** `_bmad-output/planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md`

- [ ] **R3 — assign a contract enforcer (the real gap).** AD-6 declares the wire contract "fixed and shared" but names no mechanism, while `web` and `api` are built in separate epics. Add to AD-6 (or a new AD): a **single shared source-of-truth type** for the todo wire shape that both sides derive from, so drift becomes a build error, not a runtime surprise. Document where it lives (e.g. a `shared/` contract module or generated types from one schema). *(Drops R3 probability 3→1, i.e. score 2.)*
- [ ] **TC5 — specify the `api` health/readiness endpoint.** AD-12 declares healthcheck-gated startup (`db → api → web`) but no explicit `api` health route exists. Add `GET /health` (or `/healthz`) to the endpoint list + conventions, reporting "migrated + serving." *(Unblocks CI E2E gating; also prod-useful.)*
- [ ] **TC1 — note the test-data seed/reset seam.** The "Deferred: Testing conventions" section should acknowledge a **test-only** seed/reset path through the repository (test profile only, never prod-reachable) so integration/E2E can set list states and reset between runs. *(Testability enabler.)*
- [ ] **R6 — make volume-mount verification explicit (small).** AD-12 has the named volume; add a one-line durability expectation (data survives `compose down/up`) so the "silent mount fail" case is a stated, testable invariant rather than an assumption.

*AD-4 (TanStack optimistic + rollback) and AD-10 (server-authoritative validation) already cover R1 and R4 at the architecture level — no spine change needed; the work is in code + tests (see Stories).*

---

## 3. Story changes

**File:** `_bmad-output/planning-artifacts/epics.md` (and story files when authored via `bmad-create-story`)

**Epic 1 — Foundation & Task Capture**
- [ ] **Story 1.1 (walking skeleton):** add tasks — (a) `GET /health` endpoint [TC5], (b) test-only seed/reset seam [TC1], (c) named-volume durability check. Both TC1/TC5 are **pre-implementation** for downstream test work.
- [ ] **Story 1.2 (create API):** add task — introduce the **shared wire-contract type** [R3] before `web` consumes it. Attach ACs 1.2-INT-001/002/004.

**Epic 2 — Complete the Task Loop**
- [ ] **Stories 2.1 / 2.2 / 2.3:** the rollback behaviour is part of every mutation — reference the shared optimistic-mutation wrapper (see R1 below) rather than hand-rolling rollback per story.

**Epic 3 — Trustworthy Experience**
- [ ] **Story 3.2 (optimistic rollback) — elevate to a P0 must-pass, this is the 9 [R1].** Acceptance criteria (non-negotiable):
  - Every mutating action (add / edit / toggle / delete) applies optimistically and, on server rejection, **rolls back visibly** to the exact pre-action state.
  - After any rollback, a refetch shows the UI equals server truth — **no silent divergence** (CM2).
  - Implemented via **one reusable optimistic-mutation wrapper** (`onMutate` snapshot + `onError` restore) shared by all four paths — not four separate hand-rolled rollbacks.
  - Scenarios attached: 3.2-UNIT-001, 3.2-E2E-001…004.
- [ ] **Story 3.4:** gate the `prefers-reduced-motion` scenario on the U2 decision above.

**Cross-cutting (dev-hygiene, not a story AC) [R9]:** mandate a fake/controllable clock for the ~5s undo window + relative-time rendering; ban `waitForTimeout`. Put this in the test harness / contributing guide, not a product AC.

---

## Done when

- [ ] PRD: U1 and U2 resolved (values or explicit reframes), CM2 decision made.
- [ ] Architecture: shared contract type specified [R3], `api` health route added [TC5], seed/reset seam noted [TC1], durability invariant stated [R6].
- [ ] Stories: 1.1 carries TC1/TC5 tasks; 1.2 carries the shared type; 3.2 elevated to P0 with the rollback ACs [R1]; 3.4 gated on U2.
- [ ] Re-scored risk board reflected wherever the risk register is tracked.
