---
name: todo-app
status: final
sources:
  - {planning_artifacts}/prds/prd-todo-app-2026-07-17/prd.md
  - {planning_artifacts}/ux-designs/ux-todo-app-2026-07-17/.memlog.md
  - {planning_artifacts}/ux-designs/ux-todo-app-2026-07-17/.working/prd-extraction.md
  - {planning_artifacts}/ux-designs/ux-todo-app-2026-07-17/.working/key-list.html
  - {planning_artifacts}/ux-designs/ux-todo-app-2026-07-17/.working/key-states.html
updated: 2026-07-20
---

# todo — Experience Spine

> The behavior / IA / flow contract for a deliberately minimal single-user todo web app. `DESIGN.md` is the visual identity reference; this spine is the experience. Tokens are cross-referenced by name (e.g. `{colors.accent}`) and never redefined here. The product's value *is* restraint: one screen, one loop — create, view, edit, complete, delete — done cleanly enough to feel finished. The emotional core is two moments, and every behavior below serves one of them: the **speed of dumping tasks in**, and the **satisfaction of checking one off**.

## Foundation

Single-surface **responsive web app** (not native). Next.js / React frontend talking to a separate Go REST API; the two are decoupled, and the UI is built to render optimistically against an API that confirms after the fact. Polished and fully functional from **~375px mobile width up through desktop** (NFR5, SM4).

Layout is a **single centered column, max-width ~560px** on desktop, full-width with padding on mobile — the same composition at every width, never a distinct "mobile app." No component library is named; the visual system is bespoke warm-and-soft (Cream & Terracotta), defined entirely in `DESIGN.md`.

**Dark mode is supported** as a first-class warm-charcoal variant, toggled from the header; **light is the default**. There are **no accounts, no signup, no onboarding, and no configuration** in v1 — the app opens straight into the list and works. Cross-device *continuity* comes from a single shared backend list (the same list appears on any device), **not** per-user sync.

## Information Architecture

Essentially **one surface**. There is no navigation, no routing between screens, no menus. Everything happens on the list.

| Surface | Reached from | Purpose |
|---|---|---|
| The List | App open (cold) — the only surface | Header, add-input, and the task list. Every core action (create / view / edit / complete / delete) happens here. |

Transient and overlay layers sit *on top of* the one surface rather than replacing it:

| Layer | Trigger | Purpose |
|---|---|---|
| Undo toast | A delete | Floating, non-blocking confirmation + one-tap reversal during the ~5s window. Bottom-center. |
| Inline-edit mode | Tap a row's title/description | Turns the row itself into an editor in place — no modal, no separate screen. |
| Char counter | Title/description nears its cap | Inline, quiet count that appears only when approaching the limit. |

**On-surface anatomy (top to bottom):** a minimal **header** — wordmark `todo` at left; **theme toggle + placeholder avatar** at right; a **top-pinned, always-focused add input**; then the **task list** below it, newest-first. The undo toast floats over the lower edge when a delete is pending.

→ Composition reference: `mockups/key-list.html` (primary screen, desktop + mobile × light + warm-dark) and `mockups/key-states.html` (empty / loading / error). The spine wins on conflict; the mocks only illustrate.

## Voice and Tone

Microcopy discipline. Brand voice and aesthetic posture live in `DESIGN.md`. The register is **warm, friendly, restrained, and reassuring — never alarming, never marketing-loud**. It speaks like a calm person at a kitchen table, not a system emitting status. Errors reassure before they explain; nothing shouts.

All confirmed strings are locked below.

| Slot | Copy |
|---|---|
| Wordmark | `todo` (lowercase, with a terracotta accent dot — see `{typography.wordmark}`) |
| Add-input placeholder | `Add a task…` |
| Empty — headline | `Nothing here yet` |
| Empty — subline | `Add your first task above — it'll show up right here.` |
| Loading | `Getting your tasks…` |
| Error — headline | `Couldn't load your tasks` |
| Error — subline | `Something got in the way. Your tasks are safe — let's try that again.` |
| Error — button | `Try again` |
| Edit hint | `Enter to save · Esc to cancel` |
| Description placeholder | `Add a description (optional)` |
| Undo toast | `Task deleted` + action `Undo` |

| Do | Don't |
|---|---|
| "Your tasks are safe — let's try that again." | "Error: request failed (500)." |
| "Nothing here yet." | "You have no tasks! Get productive 🚀" |
| Reassure, then offer a next step. | Alarm-red banners, blame, exclamation-stacking. |
| Lowercase, plain, complete sentences. | Jargon, status codes, streaks, badges. |

## Component Patterns

Behavioral rules only. Visual specs live in `DESIGN.md.Components`.

