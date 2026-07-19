import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Todo } from '@shared/todo';
import { TodoRow } from '@/app/components/TodoRow';

// Read-only row anatomy (Story 1.3): title/description/relative-time render, ""-description
// omission, the clamp `more`→expand-in-place→`less` reveal, and completed styling. Locators
// are role/label/text, never test ids.

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

afterEach(cleanup);

describe('TodoRow', () => {
  it('renders the title, description, and RD-1 relative time', () => {
    render(<TodoRow todo={makeTodo({ description: 'Attach the deck' })} />);

    expect(screen.getByText('Email Sam the Q3 numbers')).toBeInTheDocument();
    expect(screen.getByText('Attach the deck')).toBeInTheDocument();
    expect(screen.getByText('Jan 15, 2020')).toBeInTheDocument();
  });

  it('omits the description line entirely when description is "" (never null)', () => {
    const { container } = render(<TodoRow todo={makeTodo({ description: '' })} />);

    // Only the title paragraph is present; no second (description) paragraph.
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(screen.getByText('Email Sam the Q3 numbers')).toBeInTheDocument();
  });

  it('does not offer a reveal affordance for a short description', () => {
    render(<TodoRow todo={makeTodo({ description: 'Short one' })} />);
    expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument();
  });

  it('clamps a long description and expands it in place via more/less (not edit mode)', () => {
    render(<TodoRow todo={makeTodo({ description: LONG_DESCRIPTION })} />);

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
    render(<TodoRow todo={makeTodo({ status: 'active' })} />);
    expect(screen.getByText('Email Sam the Q3 numbers')).not.toHaveStyle({
      textDecoration: 'line-through',
    });
  });

  it('renders a completed row recessed + struck through (read-only, no checkbox)', () => {
    render(<TodoRow todo={makeTodo({ status: 'completed' })} />);

    const title = screen.getByText('Email Sam the Q3 numbers');
    expect(title).toHaveStyle({ textDecoration: 'line-through' });
    // No interactive status control (Epic 2): no checkbox in the read-only row.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
