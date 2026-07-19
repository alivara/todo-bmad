'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Todo } from '@shared/todo';
import { deleteTodo, todosQueryKey } from './todos';

// The client-owned pending-delete window (AD-5). NO network call fires during this window; the
// real DELETE commits only when it elapses (or is flushed on unload).
const PENDING_WINDOW_MS = 5000;

// The sanctioned retryable copy (RD-5) — reused verbatim from the mutation error surface.
const COMMIT_ERROR_COPY = 'Something got in the way. Try again.';

// One in-flight pending delete. The snapshot lets a failed commit / unload flush reason about the
// row, but the cache is NEVER mutated to remove it — visibility is driven purely by suppression
// (see the list `select` filter in page.tsx). `dispatched` is the undo-vs-elapse race guard: set
// synchronously before the commit fetch. There is deliberately no captured `index`: the row is
// never removed from the cache, so it reappears in its natural position for free.
type PendingEntry = {
  snapshot: Todo;
  timerId: ReturnType<typeof setTimeout>;
  dispatched: boolean;
};

// The single visible toast target (RD-4 — non-stacking; only the most-recent delete is shown).
export type VisibleToast = { id: string };

// A commit error SCOPED to the entry it belongs to. The toast surfaces it ONLY when its id matches
// the visible toast, so a failed background commit can't clobber a newer, still-undoable toast.
export type CommitError = { id: string; message: string };

export type PendingDeleteContextValue = {
  requestDelete: (todo: Todo) => void;
  undo: (id: string) => void;
  // True while `id` is suppressed (pending delete). The list query's `select` filters on this so a
  // refetch during the window can't resurrect the row (the cache holds server truth; suppression
  // is separate state — AD-4).
  isPending: (id: string) => boolean;
  visible: VisibleToast | null;
  error: CommitError | null;
};

const PendingDeleteContext = createContext<PendingDeleteContextValue | null>(null);

/**
 * The pending-delete controller (Story 2.3, AD-5). It is deliberately NOT a TanStack optimistic
 * mutation — the network is DEFERRED, not fired on mutate. Crucially it does NOT model "deleted"
 * as absence from the cache: the cache always holds server truth, and a suppressed-id set drives
 * visibility (the list query filters pending ids via `select`). This is why a refetch/invalidate
 * during the window can't resurrect the row.
 *
 * Activating a delete suppresses the row immediately (≤100ms optimistic removal via the filter)
 * and starts a client-owned 5000ms timer with NO network call. Undo within the window stops
 * suppressing — the row reappears in its natural position from the still-intact cache, no
 * round-trip. On elapse the real DELETE fires (204/404 both = success, RD-5) and the row is then
 * dropped from the cache permanently; a 5xx/network failure just stops suppressing (the row
 * reappears) and surfaces a scoped retryable error. A still-pending delete on pagehide is flushed
 * via `fetch keepalive` so a reload/close commits it. The server never learns a delete was
 * "pending" — it does a plain hard delete.
 *
 * All pending deletes live in a ref'd Map (each its own timer, RD-4); a version counter re-renders
 * consumers whenever the pending set changes so the list `select` re-filters correctly.
 */
