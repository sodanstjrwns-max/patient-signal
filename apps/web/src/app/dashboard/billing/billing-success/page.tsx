'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { paymentsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/hooks/useToast';
import { Loader2, CreditCard, PartyPopper, Sparkles } from 'lucide-react';

function BillingSuccessContent() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const processBilling = async () => {
      const authKey = searchParams.get('authKey');
      const customerKey = searchParams.get('customerKey');
      const plan = searchParams.get('plan') || 'STARTER';  // 빌링키 등록은 유료 플랜만

      if (!authKey || !customerKey || !hospitalId) {
        setStatus('error');
        toast.error('빌링키 등록 정보가 올바르지 않습니다.');
        return;
      }

      try {
        // 빌링키 발급
        await paymentsApi.issueBillingKey({
          authKey,
          customerKey,
          hospitalId,
        });

        setStatus('success');
        toast.success('카드 등록이 완료되었습니다!');
      } catch (err: any) {
        setStatus('error');
        toast.error(err.response?.data?.message || '카드 등록에 실패했습니다.');
      }
    };

    processBilling();
  }, [searchParams, hospitalId]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="text-gray-600 text-lg">카드를 등록하고 있습니다...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <CreditCard className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">카드 등록에 문제가 있습니다</h2>
        <p className="text-gray-500 text-center max-w-md">
          다시 시도해주세요. 문제가 지속되면 고객센터로 문의해주세요.
        </p>
        <a
          href="/dashboard/billing"
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          다시 시도하기
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
        <PartyPopper className="h-12 w-12 text-green-600" />
      </div>

      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">카드 등록 완료!</h2>
        <p className="text-gray-500">
          자동결제가 설정되었습니다. 7일 무료 체험 후 자동으로 결제됩니다.
        </p>
      </div>

      <a
        href="/dashboard"
        className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2"
      >
        <Sparkles className="h-5 w-5" />
        대시보드로 이동
      </a>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <BillingSuccessContent />
    </Suspense>
  );
}
