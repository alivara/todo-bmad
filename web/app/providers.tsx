'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { PendingDeleteProvider } from '@/lib/pendingDelete';

// TanStack Query is the sole owner of server state (AD-4). One client per browser
// session; created lazily in state so it survives re-renders but is never shared
// across requests on the server.
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Keep list data fresh but avoid noisy refetches during the walking skeleton.
            staleTime: 5_000,
            retry: 1,
          },
        },
      }),
  );

  // PendingDeleteProvider mounts INSIDE the QueryClientProvider — it owns the AD-5 pending-delete
  // lifecycle by mutating the same TanStack cache (it calls useQueryClient).
  return (
    <QueryClientProvider client={queryClient}>
      <PendingDeleteProvider>{children}</PendingDeleteProvider>
    </QueryClientProvider>
  );
}
