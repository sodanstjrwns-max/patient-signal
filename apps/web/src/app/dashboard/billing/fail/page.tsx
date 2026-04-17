'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

function FailContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('code') || '';
  const errorMessage = searchParams.get('message') || '결제에 실패했습니다.';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center">
        <AlertCircle className="h-12 w-12 text-red-500" />
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">결제 실패</h2>
        <p className="text-slate-500 max-w-md">{decodeURIComponent(errorMessage)}</p>
        {errorCode && (
          <p className="text-xs text-slate-400 mt-2">에러 코드: {errorCode}</p>
        )}
      </div>

      <div className="flex gap-3 mt-4">
        <a
          href="/dashboard/billing"
          className="px-6 py-2.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          다시 시도하기
        </a>
        <a
          href="/dashboard/settings"
          className="px-6 py-2.5 border border-slate-200 rounded-2xl text-slate-700 hover:bg-white/60"
        >
          설정으로 돌아가기
        </a>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}
