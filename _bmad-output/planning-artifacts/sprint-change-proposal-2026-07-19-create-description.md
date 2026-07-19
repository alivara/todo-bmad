# Sprint Change Proposal — Description on Create

**Date:** 2026-07-19 · **Author:** Developer (correct-course) · **Project Lead:** Alivara
**Scope classification:** **Minor** (conformance fix; fits existing architecture) → Developer-agent direct implementation.

## 1. Issue Summary

**Trigger:** A UI change was requested — allow entering an **optional description when creating** a todo, not only via edit-in-place.

**What we found (the important part):** this is **not** a new scope decision — it restores conformance with an existing requirement.

- **PRD FR1** already states: *"User can create a todo by typing a short title (required) and submitting … an optional longer description can be added **at creation** or later."*
- **PRD FR2/FR3** already carry "any description" on create and note description is optional/blank-allowed.
- **UX** already defines the microcopy `Add a description (optional)`.

The first implementation of **Story 1.2 (Create)** deferred the description-entry UI to Story 2.2 (edit-in-place), which **under-delivered FR1**. The change closes that gap: the create form now collects an optional description. The backend/wire contract (`POST /todos { title, description? }`, AD-6/AD-10) always supported it — no server or contract change.

## 2. Impact Analysis

| Artifact | Impact |
| --- | --- |
| **PRD** | **None.** FR1/FR2/FR3 already require description-at-creation; the code was the thing out of sync. |
| **Epics — Story 1.2** | Add the missing create-description **interaction AC** + a scope note. (Its server-validation AC already covers `description` optional ≤2000.) |
| **Epics — Story 2.2** | **None.** "Tap a task and fix its title or description" is unchanged; edit is no longer the *only* place a description can be entered, but the story text never claimed exclusivity. |
| **UX (EXPERIENCE.md)** | Clarify the **Add input** component anatomy to explicitly include the optional description field (multiline, Enter=newline, ≤2000 cap + char-counter). |
| **Architecture** | **None.** AD-6 wire contract, AD-10 validation, and the optimistic-add hook (`useCreateTodo` already threads `description`) are unchanged. |
| **Technical / code** | Web-only. `web/app/components/AddInput.tsx` gains the field; `useCreateTodo`/`shared`/`api` untouched. Already implemented + unit-green in worktree `feat/create-todo-description-field` (paused pre-PR). |
| **Sprint tracking** | This is a conformance fix to a done story, delivered as a freeform change (no new epic-story key). Optionally note it against Story 1.2 in sprint-status. |

## 3. Recommended Approach

**Direct Adjustment.** Update Story 1.2's ACs + the UX Add-input spec to reflect FR1 (no PRD/architecture change), then let the already-written implementation proceed through review → PR. No rollback, no MVP change, no replan. Risk: low (fits the existing contract; the change is small and reversible).

## 4. Detailed Change Proposals (applied)

**A) Epics — Story 1.2 (Create a todo)**
- User story updated to "type a title (and optionally a description)…".
- Added a scope note pointing at FR1 + this proposal.
- **New AC:** given the add-input with an optional description field beneath the title (multiline; Enter = newline, not submit), when a description is filled and submitted, then the todo is created carrying it (`POST` body includes `description` only when non-empty; blank omitted, persists as `""`, never null); description validated ≤2000 code points after trim, mirroring the server (over-cap blocks submit); on success both fields clear and focus returns to the title.

**B) UX — EXPERIENCE.md, "Add input" component**
- Anatomy now explicitly lists the required title **plus the optional description field** (`Add a description (optional)`, multiline, Enter=newline), both caps enforced after trim with the quiet char-counter; blank description omitted; both fields clear + focus returns to title on submit.

**C) PRD, Architecture** — no edits (already conformant).

## 5. Implementation Handoff

- **Scope:** Minor → Developer agent, direct implementation (already done in `feat/create-todo-description-field`).
- **Next step:** resume the paused `bmad-dev-auto` loop (adversarial review → PR) for that branch; the code now matches the reconciled Story 1.2 AC + UX spec.
- **Success criteria:** create form collects an optional description; POST omits it when blank; ≤2000 rune cap mirrored client-side; both fields clear + title refocus on add; existing title behavior + optimistic rollback unchanged; unit + create E2E green in CI; `git diff` limited to `web/` (no `api`/`shared`).
- **Docs:** this proposal + the Story 1.2 / UX edits keep the planning artifacts leading the code (SDD order restored).
