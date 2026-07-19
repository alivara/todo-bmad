---
title: 'Add an optional description field to the create-todo form'
type: 'feature'
created: '2026-07-19'
status: 'done'
baseline_revision: '7985b69ed2ed1e6ea40c6df13f5e18bc4db60282'
final_revision: 'b5e231c'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/project-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** The create-todo form (`AddInput`) only accepts a title; a description can currently only be added afterward via edit-in-place — a deliberate Story 1.2 scoping. Users want to set a description at creation time. The API (`POST /todos` accepts `{ title, description? }`), the wire contract (`CreateTodoRequest.description?`), and the optimistic hook are **already description-ready** — only the form doesn't expose it.

**Approach:** Add an optional description `<textarea>` to `AddInput`, mirroring the edit-in-place description editor (placeholder, `CharCounter`, ≤2000-rune cap, trim), and pass `description` through to the already-ready `useCreateTodo`. **Web-only; no API/contract/migration change.** This consciously reverses 1.2's "description via edit only" deferral.

## Boundaries & Constraints

**Always:**
- Mirror the edit-in-place description field (`TodoRow.tsx`): a `<textarea>` (`rows={2}`), the **verbatim** placeholder `Add a description (optional)`, an explicit `aria-label`, a `CharCounter` under it with `max={MAX_DESCRIPTION}`, and `aria-invalid` when over-cap. Reuse `MAX_DESCRIPTION` + `codePoints` from `web/lib/caps.ts` and the existing field-style idiom (`editFieldBaseStyle`/`editDescriptionStyle` "shares the AddInput field idiom") + dark-theme tokens — introduce no new tokens or validation util.
- Validate the description client-side as a **mirror** of the server (AD-10): block submit when `codePoints(description.trim()) > MAX_DESCRIPTION`, counting Unicode code points, cap applied **after trim**; never drop keystrokes.
- **Omit `description` from the POST body when blank/whitespace-only** (keeps `CreateTodoRequest.description?` optional and the `""`-empty-todo semantics; matches the absent-is-clean idiom). Send `description` (trimmed) only when non-empty.
- The description `<textarea>` must **not** submit the form on Enter (Enter = newline, as in the edit editor); only the title input's Enter/the Add button submit.
- After a successful add, clear **both** fields and refocus the title input. Keep the field keyboard-reachable + labeled from the start (Epic 2 a11y-of-controls lesson).
- Preserve all existing title behavior, the double-add guard, and the 4xx-inline / 5xx-retry error surface unchanged (both fields roll back visibly on rejection via the existing optimistic path).

**Block If:**
- The backend/wire contract turns out NOT to accept `description` on create (it does — `CreateTodoRequest.description?`) — HALT `blocked`, condition `create contract lacks description`.

**Never:**
- No change to `api/` (service/handler/repository/migrations) or `shared/todo.ts` — the contract already supports this.
- No new validation helper, no re-sort, no change to `useCreateTodo`'s optimistic/rollback logic beyond it already threading `description` (it does).
- No character-limit *counter redesign* (reuse `CharCounter` as-is); no dark-theme token changes.
- Do not make description required, and do not send `description: null`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create with title + description | both filled | `POST { title, description }` (trimmed); optimistic row shows both; persists | n/a |
| Create with title only | description blank/whitespace | `POST { title }` (description omitted); optimistic `description: ''` | n/a |
| Over-cap description | > 2000 code points (after trim) | Submit blocked (no POST), counter shows overage, `aria-invalid`, keystrokes kept | Silent block (mirror title over-cap) |
| Enter in description textarea | caret in textarea | Inserts a newline; does NOT submit | n/a |
| Rejected create (5xx) | server 500 | Optimistic row (title+desc) rolls back visibly + Retry (existing surface) | 5xx → error + retry |
| After successful add | 201 settles | Title + description cleared, title refocused, real UUID swapped | n/a |

</intent-contract>

## Code Map

