'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { subscriptionsApi } from '@/lib/api';
import { Sparkles, ArrowRight, X, AlertTriangle, CreditCard, Ticket } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionInfo {
  isInTrial: boolean;
  isUnpaidActive: boolean;
  needsPayment: boolean;
  isExpired: boolean;
  trialDaysRemaining: number;
  daysRemaining: number;
  planType: string;
  status: string;
  hasBillingKey: boolean;
  // 쿠폰 관련
  isCouponUser: boolean;
  couponName: string | null;
  couponFreeMonths: number;
}

export function TrialBanner() {
  const { user } = useAuthStore();
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  useEffect(() => {
    if (!user?.hospitalId) return;

    subscriptionsApi.getMySubscription()
      .then(({ data }) => {
        if (!data?.hasSubscription) return;

        const info: SubscriptionInfo = {
          isInTrial: data.isInTrial || data.status === 'TRIAL',
          isUnpaidActive: data.isUnpaidActive || false,
          needsPayment: data.needsPayment || false,
          isExpired: data.isExpired || data.status === 'EXPIRED',
          trialDaysRemaining: data.trialDaysRemaining ?? data.daysRemaining ?? 0,
          daysRemaining: data.daysRemaining ?? 0,
          planType: data.planType,
          status: data.status,
          hasBillingKey: data.hasBillingKey || !!data.subscription?.billingKey || false,
          // 쿠폰 관련
          isCouponUser: data.isCouponUser || false,
          couponName: data.couponName || null,
          couponFreeMonths: data.couponFreeMonths || 0,
        };

        setSubInfo(info);

        // 만료된 경우 모달 표시
        if (info.isExpired && !info.hasBillingKey) {
          setShowExpiredModal(true);
        }
      })
      .catch(() => {});
  }, [user?.hospitalId]);

  // ─── 만료 후 결제 유도 모달 (쿠폰 만료 포함) ───
  if (showExpiredModal && subInfo?.isExpired) {
    const isCouponExpired = subInfo.isCouponUser;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isCouponExpired ? 'bg-amber-100' : 'bg-red-100'
          }`}>
            {isCouponExpired 
              ? <Ticket className="h-8 w-8 text-amber-600" />
              : <AlertTriangle className="h-8 w-8 text-red-600" />
            }
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {isCouponExpired 
              ? '쿠폰 혜택이 종료되었습니다'
              : '체험 기간이 종료되었습니다'
            }
          </h2>
          {isCouponExpired && subInfo.couponName && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 inline-block mb-2">
              🎟️ {subInfo.couponName}
            </p>
          )}
          <p className="text-slate-600 mb-2">
            현재 <strong>FREE 플랜</strong>으로 전환되었습니다.
          </p>
          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left text-sm">
            <p className="font-semibold text-slate-700 mb-2">FREE 플랜 제한:</p>
            <ul className="space-y-1 text-slate-500">
              <li>• AI 플랫폼: Perplexity 1개만</li>
              <li>• 모니터링 질문: 1개</li>
              <li>• 크롤링: 주 1회</li>
              <li>• 경쟁사 분석: 불가</li>
            </ul>
          </div>
          <Link
            href="/dashboard/billing"
            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-bold rounded-xl hover:from-brand-700 hover:to-indigo-700 transition-all mb-3"
          >
            <CreditCard className="h-5 w-5" />
            {isCouponExpired ? '유료 결제로 계속 이용하기' : '플랜 업그레이드하기'}
          </Link>
          <button
            onClick={() => setShowExpiredModal(false)}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            나중에 할게요
          </button>
        </div>
      </div>
    );
  }

  // 결제 완료된 사용자 or 정보 없으면 배너 안 보임
  if (!subInfo || dismissed) return null;

  // 이미 결제한 사용자(빌링키 있음)이고 만료 아닌 경우 → 배너 불필요
  if (subInfo.hasBillingKey && !subInfo.isExpired) return null;

  // ─── 쿠폰 사용자 전용 배너 (만료 30일 이내) ───
  if (subInfo.isCouponUser && subInfo.status === 'ACTIVE' && !subInfo.hasBillingKey) {
    const daysLeft = subInfo.daysRemaining;
    
    // 30일 넘게 남았으면 배너 안 보여줌
    if (daysLeft > 30) return null;

    const isUrgent = daysLeft <= 3;
    const isWarning = daysLeft <= 7;

    return (
      <div className={`
        relative px-4 py-3 text-sm flex items-center justify-between gap-3
        ${isUrgent
          ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
          : isWarning
            ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900'
            : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white'
        }
      `}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Ticket className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium truncate">
            {isUrgent ? (
              <>🔥 {subInfo.couponName || '쿠폰'} 혜택이 <strong>{daysLeft}일</strong> 남았어요! 결제 수단을 등록하면 중단 없이 이용 가능합니다</>
            ) : isWarning ? (
              <>⏰ {subInfo.couponName || '쿠폰'} 만료까지 <strong>{daysLeft}일</strong> — 만료 후 FREE(Perplexity만)로 변경됩니다</>
            ) : (
              <>🎟️ {subInfo.couponName || '쿠폰'} 혜택 만료까지 <strong>{daysLeft}일</strong> 남음 — 미리 결제를 등록해주세요</>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/dashboard/billing"
            className={`
              flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
              ${isUrgent
                ? 'bg-white/80 backdrop-blur-sm text-red-600 hover:bg-red-50'
                : isWarning
                  ? 'bg-amber-900 text-white hover:bg-amber-800'
                  : 'bg-white/80 backdrop-blur-sm text-purple-600 hover:bg-purple-50'
              }
            `}
          >
            <CreditCard className="h-3 w-3" />
            결제 등록 <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── 일반 체험 / 무결제 ACTIVE 배너 (기존 로직) ───
  // 체험/무결제 ACTIVE가 아니면 배너 불필요
  if (!subInfo.isInTrial && !subInfo.isUnpaidActive && !subInfo.isExpired) return null;

  const daysLeft = subInfo.isInTrial ? subInfo.trialDaysRemaining : subInfo.daysRemaining;
  const isUrgent = daysLeft <= 2;
  const isExpiring = daysLeft <= 4;
  const planName = subInfo.planType || 'STARTER';

  return (
    <div className={`
      relative px-4 py-3 text-sm flex items-center justify-between gap-3 
      ${isUrgent 
        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white' 
        : isExpiring 
          ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900'
          : 'bg-gradient-to-r from-brand-500 to-indigo-500 text-white'
      }
    `}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Sparkles className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium truncate">
          {isUrgent ? (
            <>🔥 {planName} 체험이 <strong>{daysLeft}일</strong> 남았어요! 지금 결제하면 AI 분석을 계속 이용할 수 있습니다</>
          ) : isExpiring ? (
            <>⏰ {planName} 무료 체험 <strong>{daysLeft}일</strong> 남음 — 체험 종료 후 FREE(Perplexity만)로 변경됩니다</>
          ) : (
            <>✨ {planName} 무료 체험 중! (남은 <strong>{daysLeft}일</strong>) — 체험 종료 전에 결제를 완료해주세요</>
          )}
        </span>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link 
          href="/dashboard/billing"
          className={`
            flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
            ${isUrgent 
              ? 'bg-white/80 backdrop-blur-sm text-red-600 hover:bg-red-50' 
              : isExpiring 
                ? 'bg-amber-900 text-white hover:bg-amber-800'
                : 'bg-white/80 backdrop-blur-sm text-brand-600 hover:bg-brand-50'
            }
          `}
        >
          <CreditCard className="h-3 w-3" />
          결제하기 <ArrowRight className="h-3 w-3" />
        </Link>
        <button 
          onClick={() => setDismissed(true)}
          className="opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
