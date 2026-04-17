'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { ScoreChart } from '@/components/dashboard/ScoreChart';
import { PlatformStats } from '@/components/dashboard/PlatformStats';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { CompetitorComparison } from '@/components/dashboard/CompetitorComparison';
import OnboardingTutorial from '@/components/onboarding/OnboardingTutorial';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { crawlerApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { queryKeys } from '@/lib/queryKeys';
import {
  useHospital,
  useDashboard,
  useWeeklyScore,
  usePlatformScores,
  useCompetitorComparison,
  useMentionInsight,
  useSourceInsight,
  useABHS,
} from '@/hooks/useQueries';
import { 
  Activity, 
  Eye, 
  Users, 
  MessageSquare, 
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Zap,
  Loader2,
  Lightbulb,
  Quote,
  Globe,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  FileText,
  BarChart3,
  CheckCircle2,
  AlertTriangle as AlertTriangleIcon,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { getPlanLimits, canUseFeature } from '@/components/plan/PlanGate';
import { toast } from '@/hooks/useToast';

// ─── 플랫폼 색상/이름 ───
const PLATFORM_META: Record<string, { name: string; color: string; bg: string; text: string }> = {
  CHATGPT: { name: 'ChatGPT', color: '#10a37f', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  PERPLEXITY: { name: 'Perplexity', color: '#1E88E5', bg: 'bg-blue-50', text: 'text-blue-700' },
  CLAUDE: { name: 'Claude', color: '#D97706', bg: 'bg-amber-50', text: 'text-amber-700' },
  GEMINI: { name: 'Gemini', color: '#8B5CF6', bg: 'bg-purple-50', text: 'text-purple-700' },
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;

  const { data: hospitalData } = useHospital();
  const planType = hospitalData?.planType || (user as any)?.hospital?.planType || 'FREE';
  const [showTutorial, setShowTutorial] = useState(false);

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

  const { data: dashboard, isLoading: dashboardLoading, refetch } = useDashboard();

  const { data: lastAnalysis } = useQuery({
    queryKey: ['lastAnalysis', hospitalId],
    queryFn: async () => {
      if (!hospitalId) return null;
      const res = await crawlerApi.getLastAnalysis(hospitalId);
      return res.data;
    },
    enabled: !!hospitalId,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: weekly } = useWeeklyScore();
  const { data: comparison } = useCompetitorComparison(canUseFeature(planType, 'competitorComparison'));
  const { data: platformDetails } = usePlatformScores();
  const { data: mentionInsight } = useMentionInsight();
  const { data: sourceInsight } = useSourceInsight();
  const { data: abhs } = useABHS();

  const handleRefresh = () => {
    refetch();
    if (hospitalId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.scores.weekly(hospitalId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.competitors.comparison(hospitalId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scores.platforms(hospitalId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.insights.mention(hospitalId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.insights.sources(hospitalId) });
    }
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ─── SoV 계산 ───
  const sovPercent = abhs?.sovPercent ?? 0;
  const sovChange = weekly?.scoreChange ?? 0;
  const abhsScore = abhs?.abhsScore ?? dashboard?.overallScore ?? 0;
  const avgSentiment = abhs?.avgSentimentV2 ?? 0;

  // 플랫폼별 SoV 데이터 추출
  const platformSovData = Array.isArray(platformDetails)
    ? platformDetails.map((p: any) => ({
        key: p.platform,
        name: PLATFORM_META[p.platform]?.name || p.platformName,
        mentionRate: p.mentionRate ?? 0,
        score: p.visibilityScore ?? 0,
        trend: p.trend?.direction || 'STABLE',
        trendChange: p.trend?.change ?? 0,
        color: PLATFORM_META[p.platform]?.color || '#6B7280',
        bg: PLATFORM_META[p.platform]?.bg || 'bg-gray-50',
        text: PLATFORM_META[p.platform]?.text || 'text-gray-700',
      }))
    : [];

  return (
    <div className="min-h-screen bg-gray-50/50">
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

      {/* 마지막 분석 시간 인디케이터 */}
      {lastAnalysis?.lastCrawl && (
        <div className="mx-4 sm:mx-6 mt-2">
          <div className="flex items-center gap-3 text-xs text-gray-500 bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-100">
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${
                lastAnalysis.lastCrawl.freshness === 'fresh' ? 'bg-green-500 animate-pulse' :
                lastAnalysis.lastCrawl.freshness === 'stale' ? 'bg-yellow-500' : 'bg-gray-400'
              }`} />
              <span>마지막 분석:</span>
              <span className="font-medium text-gray-700">
                {lastAnalysis.lastCrawl.hoursAgo !== null
                  ? lastAnalysis.lastCrawl.hoursAgo < 1
                    ? '방금 전'
                    : lastAnalysis.lastCrawl.hoursAgo < 24
                      ? `${Math.round(lastAnalysis.lastCrawl.hoursAgo)}시간 전`
                      : `${Math.round(lastAnalysis.lastCrawl.hoursAgo / 24)}일 전`
                  : '분석 대기 중'}
              </span>
            </div>
            {lastAnalysis.lastCrawl.totalPrompts && (
              <>
                <span className="text-gray-300">|</span>
                <span>{lastAnalysis.lastCrawl.totalPrompts}개 질문</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 space-y-5">
        {/* ═══════════════════════════════════════════
            🌟 HERO: SoV North-Star Metric 
        ═══════════════════════════════════════════ */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
          {/* 배경 장식 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            {/* 상단 라벨 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-sm font-medium text-gray-300">Voice Share (SoV)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">North-Star Metric</span>
              </div>
              <Link href="/dashboard/analytics">
                <span className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
                  상세 분석 <ChevronRight className="h-3 w-3" />
                </span>
              </Link>
            </div>

            {/* 메인 SoV 수치 */}
            <div className="flex items-end gap-6 mb-6">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl sm:text-7xl font-bold tracking-tight">{sovPercent}</span>
                  <span className="text-2xl sm:text-3xl font-semibold text-gray-400">%</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  AI가 우리 병원을 추천하는 비율
                </p>
              </div>

              {/* 주간 변동 */}
              {sovChange !== 0 && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  sovChange > 0 
                    ? 'bg-green-500/15 text-green-400' 
                    : 'bg-red-500/15 text-red-400'
                }`}>
                  {sovChange > 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {sovChange > 0 ? '+' : ''}{sovChange}p
                  <span className="text-xs opacity-70">vs 지난주</span>
                </div>
              )}
            </div>

            {/* 하단 서브 메트릭 3개 */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-xs text-gray-500 mb-1">ABHS 종합</p>
                <p className="text-xl font-bold">{abhsScore}<span className="text-sm text-gray-500 ml-0.5">/100</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">감성 톤</p>
                <p className={`text-xl font-bold ${
                  avgSentiment >= 0.5 ? 'text-green-400' : avgSentiment <= -0.5 ? 'text-red-400' : 'text-gray-300'
                }`}>
                  {avgSentiment > 0 ? '+' : ''}{avgSentiment.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">추천 깊이</p>
                <div className="flex items-center gap-2 text-sm">
                  {abhs?.depthDistribution ? (
                    <>
                      <span className="font-bold text-green-400">R3 {abhs.depthDistribution.R3 ?? 0}</span>
                      <span className="text-gray-600">·</span>
                      <span className="font-semibold text-blue-400">R2 {abhs.depthDistribution.R2 ?? 0}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-yellow-400">R1 {abhs.depthDistribution.R1 ?? 0}</span>
                    </>
                  ) : (
                    <span className="text-gray-500">수집 중</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 최초 데이터 없을 때 안내 */}
        {dashboard?.overallScore === 0 && (
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-white/20">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">AI 크롤링이 곧 시작됩니다!</h3>
                  <p className="text-blue-100 text-sm">
                    매일 ChatGPT, Perplexity, Claude, Gemini에서 AI 가시성을 자동 분석합니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════
            📊 플랫폼별 SoV 미니카드 4개
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {platformSovData.length > 0 ? (
            platformSovData.map((p) => (
              <Card key={p.key} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-sm font-medium text-gray-700">{p.name}</span>
                    </div>
                    {p.trend === 'UP' && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
                    {p.trend === 'DOWN' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900">{p.mentionRate}</span>
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(p.mentionRate * 2, 100)}%`, backgroundColor: p.color }}
                    />
                  </div>
                  {p.trendChange !== 0 && (
                    <p className={`text-[11px] mt-1.5 font-medium ${p.trendChange > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {p.trendChange > 0 ? '+' : ''}{p.trendChange}%p vs 이전
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            // 기존 dashboard 데이터 fallback
            ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'].map((key) => {
              const meta = PLATFORM_META[key];
              const score = (dashboard?.platformScores as any)?.[key.toLowerCase()] ?? 0;
              return (
                <Card key={key}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color }} />
                      <span className="text-sm font-medium text-gray-700">{meta.name}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-gray-900">{score}</span>
                      <span className="text-sm text-gray-400">점</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${score}%`, backgroundColor: meta.color }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* ═══════════════════════════════════════════
            📈 차트 + 상세 플랫폼
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <ScoreChart data={dashboard?.scoreHistory || []} title="SoV 추이 (AI 가시성 점수)" />
          </div>
          <PlatformStats 
            data={platformDetails || (dashboard?.platformScores || {})} 
            planType={(user as any)?.hospital?.planType || 'FREE'}
          />
        </div>

        {/* ═══════════════════════════════════════════
            🔥 핵심 지표 요약 3칸 (감성 / 인용 / 기회)
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 감성 분석 요약 */}
          <Link href="/dashboard/insights">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                    <ThumbsUp className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">AI 감성 분석</span>
                </div>
                {dashboard?.sentiment && dashboard.sentiment.total > 0 ? (
                  <>
                    <div className="flex items-center gap-4 mb-3">
                      <div>
                        <span className="text-2xl font-bold text-green-600">{dashboard.sentiment.positiveRate}%</span>
                        <span className="text-xs text-gray-400 ml-1">긍정</span>
                      </div>
                      <div className="h-6 w-px bg-gray-200" />
                      <div>
                        <span className="text-lg font-semibold text-red-500">{dashboard.sentiment.negativeRate}%</span>
                        <span className="text-xs text-gray-400 ml-1">부정</span>
                      </div>
                    </div>
                    <div className="relative h-2 rounded-full overflow-hidden bg-gray-100 flex">
                      <div className="bg-green-500 h-full" style={{ width: `${dashboard.sentiment.positiveRate}%` }} />
                      <div className="bg-gray-300 h-full" style={{ width: `${dashboard.sentiment.neutralRate}%` }} />
                      <div className="bg-red-400 h-full" style={{ width: `${dashboard.sentiment.negativeRate}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">총 {dashboard.sentiment.total}건 분석</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">데이터 수집 중...</p>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* 인용 출처 요약 */}
          <Link href="/dashboard/citations">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Globe className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">인용 출처</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-bold">NEW</span>
                </div>
                {sourceInsight ? (
                  <>
                    <p className="text-2xl font-bold text-gray-900">{sourceInsight.totalUrls || 0}<span className="text-sm text-gray-400 ml-1">건</span></p>
                    <p className="text-xs text-gray-500 mt-1">
                      {sourceInsight.categories?.length || 0}개 채널에서 인용
                      {sourceInsight.missingChannels?.length > 0 && (
                        <span className="text-amber-600 ml-1">
                          · {sourceInsight.missingChannels.length}개 미활용
                        </span>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">수집 중...</p>
                )}
                <p className="text-[11px] text-blue-500 mt-3 flex items-center gap-1">
                  출처 상세 보기 <ChevronRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* 기회 분석 요약 */}
          <Link href="/dashboard/opportunities">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <Target className="h-4 w-4 text-red-600" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">기회 분석</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-bold">NEW</span>
                </div>
                {mentionInsight ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {mentionInsight.totalResponses > 0
                            ? Math.round((mentionInsight.mentionedResponses / mentionInsight.totalResponses) * 100)
                            : 0}%
                        </p>
                        <p className="text-xs text-gray-400">AI 언급률</p>
                      </div>
                      <div className="h-8 w-px bg-gray-200" />
                      <div>
                        <p className="text-lg font-bold text-amber-600">
                          {mentionInsight.recommendationContext?.primaryRecommend || 0}
                        </p>
                        <p className="text-xs text-gray-400">1순위 추천</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">수집 중...</p>
                )}
                <p className="text-[11px] text-red-500 mt-3 flex items-center gap-1">
                  놓치는 기회 확인 <ChevronRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ═══════════════════════════════════════════
            📊 경쟁사 비교 + 인사이트
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <InsightCard insights={weekly?.insights || []} />
          {comparison && (
            <CompetitorComparison
              myHospital={comparison.myHospital}
              competitors={comparison.competitors}
            />
          )}
        </div>

        {/* ═══════════════════════════════════════════
            🗺️ AI 가시성 개선 여정 (간소화)
        ═══════════════════════════════════════════ */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            AI 가시성 개선 여정
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { href: '/dashboard/prompts', step: '1', label: '질문 설정', icon: MessageSquare, color: 'blue', done: (dashboard?.stats?.totalPrompts || 0) > 0 },
              { href: '/dashboard/insights', step: '2', label: 'AI 인사이트', icon: Lightbulb, color: 'amber', done: !!mentionInsight },
              { href: '/dashboard/analytics', step: '3', label: 'ABHS 분석', icon: BarChart3, color: 'indigo', done: !!abhs },
              { href: '/dashboard/competitors', step: '4', label: '경쟁사 비교', icon: Users, color: 'orange', done: (dashboard?.stats?.totalCompetitors || 0) > 0 },
              { href: '/dashboard/report', step: '5', label: '주간 리포트', icon: FileText, color: 'green', done: !!abhs },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className={`hover:shadow-md transition-all cursor-pointer ${item.done ? '' : 'border-dashed'}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`relative p-1.5 rounded-md bg-${item.color}-100`}>
                        <item.icon className={`h-4 w-4 text-${item.color}-600`} />
                        {item.done && (
                          <CheckCircle2 className="absolute -top-1 -right-1 h-3 w-3 text-green-500 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-xs">{item.label}</p>
                        <p className={`text-[10px] font-bold ${item.done ? 'text-green-500' : 'text-gray-400'}`}>
                          STEP {item.step}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            ⚡ 빠른 액션
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Link href="/guide">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <BookOpen className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">사용 가이드</p>
                    <p className="text-xs text-gray-500">서비스 이용 안내</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
          <Card className="bg-gray-50 border-dashed">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">자동 크롤링</p>
                  <p className="text-xs text-gray-500">매일 자동 실행</p>
                </div>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">ON</span>
            </CardContent>
          </Card>
          <CrawlCard user={user} hospitalId={hospitalId} onComplete={handleRefresh} />
        </div>
      </div>
    </div>
  );
}

/**
 * 크롤링 카드 - 원장님 전용 수동 크롤링 버튼
 */
function CrawlCard({ user, hospitalId, onComplete }: { user: any; hospitalId: string | undefined; onComplete: () => void }) {
  const isAdmin = user?.email === 'sodanstjrwns@gmail.com';
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null);

  const crawlMutation = useMutation({
    mutationFn: () => crawlerApi.trigger(hospitalId!),
    onSuccess: (res) => {
      const jobId = res.data?.jobId;
      toast.success('크롤링이 시작되었습니다!');
      setCrawlStatus('running');
      if (jobId) {
        const poll = setInterval(async () => {
          try {
            const status = await crawlerApi.getJobStatus(jobId);
            if (status.data?.status === 'COMPLETED') {
              clearInterval(poll);
              setCrawlStatus('done');
              toast.success(`크롤링 완료! ${status.data?.completed || 0}개 응답 수집`);
              onComplete();
              setTimeout(() => setCrawlStatus(null), 5000);
            } else if (status.data?.status === 'FAILED') {
              clearInterval(poll);
              setCrawlStatus(null);
              toast.error('크롤링 중 오류가 발생했습니다.');
            }
          } catch { /* ignore */ }
        }, 5000);
        setTimeout(() => clearInterval(poll), 300000);
      }
    },
    onError: (err: any) => {
      setCrawlStatus(null);
      toast.error(err.response?.data?.message || '크롤링 시작에 실패했습니다.');
    },
  });

  if (!isAdmin) {
    return (
      <Card className="bg-gray-50 border-dashed">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <Calendar className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">자동 크롤링</p>
              <p className="text-xs text-gray-500">매일 자동 실행</p>
            </div>
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">ON</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-dashed transition-all cursor-pointer ${
      crawlStatus === 'running' ? 'bg-amber-50 border-amber-300' :
      crawlStatus === 'done' ? 'bg-green-50 border-green-300' :
      'bg-gray-50 hover:bg-blue-50 hover:border-blue-300'
    }`}
      onClick={() => {
        if (!crawlMutation.isPending && crawlStatus !== 'running' && hospitalId) {
          crawlMutation.mutate();
        }
      }}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            crawlStatus === 'running' ? 'bg-amber-100' :
            crawlStatus === 'done' ? 'bg-green-100' : 'bg-blue-100'
          }`}>
            {crawlStatus === 'running' ? (
              <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 text-blue-600" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">
              {crawlStatus === 'running' ? '크롤링 중...' :
               crawlStatus === 'done' ? '크롤링 완료!' : '수동 크롤링'}
            </p>
            <p className="text-xs text-gray-500">
              {crawlStatus === 'running' ? 'AI 분석 진행 중' :
               crawlStatus === 'done' ? '데이터 갱신됨' : '클릭하여 즉시 실행'}
            </p>
          </div>
        </div>
        {crawlStatus === 'done' ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">완료</span>
        ) : crawlStatus === 'running' ? (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full animate-pulse">진행 중</span>
        ) : (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">실행</span>
        )}
      </CardContent>
    </Card>
  );
}
