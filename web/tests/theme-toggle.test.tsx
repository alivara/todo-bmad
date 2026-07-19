import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeToggle } from '@/app/components/ThemeToggle';

// Story 3.4: the toggle is a labeled control whose click flips document.documentElement.dataset.theme
// light↔dark (the DOM attribute is the source of truth) and persists the choice to localStorage.

// This jsdom build ships without localStorage; stub a minimal in-memory Storage so the component's
// persist write and the assertions below share one backing store.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeToggle', () => {
  it('renders a labeled toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });

  it('flips the html data-theme light→dark→light and persists each choice', () => {
    // Start from an unset attribute (treated as light) — the first click must produce dark.
    document.documentElement.removeAttribute('data-theme');
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /toggle theme/i });

    fireEvent.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('todo-theme')).toBe('dark');

    fireEvent.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('todo-theme')).toBe('light');
  });
});
