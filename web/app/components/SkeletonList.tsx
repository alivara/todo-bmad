import type { CSSProperties } from 'react';

/**
 * The polished loading state (Story 3.2). Four skeleton rows that echo the real TodoRow anatomy
 * — a 24px check-circle placeholder + one shimmer line of varying width on a surface-raised card —
 * plus the `Getting your tasks…` caption. Never a blank screen and never a bare spinner (FR21/NFR2);
 * it resolves directly to the list when data loads.
 *
 * A11y: the whole region is a single `role="status"` and the caption carries the announcement; the
 * shimmer placeholders are purely decorative and `aria-hidden`. The shimmer sweep + reduced-motion
 * collapse live in globals.css (.skeleton-shimmer). Tokens only — the highlight is a token-derived
 * accent-soft↔surface-raised gradient, so it adapts to the warm-dark palette.
 */

// One shimmer line per row, at descending widths — the varied lengths read as real task titles
// rather than a uniform bar.
const LINE_WIDTHS = ['72%', '54%', '63%', '44%'];

export function SkeletonList() {
  return (
    <div role="status" style={listStyle}>
      {LINE_WIDTHS.map((width, i) => (
        <div key={i} aria-hidden="true" style={cardStyle}>
          <div className="skeleton-shimmer" style={checkPlaceholderStyle} />
          <div className="skeleton-shimmer" style={{ ...linePlaceholderStyle, width }} />
        </div>
      ))}
      <p style={captionStyle}>Getting your tasks…</p>
    </div>
  );
}

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

// Mirrors TodoRow's active card chrome (surface-raised + hairline + radius-md + space-4 padding)
// and its flex row (gap space-3, top-aligned).
const cardStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
  alignItems: 'flex-start',
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4)',
};

// The 24px check-circle placeholder, matching TodoRow's real checkbox box (width/height/marginTop).
const checkPlaceholderStyle: CSSProperties = {
  flexShrink: 0,
  width: 24,
  height: 24,
  marginTop: 2,
  borderRadius: 'var(--radius-full)',
};

// One title-height shimmer line, top-aligned with the check placeholder.
const linePlaceholderStyle: CSSProperties = {
  height: 11,
  marginTop: 8,
  borderRadius: 'var(--radius-full)',
};

const captionStyle: CSSProperties = {
  margin: 0,
  paddingTop: 'var(--space-2)',
  color: 'var(--ink-secondary)',
  fontSize: 14,
  textAlign: 'center',
};
