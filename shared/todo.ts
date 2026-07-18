// shared/todo.ts — SINGLE SOURCE OF TRUTH for the todo wire contract (AD-6).
//
// Both `web` and `api` derive the todo shape, field names, casing, envelope, and
// success codes from this definition. `web` imports these types directly. The Go
// side (`api`) mirrors this shape and is wired to a contract test that fails the
// build on drift — completed in Story 1.2 when `POST` lands (see api/model/todo.go).
//
// Rules encoded here (do not diverge — a mismatch must be a type error, not a
// runtime bug):
//   - camelCase on the wire.
//   - timestamps are NESTED under `metadata` (never top-level).
//   - `description` is "" when empty, NEVER null.
//   - `status` is a constrained set kept in sync with the DB CHECK + Go service (AD-8).
//   - `GET /todos` returns a bare array, `[]` (never null) when empty.

/** Allowed todo lifecycle states (AD-8). Extend this list to add a state. */
export const TODO_STATUSES = ['active', 'completed'] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

/** Server-managed timestamps, RFC3339 UTC with trailing `Z`, second precision (AD-7). */
export interface TodoMetadata {
  /** e.g. "2026-07-17T14:03:11Z" */
  createdAt: string;
  /** e.g. "2026-07-17T14:03:11Z" — updates on every create/edit/status change */
  updatedAt: string;
}

/** The canonical todo resource as it appears on the wire (AD-6). */
export interface Todo {
  /** server/DB-generated UUID v4 (AD-7) */
  id: string;
  /** required, ≤200 code points after trim (AD-10) */
  title: string;
  /** optional, ≤2000 code points after trim; "" when empty, never null (AD-10) */
  description: string;
  status: TodoStatus;
  metadata: TodoMetadata;
}

/** `POST /todos` request body. Server assigns id/status/metadata and ignores any client-supplied copies. */
export interface CreateTodoRequest {
  title: string;
  description?: string;
}

/** `PATCH /todos/:id` request body. Send ONLY changed fields; an absent field means unchanged (AD-6). */
export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  status?: TodoStatus;
}

/** Uniform error envelope for every non-2xx response (AD-9). */
export interface ApiError {
  error: {
    code: 'validation_error' | 'not_found' | 'internal_error';
    message: string;
  };
}
