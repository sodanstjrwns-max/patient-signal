'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { RefreshCw, Home } from 'lucide-react';

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
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-[#08090a] text-[#f5f5ef]">
      <div className="text-[clamp(6rem,18vw,12rem)] font-medium leading-none tracking-[-0.09em] text-[#c0c4c7]">Oops.</div>

      <section className="text-center max-w-md">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em] text-[#f5f5ef] mb-2">
          일시적인 오류가 발생했습니다
        </h1>
        <p className="text-[#959c9f]">
          불편을 드려 죄송합니다. 잠시 후 다시 시도해주세요.
          문제가 계속되면 고객센터로 문의해주세요.
        </p>
      </section>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-[#08090a] text-white rounded-none font-semibold hover:bg-[#d9ff43] flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          다시 시도
        </button>
        <a
          href="/dashboard"
          className="px-6 py-2.5 border border-[#30343a] bg-[#111315] rounded-none text-[#f5f5ef] hover:bg-[#181b1e] flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          대시보드로
        </a>
      </div>
    </main>
  );
}
