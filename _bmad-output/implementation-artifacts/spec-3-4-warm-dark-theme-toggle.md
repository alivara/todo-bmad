---
title: 'Warm-dark theme toggle'
type: 'feature'
created: '2026-07-19'
status: 'review'
baseline_revision: '4c51a1d'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** The warm-dark token palette exists but is inert — there's no way to switch to it, and no header affordance. Users want a real warm-dark mode for low light, remembered across sessions.

**Approach:** Web-only. Add a header **theme toggle** (sun/moon) that stamps `data-theme="light"|"dark"` on `<html>` (activating the already-defined `-dark` tokens — never a cold blue-black), persist the choice to `localStorage`, and honor the OS `prefers-color-scheme` on first load (RD-6). Prevent a flash-of-wrong-theme with a tiny blocking inline script before paint. Also add the header's **non-functional placeholder avatar** (a forward gesture — no login). Extract the existing inline header into a `Header` component.

## Boundaries & Constraints

**Always:**
- The toggle stamps `document.documentElement.dataset.theme = 'light' | 'dark'`, swapping the Epic-1 CSS-variable tokens via the existing `:root[data-theme='dark']` seam — the warm-charcoal `-dark` set (never a cold blue-black; those tokens already encode the warmth). Light and dark are **explicit** `data-theme` values.
- The choice **persists** to `localStorage['todo-theme']` on toggle. **RD-6 first load:** if `localStorage['todo-theme']` is `'light'`/`'dark'` use it; else `matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'`. A stored choice overrides the OS.
- **No flash:** a small blocking inline `<script>` (wrapped in try/catch) runs before paint — as the first child of `<body>` in `layout.tsx` — reading storage→OS and stamping `data-theme`. `<html>` carries `suppressHydrationWarning` (the script mutates the attribute before hydration).
- The toggle is a **real `<button>`** (icon-only, static `aria-label="Toggle theme"`); its sun/moon icons are **CSS-toggled by `data-theme`** (both SVGs rendered, visibility via CSS) so there is **no React theme state and no hydration mismatch** — `onClick` flips the DOM attribute + writes storage. Toggle chrome: ghost 36px, `--radius-sm`, `--ink-secondary` at rest, hover/`:focus-visible` → `--accent-soft` bg + `--accent` (mirror `.todo-delete`, `@media (hover:hover)` for the hover half).
- The **placeholder avatar** is a non-interactive, `aria-hidden`, ~32px `--radius-full` circle (`--accent-soft` field + `--accent` person glyph) — **not a button, not focusable, nothing on tap** (DESIGN: forward gesture only). All colors from existing tokens.

**Block If:**
- Activating dark requires changing a token value to look right — it must not; the `-dark` tokens already exist and are the design's warm-charcoal set. (Contrast tuning of any token is Story 3.5, not here.)

**Never:** No cold blue-black dark (use the existing warm `-dark` tokens). No wiring the avatar to anything (no login/accounts). No changing `--ink-secondary`/`--ink-muted` values or any token value (3.5 owns contrast for both themes). No theme React-context/provider (the DOM attribute is the source of truth; nothing else needs the JS value). No `color-contrast` gate change (stays excluded for both themes — 3.5).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| toggle to dark | click toggle in light | `<html data-theme="dark">`, warm-dark tokens active, moon icon shown; `localStorage['todo-theme']='dark'` | — |
| toggle to light | click in dark | `data-theme="light"`, sun icon; storage `'light'` | — |
| reload with stored | `localStorage='dark'` | first paint is dark (no flash) | — |
| first load, OS dark | no stored pref, OS dark | first paint dark (RD-6) | — |
| first load, OS light | no stored pref, OS light | first paint light (default) | — |
| stored overrides OS | stored `'light'`, OS dark | light (stored wins) | — |
| storage blocked | localStorage throws | script try/catch → falls back to OS/light; page never blanks | defensive |
| avatar tap | click the avatar | nothing happens (non-interactive) | — |
| a11y (both themes) | axe scan light + dark | zero non-contrast violations in both; toggle has an accessible name | — |

## Code Map

- `web/app/layout.tsx` -- add `suppressHydrationWarning` to `<html>`; inject the blocking `THEME_INIT` inline `<script dangerouslySetInnerHTML>` as the first child of `<body>` (storage→OS precedence, try/catch).
- `web/app/components/Header.tsx` -- **new** header: `<Wordmark />` left, a right-side group (`gap`) with `<ThemeToggle />` then the avatar. Replaces the inline `<header>` in page.tsx.
- `web/app/components/ThemeToggle.tsx` -- **new** `<button class="theme-toggle" aria-label="Toggle theme">` with both sun + moon SVGs (CSS-toggled by `data-theme`); `onClick` reads `document.documentElement.dataset.theme`, flips it, writes `localStorage['todo-theme']`.
- `web/app/page.tsx` -- replace the inline `<header><Wordmark/></header>` with `<Header />`.
- `web/app/globals.css` -- add `.theme-toggle` (ghost 36px, `--radius-sm`, `--ink-secondary`, hover/`:focus-visible` accent) + the sun/moon icon visibility rules (`.theme-toggle .icon-sun`/`.icon-moon` shown/hidden by `:root[data-theme='dark']`, default = sun) + `.avatar-placeholder` (circle, accent-soft/accent). No token-value changes.

