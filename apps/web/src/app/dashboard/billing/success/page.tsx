'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { paymentsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/hooks/useToast';
import { Loader2, CheckCircle2, PartyPopper, Sparkles } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  useEffect(() => {
    const confirmPayment = async () => {
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');

      if (!paymentKey || !orderId || !amount) {
        setStatus('error');
        toast.error('결제 정보가 올바르지 않습니다.');
        return;
      }

      try {
        // 백엔드에서 결제 승인 처리
        const { data } = await paymentsApi.confirm({
          paymentKey,
          orderId,
          amount: Number(amount),
        });

        setPaymentInfo(data);
        setStatus('success');
        toast.success('결제가 완료되었습니다!');
      } catch (err: any) {
        setStatus('error');
        toast.error(err.response?.data?.message || '결제 승인에 실패했습니다.');
      }
    };

    confirmPayment();
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="text-gray-600 text-lg">결제를 확인하고 있습니다...</p>
        <p className="text-gray-400 text-sm">잠시만 기다려주세요</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <span className="text-3xl">!</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">결제 확인에 문제가 있습니다</h2>
        <p className="text-gray-500 text-center max-w-md">
          걱정하지 마세요. 결제가 실제로 이루어졌다면 자동으로 처리됩니다.
          문제가 지속되면 고객센터로 문의해주세요.
        </p>
        <div className="flex gap-3 mt-4">
          <a
            href="/dashboard/settings"
            className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            설정으로 이동
          </a>
          <a
            href="/dashboard"
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            대시보드로 이동
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
        <PartyPopper className="h-12 w-12 text-green-600" />
      </div>

      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">결제 완료!</h2>
        <p className="text-gray-500">구독이 활성화되었습니다. 지금 바로 시작하세요.</p>
      </div>

      {paymentInfo?.receiptUrl && (
        <a
          href={paymentInfo.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 underline"
        >
          영수증 확인
        </a>
      )}

      <div className="flex gap-3 mt-4">
        <a
          href="/dashboard"
          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2"
        >
          <Sparkles className="h-5 w-5" />
          대시보드로 이동
        </a>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
