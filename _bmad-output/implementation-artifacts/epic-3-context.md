# Epic 3 Context: Trustworthy, Polished Experience

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 3 takes the working task loop from Epics 1–2 and makes it feel finished and trustworthy — the portfolio-grade layer on top of a system that already works. It upgrades Epic 1's *minimal* resilience floor (add-path rollback, a basic loading spinner, a bare empty state, basic fetch-error handling) into the *polished + systematized* layer: one uniform error contract with cross-mutation optimistic rollback applied identically to all four mutations, skeleton-shimmer loading, a warm de-escalated error state with retry, a polished empty state, progressive character-limit feedback, a real warm-dark theme toggle on top of the Epic 1 token system, responsive polish from ~375px up, and the v1 accessibility floor. No new services, data model, or wire-contract changes — this is `web`-side polish plus reuse of the already-defined AD-9 error contract and the `api`'s existing structured behavior.

## Stories

- Story 3.1: Unified error contract & systematized rollback
- Story 3.2: Polished loading, empty & error states
- Story 3.3: Progressive character-limit feedback
- Story 3.4: Warm-dark theme toggle
- Story 3.5: Responsive polish, voice & accessibility floor

## Requirements & Constraints

- Every mutating action (add/edit/toggle/delete) must roll back **visibly** on server rejection; a post-rollback refetch must equal server truth — no silent divergence. This is the epic's **P0 must-pass** (re-scored top risk R1 = 9).
- Client error handling splits by class: a `4xx` validation error → inline feedback, no retry (retrying a malformed request is futile); a `5xx` / network / timeout → error state + a retry path that re-issues the failed request. No raw exception ever reaches the user.
- Loading never shows a blank screen or a bare spinner; it resolves directly to content. Empty and error states are polished, calm, and non-disruptive.
- Character-limit feedback appears only as a cap is approached and escalates as it is exceeded — never present at rest; caps counted in Unicode code points, consistent with server-side validation (`title` 200 / `description` 2000).
- A real, functional warm-dark theme (never cold blue-black) that persists across sessions.
- Fully functional and visually polished from ~375px mobile width up: single centered column, same composition at every width, no reflow, no horizontal scroll.
- Server-side validation and sanitization remain authoritative (NFR10); client and server handle failures gracefully with no unhandled exceptions surfaced (NFR9).
- Respect the v1 accessibility floor; explicitly flag (not pretend done) the deferred hardening scope.

## Technical Decisions

**Uniform error contract (AD-9).** Every non-2xx response from `api` is `{ "error": { "code", "message" } }` with a **fixed code vocabulary**: `validation_error` (400), `not_found` (404), `internal_error` (500 — also emitted for `502`/`504`). The client **splits by class**: `4xx` validation → inline feedback, no Retry; `5xx`/network/timeout → the error state + Retry (FR22). This is the contract Epics 1–2 already depend on; Story 3.1 makes handling of it uniform and complete.

**Dumb-proxy error synthesis (AD-3).** The Next proxy is pure pass-through and forwards `api` responses verbatim (status + JSON body untouched). If `api` is unreachable or exceeds the proxy's request timeout, the proxy **synthesizes an AD-9-shaped `502`/`504`** — it never leaks an HTML error page or a thrown fetch to the browser. No business logic or validation lives in the proxy.

**Systematized cross-mutation rollback (AD-4 / R1, the P0).** TanStack Query is the sole owner of server state (todos live in the query cache only). Story 3.1 unifies the **four existing optimistic mutations** — create (`useCreateTodo`), toggle (`useToggleTodo`), edit (`useUpdateTodo`), and the client-side pending-delete controller — under **one reusable optimistic-mutation wrapper**: `onMutate` snapshots prior cache state and applies optimistically, `onError` restores the snapshot (visible rollback), and each settles against the server. Acceptance is threefold: (1) every mutating action rolls back visibly on rejection; (2) a post-rollback refetch equals server truth (no silent divergence, CM2); (3) it is implemented as *one* wrapper shared by all four paths, not four hand-rolled rollbacks. Epic 2 already leaned on this shared wrapper; Epic 3 hardens and proves it.

**React error boundary + structured logging (AD-14).** A React error boundary in `web` plus structured logging in `api` guarantee no unhandled error reaches the user. Rely on React's default output-escaping for XSS on render.