- `web/app/components/AddInput.tsx` -- MODIFY: add the optional description `<textarea>` + its `CharCounter`, over-cap guard, submit wiring (omit when blank), and clear+refocus. The only production file changed.
- `web/lib/useCreateTodo.ts` -- READ-ONLY: already forwards `input` and sets optimistic `description: input.description ?? ''`. No change.
- `web/app/components/TodoRow.tsx` -- READ-ONLY pattern source (edit description textarea + placeholder + counter + validation).
- `web/lib/caps.ts` -- `MAX_DESCRIPTION`, `codePoints` (reuse). `web/app/components/CharCounter.tsx` -- reuse `{ value, max }`.
- `shared/todo.ts` -- confirms `CreateTodoRequest.description?` (do not modify).

## Tasks & Acceptance

**Execution:**
- [x] `web/app/components/AddInput.tsx` -- Add a `description` state + an optional `<textarea>` below the title row (full-width in the wrapping flex form), with the verbatim `Add a description (optional)` placeholder, an `aria-label`, a `CharCounter value={description} max={MAX_DESCRIPTION}`, and `aria-invalid` when `codePoints(description.trim()) > MAX_DESCRIPTION`. Extend the submit guard to also block on description over-cap. Pass description to the mutation, omitting it when blank: `create.mutate({ title, ...(desc ? { description: desc } : {}) })` (desc = trimmed). On successful add, clear both fields and refocus the title. Reuse `caps.ts` + the edit field-style idiom + dark-theme tokens; keep the textarea from submitting on Enter.
- [x] `web/tests/add-input.test.tsx` -- Add unit tests: (a) description included (trimmed) in the POST body when provided; (b) blank/whitespace description → body omits `description` (the existing `toEqual({ title })` case still holds); (c) over-2000 description blocks submit (no POST); (d) description `CharCounter` appears within 20 of the cap; (e) both fields cleared + title refocused after add.
- [x] `web/tests/e2e/create.spec.ts` -- Add an E2E: fill title + `getByPlaceholder('Add a description (optional)')`, submit, assert the `POST /todos` body includes `description`, the new row renders the description, and it persists across reload.

**Acceptance Criteria:**
- Given the create form, when a user enters a title and a description and submits, then the todo is created with both (optimistically shown and persisted), and the description round-trips per AD-6.
- Given a title but no description, when the user submits, then the POST body omits `description` and the created todo's description is `""` (never null).
- Given a description over 2000 code points (after trim), when the user tries to submit, then submit is blocked with no POST and the counter/`aria-invalid` reflect the overage — mirroring the title cap.
- Given the description textarea has focus, when the user presses Enter, then a newline is inserted and the form does not submit.
- Given a successful add, when it settles, then both fields are cleared, the title is refocused, and the temp id is swapped for the server UUID.

## Spec Change Log

_No bad_spec loopbacks. SDD note: correct-course reframed this as a **conformance fix** — PRD FR1 always required "an optional longer description can be added at creation or later"; Story 1.2's implementation under-delivered it. The planning artifacts were reconciled first (epics Story 1.2 AC + note, UX `EXPERIENCE.md` Add-input spec, `sprint-change-proposal-2026-07-19-create-description.md`); no PRD/architecture change was needed._

## Review Triage Log

### 2026-07-19 — Review pass
Reviewer (per REVIEW OVERRIDE — web-only change): PIXEL (agent-frontend-engineer). Verdict: ship-ready on correctness/security/acceptance; all five ACs met; tests honest (no tautology); the 4th changed file (`mutation-error-split.test.tsx`) is a behavior-neutral selector disambiguation.
- intent_gap: 0
- bad_spec: 0
- patch: 1: (low 1)
- defer: 1: (medium 1)
- reject: 0
- addressed_findings:
  - `[low]` `[patch]` AC4 (Enter in the description textarea = newline, not submit) had no test lock. Added an RTL test asserting `keyDown Enter` on the Description textbox fires no POST — guards against a future submit-on-Enter regression.
  - `[medium]` `[defer]` The description `<textarea>` wears an unconditional accent border + `accent-soft` halo (`outline:'none'`, no `:focus-visible`) per the spec's "mirror the edit field idiom" instruction, so an unfocused optional field looks permanently focused (WCAG 2.4.7 gap, CI-invisible). Spec-inherited debt — the title input has the same pre-existing pattern; a proper fix spans both AddInput fields + the shared `.todo-editable:focus-visible` idiom. Deferred to Story 3.5 (a11y floor), recorded in `deferred-work.md` alongside the existing 1.2 focus-halo item.

