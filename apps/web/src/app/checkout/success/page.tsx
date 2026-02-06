'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  CheckCircle,
  ArrowRight,
  PartyPopper
} from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderId = searchParams.get('orderId');
  const paymentKey = searchParams.get('paymentKey');
  const amount = searchParams.get('amount');

  useEffect(() => {
    async function verifyPayment() {
      if (!orderId || !paymentKey || !amount) {
        setError('결제 정보가 올바르지 않습니다.');
        setVerifying(false);
        return;
      }

      try {
        // 백엔드에서 결제 승인 처리
        const response = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId,
            paymentKey,
            amount: parseInt(amount),
          }),
        });

        const data = await response.json();

        if (data.success) {
          setVerified(true);
        } else {
          setError(data.message || '결제 승인에 실패했습니다.');
        }
      } catch (err) {
        console.error('결제 승인 오류:', err);
        setError('결제 승인 중 오류가 발생했습니다.');
      } finally {
        setVerifying(false);
      }
    }

    verifyPayment();
  }, [orderId, paymentKey, amount]);

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">결제 확인 중...</h2>
          <p className="text-gray-500 mt-2">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            결제 승인 실패
          </h1>
          <p className="text-gray-600 mb-8">{error}</p>
          <div className="space-y-3">
            <Link href="/pricing">
              <Button className="w-full">다시 시도하기</Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full">홈으로 돌아가기</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">Patient Signal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto text-center">
          {/* Success Icon */}
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <div className="absolute -top-2 -right-2">
              <PartyPopper className="h-8 w-8 text-yellow-500" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            결제가 완료되었습니다! 🎉
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Patient Signal 구독이 시작되었습니다.<br />
            7일간 무료로 모든 기능을 사용해보세요!
          </p>

          {/* Order Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 text-left">
            <h2 className="font-semibold text-gray-900 mb-4">주문 정보</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">주문 번호</span>
                <span className="text-gray-900 font-mono">{orderId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">결제 금액</span>
                <span className="text-gray-900">{parseInt(amount || '0').toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">무료 체험</span>
                <span className="text-green-600 font-medium">7일</span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 rounded-xl p-6 mb-8 text-left">
            <h2 className="font-semibold text-blue-900 mb-3">다음 단계</h2>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                병원 정보를 등록하세요
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                모니터링할 질문을 설정하세요
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                경쟁사를 추가하고 비교해보세요
              </li>
            </ul>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Link href="/dashboard">
              <Button className="w-full" size="lg">
                대시보드로 이동
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button variant="outline" className="w-full" size="lg">
                병원 등록 시작하기
              </Button>
            </Link>
          </div>

          {/* Support */}
          <p className="text-sm text-gray-500 mt-8">
            문의사항이 있으시면{' '}
            <a href="mailto:support@patientsignal.kr" className="text-blue-600 hover:underline">
              support@patientsignal.kr
            </a>
            로 연락해주세요.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
