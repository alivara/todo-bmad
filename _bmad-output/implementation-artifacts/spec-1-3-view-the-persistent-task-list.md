---
title: 'View the persistent task list'
type: 'feature'
created: '2026-07-19'
status: 'done'
baseline_revision: 'cdb74ec8b8130841780e9ab93a2b6a6472830579'
final_revision: '38c1df0b4f0d871de97e1e13ccae89f3e91e3f25'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** The list renders a minimal title-only `<li>` per todo (the 1.1/1.2 safety net). Users need the full, trustworthy list on open: newest-first, each row showing description, status, and a relative creation time, with proper loading/error/empty affordances.

**Approach:** Web-only. Replace the minimal `<li>` in `page.tsx` with a real **read-only** `TodoRow` (title + 2-line-clamped description with a "more"/"less" in-place reveal + status-reflecting treatment + RD-1 relative time), add a pure RD-1 relative-time formatter, and keep the existing loading/error/empty branches — all reading from the existing TanStack `useQuery` cache. The api already returns newest-first and persists, so no backend change.

## Boundaries & Constraints

**Always:**
- Read todos from the TanStack `useQuery` cache only (AD-4); render `data` in **received order**, never re-sort (server = `created_at DESC, id DESC`, `id DESC` tiebreak for same-second rows).
- Relative time is a **pure function of `metadata.createdAt`**, computed client-side; the client never generates timestamps (AD-7).
- RD-1 bucket formats are binding: `<60s`→`just now`; `<60m`→`Nm ago`; `<24h`→`Nh ago`; `<7d`→`Nd ago`; `≥7d`→absolute date (`MMM D`, add `, YYYY` if a different calendar year).
- Semantic HTML + role/label locators; keep the `<ul>`/`<li>` so `getByRole('listitem')` still works.
- Consume CSS token vars for all styling — no hardcoded hexes. Handle `description === ""` (never null): render no description line.
- Tests: Vitest for the pure formatter with an **injected `now`** (no real clock); Playwright network-first, no hard waits, `installClock()` for any relative-time E2E assertion.

**Block If:**
- The api's ordering / `[]`-not-null / persistence contract turns out **not** satisfied by the existing `GET /todos` and would require an api or migration change (this spec is web-only — an api change is out of band).
- A required 1.3 row behavior can only be met by pulling in Epic-2 interaction (toggle/PATCH/DELETE) or Epic-3 polish (theme, char counter, shimmer skeleton) — i.e. the read-only interpretation proves insufficient.

**Never:** No edit / toggle / delete, no `PATCH`/`DELETE`, **no interactive checkbox** (Epic 2). No char counter, theme toggle, polished shimmer skeleton, warm error illustration, or 4xx/5xx error split (Epic 3). No api/schema/migration change. No client re-sort. No new top-level directories.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| just-now | `now - createdAt = 30s` | `"just now"` | n/a |
| minutes | `= 5m` | `"5m ago"` | n/a |
| hours | `= 2h` | `"2h ago"` | n/a |
| days | `= 3d` | `"3d ago"` | n/a |
| date (same yr) | `= 8d`, same year | `"Jul 10"` (MMM D) | n/a |
| date (other yr) | `= 400d` | `"Jul 10, 2025"` | n/a |
| boundary 59/60s | `59s` / `60s` | `"just now"` / `"1m ago"` | n/a |
| boundary min/hr | `59m` / `60m` | `"59m ago"` / `"1h ago"` | n/a |
| boundary hr/day | `23h` / `24h` | `"23h ago"` / `"1d ago"` | n/a |
| boundary day/date | `6d` / `7d` | `"6d ago"` / date | n/a |
| no description | `description === ""` | no description line rendered | n/a |
| long description | `> 2 lines` | clamped to 2 lines + soft fade + inline `more`; click `more` → full text expands **in place** (not edit); `less` collapses | n/a |
| ordering | server list `[c,b,a]` | rendered `c,b,a` verbatim; no re-sort | n/a |
| status render | `status: 'active'` / `'completed'` | active = normal row; completed = recessed/strikethrough (read-only), no checkbox interaction | n/a |

