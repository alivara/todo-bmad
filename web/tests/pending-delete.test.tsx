import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Todo } from '@shared/todo';
import { fetchTodos, todosQueryKey } from '@/lib/todos';
import { PendingDeleteProvider, usePendingDelete, type PendingDeleteContextValue } from '@/lib/pendingDelete';

// Story 2.3 pending-delete controller (AD-5), re-architected to a suppressed-id-set model: the
// TanStack cache ALWAYS holds server truth, and a suppressed-id set drives visibility via the list
// query's `select` filter. Activating a delete suppresses the row (NO cache mutation, NO network)
// and starts a client-owned 5000ms timer; undo un-suppresses it (it reappears from the intact
// cache); on elapse the real DELETE fires (204/404 = success, then the row is dropped from the
// cache permanently); a 5xx un-suppresses (row reappears) + surfaces a scoped retryable error. The
// harness mirrors prod: a list bound to `useQuery` with the SAME `select` filter, and a QueryClient
// with the prod staleTime (5000, not Infinity) so a refetch during the window is a real test of
// suppression. Network is mocked; fake timers drive the window deterministically.

function todo(id: string, title: string): Todo {
  return {
    id,
    title,
    description: '',
    status: 'active',
    metadata: { createdAt: '2026-07-19T10:00:00Z', updatedAt: '2026-07-19T10:00:00Z' },
  };
}

// Newest-first list (server order); B is the middle row, used to prove restore-IN-PLACE.
const A = todo('a', 'Alpha');
const B = todo('b', 'Bravo');
const C = todo('c', 'Charlie');
const SEED = [A, B, C];

let fetchMock: ReturnType<typeof vi.fn>;
// Every DELETE url the mock observed (proves no commit fires during the window / after undo).
let deleteCalls: string[];
// Controls the DELETE response the commit sees (204 success / 404 already-gone / 500 failure).
let deleteResponse: () => { ok: boolean; status: number };

// Captured controller handle so a test can call undo() programmatically (the post-dispatch race,
// where the Undo button is already gone from the DOM).
let controller: PendingDeleteContextValue;
function Capture() {
  controller = usePendingDelete();
  return null;
}

// A cache-bound harness that mirrors prod: the list is a `useQuery` with the SAME suppression
// `select` filter, so pending ids are hidden even though they remain in the cache. The visible
// toast + scoped error mirror UndoToast; undo(id) targets the visible entry.
function Harness() {
  const { isPending, requestDelete, undo, visible, error } = usePendingDelete();
  const { data } = useQuery({
    queryKey: todosQueryKey,
    queryFn: fetchTodos,
    select: (rows) => rows.filter((t) => !isPending(t.id)),
  });

  // Scoped error, exactly as UndoToast computes it: shown only when it owns the visible toast.
  const scopedError = error && visible && error.id === visible.id ? error.message : null;

  return (
    <div>
      {(data ?? []).map((t) => (
        <div key={t.id}>
          <span>{`row:${t.id}`}</span>
          <button type="button" onClick={() => requestDelete(t)}>{`del-${t.id}`}</button>
        </div>
      ))}
      {visible && !scopedError && <span>{`toast:${visible.id}`}</span>}
      {visible && !scopedError && (
        <button type="button" onClick={() => undo(visible.id)}>
          undo
        </button>
      )}
      {scopedError && <span>{`error:${scopedError}`}</span>}
    </div>
  );
}

function renderHarness() {
  // Mirror the prod QueryClient (providers.tsx): staleTime 5000 (NOT Infinity). Seeding the cache
  // right before render keeps the data fresh, so mount fires NO GET — then any fetch observed
  // during the window is a real violation of the "no network during the window" rule, AND a
  // manual refetch mid-window is a genuine test of the suppression filter.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5000 } } });
  client.setQueryData(todosQueryKey, SEED);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <PendingDeleteProvider>
        <Capture />
        {children}
      </PendingDeleteProvider>
    </QueryClientProvider>
  );
  render(<Harness />, { wrapper });
  return client;
}

