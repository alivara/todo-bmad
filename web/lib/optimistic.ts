// Shared optimistic-rollback plumbing (AC4a). The three TanStack mutations (create/toggle/edit)
// hand-rolled near-identical cache writes; these lighter helpers extract the common mechanics —
// the id-scoped cache mutators, the server-row swap, and the gated reconciliation invalidate — so
// each hook is SHORTER while its transform + ctx + which-fields-to-restore stay EXPLICIT in the
// hook. Deliberately NOT a `useOptimisticMutation` factory (Design Note 4): keeping each hook's
// onMutate/onError explicit minimizes regression on create's temp-id swap and edit's dual-field
// snapshot. Every write is id-scoped — NEVER a whole-list snapshot restore, which would clobber a
// concurrent sibling that already settled.

import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Todo } from '@shared/todo';

/**
 * Merge a partial patch into ONLY the row matching `id`, leaving every sibling untouched. This is
 * the id-scoped rollback restore: toggle puts back `{ status: prevStatus }`, edit puts back
 * `{ title: prevTitle, description: prevDescription }`. A sibling that already settled is intact.
 */
export function rollbackById(
  queryClient: QueryClient,
  queryKey: QueryKey,
  id: string,
  patch: Partial<Todo>,
): void {
  queryClient.setQueryData<Todo[]>(queryKey, (rows) =>
    (rows ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
  );
}

/**
 * Remove ONLY the row matching `id`. This is create's rollback: it drops its own temp row without
 * touching a concurrent sibling add that already swapped in its server row (UX-DR22).
 */
export function removeById(queryClient: QueryClient, queryKey: QueryKey, id: string): void {
  queryClient.setQueryData<Todo[]>(queryKey, (rows) => (rows ?? []).filter((t) => t.id !== id));
}

/**
 * Swap the row matching `id` for the authoritative server resource (AD-7 identity/timestamp
 * handoff). create swaps its temp id → the real UUID; toggle/edit swap their stable id in place.
 */
export function swapById(queryClient: QueryClient, queryKey: QueryKey, id: string, server: Todo): void {
  queryClient.setQueryData<Todo[]>(queryKey, (rows) => (rows ?? []).map((t) => (t.id === id ? server : t)));
}

/**
 * The gated reconciliation invalidate: refetch server truth only when THIS is the last in-flight
 * mutation of its kind (`isMutating === 1` — the settling mutation still counts as 1, the official
 * TanStack pattern), so an early refetch during a concurrent sibling can't transiently drop a
 * still-pending optimistic row.
 */
export function gatedInvalidate(queryClient: QueryClient, mutationKey: QueryKey, queryKey: QueryKey): void {
  if (queryClient.isMutating({ mutationKey }) === 1) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

/**
 * Build the shared `onSettled` all three mutations use — the gated reconciliation invalidate. The
 * three were byte-for-byte identical; this is the single source.
 */
export function makeOnSettled(
  queryClient: QueryClient,
  mutationKey: QueryKey,
  queryKey: QueryKey,
): () => void {
  return () => gatedInvalidate(queryClient, mutationKey, queryKey);
}
