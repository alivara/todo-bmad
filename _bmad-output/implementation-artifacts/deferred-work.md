# Deferred Work

## Deferred from: code review of story-1.1 (2026-07-18)

- **Proxy redirect handling** — `frontend/app/api/[...path]/route.ts`: `redirect:'manual'` yields an opaqueredirect (status 0) that throws in the `Response` constructor and is mis-reported as 502; the `Location` header is also dropped. Latent — the `backend` never issues 3xx responses. Revisit if any upstream redirect becomes possible.
- **`fetchTodos` response robustness** — `frontend/lib/todos.ts`: calls `res.json()` unconditionally, so a 2xx `204`/empty body throws (→ error state) and a non-array/`null` 2xx body crashes the render. Latent — `GET /todos` always returns a JSON array in this system. Add an empty-body + `Array.isArray` guard when the client consumes more endpoints.
- **Boot/serve timeouts** — `backend/main.go` + `backend/db/db.go`: `context.Background()` (no deadline) is used for Migrate/Connect/Ping, and `router.Run` sets no `http.Server` read/write timeouts. Boot could hang on a half-open DB. Low priority — the service is internal-only.
- **Proxy `HEAD`/`OPTIONS` methods** — `frontend/app/api/[...path]/route.ts`: only GET/POST/PATCH/PUT/DELETE are exported, so `HEAD`/`OPTIONS` get Next's default 405 instead of reaching the backend. Not needed for Story 1.1.