**Char-counter behavior (RD-2 / RD-3).** The counter appears within **20** of the cap (title ≥180/200, description ≥1980/2000) and is hidden below that. Over-cap typing is **allowed** — keystrokes are never dropped; the counter turns accent/negative past the cap, and submit/save is **blocked** until the field is back within cap.

**First-load theme (RD-6).** With no stored preference, honor the OS `prefers-color-scheme` on first load; once the user toggles, their stored choice overrides and persists. The toggle swaps the Epic 1 CSS-variable token set (light ↔ warm-charcoal dark) — the token values already exist; Epic 3 adds only the toggle + persistence.

**Reduced-motion gate.** Any `prefers-reduced-motion` scenario (bouncy check-off / pop-to-top → instant) is gated on PRD open question OQ3 and is part of the *deferred*, flagged a11y scope — do not silently implement or claim it done.

## UX & Interaction Patterns

- **Skeleton loading (UX-DR14).** Shimmer rows matching row anatomy (circular check placeholder + 1–2 shimmer lines) with an accent-soft-tinted sweep and a "Getting your tasks…" note; never a blank screen or bare spinner; resolves directly to content.
- **Polished empty state (UX-DR15).** Centered accent-soft glyph field with a line-art check-in-circle, headline "Nothing here yet", subline "Add your first task above — it'll show up right here."; the focused add-input stays the focal CTA above it.
- **De-escalated error state (UX-DR16).** Same centered structure, neutral (`border-hairline` glyph, `ink-secondary` refresh glyph, no red), headline "Couldn't load your tasks", a warm reassuring subline, and a solid accent "Try again" button (the one place the filled primary button appears) that re-issues the failed request.
- **Char counter (UX-DR6).** `meta`-size, right-aligned under the input; hidden until approaching a cap; the number turns accent + bold near/over the limit.
- **Theme toggle (UX-DR12) & placeholder avatar (UX-DR13).** Ghost icon button in the header (sun in light / moon in dark), real and functional. The placeholder avatar sits right of the toggle — present but **non-functional** (no login wired, nothing on tap); it must not be connected to anything.
- **Responsive (UX-DR17).** Single centered column (max ~560px desktop; full-width with ~18px side padding on mobile), same composition at every width.
- **Locked microcopy (verbatim, UX-DR25).** Loading "Getting your tasks…"; empty "Nothing here yet" / "Add your first task above — it'll show up right here."; error "Couldn't load your tasks" / "Something got in the way. Your tasks are safe — let's try that again." / button "Try again". Voice (UX-DR26): warm, friendly, restrained, reassuring — errors reassure before they explain; lowercase plain sentences; no alarm-red, no jargon, status codes, streaks, badges, or emoji.
- **Accessibility floor (UX-DR27).** Keyboard for the core path (Enter/Esc + persistent focus), a visible accent focus ring, semantic controls (real button/checkbox/input), legible warm contrast in both themes. **Deferred + flagged (UX-DR28):** full screen-reader label/role/state coverage incl. `aria-live` for completion/pending-delete/undo, comprehensive keyboard traversal + focus-order guarantees, verified WCAG ratios, and `prefers-reduced-motion` handling (OQ3).

## Cross-Story Dependencies

- **On Epics 1–2:** Story 3.1 systematizes the four optimistic mutations that already exist — `useCreateTodo` (Epic 1) plus `useToggleTodo`, `useUpdateTodo`, and the pending-delete controller (Epic 2). It consumes the AD-9 error contract, the TanStack cache (AD-4), and the shared wire-contract type already in place; it changes no data model or wire contract. Story 3.4's toggle consumes the light + warm-dark CSS-variable token set defined as day-one values in Epic 1 (only the toggle + persistence are new). Stories 3.2/3.3/3.5 replace the *minimal* Epic 1 floor (bare empty/loading/error, caps enforced but no counter UI) with the polished versions.
- **Within Epic 3:** 3.1 (error contract + systematized rollback) is the foundation — the uniform 4xx-inline / 5xx-error+retry split and the error boundary that 3.2's polished error/retry state renders against. 3.2 (loading/empty/error states) and 3.3 (char counter) surface the feedback 3.1 standardizes. 3.4 (theme) and 3.5 (responsive/voice/a11y) are largely orthogonal polish, but 3.5's locked microcopy governs the strings 3.2's states display, and its theming-contrast floor applies to 3.4's dark mode.
