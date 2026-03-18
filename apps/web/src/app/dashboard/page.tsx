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
  Calendar
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
