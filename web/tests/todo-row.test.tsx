import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Todo } from '@shared/todo';
import { TodoRow } from '@/app/components/TodoRow';

// Row anatomy (Story 1.3) + interactive checkbox (Story 2.1): title/description/relative-time
// render, ""-description omission, the clamp `more`→expand-in-place→`less` reveal, completed
// styling, and a REAL semantic checkbox that fires an optimistic toggle PATCH. Locators are
// role/label/text, never test ids. TodoRow now uses useToggleTodo, so it is wrapped in a
// QueryClientProvider; the network is stubbed and PATCH calls are asserted.

// A createdAt years in the past yields a STABLE absolute date regardless of the real
// clock ("Jan 15, 2020"), so the relative-time assertion needs no fake clock.
const OLD_CREATED = '2020-01-15T00:00:00Z';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'id-1',
    title: 'Email Sam the Q3 numbers',
    description: '',
    status: 'active',
    metadata: { createdAt: OLD_CREATED, updatedAt: OLD_CREATED },
    ...overrides,
  };
}

const LONG_DESCRIPTION =
  'This is a deliberately long description that runs well beyond two lines so the row ' +
  'clamps it and offers a more affordance to reveal the full text in place rather than ' +
  'entering any kind of edit mode whatsoever.';

function renderRow(todo: Todo) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<TodoRow todo={todo} />, { wrapper });
}

function patchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Default: PATCH succeeds, echoing a completed row (tests that need failure override this).
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => makeTodo({ status: 'completed' }),
  }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TodoRow', () => {
  it('renders the title, description, and RD-1 relative time', () => {
    renderRow(makeTodo({ description: 'Attach the deck' }));

    expect(screen.getByText('Email Sam the Q3 numbers')).toBeInTheDocument();
    expect(screen.getByText('Attach the deck')).toBeInTheDocument();
    expect(screen.getByText('Jan 15, 2020')).toBeInTheDocument();
  });

  it('omits the description line entirely when description is "" (never null)', () => {
    const { container } = renderRow(makeTodo({ description: '' }));

    // Only the title paragraph is present; no second (description) paragraph.
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(screen.getByText('Email Sam the Q3 numbers')).toBeInTheDocument();
  });

  it('does not offer a reveal affordance for a short description', () => {
    renderRow(makeTodo({ description: 'Short one' }));
    expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument();
  });

  it('clamps a long description and expands it in place via more/less (not edit mode)', () => {
    renderRow(makeTodo({ description: LONG_DESCRIPTION }));

    // Collapsed: the description is clamped and a "more" reveal is offered.
    const description = screen.getByText(LONG_DESCRIPTION);
    expect(description).toHaveStyle({ WebkitLineClamp: '2' });
    const more = screen.getByRole('button', { name: 'more' });
    expect(more).toHaveAttribute('aria-expanded', 'false'); // disclosure state exposed

    // Expand in place: the same text stays, no edit affordance appears, clamp is dropped.
    fireEvent.click(more);
    const less = screen.getByRole('button', { name: 'less' });
    expect(less).toBeInTheDocument();
    expect(less).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: 'more' })).not.toBeInTheDocument();
    expect(screen.getByText(LONG_DESCRIPTION)).not.toHaveStyle({ WebkitLineClamp: '2' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    // Collapse again.
    fireEvent.click(screen.getByRole('button', { name: 'less' }));
    expect(screen.getByRole('button', { name: 'more' })).toBeInTheDocument();
  });

  it('renders an active row without strikethrough', () => {
    renderRow(makeTodo({ status: 'active' }));
    expect(screen.getByText('Email Sam the Q3 numbers')).not.toHaveStyle({
      textDecoration: 'line-through',
    });
  });

  // Story 2.1: the checkbox is a REAL semantic control (role="checkbox") exposing aria-checked.
  it('renders an unchecked checkbox on an active row', () => {
    renderRow(makeTodo({ status: 'active' }));
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });

  it('renders a completed row struck through with a checked checkbox', () => {
    renderRow(makeTodo({ status: 'completed' }));

    const title = screen.getByText('Email Sam the Q3 numbers');
    expect(title).toHaveStyle({ textDecoration: 'line-through' });
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  // AC1: clicking an active row's checkbox fires a PATCH flipping the status to completed.
  it('clicking an active checkbox PATCHes status=completed', async () => {
    renderRow(makeTodo({ id: 'id-1', status: 'active' }));

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    const [url, init] = patchCalls(fetchMock)[0];
    expect(url).toBe('/api/todos/id-1');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ status: 'completed' });
  });

  // AC1: clicking a completed row's checkbox flips it back to active.
  it('clicking a completed checkbox PATCHes status=active', async () => {
    renderRow(makeTodo({ id: 'id-1', status: 'completed' }));

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    const [url, init] = patchCalls(fetchMock)[0];
    expect(url).toBe('/api/todos/id-1');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ status: 'active' });
  });
});
