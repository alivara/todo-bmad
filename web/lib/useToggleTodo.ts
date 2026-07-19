'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Todo, TodoStatus } from '@shared/todo';
import { updateTodo, todosQueryKey } from './todos';
import { makeOnSettled, rollbackById, swapById } from './optimistic';

// Scopes isMutating()/the mutation cache to toggles, so onSettled can tell whether any OTHER
// toggle is still in flight before it reconciles (see onSettled below). Mirrors createTodoMutationKey.
export const toggleTodoMutationKey = ['todos', 'toggle'] as const;

// The toggle input: the row id plus the NEXT status to flip to. Status-only PATCH (AD-6).
export type ToggleInput = { id: string; status: TodoStatus };

// Context carried from onMutate → onError/onSuccess. No temp id (id is stable, unlike create):
// we snapshot the PRIOR status so onError can restore exactly that row on failure (id-based
// rollback, NOT a whole-list snapshot — a sibling toggle that already settled stays intact).
type ToggleContext = { id: string; prevStatus: TodoStatus };

/**
 * The optimistic toggle mutation (AD-4), the second of the app's mutations. It mirrors
 * useCreateTodo's onMutate-snapshot / onError-restore / onSuccess-swap / onSettled-reconcile
 * shape, minus the temp-id dance (the id is already stable). The status flips in the cache in
 * ≤100ms; on failure it flips back visibly to the prior status; on success the server row
 * (with its bumped updatedAt) replaces the optimistic one (AD-7).
 */
export function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, ToggleInput, ToggleContext>({
    mutationKey: toggleTodoMutationKey,
    mutationFn: ({ id, status }) => updateTodo(id, { status }),

    // Apply optimistically: flip this row's status by id so the completed style settles in
    // ≤100ms (AC1). Snapshot the prior status for an id-scoped rollback on failure.
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: todosQueryKey });

      const prev = queryClient.getQueryData<Todo[]>(todosQueryKey)?.find((t) => t.id === id);
      // Fall back to the opposite of the requested status if the row is somehow absent — the
      // rollback still restores a coherent prior state.
      const prevStatus: TodoStatus = prev?.status ?? (status === 'completed' ? 'active' : 'completed');

      queryClient.setQueryData<Todo[]>(todosQueryKey, (rows) =>
        (rows ?? []).map((t) => (t.id === id ? { ...t, status } : t)),
      );

      return { id, prevStatus };
    },

    // Visible rollback (AC6): restore ONLY this row's prior status by id (rollbackById is
    // id-scoped). A whole-list snapshot restore would clobber a concurrent sibling toggle that
    // already settled; id-scoped restore leaves siblings intact. onSettled then reconciles.
    onError: (_err, _input, ctx) => {
      if (!ctx) return;
      rollbackById(queryClient, todosQueryKey, ctx.id, { status: ctx.prevStatus });
    },

    // Swap the optimistic row for the server resource by id (adopting the server's bumped
    // updatedAt) — AD-7 identity/timestamp handoff.
    onSuccess: (server, _input, ctx) => {
      if (!ctx) return;
      swapById(queryClient, todosQueryKey, ctx.id, server);
    },

    // Reconciliation backstop: after the LAST in-flight toggle settles, refetch so the cache equals
    // server truth. The shared makeOnSettled applies the gated invalidate (isMutating === 1) so an
    // early refetch during a concurrent toggle can't transiently drop a pending flip.
    onSettled: makeOnSettled(queryClient, toggleTodoMutationKey, todosQueryKey),
  });
}
