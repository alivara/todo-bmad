import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkeletonList } from '@/app/components/SkeletonList';

// Story 3.2 loading state: 4 skeleton rows echoing the row anatomy + the `Getting your tasks…`
// caption in a role="status" region. The shimmer placeholders are decorative (aria-hidden); the
// caption carries the announcement — never a blank screen or a bare spinner.
describe('SkeletonList', () => {
  it('renders a role="status" region with the locked loading caption', () => {
    render(<SkeletonList />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    // The caption is the announced text (LOCKED microcopy, verbatim).
    expect(screen.getByText('Getting your tasks…')).toBeInTheDocument();
  });

  it('renders 4 skeleton rows', () => {
    const { container } = render(<SkeletonList />);
    // Each row is an aria-hidden card holding the shimmer placeholders.
    const rows = container.querySelectorAll('[aria-hidden="true"]');
    expect(rows).toHaveLength(4);
  });

  it('marks the shimmer placeholders decorative (aria-hidden) so only the caption announces', () => {
    const { container } = render(<SkeletonList />);
    // The shimmer placeholder divs must not be exposed to AT.
    const shimmer = container.querySelectorAll('.skeleton-shimmer');
    expect(shimmer.length).toBeGreaterThan(0);
    // Every shimmer placeholder is inside an aria-hidden subtree (its row card is aria-hidden).
    shimmer.forEach((el) => {
      expect(el.closest('[aria-hidden="true"]')).not.toBeNull();
    });
  });
});
