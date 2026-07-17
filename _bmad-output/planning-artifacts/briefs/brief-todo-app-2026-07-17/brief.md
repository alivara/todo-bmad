---
title: todo-app — Product Brief
status: final
created: 2026-07-17
updated: 2026-07-17
---

# todo-app

A deliberately minimal, single-user todo app you can open and use immediately — no signup, no accounts, no clutter. It runs the core task loop (create, view, edit, complete, delete) so cleanly and reliably that a small surface feels like a finished product. Bring up the whole stack with one command: `docker compose up`.

## What it is

todo-app is a personal task list for anyone who wants to jot tasks down and check them off without friction. You land straight on your list — it's already there. Type a task, hit Enter, and it pops to the top; check one off and it settles into a quiet "done" state; delete one and you get about five seconds to undo. Your list persists across refreshes, sessions, and devices (a single shared list, not per-user sync).

It is also, deliberately, an **engineering showcase**: a conventional, well-structured full-stack app whose code is clean and legible enough to read as a portfolio piece — and whose foundation could grow into a multi-user product later.

## Why it exists

The bet: **restraint is the value.** Most todo apps accrete features — priorities, tags, due dates, streaks, gamification — until the simple act of writing down a task carries overhead. todo-app does the opposite: it does the core loop and nothing else, and spends the effort it saves on making that loop feel *instant and trustworthy*. Two emotional moments carry the whole product — the **speed of dumping tasks in** and the **satisfaction of checking one off** — and every decision serves one of them without trading off the other.

It matters as a demonstration: that a small, focused product done well beats a broad one done adequately, and that "simple" is an engineering achievement, not a lack of ambition.

## Who it's for

- **Primary:** anyone who wants a no-signup, no-friction personal task list.
- **Secondary:** a portfolio reviewer evaluating full-stack engineering quality — clean structure, sensible boundaries, one-command run.

## What it does (v1)

The complete core loop, and only the core loop:

- **Capture** — type a title (optional description), submit with Enter or a button; it appears instantly at the top.
- **View** — the full list loads automatically, newest-first, with relative timestamps.
- **Edit** — fix a title or description in place, right in the row.
- **Complete** — toggle a task done; it moves to a muted, struck-through state.
- **Delete with undo** — tasks vanish immediately but are recoverable for about five seconds.

Everything is **optimistic**: the UI reflects your action in under 100ms and reconciles with the server after the fact — and if the server ever rejects a change, the app rolls it back visibly rather than hiding the failure.

## Why these choices

These are the decisions a reader of the codebase will want explained up front:

- **Next.js client + a separate Gin (Go) API, behind a thin same-origin proxy.** The deliberate front/back split keeps the architecture legible and removes CORS entirely (the browser only ever talks to the `web` service). The proxy is also the natural future home for auth/session.
- **PostgreSQL over SQLite.** Models a realistic deploy and supports the multi-user future cleanly; the heavier local stack is paid for by one-command startup.
- **Optimistic UI with visible rollback.** Delivers the "instant feel" without ever lying about what's saved.
- **`status` as an extensible enum, not a boolean.** Completion is a lifecycle state (`active` | `completed`), so new states (`in_progress`, `archived`) can be added later without a schema rewrite.
- **A repository interface as the multi-user seam.** The data model and API are structured so per-user scoping can be added later by threading an owner through one interface — not a rewrite. It stays clean today; the future is prepared, not built.
- **One `docker compose up`.** Frontend + backend + datastore come up healthcheck-gated, migrations apply on boot, only the web service is exposed, and a new developer can clone→run in under ten minutes.

## Scope & non-goals

**In scope (v1):** the five-action core loop, durable persistence, first-class empty/loading/error states, optimistic rollback, a real warm-dark theme, and responsive polish from ~375px up.

**Explicitly out of scope (deferred, not rejected):** accounts / auth / multi-user, collaboration & sharing, priorities, manual reordering, due dates, reminders, tags / categories / projects, search & filtering, recurring tasks, and full accessibility hardening. The architecture is built so these can be added later — auth and multi-user being the clearest next step — but shipping any of them in v1 would betray the restraint that is the point.

## Look & feel

A warm, soft, "kitchen table in afternoon light" aesthetic — a Cream & Terracotta palette with a single accent color carrying the key moments (the check-off, the focus ring, the primary action), generous rounding, and low warm shadows. A genuine warm-dark theme (warm charcoal, never cold black) is a first-class supported mode. The visual language stays calm rather than busy.

## Status & provenance

This brief is a **retroactive distillation** of a completed planning suite, written for orientation at the top of the repo. The authoritative detail lives in:

- **PRD** — `planning-artifacts/prds/prd-todo-app-2026-07-17/prd.md` (+ `addendum.md`)
- **Architecture spine** — `planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md`
- **UX** — `planning-artifacts/ux-designs/ux-todo-app-2026-07-17/DESIGN.md` + `EXPERIENCE.md`
- **SPEC (kernel contract)** — `specs/spec-todo-app/SPEC.md`
- **Epics & stories** — `planning-artifacts/epics.md` (3 epics, 11 stories)
