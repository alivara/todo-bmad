'use client';

import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Todo, UpdateTodoRequest } from '@shared/todo';
import { formatRelativeTime } from '@/lib/relativeTime';
import { todosQueryKey } from '@/lib/todos';
import { is4xx, inline4xxText } from '@/lib/apiError';
import { usePendingDelete } from '@/lib/pendingDelete';
import { useToggleTodo } from '@/lib/useToggleTodo';
import { useUpdateTodo } from '@/lib/useUpdateTodo';

// Client mirror of the server caps (AD-10). Counted in Unicode code points — see codePoints.
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;

// Count Unicode code points, matching Go's utf8.RuneCountInString on the server (mirrors
// AddInput). The spread iterates by code point; `.length` would count UTF-16 units and disagree
// with the server on astral characters.
function codePoints(s: string): number {
  return [...s].length;
}

// Locked microcopy (verbatim) — the edit hint uses the middle-dot `·` (U+00B7).
const EDIT_HINT = 'Enter to save · Esc to cancel';
const DESCRIPTION_PLACEHOLDER = 'Add a description (optional)';

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
  const update = useUpdateTodo();
  const { requestDelete } = usePendingDelete();

  // Inline edit-in-place (Story 2.2). The row itself becomes the editor; the drafts are seeded
  // from the current values on entry and diffed (trimmed, per-field) against them on save.
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(todo.title);
  const [descDraft, setDescDraft] = useState(todo.description);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);
  // Which field to focus on entering edit (the tapped one). Read once by the focus effect.
  const focusFieldRef = useRef<'title' | 'description'>('title');
  // Mirrors `editing` synchronously so the editor-scoped blur handler can tell a real
  // focus-leaves-editor blur (save) from the unmount blur fired while we're closing (ignore) —
  // setEditing(false) is async, so a state read alone would still see the editor "open".
  const editingRef = useRef(false);

  const isCompleted = todo.status === 'completed';
  const hasDescription = todo.description !== '';
  const collapsed = !expanded;

  function enterEdit(field: 'title' | 'description') {
    focusFieldRef.current = field;
    setTitleDraft(todo.title);
    setDescDraft(todo.description);
    editingRef.current = true;
    setEditing(true);
  }

  function closeEditor() {
    editingRef.current = false;
    setEditing(false);
  }

  // Esc: revert both drafts and close, no save (AC / Matrix "cancel").
  function cancelEdit() {
    setTitleDraft(todo.title);
    setDescDraft(todo.description);
    closeEditor();
  }

  // Save on Enter-in-title or blur-out-of-editor. Trims + mirrors the server validation (AD-10),
  // builds a patch of ONLY the changed fields (trimmed draft ≠ prior), and issues at most one
  // PATCH — a no-op patch sends nothing (AD-6 crux). An empty/whitespace title is rejected and
  // reverts to the prior title; an over-cap field blocks the save (editor stays open).
  function saveEdit() {
    const nextTitle = titleDraft.trim();
    const nextDescription = descDraft.trim();

    // Empty/whitespace title → reject: revert to prior, close, no PATCH (Matrix "empty title").
    if (nextTitle === '') {
      cancelEdit();
      return;
    }
    // Over cap → block the save until back within cap; keep the editor open (RD-3).
    if (codePoints(nextTitle) > MAX_TITLE || codePoints(nextDescription) > MAX_DESCRIPTION) {
      return;
    }

    // Per-field trimmed diff against the prior values: only a changed field enters the patch. A
    // description cleared to "" IS a change (present, empty — an intentional clear); an untouched
    // field is omitted (absent = unchanged, never a zero-value overwrite — AD-6).
    const patch: UpdateTodoRequest = {};
    if (nextTitle !== todo.title) patch.title = nextTitle;
    if (nextDescription !== todo.description) patch.description = nextDescription;

    if (patch.title !== undefined || patch.description !== undefined) {
      update.mutate({ id: todo.id, patch });
    }
    closeEditor();
  }

  // Editor-scoped blur: save ONLY when focus leaves the entire editor (relatedTarget outside the
  // container). Tabbing title→description keeps focus inside → no save. The unmount blur fired
  // while closing is ignored via editingRef.
  function handleEditorBlur(e: FocusEvent<HTMLDivElement>) {
    if (!editingRef.current) return;
    const next = e.relatedTarget as Node | null;
    if (editorRef.current && next && editorRef.current.contains(next)) return;
    // A null relatedTarget from a WINDOW/tab blur (alt-tab, DevTools, switch tab) must not
    // commit + close the editor mid-edit; only an in-page focus move out of the editor saves.
    // document.hasFocus() is false when the whole window lost focus.
    if (!next && !document.hasFocus()) return;
    saveEdit();
  }

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

  // On entering edit, focus the tapped field (title tap → title input; description tap →
  // textarea) so the keyboard-first flow starts where the user pointed (Design Note 4).
  useEffect(() => {
    if (!editing) return;
    const el = focusFieldRef.current === 'description' ? descInputRef.current : titleInputRef.current;
    el?.focus();
    // Place the caret at the end of the seeded text rather than selecting all.
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

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
        {editing ? (
          <div ref={editorRef} onBlur={handleEditorBlur} style={editorStyle}>
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); // Enter in the title saves the whole editor
                  saveEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              aria-label="Edit title"
              aria-invalid={codePoints(titleDraft.trim()) > MAX_TITLE || undefined}
              style={editTitleStyle}
            />
            <textarea
              ref={descInputRef}
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                // Enter inserts a newline here (multiline description); only Esc is intercepted.
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              rows={2}
              placeholder={DESCRIPTION_PLACEHOLDER}
              aria-label="Edit description"
              aria-invalid={codePoints(descDraft.trim()) > MAX_DESCRIPTION || undefined}
              style={editDescriptionStyle}
            />
            <p style={editHintStyle}>{EDIT_HINT}</p>
          </div>
        ) : (
          <>
            <p
              role="button"
              tabIndex={0}
              className="todo-editable"
              onClick={() => enterEdit('title')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  enterEdit('title');
                }
              }}
              style={{ ...titleStyle, ...(isCompleted ? completedTextStyle : null) }}
            >
              {todo.title}
            </p>

            {hasDescription && (
              <div style={descriptionWrapStyle}>
                <div style={descriptionClampBoxStyle}>
                  <p
                    ref={descriptionRef}
                    role="button"
                    tabIndex={0}
                    className="todo-editable"
                    onClick={() => enterEdit('description')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        enterEdit('description');
                      }
                    }}
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
          </>
        )}

        {/* Non-disruptive rollback notice (AC3 / AC5): the row has already rolled back; this tells
            the user the save failed, branching on error class (4xx inline server message, no retry;
            5xx/network the sanctioned copy + a Try-again that re-fires the same mutation). */}
        {toggle.isError && (
          <MutationError
            error={toggle.error}
            onRetry={() => {
              if (toggle.variables) toggle.mutate(toggle.variables);
            }}
          />
        )}
        {/* At most one notice: if a toggle error is already shown, don't stack a second identical
            alert/Try-again for a concurrent edit failure (review P1). */}
        {!toggle.isError && update.isError && (
          <MutationError
            error={update.error}
            onRetry={() => {
              if (update.variables) update.mutate(update.variables);
            }}
          />
        )}
      </div>

      {/* The quiet delete affordance (Story 2.3, Design Note 1): ALWAYS rendered (mobile-first has
          no hover), a real focusable <button>, quiet by default and emphasized on hover/focus
          (globals.css .todo-delete). Activating it hands the row to the client-owned pending-delete
          lifecycle (optimistic remove + Undo toast) — NO network call fires here (AD-5). */}
      <button
        type="button"
        className="todo-delete"
        aria-label={`Delete ${todo.title}`}
        onClick={() => requestDelete(todo)}
        style={deleteButtonStyle}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
          <path
            d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * The shared 4xx/5xx split for a mutation surface (AC3). Both of the row's mutations (toggle, edit)
 * render this: a `4xx` inlines the server's user-facing `message` with NO retry (retrying the
 * user's malformed input is futile); a `5xx`/network/timeout shows the sanctioned copy plus a
 * Try-again that re-fires the same mutation (`mutation.mutate(mutation.variables)`).
 */