// Ids currently PRESENT in the cache (server truth) — unaffected by suppression.
function cacheIds(client: QueryClient): string[] {
  return (client.getQueryData<Todo[]>(todosQueryKey) ?? []).map((t) => t.id);
}

// Ids currently VISIBLE in the rendered list (post-suppression `select`) — what the user sees.
function renderedIds(): string[] {
  return SEED.map((t) => t.id).filter((id) => screen.queryByText(`row:${id}`) !== null);
}

beforeEach(() => {
  vi.useFakeTimers();
  deleteCalls = [];
  deleteResponse = () => ({ ok: true, status: 204 });
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'DELETE') {
      deleteCalls.push(url);
      return deleteResponse();
    }
    return { ok: true, status: 200, json: async () => SEED };
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('pending-delete controller', () => {
  it('suppresses the row from the list immediately and fires NO network call during the window', async () => {
    const client = renderHarness();
    expect(screen.getByText('row:b')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'del-b' }));

    // Optimistic suppression + the visible toast, with NO fetch yet. The cache is UNTOUCHED —
    // visibility is driven by the `select` filter, not by removing the row (AD-4).
    expect(screen.queryByText('row:b')).not.toBeInTheDocument();
    expect(screen.getByText('toast:b')).toBeInTheDocument();
    expect(renderedIds()).toEqual(['a', 'c']);
    expect(cacheIds(client)).toEqual(['a', 'b', 'c']);
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance ALMOST to the boundary — still no network call.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a refetch/invalidate DURING the window does NOT resurrect the suppressed row', async () => {
    const client = renderHarness();

    fireEvent.click(screen.getByRole('button', { name: 'del-b' }));
    expect(screen.queryByText('row:b')).not.toBeInTheDocument();

    // A GET lands mid-window with the FULL server list (incl. B) and repopulates the cache — the
    // exact scenario the old "remove from cache" model got wrong. Suppression must keep B hidden.
    await act(async () => {
      await client.invalidateQueries({ queryKey: todosQueryKey });
    });

    expect(fetchMock).toHaveBeenCalled(); // the GET really fired
    expect(cacheIds(client)).toEqual(['a', 'b', 'c']); // B is back in the cache …
    expect(screen.queryByText('row:b')).not.toBeInTheDocument(); // … but still suppressed
    expect(renderedIds()).toEqual(['a', 'c']);
    expect(deleteCalls).toEqual([]); // and no premature commit
  });

  it('undo restores the row IN PLACE and the DELETE never fires', async () => {
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: 'del-b' }));
    expect(renderedIds()).toEqual(['a', 'c']);

    fireEvent.click(screen.getByRole('button', { name: 'undo' }));

    // B is back in the MIDDLE (its natural cache position), not appended — it was never removed.
    expect(renderedIds()).toEqual(['a', 'b', 'c']);
    expect(screen.queryByText('toast:b')).not.toBeInTheDocument();

    // The cancelled timer must never commit — advance well past the window, still no DELETE.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(deleteCalls).toEqual([]);
  });

  it('fires DELETE once on elapse and treats 204 as success (row stays gone, dropped from cache)', async () => {
    const client = renderHarness();

    fireEvent.click(screen.getByRole('button', { name: 'del-b' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(deleteCalls).toEqual(['/api/todos/b']);
    // On a real commit the row is dropped from the cache permanently so it can't flash back.
    expect(cacheIds(client)).toEqual(['a', 'c']);
    expect(renderedIds()).toEqual(['a', 'c']);
    expect(screen.queryByText('toast:b')).not.toBeInTheDocument();
    expect(screen.queryByText(/^error:/)).not.toBeInTheDocument();
  });

  it('treats a commit 404 (already gone) as success — row stays gone, no error', async () => {
    const client = renderHarness();
    deleteResponse = () => ({ ok: false, status: 404 });

    fireEvent.click(screen.getByRole('button', { name: 'del-b' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(deleteCalls).toEqual(['/api/todos/b']);
    expect(cacheIds(client)).toEqual(['a', 'c']);
    expect(renderedIds()).toEqual(['a', 'c']);
    expect(screen.queryByText(/^error:/)).not.toBeInTheDocument();
  });

  it('resurrects the row in place and surfaces the scoped retryable error on a 5xx commit', async () => {
    const client = renderHarness();
    deleteResponse = () => ({ ok: false, status: 500 });

    fireEvent.click(screen.getByRole('button', { name: 'del-b' }));
    expect(renderedIds()).toEqual(['a', 'c']);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // RD-5: un-suppress → B reappears from the intact cache (never removed), and the sanctioned
    // error is shown scoped to B (the visible toast).
    expect(cacheIds(client)).toEqual(['a', 'b', 'c']);
    expect(renderedIds()).toEqual(['a', 'b', 'c']);
    expect(screen.getByText('error:Something got in the way. Try again.')).toBeInTheDocument();

    // The scoped error auto-clears (never sticky) and dismisses its toast.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.queryByText(/^error:/)).not.toBeInTheDocument();
    expect(screen.queryByText('toast:b')).not.toBeInTheDocument();
  });

  it('undo is a NO-OP once the commit has dispatched (undo-vs-elapse race)', async () => {
    const client = renderHarness();

    fireEvent.click(screen.getByRole('button', { name: 'del-b' }));

    // The window elapses → the commit dispatches (204 success), dropping the entry + the row.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(deleteCalls).toEqual(['/api/todos/b']);
    expect(cacheIds(client)).toEqual(['a', 'c']);

    // A late undo for that id must do nothing — the delete is already committed.
    await act(async () => {
      controller.undo('b');
    });
    expect(cacheIds(client)).toEqual(['a', 'c']);
    expect(renderedIds()).toEqual(['a', 'c']);
  });

  it('flushes non-dispatched pending deletes via a keepalive DELETE on pagehide', async () => {
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: 'del-b' }));
    expect(deleteCalls).toEqual([]); // still nothing during the window

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });

    // The pending B is flushed as a keepalive DELETE so a reload/close commits it (AD-5).
    expect(deleteCalls).toEqual(['/api/todos/b']);
    const deleteCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE',
    );
    expect(deleteCall?.[0]).toBe('/api/todos/b');
    expect((deleteCall?.[1] as RequestInit).keepalive).toBe(true);

    // A flushed entry is marked dispatched — its timer can't fire a second DELETE.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(deleteCalls).toEqual(['/api/todos/b']);
  });

  it('RD-4: concurrent deletes each keep their own timer; toast shows the most recent; older commits alone', async () => {
    const client = renderHarness();

    // Delete A, then B 2s later — staggering their 5000ms timers (A@5000, B@7000).
    fireEvent.click(screen.getByRole('button', { name: 'del-a' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'del-b' }));

    // Both suppressed; the toast is the MOST-RECENT (B) and its Undo targets B (RD-4).
    expect(renderedIds()).toEqual(['c']);
    expect(screen.getByText('toast:b')).toBeInTheDocument();

    // Advance to A's boundary (t=5000): A commits alone (DELETE A) while B stays pending + undoable.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(deleteCalls).toEqual(['/api/todos/a']);
    expect(cacheIds(client)).toEqual(['b', 'c']); // A dropped from the cache; B untouched
    expect(screen.getByText('toast:b')).toBeInTheDocument();

    // Undo B before its own timer → B restored in place, DELETE B never fires.
    fireEvent.click(screen.getByRole('button', { name: 'undo' }));
    expect(renderedIds()).toEqual(['b', 'c']);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(deleteCalls).toEqual(['/api/todos/a']);
  });
});
