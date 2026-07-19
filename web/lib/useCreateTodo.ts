'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTodoRequest, Todo } from '@shared/todo';
import { createTodo, todosQueryKey } from './todos';
import { makeOnSettled, removeById, swapById } from './optimistic';

// Scopes isMutating()/the mutation cache to creates, so onSettled can tell whether any
// OTHER add is still in flight before it reconciles (see onSettled below).
export const createTodoMutationKey = ['todos', 'create'] as const;

// Context carried from onMutate → onError/onSuccess: the temp id, used both to roll the
// row back by id on failure (NOT a whole-list snapshot restore — that would clobber a
// concurrent sibling add) and to swap for the real UUID on success.
type CreateContext = { tempId: string };

/**
 * The optimistic create mutation (AD-4). This is the FIRST of the app's four mutations;
 * its onMutate-snapshot / onError-restore / onSuccess-swap / onSettled-reconcile shape is
 * deliberately generic so Epic 2 (edit/toggle/delete) and Epic 3's systematized rollback
 * wrapper (R1) can extend it rather than hand-rolling rollback four times.
 */
export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, CreateTodoRequest, CreateContext>({
    mutationKey: createTodoMutationKey,
    mutationFn: createTodo,

    // Apply optimistically: prepend a temp row so it lands at the top in ≤100ms (AC1),
    // matching the server's newest-first ordering on settle.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: todosQueryKey });

      const tempId = crypto.randomUUID();
      const optimistic: Todo = {
        id: tempId,
        title: input.title,
        description: input.description ?? '',
        status: 'active',
        // Placeholder only — the server owns id/timestamps (AD-7). Swapped wholesale for
        // the real resource in onSuccess; never persisted, never trusted past settle.
        metadata: { createdAt: '', updatedAt: '' },
      };

      queryClient.setQueryData<Todo[]>(todosQueryKey, (rows) => [optimistic, ...(rows ?? [])]);
      return { tempId };
    },

    // Visible rollback (AC6): remove ONLY this add's row by temp id (removeById is id-scoped). A
    // whole-list snapshot restore would revert a concurrent sibling add that already swapped in its
    // server row (rapid type-Enter-type-Enter, UX-DR22); id-scoped removal leaves siblings intact.
    // onSettled then reconciles against server truth — no silent divergence.
    onError: (_err, _input, ctx) => {
      if (!ctx) return;
      removeById(queryClient, todosQueryKey, ctx.tempId);
    },

    // Swap the temp row for the server resource (temp id → real UUID, server status +
    // timestamps) — AD-7 identity handoff.
    onSuccess: (server, _input, ctx) => {
      if (!ctx) return;
      swapById(queryClient, todosQueryKey, ctx.tempId, server);
    },

    // Reconciliation backstop: after the LAST in-flight add settles, refetch so the cache equals
    // server truth (CM2). The shared makeOnSettled applies the gated invalidate (isMutating === 1)
    // so an early refetch during a concurrent add can't transiently drop a still-pending sibling.
    onSettled: makeOnSettled(queryClient, createTodoMutationKey, todosQueryKey),
  });
}
