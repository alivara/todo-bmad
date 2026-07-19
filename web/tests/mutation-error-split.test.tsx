import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AddInput } from '@/app/components/AddInput';

// AC3 (the core split), asserted on a real mutation surface (AddInput / useCreateTodo): a `4xx`
// inlines the server's message with NO retry control; a `5xx` shows the sanctioned copy + a
// Try-again that RE-FIRES the same request (TanStack retains the last variables). The optimistic
// rollback itself is covered by add-input.test.tsx / the hook tests — this pins the CLASS branch.

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function postCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
}

let fetchMock: ReturnType<typeof vi.fn>;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('mutation error split (AC3) on AddInput', () => {
  it('a 4xx inlines the server message and offers NO retry control', async () => {
    // The server rejects with a 400 validation_error carrying a user-facing message (mirror drift).
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { code: 'validation_error', message: 'title is required' } }),
        };
      }
      return { ok: true, status: 200, json: async () => [] };
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(<AddInput />, { wrapper: wrapper(client) });

    const input = screen.getByRole('textbox', { name: 'Add a task' });
    fireEvent.change(input, { target: { value: 'Whatever' } });
    fireEvent.submit(input.closest('form')!);

    // The server message is shown inline...
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('title is required'));
    // ...and there is NO Try-again control (retrying malformed input is futile).
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('a 5xx shows the sanctioned copy + a Try-again that re-fires the same request', async () => {
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { code: 'internal_error', message: 'boom' } }),
        };
      }
      return { ok: true, status: 200, json: async () => [] };
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(<AddInput />, { wrapper: wrapper(client) });

    const input = screen.getByRole('textbox', { name: 'Add a task' });
    fireEvent.change(input, { target: { value: 'Ship it' } });
    fireEvent.submit(input.closest('form')!);

    // Sanctioned 5xx copy + a real Try-again control.
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/something got in the way/i));
    const retry = await screen.findByRole('button', { name: /try again/i });
    expect(postCalls(fetchMock)).toHaveLength(1);

    // Clicking Try-again re-fires the SAME add (variables retained by TanStack) — a second POST.
    fireEvent.click(retry);
    await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(2));
    const body = JSON.parse((postCalls(fetchMock)[1][1] as RequestInit).body as string);
    expect(body).toEqual({ title: 'Ship it' });
  });
});
