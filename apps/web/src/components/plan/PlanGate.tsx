'use client';

import { useState } from 'react';
import { Lock, Sparkles, X, ArrowRight, Check } from 'lucide-react';

// 플랜별 기능 제한 (백엔드 PlanGuard.PLAN_LIMITS와 동기화)
export const PLAN_LIMITS = {
  FREE: {
    maxPrompts: 1,
    maxCompetitors: 0,
    platforms: ['PERPLEXITY'],
    crawlsPerMonth: 4,
    exportEnabled: false,
    aiRecommendations: false,
    contentGap: false,
    competitorAEO: false,
    competitorComparison: false,
    queryFanouts: false,
    autoDetect: false,
  },
  STARTER: {
    maxPrompts: 5,
    maxCompetitors: 1,
    platforms: ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'],
    crawlsPerMonth: 4,
    exportEnabled: false,
    aiRecommendations: false,
    contentGap: false,
    competitorAEO: false,
    competitorComparison: true,
    queryFanouts: false,
    autoDetect: false,
  },
  STANDARD: {
    maxPrompts: 15,
    maxCompetitors: 5,
    platforms: ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'],
    crawlsPerMonth: 8,
    exportEnabled: true,
    aiRecommendations: true,
    contentGap: false,
    competitorAEO: true,
    competitorComparison: true,
    queryFanouts: true,
    autoDetect: true,
  },
  PRO: {
    maxPrompts: 35,
    maxCompetitors: 10,
    platforms: ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'],
    crawlsPerMonth: 30,
    exportEnabled: true,
    aiRecommendations: true,
    contentGap: true,
    competitorAEO: true,
    competitorComparison: true,
    queryFanouts: true,
    autoDetect: true,
  },
  ENTERPRISE: {
    maxPrompts: -1,
    maxCompetitors: -1,
    platforms: ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'],
    crawlsPerMonth: -1,
    exportEnabled: true,
    aiRecommendations: true,
    contentGap: true,
    competitorAEO: true,
    competitorComparison: true,
    queryFanouts: true,
    autoDetect: true,
  },
};

export type PlanType = keyof typeof PLAN_LIMITS;

export function getPlanLimits(planType: string) {
  return PLAN_LIMITS[planType as PlanType] || PLAN_LIMITS.FREE;
}

export function canUseFeature(planType: string, feature: string): boolean {
  const limits = getPlanLimits(planType);
  return limits[feature as keyof typeof limits] !== false && limits[feature as keyof typeof limits] !== 0;
}

export function getRequiredPlan(feature: string): string {
  const featurePlans: Record<string, string> = {
    maxCompetitors: 'STANDARD',
    competitorComparison: 'STANDARD',
    autoDetect: 'STANDARD',
    competitorAEO: 'STANDARD',
    queryFanouts: 'STANDARD',
    contentGap: 'PRO',
  };
  return featurePlans[feature] || 'STANDARD';
}

// 업그레이드 유도 모달
export function UpgradeModal({
  isOpen,
  onClose,
  feature,
  currentPlan,
}: {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  currentPlan: string;
}) {
  if (!isOpen) return null;

  const featureNames: Record<string, string> = {
    maxCompetitors: '경쟁사 분석',
    competitorComparison: '경쟁사 비교 분석',
    autoDetect: 'AI 경쟁사 자동 탐지',
    competitorAEO: '경쟁사 AEO 측정',
    queryFanouts: 'AI 질문 변형 생성',
    contentGap: 'Content Gap 분석',
    exportEnabled: '데이터 내보내기',
    crawlsPerMonth: '추가 크롤링',
    maxPrompts: '추가 모니터링 질문',
  };

  const requiredPlan = getRequiredPlan(feature);
  const planPrices: Record<string, string> = {
    STANDARD: '29만원/월',
    PRO: '59만원/월',
  };

  const planFeatures: Record<string, string[]> = {
    STANDARD: [
      '4개 AI 플랫폼 (ChatGPT, Claude, Perplexity, Gemini)',
      '매일 자동 크롤링 (월 30회)',
      '모니터링 질문 15개',
      '경쟁사 5개 비교 분석',
      'AI 질문 변형 생성',
      '자동 액션 인텔리전스',
    ],
    PRO: [
      'Standard의 모든 기능',
      '모니터링 질문 35개',
      '경쟁사 10개 비교 분석',
      'Content Gap 분석',
      '매일 크롤링 (월 30회)',
      '우선 지원',
    ],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8" />
            <h3 className="text-xl font-bold">업그레이드가 필요합니다</h3>
          </div>
          <p className="text-blue-100 text-sm">
            <strong>{featureNames[feature] || feature}</strong> 기능은{' '}
            <strong>{requiredPlan}</strong> 플랜 이상에서 사용 가능합니다.
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-lg">{requiredPlan} 플랜</span>
              <span className="text-blue-600 font-bold text-lg">
                {planPrices[requiredPlan] || '문의'}
              </span>
            </div>
            <ul className="space-y-2">
              {(planFeatures[requiredPlan] || []).map((feat, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {feat}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">
              <strong>7일 무료 체험</strong> 가능! 마음에 안 들면 언제든 취소하세요.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm"
            >
              나중에
            </button>
            <button
              onClick={() => {
                onClose();
                window.location.href = `/dashboard/billing?plan=${requiredPlan}`;
              }}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2"
            >
              업그레이드 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 잠금 오버레이 (기능 잠김 표시)
export function LockedFeature({
  feature,
  currentPlan,
  children,
  className = '',
}: {
  feature: string;
  currentPlan: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const isLocked = !canUseFeature(currentPlan, feature);

  if (!isLocked) return <>{children}</>;

  return (
    <>
      <div
        className={`relative cursor-pointer ${className}`}
        onClick={() => setShowModal(true)}
      >
        <div className="opacity-50 pointer-events-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg backdrop-blur-[1px]">
          <div className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-full text-sm shadow-lg">
            <Lock className="w-4 h-4" />
            <span>{getRequiredPlan(feature)} 플랜 필요</span>
          </div>
        </div>
      </div>
      <UpgradeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        feature={feature}
        currentPlan={currentPlan}
      />
    </>
  );
}

// 사용량 표시 바
export function UsageBar({
  used,
  limit,
  label,
  showUpgrade = true,
  planType = 'FREE',
}: {
  used: number;
  limit: number;
  label: string;
  showUpgrade?: boolean;
  planType?: string;
}) {
  const percentage = limit === -1 ? 0 : Math.min((used / limit) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className={`font-medium ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-900'}`}>
          {used}/{limit === -1 ? '∞' : limit}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {isAtLimit && showUpgrade && (
        <p className="text-xs text-red-600">
          한도에 도달했습니다.{' '}
          <a href="/dashboard/settings" className="underline font-medium">
            업그레이드
          </a>
          하여 더 사용하세요.
        </p>
      )}
    </div>
  );
}