</intent-contract>

## Code Map

- `web/app/page.tsx` -- replace the minimal `<li>{title}</li>` list branch with `<TodoRow todo={t} />`; keep the existing `isPending`/`isError`+retry/empty branches unchanged.
- `web/app/components/TodoRow.tsx` -- **new** read-only row: title, clamped description + more/less reveal, status-reflecting treatment, relative time.
- `web/lib/relativeTime.ts` -- **new** pure RD-1 formatter `formatRelativeTime(createdAt: string, now?: Date): string`.
- `web/lib/todos.ts` -- reuse `fetchTodos`, `todosQueryKey` (already error-safe: throws before `res.json()`); no change expected.
- `shared/todo.ts` -- reuse the `Todo` type; do not redeclare.
- `web/app/globals.css` -- consume `--surface-raised`, `--border-hairline`, `--radius-md`, `--shadow-row`, `--ink-primary/secondary/muted`, `--accent`, `--space-*`.
- `web/tests/relative-time.test.ts` -- **new** Vitest unit for every I/O-matrix time bucket + boundaries (injected `now`).
- `web/tests/todo-row.test.tsx` -- **new** Vitest: title/description/time render, `""`-description omitted, clamp more→expand-in-place→less, completed styling.
- `web/tests/e2e/list.spec.ts` -- **new (or extend `create.spec.ts`)** Playwright: `1.4-E2E-003` newest-first ordering + `1.4-E2E-004` persistence-across-reload + row shows description & relative time.

## Tasks & Acceptance

**Execution:**
- [x] `web/lib/relativeTime.ts` -- pure RD-1 formatter, `now` injected, UTC-deterministic, year-boundary handled.
- [x] `web/app/components/TodoRow.tsx` -- read-only row (title/description-clamp+more/less/relative-time/completed-styling), tokens only, NO checkbox.
- [x] `web/app/page.tsx` -- minimal `<li>` swapped for `<TodoRow>`; `<ul>`/`<li role=listitem>` + loading/error/empty branches preserved.
- [x] `web/tests/relative-time.test.ts` -- all buckets + boundaries, injected `now`.
- [x] `web/tests/todo-row.test.tsx` -- render, `""` omission, clamp/more/less, completed styling, no-checkbox.
- [x] `web/tests/e2e/list.spec.ts` -- `@p0` server-order fidelity + row anatomy + more/less reveal (ordering/persistence already in `create.spec.ts`, referenced). Written; E2E not executed on host (needs docker test stack — verified at CI/PR gate).

**Acceptance Criteria:**
- Given existing todos, when I open the app, then the full list loads automatically (no action), in server order (newest-first), and the client never re-sorts.
- Given a todo row, when it renders, then it shows the title, the optional description (clamped ~2 lines with fade + `more`), the status treatment, and an RD-1 relative time.
- Given a clamped description, when I click `more`, then the full text expands in place (not edit mode) and `less` collapses it.
- Given the list is fetching, then a basic `role="status"` loading indicator shows; given the fetch fails, then a non-disruptive error with a `Try again` that re-issues the request shows.
- Given I add tasks then refresh/reopen/restart, when the app loads, then all todos persist and reappear in the same order with no loss.

## Design Notes

Five under-specifications were resolved conservatively from the binding docs (flagged here for human ratification at PR review):

