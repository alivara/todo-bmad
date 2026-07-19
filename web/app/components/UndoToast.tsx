'use client';

import type { CSSProperties } from 'react';
import { usePendingDelete } from '@/lib/pendingDelete';

// Locked microcopy, verbatim (Design Note 8).
const TOAST_LABEL = 'Task deleted';
const UNDO_LABEL = 'Undo';

/**
 * The pending-delete toast (Story 2.3): a single, non-stacking bottom-center pill. It shows the
 * MOST-RECENT pending delete — `Task deleted` + a real focusable `Undo` <button> that restores
 * that row in place with no round-trip (older pending deletes keep their own timers and commit
 * silently — RD-4). On a commit failure it switches to the sanctioned retryable error (RD-5).
 * Hidden when nothing is pending and there is no error.
 *
 * No `aria-live` / role="status" here — polished toast a11y is deferred (EXPERIENCE.md); the a11y
 * floor this story commits to is real focusable controls (the ✕ and this Undo).
 */
export function UndoToast() {
  const { visible, error, undo } = usePendingDelete();

  // The error is SCOPED to an entry (RD-5): surface it only when it belongs to the visible toast,
  // so a failed background commit never clobbers a newer, still-undoable toast. A commit failure on
  // the visible entry replaces its `Undo` with the retryable copy (the entry is no longer pending).
  //
  // AC3 class note: a delete-commit error is ALWAYS the 5xx/network (retryable) class — a 404 is
  // treated as success in deleteTodo (RD-5), so a 4xx never reaches here. The controller's message
  // is the sanctioned retryable copy, and the RETRY PATH is the row itself: on a failed commit the
  // controller resurrects the row in place (RD-5), so the user re-deletes via its ✕. We therefore
  // surface the class (sanctioned copy) without a duplicate Try-again button — the ✕ is the retry.
  const scopedError = error && visible && error.id === visible.id ? error.message : null;

  // Nothing visible to render.
  if (!visible) return null;

  return (
    <div style={pillStyle}>
      {scopedError ? (
        <span style={errorTextStyle}>{scopedError}</span>
      ) : (
        <>
          <span style={labelStyle}>{TOAST_LABEL}</span>
          <button type="button" onClick={() => undo(visible.id)} style={undoButtonStyle}>
            {UNDO_LABEL}
          </button>
        </>
      )}
    </div>
  );
}

// Bottom-center fixed pill: raised surface + toast shadow + fully-rounded (tokens only).
const pillStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'var(--space-5)',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-4)',
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--radius-full)',
  boxShadow: 'var(--shadow-toast)',
  zIndex: 50,
  maxWidth: 'calc(100vw - 2 * var(--space-4))',
};

const labelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--ink-primary)',
  whiteSpace: 'nowrap',
};

const errorTextStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--ink-secondary)',
};

// The Undo action: a real focusable button styled as an accent-colored text action on the pill.
const undoButtonStyle: CSSProperties = {
  padding: '4px 10px',
  border: 'none',
  background: 'transparent',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--accent)',
  cursor: 'pointer',
};
