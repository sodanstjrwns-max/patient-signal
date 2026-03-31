'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { subscriptionsApi } from '@/lib/api';
import { Sparkles, Clock, ArrowRight, X } from 'lucide-react';
import Link from 'next/link';

interface TrialInfo {
  isInTrial: boolean;
  trialDaysRemaining: number;
  planType: string;
  status: string;
  daysRemaining: number;
}

export function TrialBanner() {
  const { user } = useAuthStore();
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.hospitalId) return;

    subscriptionsApi.getMySubscription()
      .then(({ data }) => {
        if (data?.isInTrial || data?.status === 'TRIAL') {
          setTrialInfo({
            isInTrial: true,
            trialDaysRemaining: data.trialDaysRemaining ?? data.daysRemaining ?? 0,
            planType: data.planType,
            status: data.status,
            daysRemaining: data.daysRemaining ?? 0,
          });
        }
      })
      .catch(() => {
        // 실패 시 무시
      });
  }, [user?.hospitalId]);

  // 트라이얼이 아니거나 닫았으면 표시 안 함
  if (!trialInfo?.isInTrial || dismissed) return null;

  const daysLeft = trialInfo.trialDaysRemaining;
  const isUrgent = daysLeft <= 2;
  const isExpiring = daysLeft <= 4;

  return (
    <div className={`
      relative px-4 py-3 text-sm flex items-center justify-between gap-3 
      ${isUrgent 
        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white' 
        : isExpiring 
          ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900'
          : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
      }
    `}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Sparkles className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium truncate">
          {isUrgent ? (
            <>🔥 STARTER 체험이 <strong>{daysLeft}일</strong> 남았어요! 지금 업그레이드하면 AI 4개 플랫폼 분석을 계속 이용할 수 있습니다</>
          ) : isExpiring ? (
            <>⏰ STARTER 무료 체험 <strong>{daysLeft}일</strong> 남음 — 체험 종료 후 FREE(Perplexity만)로 변경됩니다</>
          ) : (
            <>✨ STARTER 7일 무료 체험 중! (남은 <strong>{daysLeft}일</strong>) — ChatGPT, Claude, Gemini, Perplexity 4개 플랫폼 분석 가능</>
          )}
        </span>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link 
          href="/dashboard/billing"
          className={`
            flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
            ${isUrgent 
              ? 'bg-white text-red-600 hover:bg-red-50' 
              : isExpiring 
                ? 'bg-amber-900 text-white hover:bg-amber-800'
                : 'bg-white text-blue-600 hover:bg-blue-50'
            }
          `}
        >
          업그레이드 <ArrowRight className="h-3 w-3" />
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
