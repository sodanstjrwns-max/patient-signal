'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { ScoreCard } from '@/components/dashboard/ScoreCard';
import { ScoreChart } from '@/components/dashboard/ScoreChart';
import { PlatformStats } from '@/components/dashboard/PlatformStats';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { CompetitorComparison } from '@/components/dashboard/CompetitorComparison';
import OnboardingTutorial from '@/components/onboarding/OnboardingTutorial';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { crawlerApi } from '@/lib/api';
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
  Target,
  Shield,
  FileText,
  BarChart3,
  CheckCircle2,
  AlertTriangle as AlertTriangleIcon,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { getPlanLimits, canUseFeature } from '@/components/plan/PlanGate';
import { toast } from '@/hooks/useToast';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;

  // 【캐싱 통합】공유 훅으로 교체 - queryKey & staleTime 중앙 관리
  const { data: hospitalData } = useHospital();
  const planType = hospitalData?.planType || (user as any)?.hospital?.planType || 'STARTER';
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

  // 【캐싱 통합 완료】공유 커스텀 훅 사용 → 인사이트/분석 페이지와 100% 캐시 공유
  const { data: dashboard, isLoading: dashboardLoading, refetch } = useDashboard();
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
                    매일 자동으로 ChatGPT, Perplexity, Claude, Gemini에서<br />
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

        {/* ========== AI 건강 진단 위젯 ========== */}
        {abhs && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-5 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <span className="font-semibold">AI 가시성 건강 진단</span>
                  </div>
                  <Link href="/dashboard/analytics">
                    <span className="text-xs text-blue-200 hover:text-white flex items-center gap-1 transition-colors">
                      상세 분석 <ChevronRight className="h-3 w-3" />
                    </span>
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-blue-200">ABHS 종합</p>
                    <p className="text-2xl font-bold">{abhs.abhsScore ?? 0}<span className="text-sm text-blue-200">/100</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-200">Voice Share</p>
                    <p className="text-2xl font-bold">{abhs.sovPercent ?? 0}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-200">평균 감성</p>
                    <p className={`text-2xl font-bold ${(abhs.avgSentimentV2 ?? 0) >= 0.5 ? 'text-green-300' : (abhs.avgSentimentV2 ?? 0) <= -0.5 ? 'text-red-300' : 'text-blue-100'}`}>
                      {(abhs.avgSentimentV2 ?? 0) > 0 ? '+' : ''}{(abhs.avgSentimentV2 ?? 0).toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
              {/* 신뢰도 + 추천 깊이 요약 */}
              <div className="p-4 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-4">
                  {mentionInsight?.confidenceSummary ? (
                    <div className="flex items-center gap-2">
                      {mentionInsight.confidenceSummary.lowConfidenceCount > 0 ? (
                        <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      <span className="text-sm text-gray-600">
                        신뢰도 {mentionInsight.confidenceSummary.avgConfidence
                          ? `${Math.round(mentionInsight.confidenceSummary.avgConfidence * 100)}%`
                          : '측정 중'}
                        {mentionInsight.confidenceSummary.lowConfidenceCount > 0 && (
                          <span className="text-amber-600 ml-1">
                            · 저신뢰 {mentionInsight.confidenceSummary.lowConfidenceCount}건
                          </span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">신뢰도 데이터 수집 중</span>
                  )}
                  {abhs.depthDistribution && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <span>R3</span>
                      <span className="font-semibold text-green-600">{abhs.depthDistribution.R3 ?? 0}</span>
                      <span className="text-gray-300">|</span>
                      <span>R2</span>
                      <span className="font-semibold text-blue-600">{abhs.depthDistribution.R2 ?? 0}</span>
                      <span className="text-gray-300">|</span>
                      <span>R1</span>
                      <span className="font-semibold text-yellow-600">{abhs.depthDistribution.R1 ?? 0}</span>
                    </div>
                  )}
                </div>
                <Link href="/dashboard/report">
                  <span className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> 주간 리포트
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI 인사이트 요약 */}
        {(mentionInsight || sourceInsight) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                AI 인사이트 요약
              </h3>
              <Link href="/dashboard/insights">
                <Button variant="ghost" size="sm" className="text-blue-600 text-xs">
                  상세 분석 보기 →
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 추천 멘트 분석 요약 */}
              {mentionInsight && (
                <Link href="/dashboard/insights">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-400">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Quote className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-semibold text-gray-900">추천 키워드</span>
                      </div>
                      {mentionInsight.recommendationKeywords?.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {mentionInsight.recommendationKeywords.slice(0, 4).map((kw: any) => (
                            <span key={kw.keyword} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              {kw.keyword} ({kw.count})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">데이터 수집 중</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        1순위 추천 {mentionInsight.recommendationContext?.primaryRecommend || 0}회
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )}

              {/* 트렌드 요약 */}
              {mentionInsight && (
                <Link href="/dashboard/insights">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-400">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-semibold text-gray-900">언급 현황</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">
                        {mentionInsight.totalResponses > 0
                          ? Math.round((mentionInsight.mentionedResponses / mentionInsight.totalResponses) * 100)
                          : 0}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {mentionInsight.mentionedResponses}/{mentionInsight.totalResponses} 응답에서 언급
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )}

              {/* 출처 분석 요약 */}
              {sourceInsight && (
                <Link href="/dashboard/insights">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-400">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-semibold text-gray-900">AI 참조 출처</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-700">{sourceInsight.totalUrls || 0}건</p>
                      <p className="text-xs text-gray-500">
                        {sourceInsight.categories?.length || 0}개 채널
                        {sourceInsight.missingChannels?.length > 0 && (
                          <span className="text-amber-600 ml-1">
                            · {sourceInsight.missingChannels.length}개 미활용
                          </span>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ========== 사용자 여정 네비게이터 ========== */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            AI 가시성 개선 여정
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { href: '/dashboard/prompts', step: '1', label: '질문 설정', desc: '모니터링 질문 관리', icon: MessageSquare, color: 'blue', done: (dashboard?.stats?.totalPrompts || 0) > 0 },
              { href: '/dashboard/insights', step: '2', label: 'AI 인사이트', desc: '키워드·트렌드 분석', icon: Lightbulb, color: 'amber', done: !!mentionInsight },
              { href: '/dashboard/analytics', step: '3', label: 'ABHS 분석', desc: '심층 점수 분석', icon: BarChart3, color: 'indigo', done: !!abhs },
              { href: '/dashboard/competitors', step: '4', label: '경쟁사 비교', desc: '포지셔닝 점검', icon: Users, color: 'orange', done: (dashboard?.stats?.totalCompetitors || 0) > 0 },
              { href: '/dashboard/report', step: '5', label: '주간 리포트', desc: '성과 확인·공유', icon: FileText, color: 'green', done: !!abhs },
            ].map((item, idx) => (
              <Link key={item.href} href={item.href}>
                <Card className={`hover:shadow-md transition-all cursor-pointer relative overflow-hidden ${item.done ? 'border-gray-200' : 'border-dashed border-gray-300'}`}>
                  {/* Step indicator line */}
                  {idx < 4 && (
                    <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-gray-200 z-10" />
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`relative p-2 rounded-lg bg-${item.color}-100`}>
                        <item.icon className={`h-5 w-5 text-${item.color}-600`} />
                        {item.done && (
                          <CheckCircle2 className="absolute -top-1 -right-1 h-3.5 w-3.5 text-green-500 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${item.done ? 'text-green-600' : 'text-gray-400'}`}>
                            STEP {item.step}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* 빠른 액션 (크롤링 + 가이드) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
          <Card className="bg-gray-50 border-dashed">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">자동 크롤링</p>
                  <p className="text-sm text-gray-500">매일 자동 실행</p>
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
 * 크롤링 카드 - 원장님(sodanstjrwns@gmail.com) 전용 수동 크롤링 버튼
 */
function CrawlCard({ user, hospitalId, onComplete }: { user: any; hospitalId: string | undefined; onComplete: () => void }) {
  const isAdmin = user?.email === 'sodanstjrwns@gmail.com';
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null);

  const crawlMutation = useMutation({
    mutationFn: () => crawlerApi.trigger(hospitalId!),
    onSuccess: (res) => {
      const jobId = res.data?.jobId;
      toast.success('크롤링이 시작되었습니다! 잠시 후 결과가 반영됩니다.');
      setCrawlStatus('running');
      // 상태 폴링
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
        // 최대 5분 후 폴링 중단
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
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">자동 크롤링</p>
              <p className="text-sm text-gray-500">매일 자동 실행</p>
            </div>
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">ON</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-dashed transition-all ${
      crawlStatus === 'running' ? 'bg-amber-50 border-amber-300' :
      crawlStatus === 'done' ? 'bg-green-50 border-green-300' :
      'bg-gray-50 hover:bg-blue-50 hover:border-blue-300 cursor-pointer'
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
            crawlStatus === 'done' ? 'bg-green-100' :
            'bg-blue-100'
          }`}>
            {crawlStatus === 'running' ? (
              <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
            ) : (
              <Zap className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {crawlStatus === 'running' ? '크롤링 중...' :
               crawlStatus === 'done' ? '크롤링 완료!' :
               '수동 크롤링'}
            </p>
            <p className="text-sm text-gray-500">
              {crawlStatus === 'running' ? 'AI 플랫폼 분석 진행 중' :
               crawlStatus === 'done' ? '데이터가 갱신되었습니다' :
               '클릭하여 즉시 실행'}
            </p>
          </div>
        </div>
        {crawlStatus === 'done' ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">완료</span>
        ) : crawlStatus === 'running' ? (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full animate-pulse">진행 중</span>
        ) : (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">⚡ 실행</span>
        )}
      </CardContent>
    </Card>
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
