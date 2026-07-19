'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Todo } from '@shared/todo';
import { formatRelativeTime } from '@/lib/relativeTime';
import { todosQueryKey } from '@/lib/todos';
import { useToggleTodo } from '@/lib/useToggleTodo';

/**
 * Interactive todo row (Story 2.1, extending the Story 1.3 read-only anatomy). Renders a
 * REAL semantic checkbox (role="checkbox" + aria-checked) that drives the optimistic
 * useToggleTodo mutation, the title, an optional 2-line-clamped description with an in-place
 * `more`/`less` reveal, and an RD-1 relative time.
 *
 * The row OWNS its card chrome so it can vary the treatment by status (moved here from
 * page.tsx): active is a raised card (surface-raised + hairline border + shadow); completed
 * recedes (transparent background/border, no shadow, ~0.85 opacity). Completing flips the
 * status in the cache in ≤100ms; the terracotta check plays a CSS spring (check-pop) that
 * DECORATES but never gates that change, and the recede is a matching transition. Reduced
 * motion is honored in globals.css (the bounce is disabled, the state change stays instant).
 *
 * `description` is "" when empty (never null, AD-6) → no description line is rendered.
 */

// First-paint / SSR / jsdom seed only — roughly two lines of body text in the ~560px
// column. The browser replaces this with a measured-overflow check after layout.
const DESCRIPTION_CLAMP_LIMIT = 100;

export function TodoRow({ todo }: { todo: Todo }) {
  const [expanded, setExpanded] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(() => [...todo.description].length > DESCRIPTION_CLAMP_LIMIT);

  const queryClient = useQueryClient();
  const toggle = useToggleTodo();

  const isCompleted = todo.status === 'completed';
  const hasDescription = todo.description !== '';
  const collapsed = !expanded;

  // Play the check-pop spring ONLY on a fresh, user-triggered active->completed transition —
  // not when an already-completed todo mounts on page load / refetch (that would replay the
  // payoff motion unprompted). Seeded from the initial status so mount never pops.
  const wasCompletedRef = useRef(isCompleted);
  const justCompleted = isCompleted && !wasCompletedRef.current;
  useEffect(() => {
    wasCompletedRef.current = isCompleted;
  }, [isCompleted]);

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

  // Flip to the opposite status. Read the CURRENT status from the query cache rather than the
  // possibly-stale `todo` prop (which only updates after React commits the prior flip), so a
  // rapid re-toggle sends the correct target and can't desync. Optimistic + non-blocking (AD-4);
  // no client-generated timestamp (AD-7).
  function handleToggle() {
    const current =
      queryClient.getQueryData<Todo[]>(todosQueryKey)?.find((t) => t.id === todo.id)?.status ?? todo.status;
    toggle.mutate({ id: todo.id, status: current === 'completed' ? 'active' : 'completed' });
  }

  return (
    <div style={{ ...cardBaseStyle, ...(isCompleted ? completedCardStyle : activeCardStyle) }}>
      <button
        type="button"
        role="checkbox"
        aria-checked={isCompleted}
        aria-label={isCompleted ? `Mark ${todo.title} as active` : `Mark ${todo.title} as complete`}
        onClick={handleToggle}
        style={{ ...checkboxBaseStyle, ...(isCompleted ? checkboxCompletedStyle : checkboxActiveStyle) }}
      >
        {isCompleted && (
          // The glyph mounts while completed; the check-pop CSS spring (globals.css) is applied
          // ONLY on a fresh user toggle (justCompleted) so it doesn't replay on page load.
          <svg
            className={justCompleted ? 'check-pop' : undefined}
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M2.5 7.5L5.5 10.5L11.5 3.5"
              stroke="var(--on-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <div style={contentStyle}>
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
              {collapsed && overflows && (
                <span
                  aria-hidden="true"
                  style={{
                    ...fadeStyle,
                    // Blend to the row's ACTUAL backdrop: the raised surface when active, or the
                    // page canvas showing through the transparent completed card (P5).
                    background: `linear-gradient(to bottom, transparent, ${
                      isCompleted ? 'var(--surface-base)' : 'var(--surface-raised)'
                    })`,
                  }}
                />
              )}
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

        {toggle.isError && (
          // Non-disruptive rollback notice (AC3): the checkbox has already flipped back; this
          // tells the user the save failed. Reuses the sanctioned copy (matches AddInput).
          <p role="alert" style={toggleErrorStyle}>
            Something got in the way. Try again.
          </p>
        )}
      </div>
    </div>
  );
}

// The card chrome, owned by the row so it varies by status. The transition gives the recede
// its settle; the ≤100ms cache flip is independent of it (motion decorates, never gates).
const cardBaseStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
  alignItems: 'flex-start',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4)',
  transition: 'background 350ms ease, box-shadow 350ms ease, opacity 350ms ease, border-color 350ms ease',
};

const activeCardStyle: CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-hairline)',
  boxShadow: 'var(--shadow-row)',
  opacity: 1,
};

// Recessed completed treatment: transparent surface/border, no shadow, dimmed.
const completedCardStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid transparent',
  boxShadow: 'none',
  opacity: 0.85,
};

const checkboxBaseStyle: CSSProperties = {
  flexShrink: 0,
  width: 24,
  height: 24,
  marginTop: 2,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--radius-full)',
  cursor: 'pointer',
  transition: 'background 200ms ease, border-color 200ms ease',
};

// Active: an empty ink-muted ring inviting completion.
const checkboxActiveStyle: CSSProperties = {
  background: 'transparent',
  border: '2px solid var(--ink-muted)',
};

// Completed: a filled terracotta circle holding the on-accent check.
const checkboxCompletedStyle: CSSProperties = {
  background: 'var(--accent)',
  border: '2px solid var(--accent)',
};

const contentStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
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

const toggleErrorStyle: CSSProperties = {
  margin: 0,
  marginTop: 'var(--space-1)',
  fontSize: 13,
  color: 'var(--ink-secondary)',
};
