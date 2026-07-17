---
title: 'TEA Test Design → BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design-qa.md
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-07-17'
projectName: 'todo-app'
---

# TEA → BMAD Integration Handoff

## Purpose

Bridges TEA's test design outputs with BMAD's epic/story decomposition (`create-epics-and-stories` / `create-story`). Quality requirements, risks, and test strategy flow into story acceptance criteria. Scenarios in the QA doc are already grouped **per story** so they lift directly into ACs.

## TEA Artifacts Inventory

| Artifact | Path | BMAD Integration Point |
| --- | --- | --- |
| Test Design — Architecture | `_bmad-output/test-artifacts/test-design-architecture.md` | Epic quality gates, blockers, NFR testability |
| Test Design — QA | `_bmad-output/test-artifacts/test-design-qa.md` | Story acceptance criteria, per-story test scenarios |
| Risk Assessment | (embedded in both) | Epic risk classification, story priority |
| Coverage Strategy | (embedded in QA doc) | Per-story test requirements |

## Epic-Level Integration Guidance

### Risk References

- **Epic 1 (Foundation & Task Capture):** R3 (contract drift), R4 (server-side validation/injection), R6 (restart durability), R7 (migration-on-boot), R10 (readiness) — all seeded here since Epic 1 establishes the contract, persistence, and deploy envelope.
- **Epic 2 (Complete the Task Loop):** R1 (optimistic rollback), R2 (sendBeacon commit-on-unload), R9 (timer flakiness) — the mutation + pending-delete surface.
- **Epic 3 (Trustworthy Experience):** R1 (rollback, culminating), R10 (error/proxy synthesis), R8 (rune-count parity) — the states + polish layer.

### Quality Gates

| Epic | Gate before "done" |
| --- | --- |
| Epic 1 | Contract fixture (R3) green; injection tests (R4) green; cold+restart compose smoke (R6/R7) green; `api` health route exists (TC5) |
| Epic 2 | Rollback (R1) green on edit/toggle; pending-delete controller + undo unit tests (R9) green; commit + 404-as-success (R3) green |
| Epic 3 | Rollback E2E across all mutations + post-rollback refetch=server (R1/CM2) green; error/empty/loading states green |

## Story-Level Integration Guidance

### P0/P1 Test Scenarios → Story Acceptance Criteria

Each story MUST carry its per-story block from the QA doc as acceptance criteria. Non-negotiable P0 ACs:

- **1.1:** empty `GET /todos` returns `200 []` (never null); migrations apply before serve; only `web` port exposed.
- **1.2:** `POST` valid → `201` + AD-6-shaped resource; empty title → `400 validation_error`; SQLi/oversize payload rejected, DB intact.
- **1.3:** list newest-first with `created_at DESC, id DESC` tiebreak; items match AD-6 shape.
- **1.4:** create appears optimistically at top, persists, survives reload; input clears + refocuses.
- **2.1:** inline edit saves optimistically + persists; Esc reverts; empty-title edit rejected.
- **2.2:** toggle reflects instantly + persists both directions; completed styling distinct.
- **2.3:** delete → undo toast; Undo restores with no round-trip; window elapse commits; close-while-pending commits (no reappear).
- **3.1:** injected `500` → non-disruptive error + working Retry; skeleton→content, no blank screen.
- **3.2:** every optimistic action rolls back visibly on server rejection; post-rollback UI equals server truth (CM2).

### Data-TestId Requirements

Recommended stable hooks for testability (semantic roles preferred per UX-DR27; testids as backstops):
- `add-input` (placeholder "Add a task…"), `add-button`
- `todo-row` (with `data-todo-id`), `todo-title`, `todo-description`, `todo-checkbox`, `todo-meta`
- `delete-button`, `undo-toast`, `undo-button`
- `char-counter`, `theme-toggle`, `empty-state`, `loading-skeleton`, `error-state`, `retry-button`

## Risk-to-Story Mapping

| Risk ID | Category | P×I | Recommended Story/Epic | Test Level |
| --- | --- | --- | --- | --- |
| R1 | DATA/BUS | 2×3=6 | 3.2 (+ 1.4, 2.1, 2.2) | Unit + E2E |
| R3 | TECH | 3×2=6 | 1.2, 1.3 (+ 2.1, 2.3) | Integration (contract) |
| R4 | SEC | 2×3=6 | 1.2 (+ 3.3) | Unit + Integration |
| R6 | DATA | 2×3=6 | 1.1 | Integration |
| R9 | TECH | 3×2=6 | 2.3 (+ 1.4) | Unit (fake clock) |
| R2 | DATA | 2×2=4 | 2.3 | E2E + Integration |
| R7 | OPS/TECH | 2×2=4 | 1.1 | Integration |
| R10 | OPS | 2×2=4 | 1.1 (+ 3.1) | Integration |
| R11 | DATA | 2×1=2 | 1.3 | Unit + Integration |
| R8 | BUS | 2×1=2 | 3.3 | Unit |
| R5 | PERF | 1×2=2 | 3.4 / perf-smoke | k6 (nightly) |

## Recommended BMAD → TEA Workflow Sequence

1. **TEA Test Design** (`TD`) → produces this handoff document ✅
2. **BMAD Create Epics & Stories** → consumes this handoff, embeds per-story scenarios as ACs
3. **TEA ATDD** (`AT`) → generates red-phase acceptance tests per story (start with P0)
4. **BMAD Implementation** → developers implement test-first
5. **TEA Automate** (`TA`) → expands to the full ~54-scenario suite
6. **TEA Trace** (`TR`) → validates coverage completeness (≥80% P0/P1)

## Phase Transition Quality Gates

| From Phase | To Phase | Gate Criteria |
| --- | --- | --- |
| Test Design | Epic/Story Creation | All 5 P0 risks (R1, R3, R4, R6, R9) have mitigation strategy; TC1/TC5/U1/U2 flagged |
| Epic/Story Creation | ATDD | Stories carry per-story scenarios as acceptance criteria |
| ATDD | Implementation | Failing acceptance tests exist for all P0/P1 scenarios |
| Implementation | Test Automation | All acceptance tests pass |
| Test Automation | Release | Trace matrix shows ≥80% coverage of P0/P1 requirements; all HIGH-risk mitigations green |

## Open Items Carried Forward

- **TC1** — test-data seed/reset seam (pre-implementation blocker)
- **TC5** — `api` health/readiness endpoint (pre-implementation blocker)
- **U1** — quantify "normal single-user load" for NFR1 p95≤300ms
- **U2** — decide `prefers-reduced-motion` handling (UX-DR28) — blocks one motion-a11y scenario
