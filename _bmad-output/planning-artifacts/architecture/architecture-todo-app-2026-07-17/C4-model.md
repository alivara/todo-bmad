# todo-app — C4 Model

A visual walkthrough of the architecture, from system context down to components. Companion to `ARCHITECTURE-SPINE.md`; the spine's `AD-n` invariants are cited where they govern a boundary. Diagrams are valid Mermaid.

---

## Level 1 — System Context

Who uses the system and what it depends on. The whole todo-app is one system today; auth/multi-user is a deliberately deferred future dependency (spine AD-2, AD-3).

```mermaid
flowchart TB
  user(["User<br/>(keeps a personal task list)"])
  reviewer(["Portfolio reviewer<br/>(evaluates full-stack craft)"])

  subgraph sys["Todo App"]
    app["Minimal single-user todo app<br/>create · view · edit · complete · delete"]
  end

  auth(["Auth / identity provider<br/>— future, not built —"]):::future

  user -->|"manages todos in the browser"| app
  reviewer -->|"clones & runs via one docker compose up"| app
  app -.->|"future: per-user scoping (AD-2/AD-3)"| auth

  classDef future stroke-dasharray: 5 5,fill:#f6f6f6,color:#777;
```

---

## Level 2 — Containers

The three deployable services and the browser. Only `web` is reachable from outside the Compose network; `api` and `db` are internal (spine AD-12). The browser never talks to `api` directly — it goes through the dumb BFF proxy in `web` (AD-3).

```mermaid
flowchart TB
  browser(["Browser<br/>React SPA"])

  subgraph compose["docker compose — single internal network"]
    web["<b>web</b> — Next.js 16.2<br/>UI + dumb BFF proxy<br/><i>host-exposed :3000</i>"]
    api["<b>api</b> — Gin 1.12 / Go 1.26<br/>REST service (handler/service/repository)<br/><i>internal only :8080</i>"]
    db[("<b>db</b> — PostgreSQL 18<br/>named volume<br/><i>internal only :5432</i>")]
  end

  browser -->|"HTTPS, same-origin<br/>GET/POST/PATCH/DELETE /api/todos"| web
  web -->|"server-to-server HTTP<br/>forwards /api/* verbatim (AD-3)"| api
  api -->|"parameterized SQL (AD-10)<br/>migrations on boot (AD-11)"| db

  browser -.->|"optimistic UI + ~5s pending-delete<br/>lives client-side (AD-4/AD-5)"| browser
```

**Startup order** (healthcheck-gated, AD-12): `db` healthy → `api` runs migrations then serves → `web`.

---

## Level 3a — Components: `web`

React rendering, one server-state owner (TanStack Query), the bespoke pending-delete controller, and the thin proxy. No business logic lives here (AD-3).

```mermaid
flowchart TB
  subgraph web["web — Next.js"]
    ui["UI components<br/>list · add form · inline edit · toggle · undo toast"]
    query["TanStack Query client<br/><b>sole owner of server state</b> (AD-4)<br/>optimistic onMutate + onError rollback"]
    pending["Pending-delete controller<br/>~5s timer, sendBeacon on unload (AD-5)"]
    proxy["Proxy route handlers /api/*<br/>pure pass-through + error mapping (AD-3/AD-9)"]
  end
  api["api (Gin)"]

  ui --> query
  ui --> pending
  query -->|"fetch /api/todos"| proxy
  pending -->|"commit DELETE"| proxy
  proxy -->|"server-to-server"| api
```

---

## Level 3b — Components: `api`

Strict one-way layering (AD-1): HTTP in the handler, rules in the service, all persistence behind the repository interface — which is also the multi-user seam (AD-2).

```mermaid
flowchart TB
  subgraph api["api — Gin / Go"]
    handler["<b>handler</b><br/>HTTP: parse, marshal,<br/>map errors → codes (AD-9)"]
    service["<b>service</b><br/>rules: title/description validation (AD-10),<br/>status transitions (AD-8), ordering"]
    repo["<b>repository (interface)</b><br/>persistence contract<br/><i>= the multi-user seam (AD-2)</i>"]
    pg["repository: Postgres impl<br/>parameterized SQL"]
    migrate["migrations runner<br/>golang-migrate, on boot (AD-11)"]
  end
  db[("PostgreSQL")]

  handler --> service
  service --> repo
  repo --> pg
  pg --> db
  migrate -->|"apply versioned SQL before serving"| db
```

---

## Reading the diagrams

- **Dependencies point down** — never up or sideways (AD-1). The browser depends on the wire contract (AD-6), never on Gin internals.
- **One entry point** — everything external enters through `web`; `api` and `db` are unreachable from the host (AD-12).
- **State ownership is singular** — server truth in the query cache on the client, business rules in `api` services, persistence behind the repository. No shared ownership.
- **The dashed edges are the future** — auth/multi-user attaches at the repository seam (AD-2) and the proxy's auth-injection point (AD-3) without disturbing the layers above.