1. **Status display (AC "shows the status") with no non-Epic-2 affordance.** DESIGN conveys status only via the Epic-2 interactive checkbox + completed styling. Resolution: **do not render a checkbox** (a dead, non-interactive affordance would mislead). Reflect status through read-only row treatment — `active` renders normally, `completed` renders recessed + strikethrough. All todos are `active` today, so this is forward-compatible; Epic 2 adds the toggle interaction.
2. **Relative-time format:** RD-1 (`resolved-decisions.md`, binding) wins over the AC's illustrative "2 hours ago" → compact `Nm/Nh/Nd ago`. `≥7d` uses `MMM D`, adding `, YYYY` across a year boundary (RD-1 gives only the same-year example; this is the minimal sensible extension).
3. **Clamp collapse:** `more` (accent, from DESIGN) expands in place; a companion `less` collapses. No locked "less" microcopy exists; `less` is the minimal natural label.
4. **Loading:** keep the existing basic `Getting your tasks…` indicator; the shimmer skeleton is deferred to Story 3.2 (epics AC + existing code comment).
5. **Error/empty:** keep the existing basic error + `Try again` and `EmptyState`; the warm illustration + 4xx/5xx split are Epic 3.

Golden formatter shape (illustrative, not prescriptive):
```ts
export function formatRelativeTime(createdAt: string, now: Date = new Date()): string {
  const s = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  // else absolute "MMM D" (+ ", YYYY" if a different year)
}
```

## Verification

**Commands:**
- `cd web && npm run test:unit` -- expected: all green incl. new relative-time + todo-row specs.
- `cd web && npm run lint && npm run format:check` -- expected: clean (eslint + prettier).
- `cd web && npx tsc --noEmit` (or `next build`) -- expected: no type errors (reuses `@shared/todo`).
- `cd web && npm run test:e2e:p0` -- expected: `1.4-E2E-003`/`004` + row anatomy green (against the test-compose stack).

**Manual checks:**
- `docker compose up` → open app: list loads newest-first without action; a row with a long description clamps to 2 lines with a `more` that expands in place; relative time reads e.g. `2h ago`; reload → same rows in same order (persistence).

## Review Triage Log

### 2026-07-19 — Review pass (Blind Hunter + Edge Case Hunter)
- intent_gap: 0
- bad_spec: 0
- patch: 7 (medium 2, low 5)
- defer: 0
- reject: 1 (low 1)
- addressed_findings:
  - `[medium]` `[patch]` F1 — clamp `more`/`less` was gated on a raw 100-code-point heuristic that misjudges real 2-line overflow. Reworked to a measured overflow check (`scrollHeight > clientHeight` while clamped, via a ref + effect), always applying the clamp when collapsed; the length heuristic remains only as the SSR/jsdom seed. Fixes both tall-but-short (no clamp) and long-but-fits (pointless `more`).
  - `[medium]` `[patch]` F3 — long unbroken title (pasted URL / 200 unbroken code points) had no `overflowWrap`, breaking mobile-first ~375px layout. Added `overflowWrap: 'anywhere'` to the title.
  - `[low]` `[patch]` F2 — invalid/empty `createdAt` fell through every bucket to `"undefined NaN, NaN"`. Added a `Number.isNaN` guard returning `''`.
  - `[low]` `[patch]` F4 — the soft-fade overlay sat over the reveal button, not the clamped line. Scoped it to an inner box wrapping only the paragraph.
  - `[low]` `[patch]` F5 — reveal button exposed no disclosure state. Added `aria-expanded` (full SR labeling stays UX-DR28/Epic 3).
  - `[low]` `[patch]` F6 — future/clock-skewed stamp produced a negative delta. Clamped `seconds` to `max(0, …)` → intentional "just now".
  - `[low]` `[patch]` F7 — tests missed the invalid/future formatter paths + disclosure state. Added unit cases (`''`/garbage → `''`, future → "just now") and `aria-expanded` assertions.
- rejected: F8 (relative time not live-ticking) — spec does not require live ticking; `staleTime`/refetch updates it acceptably.

### 2026-07-19 — Follow-up expert review (Gopher [Go] + Pixel [frontend])
- intent_gap: 0
- bad_spec: 0
- patch: 2 (low 2)
- defer: 2 (medium 1, low 1)
- reject: 4 (nit/non-defect 4)
- addressed_findings:
  - `[low]` `[patch]` L2 — replaced the per-row `window.resize` listener with a `ResizeObserver` on the description element (no forced-reflow thrash across N rows), guarded for jsdom.
  - `[low]` `[patch]` L3 — added `1.3-E2E-004`: a 180-char unbroken title at 375px must wrap and not force horizontal scroll (closes the F3 title-overflow coverage gap).
