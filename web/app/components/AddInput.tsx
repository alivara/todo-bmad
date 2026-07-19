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
      {/* The counter is a full-width row (mirrors the error row's flexBasis:100%): hidden until
          within 20 of the cap, then a quiet accent-bold `n / 200`. The flexBasis lives on the
          counter itself so at rest NOTHING renders (no empty row-gap gutter). Counts the raw
          value; the submit guard above still counts the trimmed value. */}
      <CharCounter value={value} max={MAX_TITLE} style={counterRowStyle} />
      {/* Optional description — a full-width row below the title/button pair on the wrapping flex
          form. Mirrors the edit-in-place editor's textarea (TodoRow): rows=2, verbatim placeholder,
          aria-invalid when over-cap. A <textarea> does NOT submit on Enter (newline), so no keydown
          handler is added here — only the title input / Add button submit. */}
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
        style={descriptionStyle}
      />
      <CharCounter value={description} max={MAX_DESCRIPTION} style={counterRowStyle} />
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
              style={retryButtonStyle}
            >
              Try again
            </button>
          </div>
        ))}
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

// The optional description textarea: a full-width row (flexBasis:100%) that shares the add-input
// field idiom (accent border + accent-soft ring on the raised surface) with the meta of the
// edit-in-place description editor (14px / 1.45, vertical resize). No new tokens.
const descriptionStyle: CSSProperties = {
  flexBasis: '100%',
  boxSizing: 'border-box',
  background: 'var(--surface-raised)',
  border: '1.5px solid var(--accent)',
  borderRadius: 'var(--radius-sm)',
  boxShadow: '0 0 0 3px var(--accent-soft)',
  padding: '12px 14px',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  lineHeight: 1.45,
  color: 'var(--ink-primary)',
  outline: 'none',
  resize: 'vertical',
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

// Full-width row for the char counter, sitting below the input/button pair on the wrapping flex
// form. The CharCounter renders nothing at rest, so this row is empty (zero height) until near-cap.
const counterRowStyle: CSSProperties = {
  flexBasis: '100%',
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
