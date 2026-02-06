'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  ArrowLeft,
  CreditCard,
  Shield,
  CheckCircle,
  Smartphone,
  Building2,
  Wallet
} from 'lucide-react';

const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_GePWvyJnrKvgOLXvqEneVgLzN97E';

const planDetails: Record<string, { name: string; description: string }> = {
  starter: { name: 'Starter', description: '1인 개원의를 위한 시작 플랜' },
  standard: { name: 'Standard', description: '성장하는 치과를 위한 플랜' },
  pro: { name: 'Pro', description: '중대형/네트워크 병원 플랜' },
};

const paymentMethods = [
  { id: '카드', name: '신용/체크카드', icon: CreditCard, description: '국내 모든 카드 결제' },
  { id: '계좌이체', name: '계좌이체', icon: Building2, description: '실시간 계좌이체' },
  { id: '가상계좌', name: '가상계좌', icon: Wallet, description: '무통장 입금' },
  { id: '휴대폰', name: '휴대폰 결제', icon: Smartphone, description: '휴대폰 소액결제' },
];

declare global {
  interface Window {
    TossPayments: any;
  }
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  
  const plan = searchParams.get('plan') || 'starter';
  const price = parseInt(searchParams.get('price') || '190000');
  const billing = searchParams.get('billing') || 'monthly';
  
  const [selectedMethod, setSelectedMethod] = useState('카드');
  const [loading, setLoading] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  const handlePayment = async () => {
    if (!sdkReady || !agreementChecked || !window.TossPayments) {
      alert('결제 시스템을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    
    setLoading(true);
    
    try {
      const tossPayments = window.TossPayments(clientKey);
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const orderName = `Patient Signal ${planDetails[plan]?.name || 'Starter'} 플랜 (${billing === 'yearly' ? '연간' : '월간'})`;
      
      // 결제 수단별 파라미터 설정
      const baseParams = {
        amount: price,
        orderId,
        orderName,
        successUrl: `${window.location.origin}/checkout/success?plan=${plan}&billing=${billing}`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerName: '고객',
      };
      
      // 결제 수단별 추가 파라미터
      let paymentParams: any = { ...baseParams };
      
      if (selectedMethod === '가상계좌') {
        paymentParams = {
          ...baseParams,
          validHours: 24, // 입금 유효시간 24시간
          cashReceipt: {
            type: '소득공제',
          },
        };
      } else if (selectedMethod === '계좌이체') {
        paymentParams = {
          ...baseParams,
          cashReceipt: {
            type: '소득공제',
          },
        };
      } else if (selectedMethod === '휴대폰') {
        paymentParams = {
          ...baseParams,
        };
      }
      
      await tossPayments.requestPayment(selectedMethod, paymentParams);
    } catch (error: any) {
      console.error('결제 요청 실패:', error);
      if (error.code !== 'USER_CANCEL') {
        alert(error.message || '결제 중 오류가 발생했습니다.');
      }
      setLoading(false);
    }
  };

  const planInfo = planDetails[plan] || planDetails.starter;

  return (
    <>
      <Script 
        src="https://js.tosspayments.com/v1/payment"
        onLoad={() => setSdkReady(true)}
      />
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-xl text-gray-900">Patient Signal</span>
              </Link>
              <Link href="/pricing">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  플랜 변경
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-8">
              {/* 결제 정보 */}
              <div className="lg:col-span-3 space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">결제하기</h1>
                  <p className="text-gray-600">안전하게 결제를 완료하세요</p>
                </div>

                {/* 결제 수단 선택 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    결제 수단 선택
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {paymentMethods.map((method) => {
                      const Icon = method.icon;
                      return (
                        <button
                          key={method.id}
                          onClick={() => setSelectedMethod(method.id)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            selectedMethod === method.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              selectedMethod === method.id ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                              <Icon className={`h-5 w-5 ${
                                selectedMethod === method.id ? 'text-blue-600' : 'text-gray-600'
                              }`} />
                            </div>
                            <div>
                              <div className={`font-medium ${
                                selectedMethod === method.id ? 'text-blue-900' : 'text-gray-900'
                              }`}>
                                {method.name}
                              </div>
                              <div className="text-xs text-gray-500">{method.description}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 약관 동의 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">약관 동의</h2>
                  
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreementChecked}
                        onChange={(e) => setAgreementChecked(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">
                        <span className="font-medium text-gray-900">[필수]</span> 결제 서비스 이용약관 및 개인정보 제3자 제공에 동의합니다.
                      </span>
                    </label>
                  </div>
                  
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">
                      • 7일 무료 체험 기간이 제공됩니다.<br />
                      • 체험 기간 중 해지 시 결제되지 않습니다.<br />
                      • 체험 기간 종료 후 자동으로 정기 결제가 시작됩니다.
                    </p>
                  </div>
                </div>

                {/* 결제 버튼 */}
                <Button
                  onClick={handlePayment}
                  disabled={!sdkReady || !agreementChecked || loading}
                  className="w-full h-14 text-lg"
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      결제 처리 중...
                    </span>
                  ) : !sdkReady ? (
                    '결제 시스템 로딩 중...'
                  ) : (
                    `${price.toLocaleString()}원 결제하기`
                  )}
                </Button>
              </div>

              {/* 주문 요약 */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">주문 요약</h2>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">
                          {planInfo.name} 플랜
                        </div>
                        <div className="text-sm text-gray-500">
                          {billing === 'yearly' ? '연간 구독' : '월간 구독'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {price.toLocaleString()}원
                        </div>
                        {billing === 'yearly' && (
                          <div className="text-xs text-green-600">2개월 무료</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex justify-between font-semibold text-lg">
                        <span>총 결제 금액</span>
                        <span className="text-blue-600">{price.toLocaleString()}원</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        VAT 포함
                      </div>
                    </div>
                  </div>

                  {/* 무료 체험 안내 */}
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-blue-900">7일 무료 체험</div>
                        <div className="text-sm text-blue-700">
                          지금 결제해도 7일간 무료로 사용하실 수 있어요. 
                          체험 기간 중 해지하면 결제되지 않습니다.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 보안 안내 */}
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    <Shield className="h-4 w-4" />
                    <span>토스페이먼츠 보안 결제</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
