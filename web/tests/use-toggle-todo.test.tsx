import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Todo } from '@shared/todo';
import { fetchTodos, todosQueryKey } from '@/lib/todos';
import { useToggleTodo } from '@/lib/useToggleTodo';

// Story 2.1 mutation core (AD-4): the optimistic toggle flips status by id in the cache in
// ≤100ms and, on a 5xx, rolls back VISIBLY to the prior status (id-based, not a whole-list
// snapshot). Mirrors the useCreateTodo rollback coverage. Network is mocked; a list bound to
// the same query cache reflects the cache state.

const ACTIVE: Todo = {
  id: 'todo-1',
  title: 'Ship the toggle',
  description: '',
  status: 'active',
  metadata: { createdAt: '2026-07-17T14:03:11Z', updatedAt: '2026-07-17T14:03:11Z' },
};

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

// A harness rendering the cache-bound list plus a toggle trigger. The status text mirrors the
// cache, so an optimistic flip / rollback is directly observable.
function Harness() {
  const { data } = useQuery({ queryKey: todosQueryKey, queryFn: fetchTodos });
  const toggle = useToggleTodo();
  const todo = data?.[0];
  return (
    <div>
      {todo && <span data-status>{`status:${todo.status}`}</span>}
      <button type="button" onClick={() => todo && toggle.mutate({ id: todo.id, status: 'completed' })}>
        toggle
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

describe('useToggleTodo', () => {
  it('flips status optimistically in the cache before the server settles', async () => {
    // GET returns the active row; hold the PATCH pending so the optimistic state is observable
    // without a settle/refetch overwriting it.
    let releasePatch!: () => void;
    const patchGate = new Promise<void>((r) => {
      releasePatch = r;
    });
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PATCH') {
        await patchGate;
        return { ok: true, status: 200, json: async () => ({ ...ACTIVE, status: 'completed' }) };
      }
      return { ok: true, status: 200, json: async () => [ACTIVE] };
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<Harness />, { wrapper: wrapper(client) });

    await waitFor(() => expect(screen.getByText('status:active')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    // Optimistic flip lands while the PATCH is still in flight (≤100ms, motion-independent).
    await waitFor(() => expect(screen.getByText('status:completed')).toBeInTheDocument());

    releasePatch();
    await waitFor(() => expect(screen.getByText('status:completed')).toBeInTheDocument());
  });

  it('rolls back visibly to the prior status when the server rejects the toggle (5xx)', async () => {
    let releasePatch!: () => void;
    const patchGate = new Promise<void>((r) => {
      releasePatch = r;
    });
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PATCH') {
        await patchGate; // hold so the optimistic completed state is observable first
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { code: 'internal_error', message: 'boom' } }),
        };
      }
      // Server truth stays active (the toggle never persisted).
      return { ok: true, status: 200, json: async () => [ACTIVE] };
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<Harness />, { wrapper: wrapper(client) });

    await waitFor(() => expect(screen.getByText('status:active')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    // Optimistically flips to completed...
    await waitFor(() => expect(screen.getByText('status:completed')).toBeInTheDocument());

    // ...then the server rejects, and it flips back visibly to the prior (active) status.
    releasePatch();
    await waitFor(() => expect(screen.getByText('status:active')).toBeInTheDocument());
  });

  // Proves the rollback is id-SCOPED, not a whole-list snapshot restore: a failed toggle of row
  // A must not clobber a sibling row B that was toggled concurrently and already settled. (A
  // single-row harness can't distinguish these; a regression to snapshot-restore would pass it.)
  it('a failed toggle rolls back only its own row, not a concurrently-toggled sibling', async () => {
    const ROW_A: Todo = { ...ACTIVE, id: 'a', title: 'A' };
    const ROW_B: Todo = { ...ACTIVE, id: 'b', title: 'B' };
    let releaseA!: () => void;
    const gateA = new Promise<void>((r) => {
      releaseA = r;
    });

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PATCH') {
        if (url.endsWith('/a')) {
          await gateA; // hold A so it fails AFTER B has settled
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: { code: 'internal_error', message: 'boom' } }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ ...ROW_B, status: 'completed' }) };
      }
      // Reconcile GET (server truth: A never persisted, B did).
      return { ok: true, status: 200, json: async () => [ROW_A, { ...ROW_B, status: 'completed' }] };
    });

    function MultiHarness() {
      const { data } = useQuery({ queryKey: todosQueryKey, queryFn: fetchTodos });
      const toggle = useToggleTodo();
      return (
        <div>
          {(data ?? []).map((t) => (
            <span key={t.id}>{`${t.id}:${t.status}`}</span>
          ))}
          <button type="button" onClick={() => toggle.mutate({ id: 'a', status: 'completed' })}>
            toggle-a
          </button>
          <button type="button" onClick={() => toggle.mutate({ id: 'b', status: 'completed' })}>
            toggle-b
          </button>
        </div>
      );
    }

    // Seed the cache and hold it fresh (staleTime Infinity) so mount doesn't fire an initial
    // GET — the only GET is the post-failure reconcile.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(todosQueryKey, [ROW_A, ROW_B]);
    render(<MultiHarness />, { wrapper: wrapper(client) });

    await waitFor(() => expect(screen.getByText('a:active')).toBeInTheDocument());

    // Toggle A (its PATCH is held and will fail), then toggle B (succeeds).
    fireEvent.click(screen.getByRole('button', { name: 'toggle-a' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle-b' }));

    // B settles to completed (server row swapped in by id).
    await waitFor(() => expect(screen.getByText('b:completed')).toBeInTheDocument());

    // Now fail A: its id-scoped rollback restores ONLY A to active, leaving B completed.
    releaseA();
    await waitFor(() => expect(screen.getByText('a:active')).toBeInTheDocument());
    expect(screen.getByText('b:completed')).toBeInTheDocument();
  });

  // AC3 spans "5xx / network / timeout"; the 5xx path is covered above. This pins the NETWORK
  // class: fetch itself rejects (no Response object), so todos.ts never inspects res.ok — the
  // mutationFn throws and the same onError rollback must fire, flipping the row back visibly.
  it('rolls back visibly when the toggle fails with a network error (fetch rejects, no response)', async () => {
    let releasePatch!: () => void;
    const patchGate = new Promise<void>((r) => {
      releasePatch = r;
    });
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PATCH') {
        await patchGate; // hold so the optimistic completed state is observable first
        throw new TypeError('Failed to fetch'); // network-layer failure / aborted request
      }
      // Server truth stays active (the toggle never persisted).
      return { ok: true, status: 200, json: async () => [ACTIVE] };
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<Harness />, { wrapper: wrapper(client) });

    await waitFor(() => expect(screen.getByText('status:active')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    // Optimistically flips to completed...
    await waitFor(() => expect(screen.getByText('status:completed')).toBeInTheDocument());

    // ...then the network error triggers the same visible rollback to the prior (active) status.
    releasePatch();
    await waitFor(() => expect(screen.getByText('status:active')).toBeInTheDocument());
  });
});
