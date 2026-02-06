'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  CheckCircle, 
  ArrowLeft,
  Zap,
  Shield,
  Clock
} from 'lucide-react';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 190000,
    displayPrice: '19만원',
    period: '/월',
    description: '1인 개원의를 위한 시작 플랜',
    features: [
      '30개 질문 모니터링',
      '3개 경쟁사 추적',
      '4개 AI 플랫폼 (ChatGPT, Claude, Perplexity, Gemini)',
      '주간 이메일 리포트',
      '기본 대시보드',
    ],
    color: 'gray',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 390000,
    displayPrice: '39만원',
    period: '/월',
    description: '성장하는 치과를 위한 플랜',
    features: [
      '80개 질문 모니터링',
      '5개 경쟁사 추적',
      '5개 AI 플랫폼',
      '카카오톡 알림',
      '감성 분석',
      '경쟁사 비교 리포트',
      '우선 지원',
    ],
    popular: true,
    color: 'blue',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 790000,
    displayPrice: '79만원',
    period: '/월',
    description: '중대형/네트워크 병원 플랜',
    features: [
      '200개 질문 모니터링',
      '10개 경쟁사 추적',
      '네이버 Cue 포함 6개 AI 플랫폼',
      '월간 PDF 리포트',
      'API 접근',
      '전담 매니저',
      '맞춤 컨설팅',
    ],
    color: 'purple',
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (planId: string, price: number) => {
    setLoading(planId);
    
    // 연간 결제 시 10개월 가격 (2개월 무료)
    const finalPrice = isYearly ? price * 10 : price;
    const billingType = isYearly ? 'yearly' : 'monthly';
    
    // 결제 페이지로 이동
    router.push(`/checkout?plan=${planId}&price=${finalPrice}&billing=${billingType}`);
  };

  const getDiscountedPrice = (price: number) => {
    if (isYearly) {
      return Math.round(price * 10 / 12); // 월 환산 가격
    }
    return price;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">Patient Signal</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                홈으로
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              플랜 선택
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              병원 규모에 맞는 플랜을 선택하세요. 7일 무료 체험 후 결제됩니다.
            </p>
            
            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-4 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setIsYearly(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  !isYearly 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                월간 결제
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  isYearly 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                연간 결제
                <span className="ml-2 text-xs text-green-600 font-semibold">2개월 무료</span>
              </button>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative p-8 bg-white rounded-2xl border-2 transition-all hover:shadow-xl ${
                  plan.popular 
                    ? 'border-blue-500 shadow-lg scale-105' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
                    가장 인기
                  </div>
                )}
                
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
                
                <div className="mt-6 mb-6">
                  {isYearly && (
                    <div className="text-sm text-gray-400 line-through">
                      {plan.displayPrice}/월
                    </div>
                  )}
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900">
                      {Math.round(getDiscountedPrice(plan.price) / 10000)}만원
                    </span>
                    <span className="text-gray-500 ml-1">/월</span>
                  </div>
                  {isYearly && (
                    <div className="text-sm text-green-600 font-medium mt-1">
                      연 {Math.round(plan.price * 10 / 10000)}만원 (2개월 무료)
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(plan.id, plan.price)}
                  disabled={loading !== null}
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full"
                  size="lg"
                >
                  {loading === plan.id ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      처리 중...
                    </span>
                  ) : (
                    '구독 시작하기'
                  )}
                </Button>
              </div>
            ))}
          </div>

          {/* Trust Badges */}
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">안전한 결제</div>
                <div className="text-sm text-gray-500">토스페이먼츠 보안 결제</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">7일 무료 체험</div>
                <div className="text-sm text-gray-500">부담 없이 시작하세요</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">언제든 해지</div>
                <div className="text-sm text-gray-500">위약금 없이 해지 가능</div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-20 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              자주 묻는 질문
            </h2>
            <div className="space-y-4">
              <div className="p-6 bg-white rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">
                  무료 체험은 어떻게 되나요?
                </h3>
                <p className="text-gray-600 text-sm">
                  모든 플랜은 7일 무료 체험을 제공합니다. 체험 기간 중 언제든 해지할 수 있으며, 
                  해지하지 않으면 7일 후 자동으로 첫 결제가 진행됩니다.
                </p>
              </div>
              <div className="p-6 bg-white rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">
                  플랜 변경이 가능한가요?
                </h3>
                <p className="text-gray-600 text-sm">
                  네, 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 
                  변경된 요금은 다음 결제일부터 적용됩니다.
                </p>
              </div>
              <div className="p-6 bg-white rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">
                  환불 정책은 어떻게 되나요?
                </h3>
                <p className="text-gray-600 text-sm">
                  결제 후 7일 이내 요청 시 전액 환불해 드립니다. 
                  7일 이후에는 일할 계산하여 남은 기간에 대해 환불해 드립니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          © 2024 페이션트퍼널 / 서울비디치과. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
