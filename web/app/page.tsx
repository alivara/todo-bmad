'use client';

import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { fetchTodos, todosQueryKey } from '@/lib/todos';
import { AddInput } from './components/AddInput';
import { EmptyState } from './components/EmptyState';
import { Wordmark } from './components/Wordmark';

export default function HomePage() {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: todosQueryKey,
    queryFn: fetchTodos,
  });

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <Wordmark />
      </header>

      {/* The add-input is pinned above the list at every state (UX-DR5/DR15). */}
      <AddInput />

      <main style={mainStyle}>{renderBody()}</main>
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

    // Minimal list fallback. Full row anatomy (description clamp, relative time,
    // newest-first guarantees) is Story 1.3; Story 1.1's database is empty, so this
    // is a safety net rather than the real list view.
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
          <li key={todo.id} style={rowStyle}>
            {todo.title}
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

const rowStyle: CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-row)',
  padding: 'var(--space-4)',
  fontSize: 17,
  fontWeight: 500,
  color: 'var(--ink-primary)',
};
