import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CharCounter } from '@/app/components/CharCounter';

// The quiet progressive counter (Story 3.3, RD-2): hidden below cap−20, visible within 20,
// format `n / max`, current number accent+bold, and a Unicode code-point count (astral + ZWJ).

afterEach(cleanup);

describe('CharCounter', () => {
  it('renders nothing at rest (below max−20)', () => {
    const { container } = render(<CharCounter value={'a'.repeat(179)} max={200} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing one code point below the threshold (max−21)', () => {
    const { container } = render(<CharCounter value={'a'.repeat(179)} max={200} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('appears exactly at the threshold (max−20) showing `n / max`', () => {
    render(<CharCounter value={'a'.repeat(180)} max={200} />);
    expect(screen.getByText('180')).toBeInTheDocument();
    expect(screen.getByText('/ 200', { exact: false })).toBeInTheDocument();
  });

  it('shows the current number in accent + bold, the total in ink-secondary', () => {
    render(<CharCounter value={'a'.repeat(184)} max={200} />);
    const current = screen.getByText('184');
    expect(current).toHaveStyle({ color: 'var(--accent)', fontWeight: 700 });
    const total = screen.getByText('/ 200', { exact: false });
    expect(total).toHaveStyle({ color: 'var(--ink-secondary)' });
  });

  it('shows the overage over cap, staying accent+bold (no red)', () => {
    render(<CharCounter value={'a'.repeat(201)} max={200} />);
    const current = screen.getByText('201');
    expect(current).toBeInTheDocument();
    expect(current).toHaveStyle({ color: 'var(--accent)', fontWeight: 700 });
  });

  it('is decorative: an aria-hidden, non-focusable span', () => {
    const { container } = render(<CharCounter value={'a'.repeat(200)} max={200} />);
    const span = container.querySelector('span[aria-hidden="true"]');
    expect(span).not.toBeNull();
    expect(span).not.toHaveAttribute('tabindex');
  });

  it('counts astral emoji by code point: 200 emoji shows `200 / 200`, not 400', () => {
    render(<CharCounter value={'😀'.repeat(200)} max={200} />);
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.queryByText('400')).not.toBeInTheDocument();
  });

  it('counts a ZWJ family emoji as 5 code points', () => {
    // 195 ASCII + a 5-code-point family = 200 → shows `200 / 200` (a 1-grapheme count would be 196
    // and stay hidden).
    const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
    render(<CharCounter value={'a'.repeat(195) + family} max={200} />);
    expect(screen.getByText('200')).toBeInTheDocument();
  });
});
