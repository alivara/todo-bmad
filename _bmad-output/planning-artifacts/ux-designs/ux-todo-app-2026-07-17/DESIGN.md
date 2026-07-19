---
name: todo-app
description: Warm, soft, restrained single-user todo web app — cream & terracotta, kitchen-table calm, with a real warm-dark theme.
status: final
sources:
  - {planning_artifacts}/prds/prd-todo-app-2026-07-17/prd.md
updated: 2026-07-20
colors:
  # Cream & Terracotta — LIGHT (default theme)
  surface-base: '#F5EFE6'
  surface-raised: '#FFFCF7'
  ink-primary: '#2E2A24'
  ink-secondary: '#8A8072'
  ink-muted: '#B8AE9E'
  accent: '#C15A34'
  accent-soft: '#E9C9B8'
  border-hairline: '#E5DBCC'
  on-accent: '#FFF9F4'
  # Warm DARK (warm charcoal, not cold black) — real supported theme
  surface-base-dark: '#221E1A'
  surface-raised-dark: '#2C2722'
  ink-primary-dark: '#F0E9DE'
  ink-secondary-dark: '#A69C8C'
  ink-muted-dark: '#6E655A'
  accent-dark: '#D97B54'
  accent-soft-dark: '#4A362B'
  border-hairline-dark: '#3A332C'
  on-accent-dark: '#221E1A'
