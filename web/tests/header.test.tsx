import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Header } from '@/app/components/Header';

// Story 3.4: the header renders the wordmark, the theme toggle, and a NON-interactive placeholder
// avatar. The only button is the toggle — the avatar is decorative (not a button, not focusable).
afterEach(() => {
  cleanup();
});

describe('Header', () => {
  it('renders the wordmark', () => {
    render(<Header />);
    expect(screen.getByText('todo')).toBeInTheDocument();
  });

  it('exposes exactly one button — the theme toggle', () => {
    render(<Header />);
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('renders a non-interactive placeholder avatar (present, not a button)', () => {
    render(<Header />);
    const avatar = screen.getByTestId('avatar-placeholder');
    expect(avatar).toBeInTheDocument();
    expect(avatar.tagName).not.toBe('BUTTON');
    // aria-hidden keeps the decorative avatar out of the a11y tree.
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
  });
});
