'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Todo } from '@shared/todo';
import { formatRelativeTime } from '@/lib/relativeTime';

/**
 * Read-only todo row (Story 1.3). Renders title, an optional 2-line-clamped
 * description with an in-place `more`/`less` reveal, a status-reflecting treatment,
 * and an RD-1 relative time. NO interactive checkbox / toggle / edit — status is
 * conveyed purely through read-only styling (active = normal, completed = recessed +
 * strikethrough). The Epic-2 toggle interaction is out of scope.
 *
 * `description` is "" when empty (never null, AD-6) → no description line is rendered.
 * The CSS `-webkit-line-clamp` always applies the visual 2-line clamp while collapsed;
 * whether the `more`/`less` reveal appears is driven by a REAL overflow measurement
 * (`scrollHeight > clientHeight` while clamped). A code-point-length heuristic seeds the
 * state for SSR / first paint / jsdom (where layout metrics are 0 and unmeasurable), so
 * the reveal stays deterministic and unit-testable while being accurate in the browser.
 */

// First-paint / SSR / jsdom seed only — roughly two lines of body text in the ~560px
// column. The browser replaces this with a measured-overflow check after layout.
const DESCRIPTION_CLAMP_LIMIT = 100;

export function TodoRow({ todo }: { todo: Todo }) {
  const [expanded, setExpanded] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(() => [...todo.description].length > DESCRIPTION_CLAMP_LIMIT);

  const isCompleted = todo.status === 'completed';
  const hasDescription = todo.description !== '';
  const collapsed = !expanded;

  // Measure real 2-line overflow while clamped (the heuristic can't know rendered width,
  // wide glyphs, or hard newlines). Guarded on clientHeight>0 so jsdom (metrics 0) keeps
  // the heuristic seed. A ResizeObserver on THIS element re-measures on any box/reflow
  // change — no global window listener per row, no forced reflow on every resize event.
  useEffect(() => {
    const el = descriptionRef.current;
    if (!el || !hasDescription || !collapsed) return;
    const measure = () => {
      if (el.clientHeight === 0) return; // not laid out (jsdom/SSR) — keep the seed
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return; // jsdom: keep the heuristic seed
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [todo.description, hasDescription, collapsed]);

  return (
    <div style={containerStyle}>
      <p style={{ ...titleStyle, ...(isCompleted ? completedTextStyle : null) }}>{todo.title}</p>

      {hasDescription && (
        <div style={descriptionWrapStyle}>
          <div style={descriptionClampBoxStyle}>
            <p
              ref={descriptionRef}
              style={{
                ...descriptionStyle,
                ...(isCompleted ? completedTextStyle : null),
                ...(collapsed ? clampStyle : null),
              }}
            >
              {todo.description}
            </p>
            {collapsed && overflows && <span aria-hidden="true" style={fadeStyle} />}
          </div>
          {overflows && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              style={revealButtonStyle}
            >
              {expanded ? 'less' : 'more'}
            </button>
          )}
        </div>
      )}

      <time dateTime={todo.metadata.createdAt} style={timeStyle}>
        {formatRelativeTime(todo.metadata.createdAt)}
      </time>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 500,
  lineHeight: 1.35,
  color: 'var(--ink-primary)',
  // An unbroken title (a pasted URL, or up to 200 unbroken code points) must wrap rather
  // than force horizontal scroll — the app is mobile-first from ~375px.
  overflowWrap: 'anywhere',
};

const descriptionWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
};

// Wraps ONLY the clamped paragraph so the fade overlay (bottom:0) sits over the clamped
// last line — not over the reveal button, which lives outside this box.
const descriptionClampBoxStyle: CSSProperties = {
  position: 'relative',
  alignSelf: 'stretch',
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 1.45,
  color: 'var(--ink-secondary)',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
};

// The 2-line clamp, applied whenever collapsed. jsdom does not clip on this, but the
// browser does — and the reveal affordance is gated on the measured overflow of this
// clamped box (with the length heuristic as the pre-measurement seed).
const clampStyle: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

// Soft fade over the clamped second line, easing text into the row surface.
const fadeStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: '1.45em',
  pointerEvents: 'none',
  background: 'linear-gradient(to bottom, transparent, var(--surface-raised))',
};

const revealButtonStyle: CSSProperties = {
  display: 'inline-block',
  marginTop: 'var(--space-1)',
  padding: 0,
  border: 'none',
  background: 'none',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--accent)',
  cursor: 'pointer',
};

const timeStyle: CSSProperties = {
  marginTop: 'var(--space-1)',
  fontSize: 13,
  fontWeight: 400,
  color: 'var(--ink-secondary)',
};

const completedTextStyle: CSSProperties = {
  textDecoration: 'line-through',
  color: 'var(--ink-muted)',
};
