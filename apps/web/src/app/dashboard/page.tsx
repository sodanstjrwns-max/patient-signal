'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { ScoreCard } from '@/components/dashboard/ScoreCard';
import { ScoreChart } from '@/components/dashboard/ScoreChart';
import { PlatformStats } from '@/components/dashboard/PlatformStats';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { CompetitorComparison } from '@/components/dashboard/CompetitorComparison';
import OnboardingTutorial from '@/components/onboarding/OnboardingTutorial';
import { Card, CardContent } from '@/components/ui/card';
import { hospitalApi, scoresApi, competitorsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { 
  Activity, 
  Eye, 
  Users, 
  MessageSquare, 
  ArrowRight,
  BookOpen,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  Minus
} from 'lucide-react';
import Link from 'next/link';
import { getPlanLimits, canUseFeature } from '@/components/plan/PlanGate';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;
  const planType = (user as any)?.hospital?.planType || 'STARTER';
  const [showTutorial, setShowTutorial] = useState(false);

  // 첫 방문 시 튜토리얼 표시
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('patient-signal-tutorial-seen');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  const handleTutorialComplete = () => {
    localStorage.setItem('patient-signal-tutorial-seen', 'true');
    setShowTutorial(false);
  };

  // 대시보드 데이터 조회
  const { data: dashboard, isLoading: dashboardLoading, refetch } = useQuery({
    queryKey: ['dashboard', hospitalId],
    queryFn: () => hospitalApi.getDashboard(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 주간 하이라이트
  const { data: weekly } = useQuery({
    queryKey: ['weekly', hospitalId],
    queryFn: () => scoresApi.getWeekly(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 경쟁사 비교 (Starter는 competitorComparison 기능 없으므로 호출 안 함)
  const { data: comparison } = useQuery({
    queryKey: ['comparison', hospitalId],
    queryFn: () => competitorsApi.getComparison(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId && canUseFeature(planType, 'competitorComparison'),
  });

  // 플랫폼별 상세 분석
  const { data: platformDetails } = useQuery({
    queryKey: ['platforms', hospitalId],
    queryFn: () => scoresApi.getPlatforms(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['weekly'] });
    queryClient.invalidateQueries({ queryKey: ['comparison'] });
    queryClient.invalidateQueries({ queryKey: ['platforms'] });
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* 온보딩 튜토리얼 */}
      {showTutorial && (
        <OnboardingTutorial
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialComplete}
        />
      )}

      <Header
        title="대시보드"
        description={`${dashboard?.hospital?.name || '병원'}의 AI 가시성 현황`}
        onRefresh={handleRefresh}
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* 상단 안내 카드 - 최초 데이터 없을 때 */}
        {dashboard?.overallScore === 0 && (
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-white/20">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">AI 크롤링이 곧 시작됩니다!</h3>
                  <p className="text-blue-100 text-sm">
                    매주 2회 자동으로 ChatGPT, Perplexity, Claude, Gemini에서<br />
                    우리 병원의 AI 가시성을 분석합니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 점수 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ScoreCard
            title="AI 가시성 점수"
            score={dashboard?.overallScore || 0}
            change={weekly?.scoreChange}
            icon={<Activity className="h-6 w-6 text-blue-600" />}
          />
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">모니터링 질문</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {dashboard?.stats?.totalPrompts || 0}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-purple-100">
                  <MessageSquare className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">주간 언급 횟수</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {weekly?.newMentions || 0}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-100">
                  <Eye className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">경쟁사</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {dashboard?.stats?.totalCompetitors || 0}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-orange-100">
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 감성 분석 카드 */}
        {dashboard?.sentiment && dashboard.sentiment.total > 0 && (
          <SentimentCard sentiment={dashboard.sentiment} />
        )}

        {/* 메인 차트 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ScoreChart data={dashboard?.scoreHistory || []} />
          </div>
          {/* 플랫폼별 상세 데이터 우선 사용 (항상 4개 플랫폼 반환) */}
          <PlatformStats 
            data={platformDetails || (dashboard?.platformScores || {})} 
            planType={(user as any)?.hospital?.planType || 'STARTER'}
          />
        </div>

        {/* 하단 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 인사이트 */}
          <InsightCard insights={weekly?.insights || []} />

          {/* 경쟁사 비교 */}
          {comparison && (
            <CompetitorComparison
              myHospital={comparison.myHospital}
              competitors={comparison.competitors}
            />
          )}
        </div>

        {/* 빠른 액션 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Link href="/guide">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <BookOpen className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">사용 가이드</p>
                    <p className="text-sm text-gray-500">서비스 이용 안내</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/prompts">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">질문 관리</p>
                    <p className="text-sm text-gray-500">모니터링 질문 추가</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/competitors">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <Users className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">경쟁사 관리</p>
                    <p className="text-sm text-gray-500">경쟁사 추가/분석</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
          <Card className="bg-gray-50 border-dashed">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">자동 크롤링</p>
                  <p className="text-sm text-gray-500">매주 2회 자동 실행</p>
                </div>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">ON</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * 감성 분석 카드 - AI가 우리 병원을 언급할 때의 톤 분석
 */
function SentimentCard({ sentiment }: { sentiment: {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  positiveRate: number;
  negativeRate: number;
  neutralRate: number;
  mentioned: {
    total: number;
    positiveRate: number;
    negativeRate: number;
  };
} }) {
  const getScoreColor = (positive: number, negative: number) => {
    if (positive >= 70) return 'text-green-600';
    if (positive >= 50) return 'text-blue-600';
    if (negative >= 30) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getScoreEmoji = (positive: number, negative: number) => {
    if (positive >= 70) return '😊';
    if (positive >= 50) return '🙂';
    if (negative >= 30) return '😟';
    return '😐';
  };

  const getBarWidth = (rate: number) => `${Math.max(rate, 2)}%`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">AI 감성 분석</h3>
              <span className="text-xs text-gray-400">최근 30일</span>
            </div>
            <span className="text-2xl">{getScoreEmoji(sentiment.positiveRate, sentiment.negativeRate)}</span>
          </div>
          
          {/* 메인 비율 바 */}
          <div className="relative h-8 rounded-full overflow-hidden bg-gray-100 flex mb-3">
            {sentiment.positiveRate > 0 && (
              <div 
                className="bg-green-500 h-full transition-all duration-500 flex items-center justify-center"
                style={{ width: getBarWidth(sentiment.positiveRate) }}
              >
                {sentiment.positiveRate >= 15 && (
                  <span className="text-white text-xs font-bold">{sentiment.positiveRate}%</span>
                )}
              </div>
            )}
            {sentiment.neutralRate > 0 && (
              <div 
                className="bg-gray-300 h-full transition-all duration-500 flex items-center justify-center"
                style={{ width: getBarWidth(sentiment.neutralRate) }}
              >
                {sentiment.neutralRate >= 15 && (
                  <span className="text-gray-700 text-xs font-bold">{sentiment.neutralRate}%</span>
                )}
              </div>
            )}
            {sentiment.negativeRate > 0 && (
              <div 
                className="bg-red-400 h-full transition-all duration-500 flex items-center justify-center"
                style={{ width: getBarWidth(sentiment.negativeRate) }}
              >
                {sentiment.negativeRate >= 15 && (
                  <span className="text-white text-xs font-bold">{sentiment.negativeRate}%</span>
                )}
              </div>
            )}
          </div>

          {/* 레이블 */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">긍정</span>
              </div>
              <span className="text-sm font-bold text-green-600">{sentiment.positive}건</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Minus className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-500">중립</span>
              </div>
              <span className="text-sm font-bold text-gray-600">{sentiment.neutral}건</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <ThumbsDown className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-red-600">부정</span>
              </div>
              <span className="text-sm font-bold text-red-600">{sentiment.negative}건</span>
            </div>
          </div>
        </div>

        {/* 언급 시 감성 (하단 강조) */}
        {sentiment.mentioned.total > 0 && (
          <div className="bg-blue-50 px-6 py-4 border-t">
            <p className="text-xs text-blue-600 font-medium mb-2">
              AI에서 언급될 때의 톤 ({sentiment.mentioned.total}회 언급 기준)
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="h-4 w-4 text-green-500" />
                <span className={`text-lg font-bold ${
                  sentiment.mentioned.positiveRate >= 50 ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {sentiment.mentioned.positiveRate}%
                </span>
                <span className="text-xs text-gray-500">긍정적</span>
              </div>
              <div className="h-4 w-px bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <ThumbsDown className="h-4 w-4 text-red-400" />
                <span className={`text-lg font-bold ${
                  sentiment.mentioned.negativeRate >= 20 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {sentiment.mentioned.negativeRate}%
                </span>
                <span className="text-xs text-gray-500">부정적</span>
              </div>
            </div>
            {sentiment.mentioned.negativeRate >= 20 && (
              <p className="text-xs text-red-500 mt-2">
                ⚠️ 부정적 언급 비율이 높습니다. AI 응답 상세 분석을 확인해보세요.
              </p>
            )}
            {sentiment.mentioned.positiveRate >= 70 && (
              <p className="text-xs text-green-600 mt-2">
                ✨ AI에서 매우 긍정적으로 언급되고 있습니다! 훌륭한 상태입니다.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
