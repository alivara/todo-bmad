import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/app/components/EmptyState';

// AC2: the bare empty state renders the LOCKED microcopy verbatim (UX-DR25) — never
// a blank screen.
describe('EmptyState', () => {
  it('renders the locked empty-state copy', () => {
    render(<EmptyState />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.getByText("Add your first task above — it'll show up right here.")).toBeInTheDocument();
  });
});