**Tests:**
- `web/tests/theme-toggle.test.tsx` -- **new**: click flips `document.documentElement.dataset.theme` light↔dark and writes `localStorage['todo-theme']`; the button is a labeled control.
- `web/tests/header.test.tsx` -- **new**: renders the wordmark + toggle + a non-interactive avatar (only ONE `button` — the toggle; the avatar is not a button and does nothing on click).
- `web/tests/tokens.test.ts` -- extend: assert the `:root[data-theme='dark']` seam maps the tokens (regression guard that the seam stays wired).
- `web/tests/e2e/theme.spec.ts` -- **new** `@p0` (Playwright — the real FOUC/RD-6 home): (a) toggle → `<html data-theme>` flips + persists across reload; (b) `addInitScript` seeding `localStorage='dark'` → first paint dark, no light flash; (c) Playwright `colorScheme:'dark'` context with no stored pref → first paint dark (RD-6 OS default); (d) stored `'light'` + `colorScheme:'dark'` → light (stored wins).
- `web/tests/e2e/a11y.spec.ts` -- add a **dark-theme** axe scan (toggle to dark, scan the populated list) via the existing `assertNoNonContrast` (keep `color-contrast` excluded).

## Tasks & Acceptance

**Execution:**
- [ ] `web/app/layout.tsx` -- `suppressHydrationWarning` + the `THEME_INIT` blocking script (storage→OS, try/catch).
- [ ] `web/app/components/ThemeToggle.tsx` -- the sun/moon toggle (CSS-icons, DOM-attr flip + persist).
- [ ] `web/app/components/Header.tsx` -- wordmark + toggle + avatar; wire into `page.tsx`.
- [ ] `web/app/globals.css` -- `.theme-toggle` + icon-visibility rules + `.avatar-placeholder`. No token-value edits.
- [ ] tests -- theme-toggle + header units; tokens dark-seam guard; e2e theme (toggle/persist/first-load) + a dark-theme a11y scan.

**Acceptance Criteria:**
- Given the header, when I use the theme toggle (sun in light / moon in dark), then the app switches light ↔ warm-charcoal dark by swapping the Epic-1 tokens — never a cold blue-black.
- Given I set a theme, when I reload or return in a later session, then the preference persists (and first load with no stored pref honors the OS `prefers-color-scheme`).
- Given the header, when it renders, then the placeholder avatar is present but non-functional (nothing happens on tap).

## Design Notes

Resolutions (from the DESIGN spine + the standard Next App-Router theme pattern):

1. **CSS-driven icons, no React theme state (the key call):** the toggle renders BOTH sun + moon SVGs; CSS shows one based on `:root[data-theme='dark']` (default = sun). The button's `aria-label` is the static `"Toggle theme"`. This avoids any SSR/hydration mismatch (no theme-dependent React render), so no `mounted` flag is needed. `onClick` mutates `document.documentElement.dataset.theme` directly (the DOM attribute is the source of truth — the standard pattern) + writes storage.
2. **No-flash = blocking inline script** at the top of `<body>` + `<html suppressHydrationWarning>`. Try/catch so a storage exception can never blank the page (falls back to OS/light).
3. **Explicit `data-theme="light"/"dark"`** (bare `:root` already serves light, so no CSS change is needed for the light value) — required so a stored `'light'` overrides an OS-dark default (RD-6).
4. **Storage key `todo-theme`**; precedence storage→OS.
5. **Avatar** is decorative + `aria-hidden` + non-focusable (a `<div>`/`<span>`, not a button) — the safest reading of "non-functional, nothing on tap," keeping the a11y tree clean.
6. **Contrast stays 3.5's job for BOTH themes.** 3.4 adds a dark-theme axe scan reusing `assertNoNonContrast` (keeping `color-contrast` excluded) to guard that stamping dark adds no structural/name/role regression — the deferred contrast question (light and dark) is untouched. The toggle glyph's `--ink-secondary` legibility in both themes is a manual design check that feeds the 3.5 ledger.

## Verification

**Commands:**
- `cd web && npm run test:unit && npm run lint && npm run format:check && npx tsc --noEmit` -- all green (toggle/header units; jsdom exercises `document.documentElement`/`localStorage`; the inline script + `matchMedia` first-load are covered by the e2e).
- `cd web && npm run test:e2e:p0` -- theme toggle/persist/first-load + the dark-theme a11y scan green (the real FOUC/RD-6 gate).

**Manual checks:**
- `docker compose up`: click the sun/moon toggle → the whole app flips to warm-charcoal dark (warm, not blue-black) and back; reload → the choice sticks; clear storage + set OS to dark → first load is dark with no light flash; tap the avatar → nothing; tab to the toggle → a visible focus ring; check the dark theme reads warmly in both the list and the editor.

## Auto Run Result

Status: **review** (ready for human PR review).

- **Implemented:** header theme toggle (sun/moon) stamping `data-theme` on `<html>`, activating the existing warm-charcoal `-dark` token seam; `localStorage['todo-theme']` persistence; RD-6 first-load (stored → OS `prefers-color-scheme`); blocking inline init script + `suppressHydrationWarning` for no-flash; CSS-driven icon swap (no React theme state → no hydration mismatch); non-functional placeholder avatar; header extracted to `Header.tsx`.
- **Review (Pixel — web slice):** no HIGH. Verified correct: the hydration/no-flash seam, RD-6 precedence, the CSS icon-swap state matrix, token discipline (no value changed), all 3 ACs, and test quality (no strict-mode locator traps). Fixed: **M1** — declared `color-scheme: light|dark` per theme so UA chrome (scrollbars/canvas) tracks the palette (no cold light scrollbar / white flash on dark); **L3** — explicit sun display + de-duped icon rules. **L2** (static `aria-label`) left as-designed (the stateless design deliberately avoids a hydration mismatch).
- **Gates:** `test:unit` 108/108, `lint`, `format:check`, `tsc` (new files clean) all green. E2E theme + a11y-dark specs are type-correct; the dockerized E2E lane runs in CI.
