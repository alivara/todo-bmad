# Deferred Work

## Deferred from: code review of story-1.1 (2026-07-18)

- **Proxy redirect handling** — `web/app/api/[...path]/route.ts`: `redirect:'manual'` yields an opaqueredirect (status 0) that throws in the `Response` constructor and is mis-reported as 502; the `Location` header is also dropped. Latent — the `api` never issues 3xx responses. Revisit if any upstream redirect becomes possible.
- **`fetchTodos` response robustness** — `web/lib/todos.ts`: calls `res.json()` unconditionally, so a 2xx `204`/empty body throws (→ error state) and a non-array/`null` 2xx body crashes the render. Latent — `GET /todos` always returns a JSON array in this system. Add an empty-body + `Array.isArray` guard when the client consumes more endpoints.
- **Boot/serve timeouts** — `api/main.go` + `api/db/db.go`: `context.Background()` (no deadline) is used for Migrate/Connect/Ping, and `router.Run` sets no `http.Server` read/write timeouts. Boot could hang on a half-open DB. Low priority — the service is internal-only.
- **Proxy `HEAD`/`OPTIONS` methods** — `web/app/api/[...path]/route.ts`: only GET/POST/PATCH/PUT/DELETE are exported, so `HEAD`/`OPTIONS` get Next's default 405 instead of reaching the api. Not needed for Story 1.1.

## Deferred from: code review of story-1.2 (2026-07-18)

- **Over-cap `aria-invalid` has no reason exposed** — `web/app/components/AddInput.tsx:70`: over-cap flips `aria-invalid` true and submit silently no-ops, but there is no `aria-describedby`/message, so a screen-reader user gets "invalid" with no reason. Out of scope by spec — full SR/`aria-live` coverage is UX-DR28 and the visible counter is Story 3.3. Add a visually-hidden helper when 3.3 lands.
- **`outline:'none'` + permanently-painted focus halo** — `web/app/components/AddInput.tsx:98,103`: the accent-soft ring is unconditional inline `boxShadow` and `outline` is suppressed. Benign in 1.2 (the field is focused-on-load and refocused after every add), but a blurred input still reads as focused and keyboard `:focus-visible` is gone. Revisit when Story 1.3 introduces other focusable rows — move the halo to `:focus`/`:focus-visible`.
