import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Todo, UpdateTodoRequest } from '@shared/todo';
import { fetchTodos, todosQueryKey } from '@/lib/todos';
import { useUpdateTodo } from '@/lib/useUpdateTodo';

// Story 2.2 mutation core (AD-4): the optimistic field-edit merges the changed fields into the
// row by id in the cache in ≤100ms, sends ONLY those fields via PATCH (AD-6), and on a 5xx rolls
// back VISIBLY restoring BOTH the prior title AND description (id-based, not a whole-list
// snapshot). Mirrors the useToggleTodo rollback coverage. Network is mocked; a list bound to the
// same query cache reflects the cache state.

const ROW: Todo = {
  id: 'todo-1',
  title: 'Original title',
  description: 'Original description',
  status: 'active',
  metadata: { createdAt: '2026-07-17T14:03:11Z', updatedAt: '2026-07-17T14:03:11Z' },
};

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function patchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
}

// A harness rendering the cache-bound row plus an edit trigger with a caller-supplied patch, so
// an optimistic merge / rollback is directly observable through the rendered title/description.
function Harness({ patch }: { patch: UpdateTodoRequest }) {
  const { data } = useQuery({ queryKey: todosQueryKey, queryFn: fetchTodos });
  const update = useUpdateTodo();
  const todo = data?.[0];
  return (
    <div>
      {todo && <span>{`title:${todo.title}|desc:${todo.description}`}</span>}
      <button type="button" onClick={() => todo && update.mutate({ id: todo.id, patch })}>
        edit
      </button>
    </div>
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useUpdateTodo', () => {
  it('applies a title edit optimistically and PATCHes only the changed field', async () => {
    let releasePatch!: () => void;
    const patchGate = new Promise<void>((r) => {
      releasePatch = r;
    });
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PATCH') {
        await patchGate; // hold so the optimistic state is observable before settle
        return { ok: true, status: 200, json: async () => ({ ...ROW, title: 'New title' }) };
      }
      return { ok: true, status: 200, json: async () => [ROW] };
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<Harness patch={{ title: 'New title' }} />, { wrapper: wrapper(client) });

    await waitFor(() =>
      expect(screen.getByText('title:Original title|desc:Original description')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'edit' }));

    // Optimistic merge lands while the PATCH is in flight (title changed, description intact).
    await waitFor(() =>
      expect(screen.getByText('title:New title|desc:Original description')).toBeInTheDocument(),
    );

    // Only the changed field went on the wire (AD-6): { title } — description omitted.
    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    const [url, init] = patchCalls(fetchMock)[0];
    expect(url).toBe('/api/todos/todo-1');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ title: 'New title' });

    releasePatch();
    await waitFor(() =>
      expect(screen.getByText('title:New title|desc:Original description')).toBeInTheDocument(),
    );
  });

  it('clears a description by sending description:"" (key present, empty)', async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PATCH') {
        return { ok: true, status: 200, json: async () => ({ ...ROW, description: '' }) };
      }
      return { ok: true, status: 200, json: async () => [ROW] };
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<Harness patch={{ description: '' }} />, { wrapper: wrapper(client) });

    await waitFor(() =>
      expect(screen.getByText('title:Original title|desc:Original description')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'edit' }));

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    const body = JSON.parse((patchCalls(fetchMock)[0][1] as RequestInit).body as string);
    // The intentional clear: description key PRESENT and empty (not omitted, not null).
    expect(body).toEqual({ description: '' });
    expect(Object.prototype.hasOwnProperty.call(body, 'description')).toBe(true);
  });

  it('rolls back BOTH title and description visibly when the server rejects the edit (5xx)', async () => {
    let releasePatch!: () => void;
    const patchGate = new Promise<void>((r) => {
      releasePatch = r;
    });
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PATCH') {
        await patchGate;
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { code: 'internal_error', message: 'boom' } }),
        };
      }
      // Server truth stays the original row (the edit never persisted).
      return { ok: true, status: 200, json: async () => [ROW] };
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Change both fields so a snapshot-clobbering regression (restoring only one) is caught.
    render(<Harness patch={{ title: 'New title', description: 'New description' }} />, {
      wrapper: wrapper(client),
    });

    await waitFor(() =>
      expect(screen.getByText('title:Original title|desc:Original description')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'edit' }));

    // Optimistically both fields change...
    await waitFor(() => expect(screen.getByText('title:New title|desc:New description')).toBeInTheDocument());

    // ...then the server rejects, and BOTH revert visibly to their prior values.
    releasePatch();
    await waitFor(() =>
      expect(screen.getByText('title:Original title|desc:Original description')).toBeInTheDocument(),
    );
  });
});
