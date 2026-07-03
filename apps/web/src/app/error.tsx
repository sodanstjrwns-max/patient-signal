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
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-slate-50">
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
        <AlertTriangle className="h-10 w-10 text-amber-600" />
      </div>

      <section className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
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
          className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          다시 시도
        </button>
        <a
          href="/dashboard"
          className="px-6 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-white flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          대시보드로
        </a>
      </div>
    </main>
  );
}
