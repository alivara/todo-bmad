# Deferred Work

## Deferred from: code review of story-1.1 (2026-07-18)

- **Proxy redirect handling** — `web/app/api/[...path]/route.ts`: `redirect:'manual'` yields an opaqueredirect (status 0) that throws in the `Response` constructor and is mis-reported as 502; the `Location` header is also dropped. Latent — the `api` never issues 3xx responses. Revisit if any upstream redirect becomes possible.
- **`fetchTodos` response robustness** — `web/lib/todos.ts`: calls `res.json()` unconditionally, so a 2xx `204`/empty body throws (→ error state) and a non-array/`null` 2xx body crashes the render. Latent — `GET /todos` always returns a JSON array in this system. Add an empty-body + `Array.isArray` guard when the client consumes more endpoints.
- **Boot/serve timeouts** — `api/main.go` + `api/db/db.go`: `context.Background()` (no deadline) is used for Migrate/Connect/Ping, and `router.Run` sets no `http.Server` read/write timeouts. Boot could hang on a half-open DB. Low priority — the service is internal-only.
- **Proxy `HEAD`/`OPTIONS` methods** — `web/app/api/[...path]/route.ts`: only GET/POST/PATCH/PUT/DELETE are exported, so `HEAD`/`OPTIONS` get Next's default 405 instead of reaching the api. Not needed for Story 1.1.

## Deferred from: code review of story-1.2 (2026-07-18)

- **Over-cap `aria-invalid` has no reason exposed** — `web/app/components/AddInput.tsx:70`: over-cap flips `aria-invalid` true and submit silently no-ops, but there is no `aria-describedby`/message, so a screen-reader user gets "invalid" with no reason. Out of scope by spec — full SR/`aria-live` coverage is UX-DR28 and the visible counter is Story 3.3. Add a visually-hidden helper when 3.3 lands.
- **`outline:'none'` + permanently-painted focus halo** — `web/app/components/AddInput.tsx:98,103`: the accent-soft ring is unconditional inline `boxShadow` and `outline` is suppressed. Benign in 1.2 (the field is focused-on-load and refocused after every add), but a blurred input still reads as focused and keyboard `:focus-visible` is gone. Revisit when Story 1.3 introduces other focusable rows — move the halo to `:focus`/`:focus-visible`.

## Deferred from: expert review of story-1.3 (2026-07-19, Pixel)

- source_spec: `spec-1-3-view-the-persistent-task-list.md`
  summary: Body-copy contrast is below WCAG AA — `--ink-secondary` (#8a8072) on `--surface-raised` (#fffcf7) ≈ 3.8:1 for the 14px description and 13px relative time (normal text needs 4.5:1).
  evidence: Pre-existing brand token (defined in `globals.css` since 1.1); Story 1.3 is the first to render body copy in it, so it surfaced here. Fix is a **design decision** (darken `--ink-secondary` toward ~#6f6656 ≈4.6:1, verified with a contrast tool) — not auto-patched to avoid unilaterally changing the brand palette. Needs designer sign-off.
- source_spec: `spec-1-3-view-the-persistent-task-list.md`
  summary: Completed-row text (`--ink-muted` #b8ae9e on #fffcf7 ≈ 1.9:1) is illegible, not merely de-emphasized.
  evidence: Dormant in 1.3 (no `completed` todos exist until Epic 2 activates completion). When Epic 2 lands the toggle, bump completed text to a token clearing ≥4.5:1 (or ≥3:1 if treated as deprioritized content). `web/app/components/TodoRow.tsx` completedTextStyle.

## Deferred from: Story 2.2 UX feedback (2026-07-19) → Epic 3 / Story 3.2

- source_spec: `spec-2-2-edit-a-task-in-place.md`
  summary: Inline edit (tap the title/description text) has no visible discoverability affordance — the only cue is `cursor: text` on hover (`web/app/components/TodoRow.tsx` editableTextStyle), invisible on touch/mobile. Editing works but users can't find it; the asymmetry worsened once 2.3 added a visible ✕ delete icon.
  evidence: Confirmed in code — editableTextStyle is `{ cursor: 'text' }` only. Matches the locked UX ("tap the row's text to edit", no edit button), so not a bug — a discoverability gap. User decision (2026-07-19): defer to Story 3.2 (polished states owns visual polish). Options recorded: (a) hover/focus tint + pencil hint on the editable text [recommended, honors the minimal design], (b) explicit edit ✎ icon symmetric with ✕ [needs UX sign-off]. On mobile, a persistent faint cue is needed (no hover).
