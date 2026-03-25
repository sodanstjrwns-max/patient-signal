'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { couponsApi, paymentsApi, subscriptionsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/hooks/useToast';
import {
  CreditCard,
  Tag,
  Check,
  X,
  Loader2,
  ArrowLeft,
  Shield,
  Gift,
  Sparkles,
  Crown,
  PartyPopper,
  AlertCircle,
  ChevronRight,
  BadgeCheck,
  Clock,
} from 'lucide-react';

// ============== 플랜 정보 (Single Source of Truth) ==============
const PLAN_INFO: Record<string, {
  name: string;
  price: number;
  priceText: string;
  description: string;
  features: string[];
  color: string;
}> = {
  FREE: {
    name: 'Free',
    price: 0,
    priceText: '무료',
    description: '무료 체험 - 기본 모니터링',
    features: [
      '모니터링 질문 1개',
      '1개 AI 플랫폼 (Perplexity)',
      '주 1회 크롤링 (월 4회)',
      '경쟁사 분석 없음',
      'ABHS 기본 점수 확인',
    ],
    color: 'gray',
  },
  STARTER: {
    name: 'Starter',
    price: 120000,
    priceText: '12만원/월',
    description: '기본 AI 가시성 모니터링',
    features: [
      '모니터링 질문 5개',
      '4개 AI 플랫폼 (ChatGPT, Claude, Perplexity, Gemini)',
      '매일 크롤링 (월 30회)',
      '경쟁사 1개 비교 분석',
      'ABHS 점수 & 주간 리포트',
    ],
    color: 'blue',
  },
  STANDARD: {
    name: 'Standard',
    price: 290000,
    priceText: '29만원/월',
    description: '개원의를 위한 핵심 플랜',
    features: [
      '모니터링 질문 15개',
      '4개 AI 플랫폼 전체',
      '매일 크롤링 (월 30회)',
      '경쟁사 5개 비교 분석',
      'AI 질문 변형 & 액션 인텔리전스',
    ],
    color: 'indigo',
  },
  PRO: {
    name: 'Pro',
    price: 590000,
    priceText: '59만원/월',
    description: '데이터 드리븐 원장을 위한 프로 플랜',
    features: [
      '모니터링 질문 35개',
      '4개 AI 플랫폼 전체',
      '매일 크롤링 (월 30회)',
      '경쟁사 10개 비교 분석',
      'Content Gap & 딥리포트',
    ],
    color: 'purple',
  },
};

// Toss Payments 클라이언트 키 (라이브 - API 개별 연동)
const TOSS_CLIENT_KEY = 'live_ck_LkKEypNArWgym1QbWvEQrlmeaxYG';

