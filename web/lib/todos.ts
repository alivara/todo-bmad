import type { CreateTodoRequest, Todo, UpdateTodoRequest } from '@shared/todo';
import { toApiError } from './apiError';

// The single query key for the todo list. TanStack Query owns this cache (AD-4).
export const todosQueryKey = ['todos'] as const;

/**
 * Fetches the todo list from the same-origin dumb proxy (AD-3), which forwards to
 * the internal api. Returns the bare array (AD-6). A non-2xx response throws a typed
 * `ApiError` (status + parsed AD-9 code/message) so the surface can apply the 4xx/5xx split.
 */
export async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch('/api/todos', {
    headers: { accept: 'application/json' },
  });

  if (!res.ok) {
    throw await toApiError(res);
  }

  return (await res.json()) as Todo[];
}

/**
 * Creates a todo via the same-origin dumb proxy (AD-3) → `POST /api/todos`. The server
 * assigns id/status/timestamps and returns the full AD-6 resource in the `201` body,
 * which the caller uses to swap the optimistic temp id (AD-7). A non-2xx response throws a typed
 * `ApiError` so the mutation's `onError` fires (optimistic row rolls back) and the surface can
 * branch on class (a `4xx` inlines the server message; a `5xx`/network offers a retry).
 */
export async function createTodo(input: CreateTodoRequest): Promise<Todo> {
  const res = await fetch('/api/todos', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw await toApiError(res);
  }

  return (await res.json()) as Todo;
}

/**
 * Partially updates a todo via the same-origin dumb proxy (AD-3) → `PATCH /api/todos/{id}`.
 * Sends ONLY the changed fields (AD-6 partial update); the server bumps `updatedAt` and
 * returns the full AD-6 resource in the `200` body, which the caller settles into the cache
 * (AD-7). A non-2xx response throws a typed `ApiError` so the mutation's `onError` fires (the
 * optimistic change rolls back visibly, AD-4) and the surface can branch on class.
 */
export async function updateTodo(id: string, patch: UpdateTodoRequest): Promise<Todo> {
  const res = await fetch(`/api/todos/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    throw await toApiError(res);
  }

  return (await res.json()) as Todo;
}

/**
 * Hard-deletes a todo via the same-origin dumb proxy (AD-3) → `DELETE /api/todos/{id}`. This is
 * the COMMIT that fires when a pending delete's client-owned window elapses (or is flushed on
 * unload) — never during the undo window (AD-5). The server returns `204` on success.
 *
 * A `404` ("already gone") is treated as SUCCESS and resolves, NOT thrown (RD-5) — unlike the
 * other helpers — because a delete of a row the server no longer has is exactly the desired end
 * state. Any OTHER non-2xx (5xx/network) throws a typed `ApiError` so the controller resurrects
 * the row at its natural position (a commit failure here is therefore always the retryable class).
 */
export async function deleteTodo(id: string): Promise<void> {
  const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });

  // 204 (deleted) AND 404 (already gone) are both success — the row is not there, which is what
  // the delete asked for. Only 404 needs an explicit early return since it is not `res.ok`.
  if (res.status === 404) return;

  if (!res.ok) {
    throw await toApiError(res);
  }
}
