'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-[#f6f7f9] text-[#17212e]">
      <div className="w-16 h-16 bg-[#fff5e9] rounded-[16px] flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-[#b46d18]" />
      </div>

      <section className="text-center max-w-md">
        <h1 className="text-2xl font-bold tracking-[-0.04em] text-[#17212e] mb-2">
          일시적인 오류가 발생했습니다
        </h1>
        <p className="text-slate-500">
          불편을 드려 죄송합니다. 잠시 후 다시 시도해주세요.
          문제가 계속되면 고객센터로 문의해주세요.
        </p>
      </section>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-[#285cf4] text-white rounded-[10px] font-semibold hover:bg-[#204bce] flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          다시 시도
        </button>
        <a
          href="/dashboard"
          className="px-6 py-2.5 border border-[#dce2e9] bg-white rounded-[10px] text-[#263548] hover:bg-[#f6f8fb] flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          대시보드로
        </a>
      </div>
    </main>
  );
}
