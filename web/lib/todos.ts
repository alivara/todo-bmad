import type { CreateTodoRequest, Todo } from '@shared/todo';

// The single query key for the todo list. TanStack Query owns this cache (AD-4).
export const todosQueryKey = ['todos'] as const;

/**
 * Fetches the todo list from the same-origin dumb proxy (AD-3), which forwards to
 * the internal api. Returns the bare array (AD-6). A non-2xx response throws so
 * TanStack Query surfaces the error state (the polished 4xx/5xx split lands in Epic 3).
 */
export async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch('/api/todos', {
    headers: { accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to load todos (status ${res.status})`);
  }

  return (await res.json()) as Todo[];
}

/**
 * Creates a todo via the same-origin dumb proxy (AD-3) → `POST /api/todos`. The server
 * assigns id/status/timestamps and returns the full AD-6 resource in the `201` body,
 * which the caller uses to swap the optimistic temp id (AD-7). A non-2xx response throws
 * so the mutation's `onError` fires and the optimistic row rolls back.
 */
export async function createTodo(input: CreateTodoRequest): Promise<Todo> {
  const res = await fetch('/api/todos', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Failed to create todo (status ${res.status})`);
  }

  return (await res.json()) as Todo;
}
