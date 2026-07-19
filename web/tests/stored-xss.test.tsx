import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Todo } from '@shared/todo';
import { TodoRow } from '@/app/components/TodoRow';
import { PendingDeleteProvider } from '@/lib/pendingDelete';

/**
 * Stored-XSS regression lock (Story 3.5, SEC-1b). React output-escaping is the sole XSS control for
 * stored todo text; this pins that a title/description containing an HTML payload renders as ESCAPED
 * TEXT — never a live DOM node. A future refactor to a raw-HTML sink (dangerouslySetInnerHTML) would
 * make this fail loudly. Reuses the todo-row.test.tsx renderRow idiom (QueryClientProvider →
 * PendingDeleteProvider → TodoRow).
 */

const OLD_CREATED = '2020-01-15T00:00:00Z';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'id-xss',
    title: 'Email Sam the Q3 numbers',
    description: '',
    status: 'active',
    metadata: { createdAt: OLD_CREATED, updatedAt: OLD_CREATED },
    ...overrides,
  };
}

function renderRow(todo: Todo) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <PendingDeleteProvider>{children}</PendingDeleteProvider>
    </QueryClientProvider>
  );
  return render(<TodoRow todo={todo} />, { wrapper });
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => makeTodo() })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('stored XSS — React escaping', () => {
  it('renders an HTML payload in title/description as escaped text, not a live element', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const { container } = renderRow(makeTodo({ title: payload, description: payload }));

    // The payload shows up verbatim as text content (title + description) …
    expect(screen.getAllByText(payload).length).toBeGreaterThan(0);
    // … and NOT as a parsed <img> or any element carrying an inline onerror handler.
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
  });
});