| Component | Behavioral rules |
|---|---|
| **Add input** | Pinned to the top of the list, focused on load and re-focused after every add. A required **title** field plus an **optional description field**, the two stacked **inside a single bordered container** — title on top, the description a quieter, smaller field **below it within the same box** (not its own separate box) (`Add a description (optional)`, multiline — **Enter inserts a newline, does not submit**), so a task can be captured with a note in one step (PRD FR1). Submits on **Enter in the title** *or* the **Add** button — parity, no primary/secondary hierarchy of outcome. On submit: **optimistic insert at the top** of the list (status `active`), carrying any description; **both fields clear and focus returns to the title** for rapid consecutive capture. Empty or whitespace-only title is **rejected inline** within the same interaction — no row is created, focus is retained. Enforces the title (≤200) and description (≤2000) caps after trim, with the quiet char-counter on each (see char-count below); a blank description is simply omitted. |
| **Task row** | Shows **title** (required, ≤200) as the primary line and, when present, an **optional description** (≤2000) inline as a smaller muted line beneath it, plus a **relative creation time** ("just now", "2 hours ago"). Newest-first. A long description is **clamped to ~2 lines** with a soft fade and a **"more" reveal** so one verbose task can't dominate the tidy list; full text is seen on expand/edit. Single-line rows (no description) sit vertically centered and compact. |
| **Checkbox / complete toggle** | Toggles the row between `active` and `completed`. **Optimistic and persisted.** Completing gives a **satisfying, bouncy settle** into the completed style (strikethrough + muted, recessed — this is an emotional-core moment, see Interaction Primitives). Toggling back to active is the same motion in reverse. |
| **Edit-in-place** | A **single edit affordance** on the row enters edit mode (one cue on the title, not one per line); the **row itself becomes the editor** (inline title field + optional description field, both shown together) — no modal, no route change. On **touch** (no hover/focus tint to fall back on) a **fainter** cue is kept on the description line so direct-tap-to-edit stays discoverable; the title remains the primary cue. **Enter or blur saves** (optimistic + persisted); **Esc cancels and reverts** to the prior values. An edit leaving the **title empty/whitespace reverts** (title required); **clearing the description is allowed** (it's optional). The edit hint `Enter to save · Esc to cancel` is shown while editing. |
| **Delete** | A **quiet affordance** (not a loud red button) on the row → **optimistic removal** from the visible list → **pending-delete** state (not yet committed) → **undo toast**. See State Patterns and Interaction Primitives for the commit/undo window. |
| **Theme toggle** | Header control switching light ⇄ warm-dark. The **preference persists** across sessions/devices as feasible. Sun/moon affordance; real and functional in v1. |
| **Placeholder avatar** | `[placeholder]` — **non-functional in v1.** A quiet soft circle in the header that gestures at future multi-user (NFR8). **No login is wired, nothing happens on tap.** Present as a forward-looking signal only, logged as an intentional placeholder, not scope creep. |

## State Patterns

The four cross-cutting states are **first-class, not afterthoughts** (explicit user emphasis; PRD FR20–23). Alongside them, the row itself moves through active / completed / editing / pending-delete, and the inputs surface char-limit feedback.

| State | Where | Treatment |
|---|---|---|
| **Empty** | List has no tasks | Friendly prompt — headline `Nothing here yet`, subline `Add your first task above…`. The **add input is the focal CTA** (shown focused). Warm, inviting; not a dead end. |
| **Loading** | Initial list fetch (FR21/NFR2) | **Skeleton rows** that match the expected layout. **Never a blank screen and never a bare spinner.** Caption `Getting your tasks…`. Resolves **directly to content** with no intervening blank frame. |
| **Error** | A fetch/API call fails (FR22) | **Non-disruptive**, warm-muted treatment — **NOT alarm-red**. Headline `Couldn't load your tasks`, reassuring subline, and a **`Try again`** button that **re-issues the failed request**. |
| **Optimistic rollback** | Server rejects add / edit / toggle / delete (FR23, CM2) | The optimistic change **visibly rolls back** to the exact pre-action state — the inserted row leaves, the edit reverts, the toggle flips back, the deleted row returns. No silent divergence between what the user sees and what is persisted. |
| Active vs completed row | Any row | Active = full-weight ink on a raised card. Completed = strikethrough + muted, recessed/settled (see `{colors.ink-muted}`). |
| Editing row | A row being edited | Row becomes the inline editor, accent-outlined; other rows unaffected. |
| Pending-delete | A row just deleted | Removed from the visible list, awaiting the ~5s undo window before commit. |
| Char-limit-approaching | Add/edit fields | A quiet count appears **only as the cap is neared** (title 200, description 2000), emphasizing as it approaches/exceeds; never present at rest. |

## Interaction Primitives

- **Optimistic UI is the baseline.** Every mutating action renders in **≤100ms** (NFR1/SM3), before the server confirms. **Motion decorates the change; it never blocks or gates it** — the perf floor wins over any animation.
- **"Pops to top" on add.** A newly added task **animates in at the top** of the list, directly below the add input — reinforcing rapid capture.
- **Satisfying, bouncy check-off.** Completing a task uses a **spring with a visible settle** into the completed style. This is the app's primary emotional payoff and is deliberately more expressive than any other motion.
- **Undo window (~5s).** Delete → pending-delete → toast. **Undo requires no server round-trip** — it restores the row in place instantly. If the window elapses without Undo, the delete **commits**. **Closing/reloading the tab while a delete is pending commits it** — "closing the tab is confirmation, not cancellation" (FR15).
- **Keyboard is inherent to the core loop.** **Enter** submits an add and saves an edit; **Esc** cancels/reverts an edit; the **add input stays focused** so a user can type-Enter-type-Enter to dump tasks without touching the mouse.
- **Progressive char-count feedback.** Title capped at **200**, description at **2000** (FR24, enforced client + server). Feedback appears as the limit is approached and escalates as it's exceeded.
- **Tap / click to act.** No drag-to-reorder, no swipe gestures, no long-press in v1 (out of scope — ordering is fixed newest-first).

## Accessibility Floor

**Honest scope:** full accessibility (comprehensive keyboard operability, complete screen-reader labelling) is **DEFERRED in v1 per the PRD — deferred, not rejected** (PRD §7, §8). This section states the minimal floor that v1 *does* respect and flags what is explicitly postponed.

**Respected in v1 (inherent to the design):**
- **Keyboard for the core path.** Add, edit, and complete are reachable by keyboard because the design is built on Enter-to-submit / Enter-to-save / Esc-to-cancel with a persistently focused input — this is load-bearing, not an add-on.
- **Visible focus ring.** Focused controls show a clear accent focus indicator (see `{colors.accent}` / focus treatment in `DESIGN.md`).
- **Semantic controls.** Real buttons, checkboxes, and text inputs — not click-handlers on generic elements — so native focus and activation behave.
- **Adequate warm contrast intent.** The palette is chosen with legible contrast in mind in both light and warm-dark; formal ratio verification is part of future hardening.

**Explicitly deferred to future hardening (flag, do not pretend):**
- Full screen-reader label/role/state coverage (e.g. announcing completion, pending-delete, and the undo window via `aria-live`).
- Comprehensive keyboard traversal of *every* affordance (delete, theme toggle, "more" reveal) and focus-order guarantees.
- Verified WCAG contrast ratios and reduced-motion handling for the spring/pop animations.

`[NOTE FOR UX: reduced-motion is not yet decided — the bouncy check-off and pop-to-top should degrade to an instant state change under prefers-reduced-motion when a11y is hardened. Flagged, not scoped for v1.]`

## Key Flows

### UJ1 — Maya clears her head between meetings

Maya is a professional with three minutes between meetings and a head full of loose tasks, on her phone. (Mirrors the PRD's UJ1.)

1. **Opens the app.** No login, no signup. Her existing list is already there after a **brief load** — she sees skeleton rows and `Getting your tasks…`, never a blank screen, and it resolves straight into her tasks.
2. **Dumps a task.** She taps the always-focused add input, types `Email Sam the Q3 numbers`, hits **Enter**. It **pops to the top** of the list; the input clears and stays focused, ready for the next one.
3. **Adds a note.** She taps the new task, and in the inline editor adds a description — `attach the deck` — beneath the title. Enter saves; it settles back into a normal row showing the muted description line.
4. **Fixes it in place.** She realizes she meant Q4. She taps the title, edits `Q3` → `Q4` right in the row, and confirms with **Enter**. No modal, no navigation — the correction happens where the task lives.
5. **CLIMAX — checks off "Book dentist."** She taps the checkbox on yesterday's `Book dentist`. It gives a **satisfying, bouncy settle into the completed style** — the strikethrough and muted recede land with a small spring. *This is the payoff:* a loose worry, visibly closed. The three-minute head-clear is working.
6. **Deletes a stale reminder.** She taps delete on an old item; it **vanishes optimistically** and the **`Task deleted` + `Undo`** toast floats up from the bottom.
7. **Undoes it.** Realizing she still needs it, she taps **Undo** — it **returns in place instantly**, no server round-trip, no data lost.
8. **Locks her phone.** Nothing is lost; the list is durably persisted.
9. **Continues on laptop.** Later, on her laptop, **the same list is there, consistent** — Q4 corrected, dentist completed, the reminder restored. Same single surface, same state, different device.

**Failure path (rollback, CM2):** if the server rejects any of her actions — the add, the Q4 edit, the check-off, or the delete — the change **visibly rolls back** to its pre-action state rather than silently diverging, and (for a load failure) she sees the warm `Couldn't load your tasks` state with **`Try again`**, which re-issues the request. She is never shown a lie about what's saved.
