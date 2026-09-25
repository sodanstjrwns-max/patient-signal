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
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-[#f1f1eb] text-[#141512]">
      <div className="text-[clamp(6rem,18vw,12rem)] font-medium leading-none tracking-[-0.09em] text-[#44551d]">Oops.</div>

      <section className="text-center max-w-md">
        <h1 className="text-3xl font-semibold tracking-[-0.055em] text-[#141512] mb-2">
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
          className="px-6 py-2.5 bg-[#141512] text-white rounded-none font-semibold hover:bg-[#d0ff43] flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          다시 시도
        </button>
        <a
          href="/dashboard"
          className="px-6 py-2.5 border border-[#d4d6cb] bg-white rounded-none text-[#141512] hover:bg-[#e9ebe1] flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          대시보드로
        </a>
      </div>
    </main>
  );
}
