'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastContainer } from '@/components/ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000, // 2분 기본값 (개별 훅에서 override)
            gcTime: 10 * 60 * 1000,    // 10분간 가비지 컬렉션 유지 (페이지 전환 시 캐시 보존)
            refetchOnWindowFocus: false,
            // 429(레이트리밋)는 2회까지, 그 외는 1회 재시도
            retry: (failureCount, error: any) => {
              const status = error?.response?.status;
              if (status === 429) return failureCount < 2;
              return failureCount < 1;
            },
            // 즉시 재시도하면 레이트리밋을 또 밟는다 — 1초/2초 백오프
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
            refetchOnMount: false,       // 마운트 시 stale 아니면 재요청 안 함
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastContainer />
    </QueryClientProvider>
  );
}