typography:
  # Rounded, friendly humanist sans. ui-rounded / SF Pro Rounded on Apple;
  # Nunito / Quicksand register elsewhere. One family, one voice.
  font-family: { note: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Quicksand', system-ui, sans-serif" }
  wordmark:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Quicksand', system-ui, sans-serif"
    fontSize: 26px
    fontWeight: '800'
    letterSpacing: -0.02em
  empty-headline:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Quicksand', system-ui, sans-serif"
    fontSize: 19px
    fontWeight: '700'
    lineHeight: '1.3'
  task-title:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Quicksand', system-ui, sans-serif"
    fontSize: 17px
    fontWeight: '500'
    lineHeight: '1.4'
  input:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Quicksand', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.4'
  description:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Quicksand', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.45'
  meta:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Quicksand', system-ui, sans-serif"
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 10px      # inputs, small icon buttons
  md: 13px      # task rows, cards
  lg: 16px      # app/browser frame, larger surfaces
  full: 9999px  # pills, toast, avatar
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
components:
  wordmark:
    color: '{colors.ink-primary}'
    accent-dot: '{colors.accent}'
    typography: '{typography.wordmark}'
  add-input:
    background: '{colors.surface-raised}'
    border: '{colors.accent}'
    radius: '{rounded.sm}'
    focus-ring: '{colors.accent-soft}'
    placeholder-color: '{colors.ink-secondary}'
    text-color: '{colors.ink-primary}'
    typography: '{typography.input}'
    description-field: 'stacked below the title inside the same container; {typography.description}, {colors.ink-secondary}'
  add-button:
    background: '{colors.accent-soft}'
    foreground: '{colors.accent}'
    radius: '{rounded.sm}'
  task-row:
    background: '{colors.surface-raised}'
    border: '{colors.border-hairline}'
    radius: '{rounded.md}'
    padding: '{spacing.4}'
    gap: '{spacing.3}'
    title-color: '{colors.ink-primary}'
    description-color: '{colors.ink-secondary}'
    meta-color: '{colors.ink-secondary}'
    shadow: '0 2px 6px -3px rgba(90,60,35,0.22)'
  task-row-completed:
    background: transparent
    border: transparent
    shadow: none
    title-color: '{colors.ink-muted}'
    meta-color: '{colors.ink-muted}'
    decoration: 'line-through {colors.ink-muted}'
  checkbox:
    size: 22px
    radius: '{rounded.full}'
    border: '{colors.ink-muted}'
    background: transparent
  checkbox-done:
    background: '{colors.accent}'
    border: '{colors.accent}'
    check-color: '{colors.on-accent}'
  description-clamp:
    lines: 2
    fade-to: '{colors.surface-raised}'
    more-color: '{colors.accent}'
  edit-row:
    border: '{colors.accent}'
    focus-ring: '{colors.accent-soft}'
    radius: '{rounded.md}'
    selection-fill: '{colors.accent-soft}'
    hint-color: '{colors.ink-secondary}'
  delete-button:
    idle-color: '{colors.ink-secondary}'
    hover-background: '{colors.accent-soft}'
    hover-color: '{colors.accent}'
    radius: '{rounded.sm}'
  undo-toast:
    background: '{colors.surface-raised}'
    border: '{colors.border-hairline}'
    radius: '{rounded.full}'
    text-color: '{colors.ink-primary}'
    action-background: '{colors.accent-soft}'
    action-color: '{colors.accent}'
    shadow: '0 14px 30px -10px rgba(70,45,25,0.4)'
  char-counter:
    color: '{colors.ink-secondary}'
    near-limit-color: '{colors.accent}'
  theme-toggle:
    idle-color: '{colors.ink-secondary}'
    hover-background: '{colors.accent-soft}'
    hover-color: '{colors.accent}'
    radius: '{rounded.sm}'
  avatar-placeholder:
    background: '{colors.accent-soft}'
    foreground: '{colors.accent}'
    radius: '{rounded.full}'
  skeleton-row:
    background: '{colors.surface-raised}'
    border: '{colors.border-hairline}'
    radius: '{rounded.md}'
    shimmer: '{colors.accent-soft}'
  empty-illustration:
    glyph-background: '{colors.accent-soft}'
    glyph-stroke: '{colors.accent}'
    headline: '{typography.empty-headline}'
  error-illustration:
    glyph-background: '{colors.border-hairline}'
    glyph-stroke: '{colors.ink-secondary}'
  retry-button:
    background: '{colors.accent}'
    foreground: '{colors.on-accent}'
    radius: '{rounded.md}'
---

## Brand & Style

todo is designed to feel like a kitchen table in afternoon light — warm, worn-in, and quietly welcoming. It is a deliberately minimal single-user task list whose entire value proposition is restraint: no accounts, no onboarding, no clutter, no gamification. You open it and it just works. The design principle, stated plainly, is *restraint* — every decision should make the surface calmer, not busier.

Two emotional moments carry the whole product, and the visual language exists to serve both. The first is the **satisfaction of checking a task off** — the terracotta check circle filling, the title settling into a soft strikethrough, a small, earned payoff. The second is the **speed of dumping tasks in** — an input pinned to the top, always focused, ready for the next thought before you've finished the last. Warmth serves the first; frictionlessness serves the second. The design must never trade one for the other.

The aesthetic register is **warm and soft** — cozy and grounded, gentle and delightful, but never loud. It borrows Trello's structural friendliness (tidy rows, card-like tiles, approachable shapes) while deliberately rejecting Trello's cool-blue chrome. Corners are generously rounded, shadows are low and warm, and a single terracotta accent does all the emotional work against a cream canvas. A genuine **warm-dark** theme — warm charcoal, not cold black — extends the same identity for low-light use and is a first-class supported mode with a header toggle, not an afterthought.

## Colors

The palette is **Cream & Terracotta**: a warm neutral field with exactly one chromatic accent. The restraint is the point — a single accent color means the check-off moment, the focus ring, and the primary action all read as *the same warm gesture*, and nothing competes with the list itself.

**Light (default):**

| Token | Hex | Role |
|---|---|---|
| `surface-base` | `#F5EFE6` | App canvas — the warm cream field everything sits on. |
| `surface-raised` | `#FFFCF7` | Task rows, cards, the add-input, the toast — the near-white raised paper. |
| `ink-primary` | `#2E2A24` | Task titles, wordmark, primary reading text. Warm near-black, never pure `#000`. |
| `ink-secondary` | `#8A8072` | Descriptions, timestamps, placeholder text, idle icon buttons. |
| `ink-muted` | `#B8AE9E` | Completed-task text and optional/secondary hints. Recedes without vanishing. |
| `accent` | `#C15A34` | The terracotta. The check-off fill, the focus ring source, the primary action, the "more" link, the wordmark dot. |
| `accent-soft` | `#E9C9B8` | Hover fills, focus-ring halo, the add-button and toast-action background, the avatar and empty-glyph field. The accent, gentled. |
| `border-hairline` | `#E5DBCC` | The lowest-contrast separation between raised surfaces and the canvas. |
| `on-accent` | `#FFF9F4` | Text/glyph on a filled terracotta surface (checkmark, retry button label). |

**Warm dark:**

| Token | Hex | Role |
|---|---|---|
| `surface-base-dark` | `#221E1A` | Warm charcoal canvas — brown-black, never blue-black. |
| `surface-raised-dark` | `#2C2722` | Raised rows/cards/input/toast in dark. |
| `ink-primary-dark` | `#F0E9DE` | Primary text on dark — a warm off-white. |
| `ink-secondary-dark` | `#A69C8C` | Descriptions, meta, placeholder on dark. |
| `ink-muted-dark` | `#6E655A` | Completed / recessed text on dark. |
| `accent-dark` | `#D97B54` | Terracotta, lifted for legibility on the dark field. |
| `accent-soft-dark` | `#4A362B` | Hover/fill/soft-accent field on dark. |
| `border-hairline-dark` | `#3A332C` | Hairline separation on dark. |
| `on-accent-dark` | `#221E1A` | Text/glyph on filled accent in dark, where the light check color would glare. |

Contrast intent (qualitative — a11y is deferred in v1 per PRD, so this is intent, not a WCAG claim): `ink-primary` on `surface-raised` is a strong, comfortable read; `ink-secondary` is clearly legible for supporting text; `ink-muted` is intentionally soft for the *completed* state, where reduced legibility communicates "done and settled." The accent is reserved and should never be diluted into decoration.

**The accent is never used for alarm.** Errors are rendered in warm, muted ink — never a saturated warning-red. Terracotta means *action and payoff*, not *danger*.

→ Palette and composition rendered in `mockups/key-list.html` (primary screen, light + warm-dark × desktop + mobile) and `mockups/key-states.html` (empty / loading / error). This spine wins on conflict; the mocks only illustrate.

## Typography

One typeface family throughout: a **rounded, friendly humanist sans**. On Apple platforms this resolves to `ui-rounded` / SF Pro Rounded; elsewhere the Nunito / Quicksand register carries the same soft, approachable warmth. The rounded letterforms reinforce the cozy mood — a geometric or grotesque sans would read colder than the brand allows.

The type scale is small and purposeful. Line-height is generous throughout (~1.4–1.45) to keep the list breathing.

| Role | Size | Weight | Usage |
|---|---|---|---|
| `wordmark` | 26px | 800 | The "todo" wordmark (23px on mobile). Tight tracking (-0.02em). |
| `empty-headline` | 19px | 700 | Empty- and error-state headlines. The one place text goes large. |
| `task-title` | 17px | 500 | The primary task line (≈17–18px; 17px mobile, up to 17.5px on wide desktop panels). |
| `input` | 16px | 400 | The add-input text and placeholder, and inline-edit fields. |
| `description` | 14px | 400 | Optional description line, set in `ink-secondary`. |
| `meta` | 13px | 400 | Relative timestamps ("2 hours ago"), the char counter, edit hints. |

Weight, not size, does most of the hierarchy work at row level: the title sits at a comfortable medium (500) while descriptions and meta drop to regular in a lighter ink. No all-caps body text; the only tracked-out treatment is small internal panel labels in the mocks, which are not part of the shipped app.

## Layout & Spacing

Spacing follows a **4px-based scale**: 4 / 8 / 12 / 16 / 24 / 32. Small gaps (4–8px) bind tightly related elements (checkbox to title, title to meta); the row's internal padding and inter-element rhythm sit at 12–16px; larger gaps (24–32px) separate major regions (header from input, input from list, and the empty/error illustration from its surroundings).

The layout is a **single centered column**, `max-width ≈ 560px` on desktop, and full-width with comfortable side padding (≈18px) on mobile. The app must be fully functional and polished from ~375px mobile width up through desktop (PRD NFR5/SM4) — responsive behavior and the three cross-cutting states (empty, loading, error) are first-class, not afterthoughts.

Structural rules:
- **Header:** minimal. Wordmark left; two right-aligned affordances (theme toggle, then placeholder avatar). Nothing else.
- **Add-input:** pinned at the top of the column, directly above the list, always focused. New tasks animate in directly below it.
- **List:** vertical stack of rows with an ~8–9px gap, newest-first.
- **Undo toast:** floats bottom-center, non-blocking, overlapping the list without displacing it.
- **Char counter:** right-aligned just under the input; appears only when approaching a cap.

## Elevation & Depth

Depth is **soft, low, and warm** — shadows are diffused and tinted toward brown, never harsh gray or black drop-shadows. Elevation is used sparingly and semantically: it marks what is *interactive paper* against the calm canvas.

- **Task rows / cards** carry a barely-there lift — `0 2px 6px -3px rgba(90,60,35,0.22)` in light — enough to feel tactile, not enough to shout.
- **The undo toast** is the one genuinely floating element and earns a deeper, still-soft shadow — `0 14px 30px -10px rgba(70,45,25,0.4)` — because it hovers above the list.
- **Completed rows deliberately shed their elevation** — no shadow, transparent background, no border — sinking back into the canvas as a visual signal of "settled and done."
- In warm-dark, shadows deepen (`rgba(0,0,0,…)`) to remain visible against the charcoal field, but keep the same soft, low character.

Hierarchy otherwise comes from tone, weight, and spacing — not from stacking heavy shadows.

## Shapes

Corners are **generously rounded** — soft, gentle, never sharp. Rounding is a core carrier of the warm-and-soft mood.

| Token | Radius | Applies to |
|---|---|---|
| `sm` | 10px | Add-input, small icon buttons (theme toggle, delete affordance). |
| `md` | 13px | Task rows and cards — the workhorse radius. |
| `lg` | 16px | The largest surfaces (app / browser frame). |
| `full` | 9999px | Pills and circles: the undo toast, the add-button and toast-action pills, the checkbox circle, and the avatar. |

The checkbox is a **true circle** (not a rounded square), which reads friendlier and makes the filled check-off feel like a satisfying dot. Pills and circles are reserved for transient/action elements and identity marks; content surfaces stay in the 10–16px rounded-rectangle range.

## Components

Visual specs only — interaction behavior and state transitions live in EXPERIENCE.md.

### Wordmark
Lowercase **"todo"** in `wordmark` type (`ink-primary`) followed by a small **terracotta accent dot** (`accent`). The dot is the entire logo flourish — no icon, no lockup. Sits top-left of the header.

### Add-input (pinned, focused)
A raised (`surface-raised`) field at `rounded.sm`, shown in its **focused** resting state: a 1.5px `accent` border with a soft `accent-soft` focus-ring halo — **one container** holding both fields. The **title** input sits on the first row with a pill-shaped **Add** button (`accent-soft` fill, `accent` text) at its right as an equal alternative to pressing Enter; the **optional description** sits **inside the same container, stacked below the title** — a quieter, smaller field (`description` size, `ink-secondary`), not its own separate box. Placeholder "Add a task…" in `ink-secondary`; typed text in `ink-primary` at `input` size. An optional leading "+" glyph (circular, accent-outlined) may precede the title placeholder.

### Char counter
Small `meta`-size counter, right-aligned under the input, e.g. `184 / 200`. Hidden until the input approaches its cap (title 200, description 2000 — PRD FR24); the current number turns `accent` and bold as it nears the limit.

### Task row (active)
Raised card (`surface-raised`, `border-hairline`, `rounded.md`, soft row shadow). Left: empty circular `checkbox` (2px `ink-muted` ring). Body: **title** (`task-title`, `ink-primary`), an **optional description** line beneath it (`description`, `ink-secondary`), and a **relative timestamp** (`meta`, "2 hours ago"). Single-line rows center vertically; rows with a description top-align. The description clamps to **2 lines** with a soft fade into the row background and an inline **"more"** affordance (`accent`) to reveal the full text — so one long task can never dominate the tidy list.

### Task row (completed)
The **payoff state**, rendered *settled*: background and border drop to transparent, shadow removed, the row recedes toward the canvas (opacity ~0.85). The checkbox becomes a **filled terracotta circle** (`accent` fill and border) with a bold white (`on-accent`) checkmark. Title gets a `ink-muted` strikethrough and `ink-muted` color; meta also drops to `ink-muted`. Quiet, earned, done.

### Inline edit (edit-in-place)
Activating the row's **single edit affordance** (one cue, not one per line) turns it into an inline editor — no modal, no separate screen. The row gains an `accent` border and `accent-soft` focus ring, stacks vertically, and shows **both fields together**: a **title field** (with selection highlighted in `accent-soft`), a second **optional description field** (separated by a dashed hairline, placeholder "Add a description (optional)"), and a small hint line — `Enter to save · Esc to cancel` (`meta`, `ink-secondary`, keys in `ink-primary`).

### Delete affordance
A **quiet ✕** icon button, `ink-secondary` and low-key at rest — surfacing on row hover. On hover it fills with `accent-soft` and the glyph turns `accent`. Never a loud red trash button; deletion is reversible and shouldn't feel alarming.

### Undo toast
A fully-rounded (`rounded.full`) **pill** floating bottom-center on `surface-raised` with a hairline border and the deep-soft toast shadow. Message ("Task deleted") in `ink-primary`; a pill **Undo** action (`accent-soft` fill, `accent` text) at the right. Non-blocking and transient (~5s window per PRD FR14).

### Theme toggle
A ghost, `rounded.sm` icon button (36px) in the header: **sun icon in light**, **moon icon in dark**. `ink-secondary` at rest, `accent-soft` background + `accent` on hover. Backs the real warm-dark theme.

### User avatar `[placeholder — non-functional v1]`
A quiet circular (`rounded.full`) mark, `accent-soft` field with an `accent` person glyph, right of the theme toggle. **Non-functional in v1** — no accounts are in scope — but present as an intentional forward gesture toward future multi-user (PRD NFR8). Do not wire it to anything.

### Skeleton loading rows
While the list fetches, show **skeleton rows** matching row anatomy (circular check placeholder + one or two shimmer lines of varying width) on `surface-raised` cards, plus a warm "Getting your tasks…" note. A gentle `accent-soft`-tinted shimmer sweeps across them. Never a blank screen and never a bare spinner (PRD FR21/NFR2).

### Empty state
Centered treatment: a soft circular glyph field (`accent-soft`) holding a line-art **check-in-circle** in `accent`, headline "Nothing here yet" (`empty-headline`), subline "Add your first task above — it'll show up right here." (`description`/`ink-secondary`). The focused, ready add-input sits above it — the empty state points back to capture.

### Error state
Same centered structure but deliberately **de-escalated**: the glyph field uses neutral `border-hairline` with an `ink-secondary` line-art refresh/retry glyph — **no red, no alarm**. Headline "Couldn't load your tasks", warm reassuring subline "Something got in the way. Your tasks are safe — let's try that again.", and a solid **Try again** button — the one place the filled `accent` primary button appears (`accent` fill, `on-accent` label, `rounded.md`, soft accent-tinted shadow).

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep the list tidy — one accent, generous rounding, low warm shadows. | Add chrome, badges, or a second accent color competing with terracotta. |
| Make check-off feel satisfying — confident filled terracotta circle, visible settle into the completed style. | Make completion feel like deletion or make it loud; the payoff is quiet and earned. |
| Keep the add-input pinned, focused, and instantly ready for the next task. | Bury capture behind a "+" screen, modal, or extra tap. |
| Render errors in warm, muted ink with a calm retry path. | Use alarming/saturated red for errors — warm muted only. |
| Let completed rows recede (transparent, no shadow, muted ink). | Give completed rows the same weight/elevation as active ones. |
| Clamp long descriptions to ~2 lines with a soft fade + "more". | Let a single long task dominate and break the tidy rhythm. |
| Treat warm-dark as a real, equal theme via the header toggle. | Ship a cold blue-black "dark mode" — the charcoal must stay warm. |
| Edit in place, inline, in the row. | Open a modal or navigate away to edit. |
| Keep the placeholder avatar visibly quiet and non-functional. | Wire the avatar to anything, or imply accounts exist in v1. |
| Use `accent` only for action and payoff (check, focus, primary, "more"). | Use `accent` as decoration or fill behind large areas. |
| Keep motion decorative and never blocking the ≤100ms optimistic render. | Gate the optimistic update behind an animation. |
| Keep it restrained — no streaks, no gamification, no re-engagement nudges. | Add priorities, tags, due dates, or any feature outside the v1 core loop. |
