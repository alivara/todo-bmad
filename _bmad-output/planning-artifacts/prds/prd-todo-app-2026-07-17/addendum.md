# Addendum — Todo App

Technical and downstream detail that supports the PRD but does not belong in its capability-focused body. Feeds architecture / solution design.

## Technology Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | **Next.js** (React) | Used as the client application. The browser calls Next.js **same-origin**; Next.js proxies API requests **server-to-server** to Gin (a thin BFF), so there is **no CORS**. Kept a distinct service from the API to preserve a clean front/back boundary (portfolio signal + extensibility); the proxy is also the natural future home for auth/session. |
| Backend / API | **Gin (Go)** | Small REST API for todo CRUD. Idiomatic, fast, easy to read. |
| Datastore | **PostgreSQL** (confirmed) | Runs as its own container. Chosen over SQLite because it supports the future multi-user direction cleanly and models the real-world deploy story. |
| Deployment | **Docker Compose** | Full stack (frontend + backend + datastore) starts with a single `docker compose up`. |

## Rationale / Decisions Considered

- **Next.js front end + separate Gin API** (rather than Next.js full-stack API routes): deliberate front/back separation makes the architecture legible for a portfolio reviewer and keeps the path to future auth/multi-user clean. The browser reaches the API through a **thin Next.js server-side proxy (BFF)** — same-origin to the browser, server-to-server to Gin — so there is **no CORS** to configure, and only the `web` service is exposed to the host. *Cost:* an extra proxy hop and a small server-side role for `web` — accepted because it removes CORS, models a realistic API-behind-a-gateway deploy, and is the natural seam for future auth/session. Contained by the single `docker compose up` (NFR11). *(Architecture decision — see `ARCHITECTURE-SPINE.md` AD-3.)*
- **PostgreSQL over SQLite**: supports the multi-user future cleanly and models a realistic deployment. *Cost:* a heavier local stack than a demo strictly needs — mitigated by NFR11's single-command startup.
- **Optimistic UI with rollback**: chosen to satisfy the "instant feel" goal (SM3/NFR1) without hiding failures (CM2/FR23). *Cost:* reconciliation/rollback logic and the pending-delete lifecycle (FR13–FR15) add client-side complexity. The mechanism is an architecture concern.
- **Extensibility toward multi-user**: data model and API should be structured so a `user_id` scoping dimension can be added without a rewrite (NFR8). Exact mechanism is an architecture decision.
- **`status` enum instead of a `completed` boolean**: completion is modeled as a constrained `status` field (current values `active` | `completed`) rather than a boolean. Chosen as a scalability/product-future decision — new lifecycle states (`in_progress`, `archived`, …) can be added without a schema migration. *Cost:* marginally more ceremony than a boolean for today's two states. Treated as an extensibility decision, not scope creep, since v1 still surfaces only the two states. Toggling completion is a status transition.

## Deferred / Future (from Out of Scope)

- Accessibility (keyboard operability, screen-reader labels) — deliberately not a v1 commitment; strong future enhancement.
- Auth & multi-user, collaboration/sharing, task prioritization, deadlines/due dates, reminders/notifications.
