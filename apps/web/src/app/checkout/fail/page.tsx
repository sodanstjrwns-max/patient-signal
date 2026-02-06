'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  XCircle,
  ArrowLeft,
  RefreshCw,
  MessageCircle
} from 'lucide-react';

const errorMessages: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제가 취소되었습니다.',
  PAY_PROCESS_ABORTED: '결제가 중단되었습니다.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거부했습니다. 카드사에 문의해주세요.',
  INVALID_CARD_EXPIRATION: '카드 유효기간이 만료되었습니다.',
  INVALID_STOPPED_CARD: '정지된 카드입니다.',
  EXCEED_MAX_DAILY_PAYMENT_COUNT: '일일 결제 한도를 초과했습니다.',
  EXCEED_MAX_PAYMENT_AMOUNT: '결제 한도를 초과했습니다.',
  INVALID_CARD_LOST_OR_STOLEN: '분실 또는 도난 신고된 카드입니다.',
  INVALID_CARD_NUMBER: '카드 번호가 올바르지 않습니다.',
  INSUFFICIENT_BALANCE: '잔액이 부족합니다.',
  DEFAULT: '결제 처리 중 오류가 발생했습니다.',
};

function FailContent() {
  const searchParams = useSearchParams();
  
  const code = searchParams.get('code') || 'DEFAULT';
  const message = searchParams.get('message') || errorMessages[code] || errorMessages.DEFAULT;
  const orderId = searchParams.get('orderId');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
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
          {/* Error Icon */}
          <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-8">
            <XCircle className="h-12 w-12 text-red-500" />
          </div>

          {/* Error Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            결제에 실패했습니다
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            {message}
          </p>

          {/* Error Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 text-left">
            <h2 className="font-semibold text-gray-900 mb-4">오류 정보</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">오류 코드</span>
                <span className="text-gray-900 font-mono">{code}</span>
              </div>
              {orderId && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">주문 번호</span>
                  <span className="text-gray-900 font-mono">{orderId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Solutions */}
          <div className="bg-amber-50 rounded-xl p-6 mb-8 text-left">
            <h2 className="font-semibold text-amber-900 mb-3">해결 방법</h2>
            <ul className="space-y-2 text-sm text-amber-800">
              <li className="flex items-start gap-2">
                <span className="font-medium">1.</span>
                다른 결제 수단을 시도해보세요
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium">2.</span>
                카드 한도 및 잔액을 확인해주세요
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium">3.</span>
                문제가 계속되면 카드사에 문의해주세요
              </li>
            </ul>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Link href="/pricing">
              <Button className="w-full" size="lg">
                <RefreshCw className="mr-2 h-5 w-5" />
                다시 결제하기
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full" size="lg">
                <ArrowLeft className="mr-2 h-5 w-5" />
                홈으로 돌아가기
              </Button>
            </Link>
          </div>

          {/* Support */}
          <div className="mt-8 p-4 bg-gray-100 rounded-lg">
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <MessageCircle className="h-5 w-5" />
              <span>
                도움이 필요하시면{' '}
                <a href="mailto:support@patientsignal.kr" className="text-blue-600 hover:underline font-medium">
                  support@patientsignal.kr
                </a>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function FailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}
