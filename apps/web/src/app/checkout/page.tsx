'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  ArrowLeft,
  Shield,
  CheckCircle,
} from 'lucide-react';

// 결제위젯 연동 키 (Vercel 환경변수에서 가져옴)
const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || '';

const planDetails: Record<string, { name: string; description: string }> = {
  starter: { name: 'Starter', description: '1인 개원의를 위한 시작 플랜' },
  standard: { name: 'Standard', description: '성장하는 치과를 위한 플랜' },
  pro: { name: 'Pro', description: '중대형/네트워크 병원 플랜' },
};

declare global {
  interface Window {
    TossPayments: (clientKey: string) => {
      widgets: (options: { customerKey: string }) => any;
    };
  }
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  
  const plan = searchParams.get('plan') || 'starter';
  const price = parseInt(searchParams.get('price') || '190000');
  const billing = searchParams.get('billing') || 'monthly';
  
  const [loading, setLoading] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const widgetsRef = useRef<any>(null);

  // 고객 키 생성 (비회원용 랜덤 키)
  const customerKey = useRef(`guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`);

  // 결제위젯 SDK 로드 및 초기화
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v2/standard';
    script.async = true;
    
    script.onload = async () => {
      console.log('✅ 토스페이먼츠 SDK v2 로드 완료');
      
      if (!CLIENT_KEY) {
        setError('결제 설정이 올바르지 않습니다. 관리자에게 문의해주세요.');
        console.error('❌ NEXT_PUBLIC_TOSS_CLIENT_KEY 환경변수가 설정되지 않았습니다.');
        return;
      }

      try {
        // 1. TossPayments 초기화
        const tossPayments = window.TossPayments(CLIENT_KEY);
        console.log('✅ TossPayments 초기화 완료');
        
        // 2. 결제위젯 초기화
        const widgets = tossPayments.widgets({ customerKey: customerKey.current });
        widgetsRef.current = widgets;
        console.log('✅ 결제위젯 초기화 완료');
        
        // 3. 결제 금액 설정
        await widgets.setAmount({
          value: price,
          currency: 'KRW',
        });
        console.log('✅ 결제 금액 설정 완료:', price);
        
        // 4. 결제수단 UI 렌더링
        await widgets.renderPaymentMethods({
          selector: '#payment-methods',
          variantKey: 'DEFAULT',
        });
        console.log('✅ 결제수단 UI 렌더링 완료');
        
        // 5. 약관 동의 UI 렌더링
        await widgets.renderAgreement({
          selector: '#agreement',
          variantKey: 'AGREEMENT',
        });
        console.log('✅ 약관 동의 UI 렌더링 완료');
        
        setWidgetReady(true);
        
      } catch (err: any) {
        console.error('❌ 결제위젯 초기화 실패:', err);
        setError(`결제위젯 초기화 실패: ${err.message}`);
      }
    };
    
    script.onerror = () => {
      console.error('❌ 토스페이먼츠 SDK 로드 실패');
      setError('결제 시스템을 불러오는데 실패했습니다. 페이지를 새로고침 해주세요.');
    };
    
    document.head.appendChild(script);
  }, [price]);

  // 결제 요청
  const handlePayment = async () => {
    if (!widgetReady || !widgetsRef.current) {
      alert('결제 시스템을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const orderId = `PS_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const orderName = `Patient Signal ${planDetails[plan]?.name || 'Starter'} 플랜 (${billing === 'yearly' ? '연간' : '월간'})`;
      
      console.log('🚀 결제 요청:', { orderId, orderName, amount: price });
      
      // 결제 요청
      await widgetsRef.current.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/checkout/success?plan=${plan}&billing=${billing}`,
        failUrl: `${window.location.origin}/checkout/fail`,
      });
      
    } catch (err: any) {
      console.error('❌ 결제 요청 실패:', err);
      
      if (err.code === 'USER_CANCEL' || err.code === 'PAY_PROCESS_CANCELED') {
        console.log('사용자가 결제를 취소했습니다.');
        setLoading(false);
        return;
      }
      
      setError(`[${err.code || 'ERROR'}] ${err.message || '결제 중 오류가 발생했습니다.'}`);
      setLoading(false);
    }
  };

  const planInfo = planDetails[plan] || planDetails.starter;

  return (
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

              {/* 결제수단 위젯 */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div id="payment-methods" className="min-h-[300px]">
                  {!widgetReady && !error && (
                    <div className="flex items-center justify-center h-[300px]">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                        <p className="text-gray-500 text-sm">결제수단 불러오는 중...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 약관 동의 위젯 */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div id="agreement" className="min-h-[100px]">
                  {!widgetReady && !error && (
                    <div className="flex items-center justify-center h-[100px]">
                      <p className="text-gray-500 text-sm">약관 불러오는 중...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 text-sm">{error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-2 text-red-600 underline text-sm"
                  >
                    페이지 새로고침
                  </button>
                </div>
              )}

              {/* 결제 버튼 */}
              <Button
                onClick={handlePayment}
                disabled={!widgetReady || loading}
                className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
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
                ) : !widgetReady ? (
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
