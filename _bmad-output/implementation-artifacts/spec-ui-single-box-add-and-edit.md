---
title: 'UI single-box consolidation: unified add-input container + single row edit cue'
type: 'feature'
created: '2026-07-20'
status: 'done'
baseline_commit: '92aae7d' # corrected: f436d34 was a transient wrong HEAD (chore/qa-reports) captured during concurrent git activity; real branch point is main@92aae7d
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-todo-app-2026-07-17/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-todo-app-2026-07-17/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The add form renders as two visually separate accent-bordered boxes (title+Add on top, a full-width bordered description textarea below), and each task row advertises two decorative pencil edit cues (one on the title line, one on the description line). The 2026-07-20 UX contract amendment (EXPERIENCE.md §Add input, §Edit-in-place; DESIGN.md add-input + inline-edit) now calls for a single-box idiom: one bordered container holding both add fields, and one edit affordance per row.

**Approach:** Purely visual/interaction structure. Wrap the add-input title row and description into one bordered container and strip the inner fields' individual accent borders. Suppress the decorative `::after` pencil on the row's description line so exactly one edit cue (on the title) shows, while the description stays clickable-to-edit. No behavior, validation, wire-contract, optimistic/rollback, char-counter, motion, or a11y change.

## Boundaries & Constraints

**Always:**
- Preserve every existing role/aria-label the tests select by: `Add a task` (title input), `Add` (button), `Description` (add textarea), `Edit title`/`Edit description` (inline editor), and the `role="button"` editable title/description paragraphs.
- Keep both the title `<p>` and description `<p>` carrying `.todo-editable` (drives hover/:focus-visible tint + focusable role="button") — the description stays clickable to open the editor (e2e 2.2-E2E-002 taps the description text).
- Reuse existing design tokens only (`--accent`, `--radius-sm`, `--surface-raised`, `--ink-secondary`, `--accent-soft`, `typography.description`). No new tokens, no new colors.
- Preserve a visible keyboard focus indicator on every field (WCAG 2.4.7 — do not regress the a11y floor).

**Ask First:**
- Any change that would alter a POST/PATCH body, a handler's behavior, or a char-counter threshold.
- Introducing a brand-new dedicated edit `<button>` element (changes the a11y tree / tab order) instead of the minimal cue-suppression approach.

**Never:**
- Do not change validation, caps (200/2000), submit/guard logic, optimistic insert/rollback, motion, or the wire contract.
- Do not remove the description's ability to open the editor; do not add a modal or route change.
- Do not regenerate the UX mockups/HTML.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Add with title only | Type title, press Enter | Optimistic insert; both fields clear; focus returns to title; POST body `{title}` only | N/A |
| Add with description | Type title + description, click Add | Same as above; POST body carries trimmed `description` | Blank/whitespace description omitted from body |
| Focus a field in the add box | Tab into title or description | The focused field shows the accent-soft focus halo inside the single container | N/A |
| View a row with a description | Row renders title + description | Exactly ONE pencil cue visible (on the title); description shows no `::after` pencil | N/A |
| Edit via description | Click the description text | Inline editor opens with both title + description fields | Empty/whitespace title reverts on save |

</frozen-after-approval>

## Code Map

- `web/app/components/AddInput.tsx` -- add form; `formStyle`, `inputStyle` (title, own accent border), `descriptionStyle` (own accent border) become one bordered container with borderless inner fields.
- `web/app/components/TodoRow.tsx` -- task row; title `<p>` and description `<p>` both className `todo-editable`. Add a no-cue modifier class to the description `<p>` only.
- `web/app/globals.css` -- `.add-input` / `.add-input:focus-visible` (L122-128) focus halo; `.todo-editable::after` pencil cue (L273). Add the no-cue modifier rule and, if needed, container focus styling.
- `web/tests/add-input.test.tsx`, `web/tests/todo-row.test.tsx`, `web/tests/e2e/{create,edit,a11y}.spec.ts` -- guardrails; expected to stay green.

## Tasks & Acceptance

**Execution:**
- [x] `web/app/components/AddInput.tsx` -- Introduced a single bordered container (`fieldContainerStyle`: 1.5px `--accent`, `--radius-sm`, `--surface-raised`) wrapping the title-row flex (title input + Add button) and the description textarea stacked below (hairline-separated); removed the resting accent border/surface from `inputStyle` and `descriptionStyle` (now transparent/borderless), kept their `.add-input` class so `:focus-visible` still lights the focused field. Description stays 14px; all handlers, aria-labels, and char-counter rows preserved.
- [x] `web/app/components/TodoRow.tsx` -- Added `todo-editable--no-cue` to the description `<p>` alongside `todo-editable`; title `<p>` unchanged (sole pencil cue). No handler changes.
- [x] `web/app/globals.css` -- Added `.todo-editable--no-cue::after { content: none; }` and reset the touch-device `padding-right` reserve for that variant. Per-field focus glow (`.add-input:focus-visible`) unchanged and still lights the focused field inside the container.
- [x] `web/tests/*` -- Ran `test:unit` (115 passed / 18 files), `tsc --noEmit` (0 errors from changed files; the lone error is a pre-existing `reducedMotion` typing in `tests/e2e/toggle.spec.ts`, present on baseline `f436d34`), and `lint` (clean). No test encoded the old two-box/two-pencil structure — none needed changes.

**Acceptance Criteria:**
- Given the add form, when it renders at rest, then the title, Add button, and description appear inside one accent-bordered container (no second resting border), and focusing a field shows the accent-soft halo on that field.
- Given a task row with a description, when it renders, then exactly one pencil edit cue is present (on the title) and clicking the description text still opens the inline editor with both fields.
- Given the existing Vitest suite and the `create`/`edit`/`a11y` e2e specs, when they run, then they pass unchanged (no behavior/contract regression, no new axe violations).

## Verification

**Commands:**
- `cd web && npm run test` -- expected: Vitest suite green (add-input, todo-row, tokens unaffected).
- `cd web && npx tsc --noEmit` -- expected: no type errors.
- `cd web && npm run lint` -- expected: clean.

**Manual checks:**
- Add form reads as one box: title on top, smaller description below, single accent border; focus halo appears per focused field.
- A row with a description shows one pencil (title), none on the description line; description remains clickable to edit.

## Suggested Review Order

**Add-input single box (Change 1)**

- Entry point — the one accent-bordered container the title + description now share.
  [`AddInput.tsx:158`](../../web/app/components/AddInput.tsx#L158)

- The JSX: title-row (input + Add) then the stacked description, all inside the container.
  [`AddInput.tsx:70`](../../web/app/components/AddInput.tsx#L70)

- Inner title field now borderless/transparent; padding tuned to match the Add button height (review patch).
  [`AddInput.tsx:176`](../../web/app/components/AddInput.tsx#L176)

- Description: borderless, hairline-separated, quieter/smaller — the "smaller down" field.
  [`AddInput.tsx:192`](../../web/app/components/AddInput.tsx#L192)

**Single edit cue (Change 2)**

- The description `<p>` gains `--no-cue` alongside `todo-editable` — still editable, no pencil.
  [`TodoRow.tsx:287`](../../web/app/components/TodoRow.tsx#L287)

- The CSS that suppresses only that line's decorative pencil (`content: none`) + drops its touch padding reserve.
  [`globals.css:294`](../../web/app/globals.css#L294)
