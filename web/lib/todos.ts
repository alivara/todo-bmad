import type { Todo } from '@shared/todo';

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
