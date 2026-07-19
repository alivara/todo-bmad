'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Todo, UpdateTodoRequest } from '@shared/todo';
import { updateTodo, todosQueryKey } from './todos';

// Scopes isMutating()/the mutation cache to field-edits, so onSettled can tell whether any
// OTHER edit is still in flight before it reconciles (see onSettled below). Mirrors
// toggleTodoMutationKey / createTodoMutationKey.
export const updateTodoMutationKey = ['todos', 'update'] as const;

// The edit input: the row id plus the partial patch of CHANGED fields only (AD-6). The caller
// (TodoRow) has already trimmed + per-field diffed, so `patch` never carries an unchanged field
// and a description cleared to "" is present (an intentional clear), not omitted.
export type UpdateInput = { id: string; patch: UpdateTodoRequest };

// Context carried from onMutate → onError/onSuccess. Snapshot BOTH prior title AND description
// so onError can restore exactly that row on failure (id-based rollback, NOT a whole-list
// snapshot — a sibling edit that already settled stays intact). Both are captured for a uniform
// context even when only one field changed.
type UpdateContext = { id: string; prevTitle: string; prevDescription: string };

/**
 * The optimistic field-edit mutation (AD-4), mirroring useToggleTodo's onMutate-snapshot /
 * onError-restore / onSuccess-swap / onSettled-reconcile shape. The changed fields apply to the
 * cache by id in ≤100ms; on failure BOTH the title and description flip back visibly to their
 * prior values; on success the server row (with its bumped updatedAt) replaces the optimistic
 * one (AD-7). Only the fields in `patch` are sent — an absent field is never zero-value
 * overwritten (AD-6).
 */
export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, UpdateInput, UpdateContext>({
    mutationKey: updateTodoMutationKey,
    mutationFn: ({ id, patch }) => updateTodo(id, patch),

    // Apply optimistically: merge the changed fields into this row by id so the edit settles in
    // ≤100ms. Snapshot the prior title AND description for an id-scoped rollback on failure.
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: todosQueryKey });

      const prev = queryClient.getQueryData<Todo[]>(todosQueryKey)?.find((t) => t.id === id);

      queryClient.setQueryData<Todo[]>(todosQueryKey, (rows) =>
        (rows ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );

      return { id, prevTitle: prev?.title ?? '', prevDescription: prev?.description ?? '' };
    },

    // Visible rollback (AC5): restore ONLY this row's prior title + description by id. A
    // whole-list snapshot restore would clobber a concurrent sibling edit that already settled;
    // id-scoped restore leaves siblings intact. onSettled then reconciles against the server.
    onError: (_err, _input, ctx) => {
      if (!ctx) return;
      queryClient.setQueryData<Todo[]>(todosQueryKey, (rows) =>
        (rows ?? []).map((t) =>
          t.id === ctx.id ? { ...t, title: ctx.prevTitle, description: ctx.prevDescription } : t,
        ),
      );
    },

    // Swap the optimistic row for the server resource by id (adopting the server's bumped
    // updatedAt) — AD-7 identity/timestamp handoff.
    onSuccess: (server, _input, ctx) => {
      queryClient.setQueryData<Todo[]>(todosQueryKey, (rows) =>
        (rows ?? []).map((t) => (t.id === ctx?.id ? server : t)),
      );
    },

    // Reconciliation backstop: after the LAST in-flight edit settles, refetch so the cache
    // equals server truth. Gated on isMutating === 1 (the settling mutation still counts as 1)
    // so an early refetch during a concurrent edit can't transiently drop a pending change.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: updateTodoMutationKey }) === 1) {
        void queryClient.invalidateQueries({ queryKey: todosQueryKey });
      }
    },
  });
}
