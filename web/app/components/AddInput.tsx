'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useCreateTodo } from '@/lib/useCreateTodo';

// Client mirror of the server cap (AD-10). Counted in Unicode code points — see codePoints.
const MAX_TITLE = 200;

// Count Unicode code points, matching Go's utf8.RuneCountInString on the server. The
// spread iterates by code point (surrogate pairs collapse to 1); `.length` would count
// UTF-16 units and disagree with the server on astral characters.
function codePoints(s: string): number {
  return [...s].length;
}

/**
 * The pinned, always-focused add-input (UX-DR5). Submits on Enter or the Add button
 * (equal alternatives). Mirrors the server validation for instant feedback, and drives
 * the optimistic create mutation.
 */
export function AddInput() {
  const [value, setValue] = useState('');
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const title = value.trim();

    // Empty/whitespace → reject inline, send nothing, keep focus (AC3). Over-cap → block
    // submit until back within cap; keystrokes are never dropped (RD-3).
    if (title === '' || codePoints(title) > MAX_TITLE) {
      inputRef.current?.focus();
      return;
    }

    // Double-add guard (AC5): a second Enter with no intervening keystroke is ignored.
    if (submittedRef.current) return;
    submittedRef.current = true;

    // Clear synchronously so the field is empty for rapid consecutive capture (AC1).
    setValue('');
    create.mutate({ title });
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle} noValidate>
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
        style={inputStyle}
      />
      <button type="submit" aria-label="Add" style={buttonStyle}>
        Add
      </button>
      {create.isError && (
        <p role="alert" style={errorStyle}>
          Something got in the way. Try again.
        </p>
      )}
    </form>
  );
}

const formStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--space-2)',
};

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: 'var(--surface-raised)',
  border: '1.5px solid var(--accent)',
  borderRadius: 'var(--radius-sm)',
  boxShadow: '0 0 0 3px var(--accent-soft)',
  padding: '12px 14px',
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  color: 'var(--ink-primary)',
  outline: 'none',
};

const buttonStyle: CSSProperties = {
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '12px 18px',
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
};

const errorStyle: CSSProperties = {
  flexBasis: '100%',
  margin: 0,
  color: 'var(--ink-secondary)',
  fontSize: 13,
};
