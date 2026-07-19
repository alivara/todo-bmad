import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Todo } from '@shared/todo';
import { TodoRow } from '@/app/components/TodoRow';
import { PendingDeleteProvider } from '@/lib/pendingDelete';

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
  // TodoRow now hosts the quiet ✕ (Story 2.3), which reads the pending-delete controller — so the
  // row must render inside a PendingDeleteProvider (itself inside the QueryClientProvider).
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <PendingDeleteProvider>{children}</PendingDeleteProvider>
    </QueryClientProvider>
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

  // Story 2.2 — inline edit-in-place.

  // AC: tapping the title turns the row into an inline editor with the title field seeded, the
  // always-rendered description field (locked placeholder), and the locked hint line.
  it('tapping the title opens the inline editor with the seeded field, placeholder, and hint', () => {
    renderRow(makeTodo({ id: 'id-1', title: 'Email Sam the Q3 numbers', description: '' }));

    fireEvent.click(screen.getByText('Email Sam the Q3 numbers'));

    // Title field seeded; the description field always renders (with the locked placeholder), so a
    // description-less todo can gain one.
    expect(screen.getByRole('textbox', { name: 'Edit title' })).toHaveValue('Email Sam the Q3 numbers');
    expect(screen.getByPlaceholderText('Add a description (optional)')).toBeInTheDocument();
    // Locked microcopy verbatim (middle-dot · U+00B7).
    expect(screen.getByText('Enter to save · Esc to cancel')).toBeInTheDocument();
  });

  // AC: an editor opened and confirmed with nothing changed issues NO PATCH (AD-6 crux).
  it('a no-op edit (nothing changed) issues no PATCH and closes the editor', async () => {
    renderRow(makeTodo({ id: 'id-1', title: 'Email Sam the Q3 numbers', description: 'Attach the deck' }));

    fireEvent.click(screen.getByText('Email Sam the Q3 numbers'));
    const titleInput = screen.getByRole('textbox', { name: 'Edit title' });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    await Promise.resolve();
    expect(patchCalls(fetchMock)).toHaveLength(0);
    // Editor closed: the display title is back (no title field).
    expect(screen.queryByRole('textbox', { name: 'Edit title' })).not.toBeInTheDocument();
    expect(screen.getByText('Email Sam the Q3 numbers')).toBeInTheDocument();
  });

  // AC: a whitespace-only delta that trims to no change is also a no-op → no PATCH.
  it('a whitespace-only title delta trims to a no-op and issues no PATCH', async () => {
    renderRow(makeTodo({ id: 'id-1', title: 'Email Sam the Q3 numbers', description: '' }));

    fireEvent.click(screen.getByText('Email Sam the Q3 numbers'));
    const titleInput = screen.getByRole('textbox', { name: 'Edit title' });
    fireEvent.change(titleInput, { target: { value: '  Email Sam the Q3 numbers  ' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    await Promise.resolve();
    expect(patchCalls(fetchMock)).toHaveLength(0);
  });

  // AC: an edit that empties the title is rejected — it reverts to the prior title, no PATCH.
  it('an empty-title save reverts to the prior title and issues no PATCH', async () => {
    renderRow(makeTodo({ id: 'id-1', title: 'Email Sam the Q3 numbers', description: '' }));

    fireEvent.click(screen.getByText('Email Sam the Q3 numbers'));
    const titleInput = screen.getByRole('textbox', { name: 'Edit title' });
    fireEvent.change(titleInput, { target: { value: '   ' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    await Promise.resolve();
    expect(patchCalls(fetchMock)).toHaveLength(0);
    // Reverted to the prior title (editor closed).
    expect(screen.getByText('Email Sam the Q3 numbers')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Edit title' })).not.toBeInTheDocument();
  });

  // AC: Esc reverts both fields and closes, no PATCH.
  it('Esc reverts the draft and closes the editor without a PATCH', async () => {
    renderRow(makeTodo({ id: 'id-1', title: 'Email Sam the Q3 numbers', description: '' }));

    fireEvent.click(screen.getByText('Email Sam the Q3 numbers'));
    const titleInput = screen.getByRole('textbox', { name: 'Edit title' });
    fireEvent.change(titleInput, { target: { value: 'Totally different' } });
    fireEvent.keyDown(titleInput, { key: 'Escape' });

    await Promise.resolve();
    expect(patchCalls(fetchMock)).toHaveLength(0);
    // Reverted to the prior title; the changed draft is discarded.
    expect(screen.getByText('Email Sam the Q3 numbers')).toBeInTheDocument();
    expect(screen.queryByText('Totally different')).not.toBeInTheDocument();
  });

  // AC: clearing the description is a valid, persisted change — sends description:"" with the
  // title OMITTED (unchanged, never a zero-value overwrite — AD-6).
  it('clearing the description PATCHes {description:""} with the title omitted', async () => {
    renderRow(makeTodo({ id: 'id-1', title: 'Email Sam the Q3 numbers', description: 'Attach the deck' }));

    // Enter edit by tapping the description text.
    fireEvent.click(screen.getByText('Attach the deck'));
    const descInput = screen.getByRole('textbox', { name: 'Edit description' });
    fireEvent.change(descInput, { target: { value: '' } });
    // Save the whole editor via Enter in the title (which saves), title left unchanged.
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit title' }), { key: 'Enter' });

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    const [url, init] = patchCalls(fetchMock)[0];
    expect(url).toBe('/api/todos/id-1');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ description: '' });
    // The intentional clear key is PRESENT; the unchanged title is absent.
    expect(Object.prototype.hasOwnProperty.call(body, 'description')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(body, 'title')).toBe(false);
  });

  // AC: a changed title saves the changed field only (description omitted, left intact).
  it('editing the title PATCHes {title} only (description omitted)', async () => {
    renderRow(makeTodo({ id: 'id-1', title: 'Email Sam the Q3 numbers', description: 'Attach the deck' }));

    fireEvent.click(screen.getByText('Email Sam the Q3 numbers'));
    const titleInput = screen.getByRole('textbox', { name: 'Edit title' });
    fireEvent.change(titleInput, { target: { value: 'Email Sam the Q4 numbers' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    const body = JSON.parse((patchCalls(fetchMock)[0][1] as RequestInit).body as string);
    expect(body).toEqual({ title: 'Email Sam the Q4 numbers' });
    expect(Object.prototype.hasOwnProperty.call(body, 'description')).toBe(false);
  });

  // RD-3: an over-cap title blocks the save (editor stays open, no PATCH) until back within cap.
  it('blocks the save while the title is over the 200 code-point cap', async () => {
    renderRow(makeTodo({ id: 'id-1', title: 'Email Sam the Q3 numbers', description: '' }));

    fireEvent.click(screen.getByText('Email Sam the Q3 numbers'));
    const titleInput = screen.getByRole('textbox', { name: 'Edit title' });
    fireEvent.change(titleInput, { target: { value: 'a'.repeat(201) } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    await Promise.resolve();
    expect(patchCalls(fetchMock)).toHaveLength(0);
    // Editor stays open so the user can trim back within the cap.
    expect(screen.getByRole('textbox', { name: 'Edit title' })).toBeInTheDocument();
  });

  // Keyboard entry (review P1): the title is a focusable control, openable with Enter — a
  // keyboard-only user can reach edit mode, not just a pointer.
  it('opens the editor from the keyboard (Enter on the focusable title)', () => {
    renderRow(makeTodo({ id: 'id-1', title: 'Email Sam the Q3 numbers', description: '' }));

    fireEvent.keyDown(screen.getByRole('button', { name: 'Email Sam the Q3 numbers' }), { key: 'Enter' });

    expect(screen.getByRole('textbox', { name: 'Edit title' })).toBeInTheDocument();
  });

  // Editor-scoped blur (review P3): moving focus WITHIN the editor (title → description) must
  // not save or close — only a blur that leaves the whole editor commits.
  it('blurring from the title to the description (within the editor) does not save or close', async () => {
    renderRow(makeTodo({ id: 'id-1', title: 'Email Sam the Q3 numbers', description: 'Attach the deck' }));

    fireEvent.click(screen.getByText('Email Sam the Q3 numbers'));
    const titleInput = screen.getByRole('textbox', { name: 'Edit title' });
    const descInput = screen.getByRole('textbox', { name: 'Edit description' });
    fireEvent.change(titleInput, { target: { value: 'Changed title' } });
    fireEvent.focusOut(titleInput, { relatedTarget: descInput });

    await Promise.resolve();
    expect(patchCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByRole('textbox', { name: 'Edit title' })).toBeInTheDocument();
  });

  it('blurring out of the editor saves the changed field', async () => {
    renderRow(makeTodo({ id: 'id-1', title: 'Email Sam the Q3 numbers', description: '' }));

    fireEvent.click(screen.getByText('Email Sam the Q3 numbers'));
    const titleInput = screen.getByRole('textbox', { name: 'Edit title' });
    fireEvent.change(titleInput, { target: { value: 'Renamed task' } });
    fireEvent.focusOut(titleInput, { relatedTarget: document.body });

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    const body = JSON.parse((patchCalls(fetchMock)[0][1] as RequestInit).body as string);
    expect(body).toEqual({ title: 'Renamed task' });
  });
});