export function PendingDeleteProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const entriesRef = useRef<Map<string, PendingEntry>>(new Map());
  // Bumped whenever the pending set changes so consumers (the list `select`, the toast) re-render.
  const [, bumpPending] = useReducer((n: number) => n + 1, 0);
  const [visible, setVisible] = useState<VisibleToast | null>(null);
  const [error, setError] = useState<CommitError | null>(null);
  // Holds the auto-clear timer for the current scoped error so it can never be sticky (and is
  // torn down on unmount). One at a time — a fresh error replaces the prior timer.
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether `id` is currently suppressed. Reads the ref directly; the version bump re-renders
  // consumers, and page.tsx rebuilds its inline `select` closure on that render.
  const isPending = useCallback((id: string) => entriesRef.current.has(id), []);

  const clearErrorTimer = useCallback(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  // Surface a scoped commit error and schedule its auto-clear (RD-5 — never sticky). Only the entry
  // that failed owns it; the toast decides whether to show it (id must match the visible toast).
  const setScopedError = useCallback(
    (id: string, message: string) => {
      clearErrorTimer();
      setError({ id, message });
      errorTimerRef.current = setTimeout(() => {
        errorTimerRef.current = null;
        setError((e) => (e && e.id === id ? null : e));
        // If this error owned the visible toast, dismiss the toast too — the entry is no longer
        // pending, so it must not fall back to `Task deleted`/`Undo` once the error clears.
        setVisible((v) => (v?.id === id ? null : v));
      }, PENDING_WINDOW_MS);
    },
    [clearErrorTimer],
  );

  // The commit that fires when a pending window elapses. It sets `dispatched` SYNCHRONOUSLY before
  // the fetch (the race guard): once dispatched, undo(id) is a no-op. 204/404 → success: drop the
  // row from the cache permanently so it doesn't flash back when un-suppressed. 5xx/network →
  // resurrect by simply un-suppressing (the cache is intact) + surface the scoped retryable error.
  const commit = useCallback(
    (id: string) => {
      const entry = entriesRef.current.get(id);
      if (!entry || entry.dispatched) return;
      entry.dispatched = true;

      void deleteTodo(id)
        .then(() => {
          // Really gone server-side → remove from the cache so un-suppressing can't flash it back.
          queryClient.setQueryData<Todo[]>(todosQueryKey, (rows) => (rows ?? []).filter((t) => t.id !== id));
          entriesRef.current.delete(id);
          bumpPending();
          setVisible((v) => (v?.id === id ? null : v));
        })
        .catch(() => {
          // RD-5: never silently lose a record. Stop suppressing → the row reappears from the
          // still-intact cache in its natural position. Surface the error SCOPED to this id so it
          // only shows if this is (or becomes) the visible toast — a newer, still-undoable toast
          // is never clobbered; the reappearing row is the signal for a non-visible failure.
          entriesRef.current.delete(id);
          bumpPending();
          setScopedError(id, COMMIT_ERROR_COPY);
        });
    },
    [queryClient, bumpPending, setScopedError],
  );

  const requestDelete = useCallback(
    (todo: Todo) => {
      // NO cache mutation, NO network. Snapshot the row (for the unload flush / reasoning) and
      // suppress it: the row disappears in ≤100ms because the list `select` filters pending ids.
      const timerId = setTimeout(() => commit(todo.id), PENDING_WINDOW_MS);
      entriesRef.current.set(todo.id, { snapshot: todo, timerId, dispatched: false });
      bumpPending();

      // Single, non-stacking toast (RD-4): the newest delete becomes the visible one; older timers
      // keep running and commit silently. A fresh request clears any prior commit error.
      clearErrorTimer();
      setError(null);
      setVisible({ id: todo.id });
    },
    [commit, bumpPending, clearErrorTimer],
  );

  const undo = useCallback(
    (id: string) => {
      const entry = entriesRef.current.get(id);
      // Race guard: undo is a no-op once the commit has dispatched (or the entry is already gone).
      if (!entry || entry.dispatched) return;
      clearTimeout(entry.timerId);
      entriesRef.current.delete(id);
      bumpPending();
      // NO cache mutation — the row reappears in its natural position because it was never removed
      // from the cache and is no longer suppressed. Dismiss the toast + any scoped error IFF they
      // belong to this id (the auto-clear timer, if any, then fires as a harmless no-op).
      setVisible((v) => (v?.id === id ? null : v));
      setError((e) => (e?.id === id ? null : e));
    },
    [bumpPending],
  );

  // On pagehide, flush every non-dispatched pending delete via a keepalive DELETE so a reload/close
  // commits it (AD-5). `navigator.sendBeacon` is POST-only and cannot DELETE — a fetch with
  // `keepalive` is the mechanism. pagehide (not beforeunload) keeps bfcache correct (Design Note 2).
  useEffect(() => {
    const flush = () => {
      for (const [id, entry] of entriesRef.current) {
        if (entry.dispatched) continue;
        entry.dispatched = true;
        void fetch(`/api/todos/${id}`, { method: 'DELETE', keepalive: true });
      }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  // Finding #4: on unmount, clear every outstanding entry timer (and the error auto-clear timer) so
  // a torn-down provider can't fire a commit/setState after it's gone.
  useEffect(() => {
    const entries = entriesRef.current;
    return () => {
      for (const entry of entries.values()) clearTimeout(entry.timerId);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const value = useMemo<PendingDeleteContextValue>(
    () => ({ requestDelete, undo, isPending, visible, error }),
    [requestDelete, undo, isPending, visible, error],
  );

  return <PendingDeleteContext.Provider value={value}>{children}</PendingDeleteContext.Provider>;
}

/**
 * Access the pending-delete controller. Must be called within a PendingDeleteProvider (mounted
 * inside the QueryClientProvider so it can read/write the same TanStack cache).
 */
export function usePendingDelete(): PendingDeleteContextValue {
  const ctx = useContext(PendingDeleteContext);
  if (!ctx) {
    throw new Error('usePendingDelete must be used within a PendingDeleteProvider');
  }
  return ctx;
}
