'use client';

import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { fetchTodos, todosQueryKey } from '@/lib/todos';
import { usePendingDelete } from '@/lib/pendingDelete';
import { AddInput } from './components/AddInput';
import { EmptyState } from './components/EmptyState';
import { SkeletonList } from './components/SkeletonList';
import { TodoRow } from './components/TodoRow';
import { UndoToast } from './components/UndoToast';
import { Header } from './components/Header';

export default function HomePage() {
  // Pending-deleted ids are suppressed via the query `select` below (never removed from the cache),
  // so a refetch/invalidate during the undo window can't resurrect a row (AD-4/AD-5). This also
  // subscribes the page to the controller, so it re-renders — and rebuilds the `select` closure —
  // whenever the pending set changes.
  const { isPending: isPendingDelete } = usePendingDelete();
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: todosQueryKey,
    queryFn: fetchTodos,
    select: (rows) => rows.filter((t) => !isPendingDelete(t.id)),
  });

  return (
    <div style={pageStyle}>
      <Header />

      {/* The add-input is pinned above the list at every state (UX-DR5/DR15). */}
      <AddInput />

      <main style={mainStyle}>{renderBody()}</main>

      {/* The pending-delete Undo toast lives at page level (bottom-center fixed), above the list
          in the tree so a delete originating in any row surfaces here (Story 2.3). */}
      <UndoToast />
    </div>
  );

  function renderBody() {
    // The polished skeleton-shimmer loading state (Story 3.2) — 4 rows matching the row anatomy
    // plus the `Getting your tasks…` caption; never a blank screen or bare spinner (AC2, NFR2).
    if (isPending) {
      return <SkeletonList />;
    }

    // The warm, de-escalated load-failure state (Story 3.2). A NEUTRAL glyph (border-hairline field +
    // ink-secondary refresh arrow — no red, no alarm), the upsized headline, the locked reassuring
    // subline, and a solid accent Try-again that re-issues the request (refetch). Keeps role="alert".
    if (isError) {
      return (
        <div role="alert" style={centeredColumnStyle}>
          <div aria-hidden="true" style={errorGlyphFieldStyle}>
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ink-secondary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-3.5-7.1" />
              <path d="M21 4v4.5h-4.5" />
            </svg>
          </div>
          <h2 style={errorHeadlineStyle}>Couldn&apos;t load your tasks</h2>
          <p style={errorSublineStyle}>
            Something got in the way. Your tasks are safe — let&apos;s try that again.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="focus-ring"
            style={retryButtonStyle}
          >
            {isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      );
    }

    if (data.length === 0) {
      return <EmptyState />;
    }

    // The full read-only list (Story 1.3). Rendered in the server's received order
    // (newest-first: created_at DESC, id DESC) — never re-sorted client-side (AD-4).
    return (
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        {data.map((todo) => (
          // Plain semantic list wrapper; the card chrome now lives in TodoRow so it can vary
          // by status (raised when active, recessed when completed) — Story 2.1.
          <li key={todo.id}>
            <TodoRow todo={todo} />
          </li>
        ))}
      </ul>
    );
  }
}

const pageStyle: CSSProperties = {
  maxWidth: 560,
  margin: '0 auto',
  padding: '0 18px',
  minHeight: '100vh',
};

const mainStyle: CSSProperties = {
  paddingTop: 'var(--space-4)',
};

const centeredColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-6) var(--space-4)',
};

// The de-escalated error glyph field: a neutral border-hairline ring (NOT accent, NOT red) holding
// the ink-secondary refresh arrow — warm and calm, signalling "recoverable", not "alarm".
const errorGlyphFieldStyle: CSSProperties = {
  width: 84,
  height: 84,
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--border-hairline)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const errorHeadlineStyle: CSSProperties = {
  margin: 0,
  fontSize: 19,
  fontWeight: 700,
  lineHeight: 1.3,
  color: 'var(--ink-primary)',
};

const errorSublineStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.45,
  color: 'var(--ink-secondary)',
};

const retryButtonStyle: CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: '10px 18px',
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  cursor: 'pointer',
};