function MutationError({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  if (is4xx(error)) {
    return (
      <p role="alert" style={toggleErrorStyle}>
        {inline4xxText(error)}
      </p>
    );
  }
  return (
    <div role="alert" style={toggleErrorStyle}>
      <span>Something got in the way. </span>
      <button type="button" onClick={onRetry} style={rowRetryButtonStyle}>
        Try again
      </button>
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

// The trailing-edge ✕. Colors + hover/focus emphasis live in globals.css (.todo-delete) since
// inline styles can't express :hover; here only the box geometry (a small round tap target).
const deleteButtonStyle: CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  marginTop: 2,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  borderRadius: 'var(--radius-full)',
  cursor: 'pointer',
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

// The inline Try-again affordance for the 5xx/network class (accent text button; no jargon/red).
const rowRetryButtonStyle: CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'none',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--accent)',
  cursor: 'pointer',
};

// The inline editor container, laid out as a stacked column within the row content.
const editorStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

// Title + description fields share the AddInput field idiom: accent border + accent-soft ring
// on the raised surface, so the row visibly becomes an editor.
const editFieldBaseStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--surface-raised)',
  border: '1.5px solid var(--accent)',
  borderRadius: 'var(--radius-sm)',
  boxShadow: '0 0 0 3px var(--accent-soft)',
  padding: '8px 10px',
  fontFamily: 'var(--font-sans)',
  color: 'var(--ink-primary)',
  outline: 'none',
};

const editTitleStyle: CSSProperties = {
  ...editFieldBaseStyle,
  fontSize: 17,
  fontWeight: 500,
};

const editDescriptionStyle: CSSProperties = {
  ...editFieldBaseStyle,
  fontSize: 14,
  lineHeight: 1.45,
  resize: 'vertical',
};

const editHintStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: 'var(--ink-secondary)',
};