function BillingContent() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;

  // URL params
  const selectedPlanId = searchParams.get('plan') || 'FREE';
  const showCouponParam = searchParams.get('coupon') === 'true';

  // State
  const [currentStep, setCurrentStep] = useState<'plan' | 'coupon' | 'payment' | 'success'>('plan');
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(selectedPlanId);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  // 구독 상태 조회
  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription', hospitalId],
    queryFn: () => paymentsApi.getSubscriptionStatus(hospitalId!).then(r => r.data),
    enabled: !!hospitalId,
  });

  // 쿠폰 파라미터가 있으면 쿠폰 단계로
  useEffect(() => {
    if (showCouponParam) {
      setCurrentStep('coupon');
    }
  }, [showCouponParam]);

  const planInfo = PLAN_INFO[selectedPlan] || PLAN_INFO.FREE;
  const finalPrice = couponResult?.pricing?.finalPrice ?? planInfo.price;
  const freeMonths = couponResult?.pricing?.freeMonths || 0;

  // ============== 쿠폰 검증 ==============
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('쿠폰 코드를 입력해주세요.');
      return;
    }

    setCouponError('');
    setCouponResult(null);
    setIsApplyingCoupon(true);

    try {
      const { data } = await couponsApi.validate(couponCode.trim(), selectedPlan);
      setCouponResult(data);
      toast.success('쿠폰이 확인되었습니다!');
    } catch (err: any) {
      const msg = err.response?.data?.message || '유효하지 않은 쿠폰 코드입니다.';
      setCouponError(msg);
      toast.error(msg);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // ============== 쿠폰 적용 (무료 기간) ==============
  const handleApplyCoupon = async () => {
    if (!couponResult?.valid) return;

    setIsApplyingCoupon(true);
    try {
      const { data } = await couponsApi.apply(couponCode.trim(), selectedPlan);
      toast.success(data.message || '쿠폰이 적용되었습니다!');
      setSuccessData({
        type: 'coupon',
        planType: selectedPlan,
        freeMonths: data.subscription?.freeMonths || freeMonths,
        periodEnd: data.subscription?.periodEnd,
        couponName: couponResult.coupon?.name,
      });
      setCurrentStep('success');
    } catch (err: any) {
      const msg = err.response?.data?.message || '쿠폰 적용에 실패했습니다.';
      toast.error(msg);
      setCouponError(msg);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // ============== Toss 결제 ==============
  const handleTossPayment = async () => {
    setIsLoadingPayment(true);

    try {
      // Toss Payments SDK 로드
      const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);

      const orderId = `PS_${selectedPlan}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const orderName = `Patient Signal ${planInfo.name} 월간 구독`;
      // Toss customerKey: 영문/숫자/특수문자(-, _, =, ., @), 2~50자 제한
      const customerKey = (hospitalId || user?.id || 'default').replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 50) || 'default_user';
      console.log('[Toss] customerKey:', customerKey, 'len:', customerKey.length);

      const payment = tossPayments.payment({
        customerKey,
      });

      // 결제 요청
      await payment.requestPayment({
        method: 'CARD',
        amount: {
          currency: 'KRW',
          value: finalPrice,
        },
        orderId,
        orderName,
        customerEmail: user?.email || '',
        customerName: user?.name || '',
        successUrl: `${window.location.origin}/dashboard/billing/success`,
        failUrl: `${window.location.origin}/dashboard/billing/fail`,
        card: {
          useEscrow: false,
          flowMode: 'DEFAULT',
          useCardPoint: false,
          useAppCardOnly: false,
        },
      });
    } catch (err: any) {
      if (err.code === 'USER_CANCEL') {
        toast.info('결제가 취소되었습니다.');
      } else {
        toast.error(err.message || '결제 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoadingPayment(false);
    }
  };

  // ============== 빌링키 등록 (자동결제) ==============
  const handleBillingSetup = async () => {
    setIsLoadingPayment(true);

    try {
      const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);

      // Toss customerKey: 영문/숫자/특수문자(-, _, =, ., @), 2~50자 제한
      const customerKey = (hospitalId || user?.id || 'default').replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 50) || 'default_user';
      console.log('[Toss] customerKey:', customerKey, 'len:', customerKey.length);

      const billing = tossPayments.payment({
        customerKey,
      });

      await billing.requestBillingAuth({
        method: 'CARD',
        successUrl: `${window.location.origin}/dashboard/billing/billing-success?plan=${selectedPlan}`,
        failUrl: `${window.location.origin}/dashboard/billing/fail`,
        customerEmail: user?.email || '',
        customerName: user?.name || '',
      });
    } catch (err: any) {
      if (err.code === 'USER_CANCEL') {
        toast.info('카드 등록이 취소되었습니다.');
      } else {
        toast.error(err.message || '카드 등록 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoadingPayment(false);
    }
  };

  // ============== RENDER: 플랜 선택 단계 ==============
  const renderPlanStep = () => (
    <div className="space-y-6">
      {/* 플랜 선택 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(PLAN_INFO).map(([planId, info]) => {
          const isSelected = selectedPlan === planId;
          const isCurrent = planId === (subscriptionData?.subscription?.planType);
          const isActive = subscriptionData?.isActive;

          return (
            <button
              key={planId}
              onClick={() => setSelectedPlan(planId)}
              className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/30'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {isCurrent && isActive && (
                <span className="absolute -top-2.5 left-3 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                  현재 플랜
                </span>
              )}
              {planId === 'STANDARD' && (
                <span className="absolute -top-2.5 right-3 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                  인기
                </span>
              )}

              <h3 className="text-lg font-bold text-gray-900 mb-1">{info.name}</h3>
              <p className="text-2xl font-bold text-gray-900">{info.priceText}</p>
              <p className="text-xs text-gray-500 mt-1 mb-3">{info.description}</p>

              <ul className="space-y-1.5">
                {info.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {isSelected && (
                <div className="absolute top-3 right-3">
                  <BadgeCheck className="h-6 w-6 text-blue-600" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 다음 단계 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep('coupon')}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Tag className="h-5 w-5" />
          <span className="font-medium">쿠폰 코드 입력</span>
        </button>
        <button
          onClick={() => setCurrentStep('payment')}
          disabled={selectedPlan === 'FREE'}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CreditCard className="h-5 w-5" />
          <span>{selectedPlan === 'FREE' ? '무료 플랜은 결제 불필요' : '결제하기'}</span>
          {selectedPlan !== 'FREE' && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  // ============== RENDER: 쿠폰 입력 단계 ==============
  const renderCouponStep = () => (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Gift className="h-8 w-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">쿠폰 적용</h2>
        <p className="text-gray-500 mt-1">
          페이션트 퍼널 수강생 쿠폰 코드를 입력해주세요
        </p>
      </div>

      {/* 선택된 플랜 표시 */}
      <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">적용 플랜</p>
          <p className="font-bold text-gray-900">{planInfo.name} 플랜</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">정가</p>
          <p className="font-bold text-gray-900">{planInfo.priceText}</p>
        </div>
      </div>

      {/* 쿠폰 입력 */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                setCouponError('');
                setCouponResult(null);
              }}
              placeholder="PF2026-XXXX"
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-lg font-mono tracking-wider"
              onKeyDown={(e) => e.key === 'Enter' && handleValidateCoupon()}
            />
          </div>
          <button
            onClick={handleValidateCoupon}
            disabled={isApplyingCoupon || !couponCode.trim()}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isApplyingCoupon ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              '확인'
            )}
          </button>
        </div>

        {/* 에러 메시지 */}
        {couponError && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-2.5 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {couponError}
          </div>
        )}

        {/* 쿠폰 검증 결과 */}
        {couponResult?.valid && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-bold text-green-800">{couponResult.coupon.name}</h4>
                <p className="text-sm text-green-600">{couponResult.coupon.description?.replace(/\s*\(?\d+장\s*한정\)?\s*/g, '')}</p>
              </div>
            </div>

            {/* 가격 요약 */}
            <div className="bg-white rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{planInfo.name} 플랜 정가</span>
                <span className="text-gray-900">{planInfo.price.toLocaleString()}원/월</span>
              </div>
              {freeMonths > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 font-medium">무료 기간</span>
                  <span className="text-green-600 font-bold">{freeMonths}개월 무료</span>
                </div>
              )}
              {couponResult.pricing.discountAmount > 0 && freeMonths === 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 font-medium">할인</span>
                  <span className="text-green-600 font-bold">
                    -{couponResult.pricing.discountAmount.toLocaleString()}원
                  </span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between">
                <span className="font-bold text-gray-900">결제 금액</span>
                <span className="font-bold text-2xl text-blue-600">
                  {freeMonths > 0 ? (
                    <span>0원 <span className="text-sm font-normal text-gray-500">({freeMonths}개월)</span></span>
                  ) : (
                    `${finalPrice.toLocaleString()}원`
                  )}
                </span>
              </div>
            </div>

            {/* 쿠폰 적용 버튼 */}
            {freeMonths > 0 ? (
              <button
                onClick={handleApplyCoupon}
                disabled={isApplyingCoupon}
                className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isApplyingCoupon ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <PartyPopper className="h-5 w-5" />
                    {freeMonths}개월 무료 시작하기
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => setCurrentStep('payment')}
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="h-5 w-5" />
                {finalPrice.toLocaleString()}원 결제하기
              </button>
            )}
          </div>
        )}
      </div>

      {/* 돌아가기 */}
      <button
        onClick={() => { setCurrentStep('plan'); setCouponResult(null); setCouponError(''); setCouponCode(''); }}
        className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 inline mr-1" />
        플랜 선택으로 돌아가기
      </button>
    </div>
  );

  // ============== RENDER: 결제 단계 ==============
  const renderPaymentStep = () => (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CreditCard className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">결제하기</h2>
        <p className="text-gray-500 mt-1">안전한 결제로 바로 시작하세요</p>
      </div>

      {/* 주문 요약 */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-3">
        <h3 className="font-bold text-gray-900 mb-3">주문 요약</h3>

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">플랜</span>
          <span className="font-medium text-gray-900">{planInfo.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">결제 주기</span>
          <span className="font-medium text-gray-900">월간 (매월 자동결제)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">정가</span>
          <span className="text-gray-900">{planInfo.price.toLocaleString()}원</span>
        </div>

        {couponResult?.valid && (
          <div className="flex justify-between text-sm text-green-600">
            <span>쿠폰 할인 ({couponResult.coupon.name})</span>
            <span className="font-medium">
              -{couponResult.pricing.discountAmount.toLocaleString()}원
            </span>
          </div>
        )}

        <div className="border-t pt-3 flex justify-between">
          <span className="font-bold text-gray-900">결제 금액</span>
          <span className="font-bold text-xl text-blue-600">
            {finalPrice.toLocaleString()}원/월
          </span>
        </div>
      </div>

      {/* 결제 수단 선택 */}
      <div className="space-y-3">
        {/* 일반 결제 (단건) */}
        <button
          onClick={handleTossPayment}
          disabled={isLoadingPayment}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isLoadingPayment ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <CreditCard className="h-5 w-5" />
              {finalPrice.toLocaleString()}원 결제하기
            </>
          )}
        </button>

        {/* 자동결제 (빌링키) */}
        <button
          onClick={handleBillingSetup}
          disabled={isLoadingPayment}
          className="w-full py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:border-gray-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <Shield className="h-4 w-4" />
          카드 등록 후 자동결제 시작 (첫 7일 무료)
        </button>
      </div>

      {/* 안내 */}
      <div className="bg-blue-50 rounded-xl p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>안전한 결제:</strong> 토스페이먼츠를 통해 안전하게 결제됩니다. 
            카드정보는 Patient Signal에 저장되지 않습니다.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>해지 자유:</strong> 언제든지 설정에서 구독을 해지할 수 있으며, 
            남은 기간까지 이용 가능합니다.
          </p>
        </div>
      </div>

      {/* 돌아가기 */}
      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep('plan')}
          className="flex-1 text-center py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 inline mr-1" />
          플랜 선택
        </button>
        <button
          onClick={() => setCurrentStep('coupon')}
          className="flex-1 text-center py-2 text-sm text-blue-500 hover:text-blue-700"
        >
          <Tag className="h-4 w-4 inline mr-1" />
          쿠폰 입력
        </button>
      </div>
    </div>
  );

  // ============== RENDER: 성공 단계 ==============
  const renderSuccessStep = () => (
    <div className="max-w-lg mx-auto text-center space-y-6 py-8">
      <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto">
        <PartyPopper className="h-12 w-12 text-green-600" />
      </div>

      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          구독이 활성화되었습니다!
        </h2>
        <p className="text-gray-500">
          {successData?.type === 'coupon' ? (
            <>
              <strong>{successData.couponName}</strong> 쿠폰이 적용되어{' '}
              <strong className="text-green-600">{successData.freeMonths}개월 무료</strong>로 이용하실 수 있습니다.
            </>
          ) : (
            <>결제가 완료되어 바로 이용하실 수 있습니다.</>
          )}
        </p>
      </div>

      {/* 구독 정보 */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 text-left space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="h-5 w-5 text-blue-600" />
          <span className="font-bold text-blue-900">
            {PLAN_INFO[successData?.planType]?.name || 'Starter'} 플랜
          </span>
        </div>

        {successData?.periodEnd && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">이용 기간</span>
            <span className="font-medium text-gray-900">
              ~ {new Date(successData.periodEnd).toLocaleDateString('ko-KR')}
            </span>
          </div>
        )}

        {successData?.freeMonths > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">무료 기간</span>
            <span className="font-medium text-green-600">{successData.freeMonths}개월</span>
          </div>
        )}
      </div>

      {/* CTA 버튼 */}
      <div className="space-y-3">
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Sparkles className="h-5 w-5" />
          대시보드로 이동
        </button>
        <button
          onClick={() => window.location.href = '/dashboard/settings'}
          className="w-full py-2.5 text-gray-500 hover:text-gray-700 text-sm"
        >
          설정 페이지로 이동
        </button>
      </div>
    </div>
  );

  // ============== MAIN RENDER ==============
  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="결제" description="구독 플랜을 선택하고 결제합니다" />
        <div className="p-6 max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl border p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">병원 등록이 필요합니다</h3>
            <p className="text-gray-500 mb-4">결제를 진행하려면 먼저 병원 정보를 등록해주세요.</p>
            <button
              onClick={() => window.location.href = '/onboarding'}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              병원 등록하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="결제" description="구독 플랜을 선택하고 결제합니다" />

      <div className="p-6 max-w-4xl mx-auto">
        {/* 진행 단계 표시 */}
        {currentStep !== 'success' && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {['plan', 'coupon', 'payment'].map((step, idx) => {
              const stepNames = { plan: '플랜 선택', coupon: '쿠폰', payment: '결제' };
              const isActive = step === currentStep;
              const isPast = ['plan', 'coupon', 'payment'].indexOf(currentStep) > idx;

              return (
                <div key={step} className="flex items-center gap-2">
                  {idx > 0 && <div className={`w-8 h-0.5 ${isPast ? 'bg-blue-500' : 'bg-gray-200'}`} />}
                  <button
                    onClick={() => setCurrentStep(step as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white font-medium'
                        : isPast
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                      {isPast ? <Check className="h-3 w-3" /> : idx + 1}
                    </span>
                    {(stepNames as any)[step]}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 각 단계별 렌더링 */}
        {currentStep === 'plan' && renderPlanStep()}
        {currentStep === 'coupon' && renderCouponStep()}
        {currentStep === 'payment' && renderPaymentStep()}
        {currentStep === 'success' && renderSuccessStep()}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