- deferred (→ deferred-work.md): M1 (medium — body-copy contrast `--ink-secondary` ~3.8:1 vs AA 4.5:1; a design-token decision, not auto-patched), L1 (low — completed-row `--ink-muted` ~1.9:1, dormant until Epic 2).
- rejected: aria-controls (within UX-DR27 floor, full SR is UX-DR28/Epic 3); fade coupling (correct + theme-safe); `<p>`-count test brittleness (works); Gopher's random-UUID tiebreak note (matches AC as written).
- Gopher backend verification: all 5 backend ACs VERIFIED against real code (`GET /todos` `ORDER BY created_at DESC, id DESC` + covering index; `[]`-not-null double-guarded; AD-6 wire shape incl. RFC3339-`Z` second precision + `""`-not-`null`; durable named volume AD-12; AD-9 error envelope) — Story 1.3 genuinely needs **zero** backend change.
- Pixel: confirmed the 7 pass-1 patches are regression-free.

## Auto Run Result

Status: done

**Summary:** Implemented Story 1.3 (view the persistent task list) web-only: a read-only `TodoRow` (title, 2-line-clamped description with in-place `more`/`less`, status-reflecting treatment, RD-1 relative time) replacing the minimal `<li>`, plus a pure RD-1 relative-time formatter. Reads the TanStack `useQuery` cache in server order (no re-sort). Backend unchanged — existing `GET /todos` already satisfies ordering/persistence. Then a two-layer adversarial review drove 7 patches (measured-overflow clamp, title wrap, formatter robustness, fade position, `aria-expanded`).

**Files changed:**
- `web/lib/relativeTime.ts` (new) — pure RD-1 formatter; NaN/future guards.
- `web/app/components/TodoRow.tsx` (new) — read-only row; measured-overflow clamp reveal; token-only styling; no checkbox.
- `web/app/page.tsx` — minimal `<li>` swapped for `<TodoRow>`; loading/error/empty branches preserved.
- `web/tests/relative-time.test.ts` (new) — all RD-1 buckets/boundaries + robustness cases.
- `web/tests/todo-row.test.tsx` (new) — row render, `""`-omission, clamp/more/less + `aria-expanded`, completed styling, no-checkbox.
- `web/tests/e2e/list.spec.ts` (new) — `@p0` server-order fidelity + row anatomy + reveal.

**Review findings (2 passes):** Pass 1 (Blind Hunter + Edge Case Hunter) → 7 patches, 1 reject. Pass 2 (experts: Gopher [Go] + Pixel [frontend]) → 2 patches (ResizeObserver, 375px title-wrap E2E), 2 deferred (body-copy contrast — a design-token decision; completed-row contrast — dormant until Epic 2), 4 rejects; Gopher verified all 5 backend ACs → zero api change needed; Pixel confirmed pass-1 patches regression-free. Totals: 9 patches, 2 deferred, 5 rejected, 0 intent-gaps, 0 bad-spec loopbacks.

**Verification:** `npm run test:unit` → 30 passed; `npm run lint` clean; `npm run format:check` clean; `npx tsc --noEmit` clean. Playwright E2E NOT executed on host (needs the docker test stack — same limitation as the api suite); specs are written to the network-first / role-locator / `seedTodos`+`resetTodos` idiom and run at CI / PR gate.

**Residual risks:** (1) The measured-overflow clamp path (`scrollHeight`/`clientHeight`) only executes in a real browser — jsdom uses the heuristic seed — so the clamp/reveal fidelity is unverified by unit tests and must be confirmed by E2E/browser (hence `followup_review_recommended: true`). (2) Design-note resolutions (read-only status treatment instead of an Epic-2 checkbox; `less` collapse label) are conservative calls awaiting human ratification at the PR gate.
