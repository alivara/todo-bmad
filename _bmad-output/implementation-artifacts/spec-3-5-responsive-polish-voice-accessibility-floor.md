---
title: 'Responsive polish, voice & accessibility floor'
type: 'feature'
created: '2026-07-19'
status: 'ready-for-dev'
baseline_revision: '7985b69'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/deferred-work.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** Epic 3's final story hardens the v1 floor. Known-tracked debt is due: a serious WCAG contrast failure (suppressed in the a11y gate), inline edit has no discoverability cue on touch, there are no security headers, and several controls lack a visible focus ring. The core loop must also be verified responsive (375px→desktop) and on-voice.

**Approach:** Web-only. (1) **Fix the contrast palette in BOTH themes** with the computed token values and **flip `color-contrast` to a hard axe gate**. (2) Add a **pure-CSS edit ✎ cue** (hover/focus reveal + persistent touch cue). (3) Add **CSP + security headers** (allowing the inline theme script) with an E2E header assertion. (4) Add a **React-escaping regression test**. (5) Add **visible accent focus rings to every control** that lacks one. (6) Verify **responsive** (add an explicit `viewport`), (7) confirm **voice** (audit found zero drift — assert, don't rewrite), and (8) **document** the still-deferred a11y items as future hardening.

## Boundaries & Constraints

**Always:**
- **Contrast tokens (exact, computed — WCAG AA):** in light `:root` (`web/app/globals.css`): `--ink-secondary` `#8a8072`→**`#6b6252`** (5.87:1 raised / 5.26:1 base) and `--accent` `#c15a34`→**`#b0512f`** (as text 5.05:1 raised / 4.52:1 base; `--on-accent` on it 4.95:1). Add new `--accent-strong: #8f3d21` (light) + `--accent-strong-dark: #e59873` (dark twin), and remap `--accent-strong: var(--accent-strong-dark)` in the `:root[data-theme='dark']` seam. The dark `--ink-secondary-dark`/`--accent-dark` already pass — **do not change them**.
- **Completed-row text** (`TodoRow` `completedTextStyle`): reroute `var(--ink-muted)`→**`var(--ink-secondary)`** — the single change that clears completed text in BOTH themes (light 5.26:1, dark 6.11:1). The "quieter" signal stays carried by the line-through + receded card. To keep the axe ratio honest, the completed card's recede must **not** dim the text node via `opacity` — apply any recede as explicit color/border, keeping the struck text at full opacity so axe reads the true AA ratio.
- **Add button** (`AddInput` `buttonStyle`): keep the locked soft-fill design (`--accent-soft` bg) — change only the label `color: var(--accent)`→**`var(--accent-strong)`** (4.73:1 light / 4.89:1 dark). Do NOT convert it to a solid button (DESIGN reserves solid-accent for the error "Try again").
- **Gate flip** (`web/tests/e2e/a11y.spec.ts`): the helper asserts the FULL `violations` array (no `color-contrast` exclusion). All five scanned states — populated, empty, edit-editor, loading-skeleton, populated-dark — must be contrast-clean.
- **Edit ✎ cue:** a **CSS `::after` pseudo-element** pencil on `.todo-editable` (invisible to the a11y tree — never a new focusable control). Reveal on `:hover`/`:focus-visible` under `@media (hover: hover)` (opacity 0→~0.6); persistent faint (opacity ~0.4) under `@media (hover: none)` (touch). Must not disturb click-to-edit, Enter/Space activation, the existing `:focus-visible` outline, or the description's line-clamp (if it clips, anchor via `position:relative` on the `<p>` + absolutely-positioned `::after`).
- **CSP** (`web/next.config.mjs` `async headers()`, `source: '/:path*'`): `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. `script-src` **must** include `'unsafe-inline'` — the 3.4 inline `THEME_INIT` script and Next's inline runtime depend on it (a nonce is impractical for a streamed `dangerouslySetInnerHTML` script; document the tradeoff). Plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`.
- **Focus rings:** add a shared `.focus-ring` utility (`outline:none` at rest; `:focus-visible { outline:2px solid var(--accent); outline-offset:2px }`) and apply it (via `className` alongside the existing inline `style`) to every currently-ringless control: the Add button, both retry "Try again" buttons (`AddInput`, `TodoRow`), the reveal more/less button, the Undo button, the checkbox control, and the page/error retry buttons. The **add-input**: keep its resting accent border, but move the always-on `boxShadow` glow to a `:focus-visible` rule (resolves the blurred-still-looks-focused defect) — remove the inline `outline:'none'` + permanent `boxShadow`.
- **Voice:** the audit found the locked microcopy is used verbatim with zero drift — **assert via a light test/spot-check, do not rewrite copy.**

**Block If:**
- A proposed token value, once applied, does not clear AA on a surface it actually renders on — re-derive rather than ship a still-failing token.

**Never:** No cold/grey palette drift (keep terracotta/warm-charcoal). No converting the Add button to solid. No new focusable control for the edit cue (it's a decorative `::after`). No `script-src` without `'unsafe-inline'` (breaks the theme script). No rewriting on-voice copy. No changing the dark `--ink-secondary-dark`/`--accent-dark` (they pass). No new drag/swipe/long-press gesture.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Notes |
|----------|--------------|----------|-------|
| body copy contrast | relative time / description / empty / edit-hint / reveal-more in light | ≥4.5:1 | `--ink-secondary` #6b6252 |
| completed row | a completed todo (both themes) | text ≥4.5:1, still reads receded | reroute to `--ink-secondary`; no text opacity |
| Add button | rendered (both themes) | label ≥4.5:1 on soft bg | `--accent-strong` |
| axe gate | all 5 states, light+dark | ZERO violations incl. color-contrast | hard gate |
| edit cue (pointer) | hover/focus an editable | faint ✎ appears | `::after`, no a11y node |
| edit cue (touch) | `@media (hover:none)` | ✎ persistently faint | discoverable without hover |
| CSP + theme script | load `/` | theme script runs (no flash), CSP header present | `script-src 'unsafe-inline'` |
| security headers | GET `/` and `/api/*` | CSP + nosniff + frame + referrer present | E2E assertion |
| stored XSS | todo title `<img src=x onerror=alert(1)>` | renders as escaped text, no `<img>` | RTL test |
| focus ring | Tab to any control | visible 2px accent ring | `.focus-ring` |
| responsive | 375px→desktop | centered ≤560 column, no h-scroll, no reflow | already largely safe |
| keyboard | Enter add/save, Esc cancel, add-input stays focused | all work | Esc already implemented |

## Code Map

- `web/app/globals.css` -- token edits (`--ink-secondary`, `--accent`, new `--accent-strong` + `-dark` + seam remap); `.todo-editable::after` pencil (hover/focus + touch); `.focus-ring` utility; add the remaining short transitions to the existing `@media (prefers-reduced-motion: reduce)` block (complete the guard).
- `web/app/components/TodoRow.tsx` -- `completedTextStyle` color → `--ink-secondary`; ensure the completed card recede doesn't apply `opacity` to the text node; add `.focus-ring` className to the reveal more/less button and the row retry button; confirm the checkbox control carries `.focus-ring`.
- `web/app/components/AddInput.tsx` -- button label color → `var(--accent-strong)`; add `.focus-ring` to the Add button + the retry button; move the input's glow to `:focus-visible` (className `add-input`, drop inline `outline:'none'`+permanent `boxShadow`).
- `web/app/components/UndoToast.tsx` -- `.focus-ring` on the Undo button.
- `web/app/page.tsx` -- `.focus-ring` on the page-level retry button.
- `web/app/error.tsx`, `web/app/global-error.tsx` -- `.focus-ring` on their retry buttons.
- `web/app/layout.tsx` -- add `export const viewport = { width: 'device-width', initialScale: 1, themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f5efe6' }, { media: '(prefers-color-scheme: dark)', color: '#221e1a' }] }`.
- `web/next.config.mjs` -- `async headers()` with the CSP + security headers above.

**Tests:**
- `web/tests/e2e/a11y.spec.ts` -- flip the helper to assert the full `violations` array; drop the exclusion docstring. (All 5 states already scanned.)
- `web/tests/e2e/security-headers.spec.ts` -- **new**: GET `/` and an `/api/*` route; assert CSP contains its directives + `x-content-type-options: nosniff` + `x-frame-options: DENY` + `referrer-policy`.
- `web/tests/stored-xss.test.tsx` (or add to `todo-row.test.tsx`) -- **new**: render a row whose title/description is `<img src=x onerror=alert(1)>`; assert it renders as escaped text (`getAllByText(payload)` present) and `container.querySelector('img')` is null. Reuse the `renderRow` (QueryClientProvider→PendingDeleteProvider) idiom.
- `web/tests/tokens.test.ts` -- add `--accent-strong` (+ `-dark` twin + seam remap) to the presence assertions.
- `web/tests/focus-ring.test.tsx` (optional) -- assert a sampled control (e.g. Add button) carries the `focus-ring` class, guarding the wiring.

## Tasks & Acceptance

**Execution (ordered):**
- [ ] `globals.css` -- apply the 4 token changes (+ new `--accent-strong` light/dark + seam remap).
- [ ] `TodoRow.tsx` -- completed text → `--ink-secondary`; de-opacity the text node; `.focus-ring` on reveal + retry; checkbox `.focus-ring`.
- [ ] `AddInput.tsx` -- button label `--accent-strong`; `.focus-ring` on button + retry; input glow → `:focus-visible`.
- [ ] `globals.css` -- `.focus-ring` utility; `.todo-editable::after` pencil (hover/focus + touch); complete the reduced-motion guard.
- [ ] `UndoToast.tsx`, `page.tsx`, `error.tsx`, `global-error.tsx` -- `.focus-ring` on their buttons.
- [ ] `layout.tsx` -- `viewport` export (device-width + themeColor).
- [ ] `next.config.mjs` -- CSP + security headers.
- [ ] tests -- flip the a11y gate; new security-headers e2e; new stored-XSS unit; extend tokens; (optional) focus-ring unit.
- [ ] `deferred-work.md` -- add a "Story 3.5 shipped / still-deferred" section (below).

**Acceptance Criteria:**
- Given widths ~375px→desktop, when I use the app, then the single centered ≤560px column is fully functional with no reflow and no horizontal scroll.
- Given the keyboard, when I use the core loop, then Enter submits an add and saves an edit, Esc cancels/reverts, the add-input stays focused, every control shows a visible accent focus ring, and controls are semantic — and no drag/swipe/long-press exists.
- Given all user-facing text, when it renders, then the locked microcopy is verbatim and the voice stays warm/restrained (no alarm-red/jargon/status-codes/streaks/badges).
- Given the a11y floor, when v1 ships, then WCAG AA contrast passes in both themes as a hard axe gate, and the remaining deferred a11y items are documented as future hardening (flagged, not pretended done).
- Given security, when a page/API response is served, then CSP + nosniff + frame + referrer headers are present and the inline theme script still runs (no flash); and stored todo text with an HTML payload renders escaped (regression-locked).

## Design Notes

1. **Contrast math is pre-computed** (WCAG relative luminance). Completed-text reroute fixes both themes with one change; the Add button keeps its soft fill via a dedicated `--accent-strong` rather than a wide `--accent` shift beyond the modest #b0512f darken. Every proposed value was verified ≥ its threshold on each surface it renders on.
2. **Residual (documented, NOT gated):** after the reroute, `--ink-muted` remains only as the active checkbox ring (≈2.14:1 light / 2.59:1 dark) — a WCAG 1.4.11 non-text ratio that axe's `color-contrast` does not test. Record it in deferred-work as a residual; do not expand scope to a new ring token unless trivial.
3. **CSP tradeoff:** `'unsafe-inline'` on `script-src` is the pragmatic choice given the 3.4 inline theme script + Next's inline runtime; a nonce-based tightening is future hardening — document it.
4. **Esc-cancel and voice are already correct** (investigation-verified): Esc reverts in both title and description editors; all locked strings match. These ACs are satisfied by assertion, not new code.
5. **Deferred-doc content** (still future hardening after 3.5): full SR label/role/state coverage; `aria-live` for completion/pending-delete/undo; complete keyboard traversal + guaranteed focus-order; residual 1.4.11 non-text ratios (checkbox ring); `prefers-reduced-motion` is now *mostly* honored (check-pop + shimmer cut, plus the short state transitions once this story wraps them) — note any remainder accurately; nonce-based CSP.

## Verification

**Commands:**
- `cd web && npm run test:unit && npm run lint && npm run format:check && npx tsc --noEmit` -- green (stored-XSS + tokens + optional focus-ring units; the escaping test runs in the `web` CI lane).
- `cd web && npm run test:e2e` (CI `integration-e2e` lane) -- the flipped a11y gate (all 5 states contrast-clean, both themes) + the new security-headers spec pass.

**Manual checks:**
- `docker compose up`: body copy + completed rows + the Add label read clearly in BOTH themes (warm, not grey); Tab through every control → a visible accent ring on each; hover/focus an editable → a faint ✎; on a touch viewport the ✎ is persistently faint; resize 375px→desktop → no horizontal scroll; view-source/devtools → CSP + security headers on `/` and `/api/*`, and the theme still applies with no flash.