## Design Notes

`useCreateTodo` needs no change — `AddInput` currently passes only `{ title }` (the sole gap). Omit-when-empty keeps `CreateTodoRequest.description?` honest and avoids touching the existing strict `toEqual({ title })` unit assertion for the no-description path. A `<textarea>` inside the form does not submit on Enter by default, so "Enter = newline" needs no special handler (only ensure no `onKeyDown` is added that submits). Scope note: this reverses Story 1.2's deliberate deferral of description entry to edit-in-place — intentional, at user request.

## Verification

**Commands** (run in `web/`):
- `npm run lint && npm run format:check && npm run test:unit` -- expected: all pass, incl. the new description tests.
- The create E2E (`create.spec.ts`) runs at the CI integration/E2E lane (needs the Docker stack) — confirm green on the PR.
- `git diff` shows only `web/app/components/AddInput.tsx` + the two test files changed (no `api/`, no `shared/`).

## Auto Run Result

Status: **done** · followup_review_recommended: **false**

**Change summary:** Web-only. Added an optional description `<textarea>` to the create-todo form (`AddInput`), mirroring the edit-in-place editor: verbatim `Add a description (optional)` placeholder, `aria-label`, `CharCounter` (`max=MAX_DESCRIPTION`), ≤2000-code-point cap after trim (over-cap blocks submit), and `description` passed to the already-ready `useCreateTodo` — **omitted from the POST body when blank** (never `""`/`null`). Both fields clear + the title refocuses on a successful add. `useCreateTodo`/`shared`/`api` untouched. Built in worktree `feat/create-todo-description-field`.

**SDD reconciliation (correct-course ran first, at user request):** this is a **conformance fix**, not a scope reversal — PRD **FR1** already required description-at-creation. Planning artifacts were updated to lead the code: epics Story 1.2 (new interaction AC + scope note), UX `EXPERIENCE.md` (Add-input anatomy now includes the description field), and `sprint-change-proposal-2026-07-19-create-description.md`. No PRD/architecture change was needed.

**Files changed:**
- `web/app/components/AddInput.tsx` — the description field + wiring.
- `web/tests/add-input.test.tsx` — 6 new tests (incl. the AC4 Enter=newline lock); `web/tests/e2e/create.spec.ts` — description-on-create E2E; `web/tests/mutation-error-split.test.tsx` — behaviour-neutral selector disambiguation.
- Planning: `epics.md`, `ux-.../EXPERIENCE.md`, `sprint-change-proposal-2026-07-19-create-description.md`; `deferred-work.md` (+1 defer); this spec.

**Review (PIXEL):** ship-ready. 1 patch (AC4 Enter=newline test), 1 defer (the description field inherits the pre-existing 1.2 focus-halo / `:focus-visible` a11y gap — → Story 3.5). 0 intent-gap/bad-spec.

**Verification:** `npm run lint` + `format:check` clean; **`npm run test:unit` → 114 passed** (incl. all new description tests). The create E2E runs at the CI integration/E2E lane on the PR (authoritative). `git diff` limited to `web/` for product code (no `api`/`shared`).

**Residual risks:** the create E2E is only confirmed by the PR's own CI run; the deferred focus-halo/`:focus-visible` a11y polish ships as-is (matches the pre-existing title-field pattern; tracked for Story 3.5).
