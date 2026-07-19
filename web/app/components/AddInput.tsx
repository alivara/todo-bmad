'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useCreateTodo } from '@/lib/useCreateTodo';
import { is4xx, inline4xxText } from '@/lib/apiError';
import { MAX_TITLE, MAX_DESCRIPTION, codePoints } from '@/lib/caps';
import { CharCounter } from '@/app/components/CharCounter';

// Verbatim placeholder, shared with the edit-in-place description editor (TodoRow).
const DESCRIPTION_PLACEHOLDER = 'Add a description (optional)';

/**
 * The pinned, always-focused add-input (UX-DR5). Submits on Enter or the Add button
 * (equal alternatives). Mirrors the server validation for instant feedback, and drives
 * the optimistic create mutation.
 *
 * 2026-07-20 UI consolidation: the title row (title input + Add button) and the optional
 * description live inside ONE accent-bordered container (the resting border + raised surface
 * moved off the inner fields onto the container), so the add form reads as a single box with a
 * quieter description stacked below the title — not two separate boxes.
 */
export function AddInput() {
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Reentrancy latch for the double-add guard (AC5). A ref (not state) so two Enter
  // key events firing in the same tick both observe it synchronously — a stale-closure
  // `value` check alone would let both submits through. Re-armed on any keystroke.
  const submittedRef = useRef(false);
  const create = useCreateTodo();

  // Focused on load for immediate capture (UX-DR5).
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const overCap = codePoints(value.trim()) > MAX_TITLE;
  const descOverCap = codePoints(description.trim()) > MAX_DESCRIPTION;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const title = value.trim();
    const desc = description.trim();

    // Empty/whitespace title → reject inline, send nothing, keep focus (AC3). Over-cap on EITHER
    // field → block submit until back within cap; keystrokes are never dropped (RD-3).
    if (title === '' || codePoints(title) > MAX_TITLE || codePoints(desc) > MAX_DESCRIPTION) {
      inputRef.current?.focus();
      return;
    }

    // Double-add guard (AC5): a second Enter with no intervening keystroke is ignored.
    if (submittedRef.current) return;
    submittedRef.current = true;

    // Clear both fields synchronously so they're empty for rapid consecutive capture (AC1).
    setValue('');
    setDescription('');
    // Omit description from the body when blank/whitespace — keeps CreateTodoRequest.description?
    // optional and the ""-empty semantics (the optimistic hook fills description: '' itself).
    create.mutate({ title, ...(desc ? { description: desc } : {}) });
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle} noValidate>
      {/* Single bordered container — holds the title row on top and the optional description
          stacked below it (2026-07-20 UI consolidation). The resting accent border + raised
          surface live here; the inner fields are borderless/transparent so it reads as one box. */}
      <div style={fieldContainerStyle}>
        <div style={titleRowStyle}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              submittedRef.current = false; // any keystroke re-arms the guard
              // Clear a stale add-error the moment the user edits, so a prior rejection's
              // banner doesn't linger over the next (unrelated) task being typed (AC6).
              if (create.isError) create.reset();
            }}
            placeholder="Add a task…"
            aria-label="Add a task"
            aria-invalid={overCap || undefined}
            className="add-input"
            style={inputStyle}
          />
          <button type="submit" aria-label="Add" className="focus-ring" style={buttonStyle}>
            Add
          </button>
        </div>
        {/* The counter row is hidden until within 20 of the cap, then a quiet accent-bold `n / 200`.
            At rest NOTHING renders (no empty gutter). Counts the raw value; the submit guard above
            still counts the trimmed value. */}
        <CharCounter value={value} max={MAX_TITLE} style={counterRowStyle} />
        {/* Optional description — stacked below the title INSIDE the same container, set off by a
            hairline. Mirrors the edit-in-place editor's textarea (TodoRow): rows=2, verbatim
            placeholder, aria-invalid when over-cap, quieter/smaller type. A <textarea> does NOT
            submit on Enter (newline), so no keydown handler is added — only the title input / Add
            button submit. */}
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            submittedRef.current = false; // any keystroke re-arms the double-add guard
            // Clear a stale add-error the moment the user edits either field (AC6).
            if (create.isError) create.reset();
          }}
          rows={2}
          placeholder={DESCRIPTION_PLACEHOLDER}
          aria-label="Description"
          aria-invalid={descOverCap || undefined}
          className="add-input"
          style={descriptionStyle}
        />
        <CharCounter value={description} max={MAX_DESCRIPTION} style={counterRowStyle} />
      </div>
      {create.isError &&
        (is4xx(create.error) ? (
          // 4xx = the user's input (a client/server validation mirror drift, AD-10). Inline the
          // server's user-facing message; retrying malformed input is futile → NO retry control.
          <p role="alert" style={errorStyle}>
            {inline4xxText(create.error)}
          </p>
        ) : (
          // 5xx / network / timeout = our fault. Sanctioned copy + a Try-again that re-fires the
          // same add (TanStack retains the last variables, so it works even though the field cleared).
          <div role="alert" style={errorStyle}>
            <span>Something got in the way. </span>
            <button
              type="button"
              onClick={() => {
                if (create.variables) create.mutate(create.variables);
              }}
              className="focus-ring"
              style={retryButtonStyle}
            >
              Try again
            </button>
          </div>
        ))}
    </form>
  );
}

// The form stacks the single field-container and any error row.
const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

// The one accent-bordered box holding both fields. The resting accent border + raised surface
// (previously duplicated on each inner field) live here now, so the title and description read as
// a single container. The accent-soft focus glow stays per-field on `.add-input:focus-visible`
// (globals.css) so tabbing between the two fields still gives a visible focus delta (WCAG 2.4.7).
const fieldContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  background: 'var(--surface-raised)',
  border: '1.5px solid var(--accent)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 8px',
};

// Title input + Add button share the top row of the container.
const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
};

// Borderless/transparent within the container — the box owns the border and surface now.
const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: 'transparent',
  border: 'none',
  // Comfortable vertical padding so the title input matches the Add button's height (row stays
  // aligned) and keeps a ≥ comfortable tap target (review patch — WCAG 2.5.8).
  padding: '10px 8px',
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  color: 'var(--ink-primary)',
};

// The optional description: a quieter, smaller field stacked below the title inside the same box,
// set off by a hairline (echoing the inline edit-in-place editor). Borderless/transparent like the
// title input; the container carries the accent border.
const descriptionStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'transparent',
  border: 'none',
  borderTop: '1px solid var(--border-hairline)',
  padding: '8px 8px 4px',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  lineHeight: 1.45,
  color: 'var(--ink-primary)',
  resize: 'vertical',
};

const buttonStyle: CSSProperties = {
  background: 'var(--accent-soft)',
  color: 'var(--accent-strong)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 18px',
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: 'var(--ink-secondary)',
  fontSize: 13,
};

// Full-width row for the char counter, sitting inside the container. The CharCounter renders
// nothing at rest, so this row is empty (zero height) until near-cap.
const counterRowStyle: CSSProperties = {
  width: '100%',
};

// The inline Try-again affordance for the 5xx/network class: an accent-colored text button (no
// status codes / jargon / alarm-red — the voice rule). Reused across the mutation surfaces.
const retryButtonStyle: CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'none',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--accent)',
  cursor: 'pointer',
};
