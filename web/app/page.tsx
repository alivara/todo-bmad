'use client';

import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { fetchTodos, todosQueryKey } from '@/lib/todos';
import { usePendingDelete } from '@/lib/pendingDelete';
import { AddInput } from './components/AddInput';
import { EmptyState } from './components/EmptyState';
import { TodoRow } from './components/TodoRow';
import { UndoToast } from './components/UndoToast';
import { Wordmark } from './components/Wordmark';

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
      <header style={headerStyle}>
        <Wordmark />
      </header>

      {/* The add-input is pinned above the list at every state (UX-DR5/DR15). */}
      <AddInput />

      <main style={mainStyle}>{renderBody()}</main>

      {/* The pending-delete Undo toast lives at page level (bottom-center fixed), above the list
          in the tree so a delete originating in any row surfaces here (Story 2.3). */}
      <UndoToast />
    </div>
  );

  function renderBody() {
    // Basic loading indicator — never a blank screen (AC2, NFR2). The polished
    // skeleton-shimmer rows are Epic 3 (Story 3.2).
    if (isPending) {
      return (
        <p role="status" style={mutedTextStyle}>
          Getting your tasks…
        </p>
      );
    }

    // Basic non-disruptive error with a working retry (re-issues the request). The
    // polished warm error illustration + 4xx/5xx split are Epic 3 (Stories 3.1/3.2).
    if (isError) {
      return (
        <div role="alert" style={centeredColumnStyle}>
          <p style={{ ...mutedTextStyle, color: 'var(--ink-primary)' }}>Couldn&apos;t load your tasks</p>
          <button type="button" onClick={() => refetch()} disabled={isFetching} style={retryButtonStyle}>
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

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-5) 0',
};

const mainStyle: CSSProperties = {
  paddingTop: 'var(--space-4)',
};

const mutedTextStyle: CSSProperties = {
  color: 'var(--ink-secondary)',
  fontSize: 14,
  textAlign: 'center',
};

const centeredColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-6) var(--space-4)',
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
