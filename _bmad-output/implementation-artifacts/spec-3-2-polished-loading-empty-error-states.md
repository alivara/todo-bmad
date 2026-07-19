---
title: 'Polished loading, empty & error states'
type: 'feature'
created: '2026-07-19'
status: 'done'
baseline_revision: '721e96e'
final_revision: 'ead8eff6ee92372882e64ccaf1e86d72d3e80ac6'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** The waiting and failure moments are unpolished — loading is a bare `role="status"` line, the error state has no glyph or subline, and inline edit has no discoverable affordance. The app should feel finished even when things go wrong.

**Approach:** Web-only visual polish of the three list states. Build the **skeleton shimmer** loading state (the main new piece), add the **warm de-escalated error** glyph + locked subline, and lightly polish the already-good empty state. Also resolve the deferred Story-2.2 **edit-discoverability** gap with a hover/focus tint on the editable text. No backend, no new data.

## Boundaries & Constraints

**Always:**
- **Loading:** 4 skeleton shimmer rows matching the row anatomy (a 24px check-circle placeholder + one shimmer line of varying width), plus the `Getting your tasks…` caption in a `role="status"` region — never a blank screen or bare spinner; resolves directly to content when data loads. Skeleton placeholders are **decorative (`aria-hidden`)**; the `role="status"` caption carries the announcement.
- **Empty:** the polished empty state (accent-soft glyph field, `Nothing here yet`, subline `Add your first task above — it'll show up right here.`) with the focused add-input as the CTA.
- **Error (load failure):** a de-escalated **warm** state — a neutral glyph (`--border-hairline` field + `--ink-secondary` refresh-arrow stroke, **NO red**, `aria-hidden`), headline `Couldn't load your tasks` (upsized to 19px/700), the locked subline `Something got in the way. Your tasks are safe — let's try that again.`, and a solid `--accent` / `--on-accent` `Try again` button that re-issues the request (`refetch`). Keep `role="alert"`.
- **Edit-discoverability:** the editable title/description text gets a hover/`:focus-visible` `--accent-soft` tint (via a `.todo-editable` className — inline styles can't do `:hover`), mirroring the `.todo-delete` pattern.
- The shimmer honors `prefers-reduced-motion: reduce` (collapses to a static `--accent-soft` placeholder). All new colors come from **existing tokens** (`--accent-soft`, `--surface-raised`, `--border-hairline`, `--accent`, `--on-accent`, `--ink-secondary/-primary`, `--radius-*`) — the shimmer highlight is a `--accent-soft → --surface-raised → --accent-soft` gradient so it adapts to theme.

**Block If:**
- A polished state cannot be built without changing the deferred-to-3.5 contrast tokens (`--ink-secondary`/`--ink-muted`) — it must not; those are Story 3.5's fix.

**Never:** No change to `--ink-secondary`/`--ink-muted` token VALUES (Story 3.5). No char-counter (3.3) or theme toggle (3.4). No red/alarm color in the error state. No new backend/data. No new icon added to the locked row anatomy without flagging (see Design Note on the edit ✎ decision). No locked-microcopy edits.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| loading | `isPending` | 4 shimmer skeleton rows + `Getting your tasks…` (`role="status"`); no blank frame | — |
| loading → content | data resolves | skeleton replaced directly by the list (no flash of blank) | — |
| reduced motion | `prefers-reduced-motion: reduce` | shimmer animation off → static `--accent-soft` placeholders | — |
| empty | `data.length === 0` | accent-soft glyph field + locked headline + subline; add-input focused | — |
| load error | `isError` | warm neutral glyph (no red) + headline + locked subline + `Try again` | Try again → `refetch` |
| retry | click `Try again` | re-issues `GET /todos`; shows loading skeleton again | — |
| edit affordance | hover/focus an editable title/description | `--accent-soft` tint cue; tap/Enter still enters edit | — |
| a11y | axe scan of loading/empty/error | zero non-contrast violations; decorative SVGs/placeholders `aria-hidden` | — |

## Code Map

- `web/app/components/SkeletonList.tsx` -- **new** the loading skeleton: 4 rows (each a `--surface-raised` card with a 24px check-circle placeholder + one `.skeleton-shimmer` line of varying width) + the `Getting your tasks…` caption in `role="status"`. Placeholders `aria-hidden`.
- `web/app/page.tsx` -- swap the bare loading `<p>` for `<SkeletonList />`; rebuild the `isError` branch to the warm glyph + subline + upsized headline (keep the `refetch` Try-again). Empty branch unchanged (still `<EmptyState />`).
- `web/app/components/EmptyState.tsx` -- light glyph polish (field 64→84px, SVG 30→40px, softer ring) — keep the locked copy + structure (do not break `empty-state.test.tsx`).
- `web/app/components/TodoRow.tsx` -- convert `editableTextStyle` to a `.todo-editable` className on the editable title/description `<p>`s (keep them `role="button" tabIndex=0`).
- `web/app/globals.css` -- add `@keyframes shimmer` + `.skeleton-shimmer` (accent-soft↔surface-raised gradient sweep, ~1.6s) with a `prefers-reduced-motion` guard; add `.todo-editable` (hover/`:focus-visible` accent-soft tint, `@media (hover:hover)` for the hover half). No token-value changes.

**Tests:**
- `web/tests/skeleton-list.test.tsx` -- **new**: renders 4 skeleton rows + the `role="status"` `Getting your tasks…` caption; placeholders `aria-hidden`.
- `web/tests/empty-state.test.tsx` -- keep passing (locked copy); optionally assert the glyph.
- `web/tests/page-error-state.test.tsx` (or extend) -- error branch renders headline + the new subline + a neutral glyph (assert no red / no `--accent` on the glyph stroke = `--ink-secondary`), and `Try again` calls `refetch`.
- `web/tests/todo-row.test.tsx` -- the editable text carries the `.todo-editable` class; stays a focusable control (axe clean).
- `web/tests/e2e/a11y.spec.ts` -- add a **loading-state** axe scan (skeleton) to the existing populated/empty/edit scans; confirm zero non-contrast violations.

## Tasks & Acceptance

**Execution:**
- [x] `web/app/globals.css` -- `@keyframes shimmer` + `.skeleton-shimmer` + reduced-motion guard; `.todo-editable` hover/focus tint. No token-value edits.
- [x] `web/app/components/SkeletonList.tsx` -- the 4-row shimmer skeleton + `role="status"` caption.
- [x] `web/app/page.tsx` -- `<SkeletonList />` for loading; warm error branch (glyph + subline + headline upsize + refetch Try-again).
- [x] `web/app/components/EmptyState.tsx` -- glyph polish (keep locked copy).
- [x] `web/app/components/TodoRow.tsx` -- `.todo-editable` className on the editable text.
- [x] tests -- skeleton render, error subline/no-red/retry, edit-cue class, empty stays green, a11y loading scan.

**Acceptance Criteria:**
- Given the initial fetch is loading, then skeleton shimmer rows matching the row anatomy show with `Getting your tasks…` (never blank, never a bare spinner), resolving directly to content.
- Given no todos exist, then the polished empty state shows (accent-soft glyph field + locked headline/subline) with the focused add-input as the CTA.
- Given a load failure, then the warm de-escalated error appears (neutral glyph, no red) with `Couldn't load your tasks`, the reassuring subline, and a solid accent `Try again` that re-issues the request.
- Given the shimmer under reduced motion, then the animation is disabled (static placeholders) — motion never gates.

## Design Notes

Resolutions (conservative, from the DESIGN spine + mockup — for PR ratification):

1. **Skeleton:** 4 rows, each = a 24px check-circle placeholder (matching `TodoRow`'s real checkbox) + **one** shimmer line of varying width (72/54/63/44%) — restraint over a full 2-line skeleton. `role="status"` caption `Getting your tasks…` in `--ink-secondary`.
2. **Shimmer highlight is token-derived:** `linear-gradient(100deg, var(--accent-soft) 20%, var(--surface-raised) 40%, var(--accent-soft) 60%)` swept via `background-position` — no untokenized hex, adapts to the warm-dark `-dark` tokens. `prefers-reduced-motion` → `animation: none; background: var(--accent-soft)`.
3. **Error glyph:** `--border-hairline` field + a refresh-arrow SVG stroked `--ink-secondary` (NO red), `aria-hidden`; headline upsized to 19px/700 `--ink-primary`; the locked subline added. Retry wiring unchanged.
4. **Empty:** already spec-compliant; only cosmetic glyph polish. Locked copy untouched.
5. **Edit-discoverability (deferred from 2.2):** ship the **hover/`:focus-visible` `--accent-soft` tint** on the editable text (`.todo-editable`, in-spec, mirrors `.todo-delete`) — a strong desktop cue. **DECISION FLAGGED FOR THE HUMAN:** a *persistent* touch cue (a quiet ✎ icon symmetric with the ✕, or a dotted underline) would deviate from the locked row anatomy (DESIGN has no edit icon), so it is NOT added unattended — the tint ships now; the persistent-touch-cue (option b) is left for UX sign-off at the PR gate. This resolves desktop discoverability and surfaces the row-anatomy decision to the human.
6. **Contrast is 3.5's job:** do NOT touch `--ink-secondary`/`--ink-muted` values; the loading caption stays `--ink-secondary` (not the mockup's `--ink-muted`, to avoid worsening the deferred contrast).

## Verification

**Commands:**
- `cd web && npm run test:unit && npm run lint && npm run format:check && npx tsc --noEmit` -- all green (my files; 2 pre-existing E2E tsc errors on main are unrelated).
- `cd web && npm run test:e2e:p0` -- the a11y scan (incl. the new loading state) + existing specs green.

**Manual checks:**
- `docker compose up`, throttle/slow the api → the skeleton shimmer shows (4 rows) then resolves to content; empty DB → the polished empty state; stop the api → the warm error (no red) + subline + `Try again` that recovers; enable reduced-motion → the shimmer is static; hover/focus an editable title → the accent-soft tint appears.

## Review Triage Log

### 2026-07-19 — Expert review pass (Pixel [web]; web-only story, no Gopher)
- intent_gap: 0
- bad_spec: 0
- patch: 2 (medium 1, low 1)
- defer: 0
- reject: 1 (low 1)
- addressed_findings:
  - `[medium]` `[patch]` P1 — `.todo-editable:focus-visible` set `outline:none` + an accent-soft wash only (~1.4:1), removing the focus ring on the story's core interaction. axe can't test WCAG 2.4.11, so every automated gate stayed green. Added a real ring (`outline: 2px solid var(--accent); outline-offset: 2px`).
  - `[low]` `[patch]` P3 — the a11y-004 loading scan released the held route only in `finally` without awaiting resolve → a benign `route.fulfill`-vs-teardown race that could log noise in the docker lane. Now releases inside the try and awaits the resolved empty state.
- rejected: P2 (hover tint bleeds a faint seam into the clamped-description fade) — cosmetic, desktop-hover-only, on collapsed overflowing descriptions; the description tint's discoverability value outweighs the rare seam.
- Pixel confirmed the **E2E/a11y lane is clean and correctly built** (the 3.1 lesson applied: `getByText('Getting your tasks…')` dodges the `#__next-route-announcer__` strict-mode trap; network-first; `resetTodos` uses the request fixture). SkeletonList/error/empty/shimmer/reduced-motion/tokens/locked-copy all verified clean; TodoRow keyboard-open behavior preserved.

## Auto Run Result

Status: done

**Summary:** Story 3.2 (polished loading/empty/error states) — web-only visual polish. New `SkeletonList` (4 token-derived shimmer rows + `Getting your tasks…`, reduced-motion guard); warm de-escalated error (neutral `aria-hidden` glyph, no red, locked subline, accent Try-again/refetch); light empty-state glyph polish; and the deferred Story-2.2 edit-discoverability resolved with a `.todo-editable` hover/focus tint (persistent ✎ icon deliberately withheld — flagged for UX). Added a loading-state axe scan. Pixel review → 2 patches (a focus-ring a11y regression axe couldn't catch; an E2E teardown-race hardening), 1 reject.

**Files changed:** web — `components/SkeletonList.tsx` (new), `page.tsx` (skeleton + warm error), `components/EmptyState.tsx` (glyph polish), `components/TodoRow.tsx` (`.todo-editable`), `globals.css` (shimmer + reduced-motion + `.todo-editable` + focus ring), tests `skeleton-list.test.tsx` (new), `page-error-state.test.tsx` (new), `todo-row.test.tsx`, `e2e/a11y.spec.ts` (loading scan).

**Review findings:** 2 patches (1 medium, 1 low), 0 deferred, 1 rejected, 0 intent-gaps, 0 bad-spec loopbacks.

**Verification:** web `npm run test:unit` → 85 passed; eslint + prettier clean; tsc clean (no new errors; the pre-existing E2E tsc errors are from parallel a11y/coverage work). The a11y/E2E lane (incl. the new loading scan) runs at CI — the dockerized lane is the real gate for the skeleton/error UI (per the 3.1 lesson).

**Residual risks:** (1) the visual polish (shimmer, warm error, focus ring, reduced-motion) is best confirmed by the CI a11y/E2E lane + a browser pass — hence `followup_review_recommended: true`; the skeleton/loading behaviour only runs in the dockerized lane, not local Vitest. (2) Touch-device edit discoverability remains unsolved by design — the persistent ✎ icon (option b) is flagged for UX sign-off at the PR gate (adding it deviates from the locked row anatomy). (3) Contrast tokens (`--ink-secondary`/`--ink-muted`) untouched — Story 3.5's job.
