import type { CSSProperties } from 'react';
import { codePoints } from '@/lib/caps';

/**
 * The quiet progressive char counter (Story 3.3, RD-2). Hidden at rest, it appears once the
 * value comes within 20 code points of the cap and shows `current / total` (e.g. `184 / 200`),
 * the current number in `--accent` + bold, the ` / total` in `--ink-secondary`, at `meta` 13px.
 *
 * It counts the RAW value (what the user sees, so a trailing space ticks it up) — the submit/save
 * block guard keeps counting the trimmed value (Design Note 4). Over cap it keeps the same
 * accent-bold treatment (the overage number `201 / 200` conveys "over" — no red/danger token, per
 * the no-alarm-red voice rule); the field's `aria-invalid` + the blocked submit are the
 * authoritative signals. Decorative: a non-focusable, `aria-hidden` span with no `aria-live`.
 */
export function CharCounter({ value, max, style }: { value: string; max: number; style?: CSSProperties }) {
  const n = codePoints(value);
  if (n < max - 20) return null;
  // Merge any caller layout (e.g. AddInput's full-width flex row) into the counter itself, so at
  // rest NOTHING renders — no empty wrapper leaving a flex-gap gutter (review P1).
  return (
    <span aria-hidden="true" style={{ ...counterStyle, ...style }}>
      <span style={currentStyle}>{n}</span>
      <span style={totalStyle}> / {max}</span>
    </span>
  );
}

const counterStyle: CSSProperties = {
  display: 'block',
  textAlign: 'right',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
};

const currentStyle: CSSProperties = {
  color: 'var(--accent)',
  fontWeight: 700,
};

const totalStyle: CSSProperties = {
  color: 'var(--ink-secondary)',
};
