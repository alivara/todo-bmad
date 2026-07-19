import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AddInput } from '@/app/components/AddInput';
import { fetchTodos, todosQueryKey } from '@/lib/todos';

// Unit coverage for the add-input's client-side rules (AD-10 mirror) and the double-add
// guard (AC5). The network is mocked; we assert on POST calls only (an invalidate GET has
// no active observer here, but filtering keeps the count unambiguous).

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function postCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 201,
    json: async () => ({
      id: 'server-uuid',
      title: 'x',
      description: '',
      status: 'active',
      metadata: { createdAt: '2026-07-17T14:03:11Z', updatedAt: '2026-07-17T14:03:11Z' },
    }),
  }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AddInput', () => {
  it('rejects a whitespace-only title inline and sends no request (AC3)', async () => {
    const client = new QueryClient();
    render(<AddInput />, { wrapper: wrapper(client) });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form')!);

    await Promise.resolve();
    expect(postCalls(fetchMock)).toHaveLength(0);
    expect(input).toHaveFocus();
  });

  it('submits a trimmed title once and clears the input (AC1)', async () => {
    const client = new QueryClient();
    render(<AddInput />, { wrapper: wrapper(client) });

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  Email Sam the Q3 numbers  ' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(1));
    const [url, init] = postCalls(fetchMock)[0];
    expect(url).toBe('/api/todos');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ title: 'Email Sam the Q3 numbers' });
    expect(input.value).toBe('');
  });

  it('guards against a double-add: two Enters with no keystroke between → one request (AC5)', async () => {
    const client = new QueryClient();
    render(<AddInput />, { wrapper: wrapper(client) });

    const input = screen.getByRole('textbox');
    const form = input.closest('form')!;
    fireEvent.change(input, { target: { value: 'Book dentist' } });
    fireEvent.submit(form);
    fireEvent.submit(form); // rapid second Enter, no intervening change

    await waitFor(() => expect(postCalls(fetchMock).length).toBeGreaterThanOrEqual(1));
    expect(postCalls(fetchMock)).toHaveLength(1);
  });

  it('blocks submit while over the 200 code-point cap (RD-3)', async () => {
    const client = new QueryClient();
    render(<AddInput />, { wrapper: wrapper(client) });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'a'.repeat(201) } });
    fireEvent.submit(input.closest('form')!);

    await Promise.resolve();
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  // Story 3.3 — progressive counter: hidden at rest, appears within 20 of the cap.
  it('hides the char counter for a short title (RD-2)', () => {
    const client = new QueryClient();
    render(<AddInput />, { wrapper: wrapper(client) });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Book dentist' } });
    expect(screen.queryByText('/ 200', { exact: false })).not.toBeInTheDocument();
  });

  it('shows the accent-bold counter as the title nears the 200 cap (RD-2)', () => {
    const client = new QueryClient();
    render(<AddInput />, { wrapper: wrapper(client) });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a'.repeat(184) } });
    const current = screen.getByText('184');
    expect(current).toHaveStyle({ color: 'var(--accent)', fontWeight: 700 });
    expect(screen.getByText('/ 200', { exact: false })).toBeInTheDocument();
  });

  it('shows the overage over cap while the submit stays blocked (RD-3 unchanged)', async () => {
    const client = new QueryClient();
    render(<AddInput />, { wrapper: wrapper(client) });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'a'.repeat(201) } });
    // The counter conveys "over" via the overage number, not a red token.
    expect(screen.getByText('201')).toBeInTheDocument();
    fireEvent.submit(input.closest('form')!);

    await Promise.resolve();
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  // AC6 / CM2: a rejected add rolls back visibly and shows a non-disruptive error, and
  // the list reconciles to server truth (nothing persisted). Uses the REAL useCreateTodo
  // hook + a list bound to the same query cache.
  it('rolls back the optimistic row and shows an error when the server rejects the add', async () => {
    // GET returns [] (server truth stays empty); POST fails with a 5xx.
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { code: 'internal_error', message: 'boom' } }),
        };
      }
      return { ok: true, status: 200, json: async () => [] };
    });

    function Harness() {
      const { data } = useQuery({ queryKey: todosQueryKey, queryFn: fetchTodos });
      return (
        <>
          <AddInput />
          <ul>
            {(data ?? []).map((t) => (
              <li key={t.id}>{t.title}</li>
            ))}
          </ul>
        </>
      );
    }

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<Harness />, { wrapper: wrapper(client) });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Boom' } });
    fireEvent.submit(input.closest('form')!);

    // The error surfaces (non-disruptive), and the optimistic "Boom" row is gone.
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/something got in the way/i));
    expect(screen.queryByText('Boom')).not.toBeInTheDocument();
  });

  // AD-10 mirror: the cap counts Unicode CODE POINTS, matching Go's utf8.RuneCountInString —
  // not UTF-16 units (`.length`) and not grapheme clusters. These two tests pin that: a
  // regression to `.length` fails the astral-accept case; grapheme-counting fails the ZWJ case.
  it('counts code points, not UTF-16 units: a 200-code-point astral title is accepted (AD-10)', async () => {
    const client = new QueryClient();
    render(<AddInput />, { wrapper: wrapper(client) });

    const input = screen.getByRole('textbox');
    // 200 emoji = 200 code points but 400 UTF-16 units; `.length` would wrongly block this.
    fireEvent.change(input, { target: { value: '😀'.repeat(200) } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(1));
  });

  it('counts a multi-code-point ZWJ grapheme as more than one and blocks over-cap (AC4/AD-10)', async () => {
    const client = new QueryClient();
    render(<AddInput />, { wrapper: wrapper(client) });

    const input = screen.getByRole('textbox');
    // Family emoji = 5 code points (👨‍👩‍👧). 196 ASCII + 5 = 201 → over the 200 cap → blocked.
    // If it were counted as a single grapheme (197), the submit would wrongly go through.
    const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
    fireEvent.change(input, { target: { value: 'a'.repeat(196) + family } });
    fireEvent.submit(input.closest('form')!);

    await Promise.resolve();
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  // Concurrency (rapid type-Enter-type-Enter, UX-DR22): two overlapping adds where one
  // fails. The failing add's rollback must remove ONLY its own row — a whole-list snapshot
  // restore would revert the sibling add that already swapped in its server row. The GET
  // reconcile is gated so the post-rollback cache state is observable (the bug is a transient
  // that self-heals on refetch, so a final-state assertion alone would not catch it).
  it('a failed concurrent add rolls back only its own row, not a sibling add (concurrency)', async () => {
    const keepServer = {
      id: 'server-keep',
      title: 'Keep',
      description: '',
      status: 'active',
      metadata: { createdAt: '2026-07-17T14:03:11Z', updatedAt: '2026-07-17T14:03:11Z' },
    };
    let releaseDrop!: () => void;
    const dropGate = new Promise<void>((r) => {
      releaseDrop = r;
    });
    let releaseGet!: () => void;
    const getGate = new Promise<void>((r) => {
      releaseGet = r;
    });

    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST') {
        const body = JSON.parse((init as RequestInit).body as string) as { title: string };
        if (body.title === 'Drop') {
          await dropGate; // hold the failing add until Keep has swapped in its server row
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: { code: 'internal_error', message: 'boom' } }),
          };
        }
        return { ok: true, status: 201, json: async () => keepServer };
      }
      await getGate; // hold reconcile GETs so the post-rollback cache state stays observable
      return { ok: true, status: 200, json: async () => [keepServer] };
    });

    function Harness() {
      const { data } = useQuery({ queryKey: todosQueryKey, queryFn: fetchTodos });
      return (
        <>
          <AddInput />
          <ul>
            {(data ?? []).map((t) => (
              <li key={t.id}>{`${t.title}:${t.id}`}</li>
            ))}
          </ul>
        </>
      );
    }

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<Harness />, { wrapper: wrapper(client) });

    const input = screen.getByRole('textbox');
    const form = input.closest('form')!;
    // Two overlapping adds; the keystroke between them re-arms the double-add guard.
    fireEvent.change(input, { target: { value: 'Keep' } });
    fireEvent.submit(form);
    fireEvent.change(input, { target: { value: 'Drop' } });
    fireEvent.submit(form);

    // Keep resolves first: its temp id is swapped for the real server UUID.
    await waitFor(() => expect(screen.getByText('Keep:server-keep')).toBeInTheDocument());

    // Let the concurrent add fail. Its id-scoped rollback removes only "Drop"; "Keep" stays.
    releaseDrop();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText(/^Drop:/)).not.toBeInTheDocument());
    expect(screen.getByText('Keep:server-keep')).toBeInTheDocument();

    releaseGet(); // release the gated reconcile GET for a clean teardown
    await waitFor(() => expect(screen.getByText('Keep:server-keep')).toBeInTheDocument());
  });
});
