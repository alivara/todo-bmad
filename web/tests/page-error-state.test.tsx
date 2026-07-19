import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import HomePage from '@/app/page';
import { PendingDeleteProvider } from '@/lib/pendingDelete';

/**
 * Story 3.2 — the warm, de-escalated load-failure state. When the initial GET /todos fails, the
 * page shows a NEUTRAL glyph (no red), the upsized headline, the LOCKED reassuring subline, and a
 * solid accent `Try again` that re-issues the request (refetch). Locators are scoped to the
 * role="alert" region so they never match Next's route-announcer alert (the 3.1 strict-mode class
 * of bug).
 */

function getFetchUrl(call: unknown[]): string {
  return String(call[0]);
}

function renderPage() {
  // retry:false so the failing query surfaces isError immediately (no backoff retries).
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <PendingDeleteProvider>{children}</PendingDeleteProvider>
    </QueryClientProvider>
  );
  return render(<HomePage />, { wrapper });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // GET /todos fails with a 5xx (a retryable, "our fault" class) so the load-error branch renders.
  fetchMock = vi.fn(async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: { code: 'internal_error', message: 'boom' } }),
  }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('HomePage load-error state', () => {
  it('renders the upsized headline and the locked reassuring subline', async () => {
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText("Couldn't load your tasks")).toBeInTheDocument();
    expect(
      within(alert).getByText("Something got in the way. Your tasks are safe — let's try that again."),
    ).toBeInTheDocument();
  });

  it('uses a NEUTRAL glyph (ink-secondary stroke, never red / accent)', async () => {
    const { container } = renderPage();
    await screen.findByRole('alert');
    const svg = container.querySelector('[role="alert"] svg');
    expect(svg).not.toBeNull();
    // The refresh arrow is stroked with the neutral ink token — NOT the terracotta accent, and
    // categorically not a raw red/alarm color.
    expect(svg?.getAttribute('stroke')).toBe('var(--ink-secondary)');
    expect(svg?.getAttribute('stroke')).not.toBe('var(--accent)');
    expect((svg?.getAttribute('stroke') ?? '').toLowerCase()).not.toMatch(/red|#f|#e0|rgb/);
  });

  it('Try again re-issues GET /todos (refetch)', async () => {
    renderPage();
    const alert = await screen.findByRole('alert');

    const getCalls = () => fetchMock.mock.calls.filter((c) => getFetchUrl(c) === '/api/todos');
    // The initial mount issued exactly one (failed) GET.
    await waitFor(() => expect(getCalls().length).toBe(1));

    fireEvent.click(within(alert).getByRole('button', { name: /try again/i }));

    // Clicking Try again re-issues the same GET.
    await waitFor(() => expect(getCalls().length).toBe(2));
  });
});
