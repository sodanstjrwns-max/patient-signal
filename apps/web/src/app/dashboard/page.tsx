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
const PLATFORM_META: Record<string, { name: string; color: string; bg: string; text: string; bgClass: string; textClass: string; ringClass: string }> = {
  CHATGPT: { name: 'ChatGPT', color: '#10a37f', bg: 'bg-emerald-50', text: 'text-emerald-700', bgClass: 'bg-emerald-500', textClass: 'text-emerald-500', ringClass: 'ring-emerald-200' },
  PERPLEXITY: { name: 'Perplexity', color: '#1E88E5', bg: 'bg-blue-50', text: 'text-blue-700', bgClass: 'bg-blue-500', textClass: 'text-blue-500', ringClass: 'ring-blue-200' },
  CLAUDE: { name: 'Claude', color: '#D97706', bg: 'bg-amber-50', text: 'text-amber-700', bgClass: 'bg-amber-500', textClass: 'text-amber-500', ringClass: 'ring-amber-200' },
  GEMINI: { name: 'Gemini', color: '#8B5CF6', bg: 'bg-purple-50', text: 'text-purple-700', bgClass: 'bg-violet-500', textClass: 'text-violet-500', ringClass: 'ring-violet-200' },
};

// Journey step config (static classes for Tailwind to detect)
const JOURNEY_STEPS = [
  { href: '/dashboard/prompts', step: '1', label: '질문 설정', icon: MessageSquare, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', accentColor: 'text-blue-500' },
  { href: '/dashboard/insights', step: '2', label: 'AI 인사이트', icon: Lightbulb, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', accentColor: 'text-amber-500' },
  { href: '/dashboard/analytics', step: '3', label: 'ABHS 분석', icon: BarChart3, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', accentColor: 'text-indigo-500' },
  { href: '/dashboard/competitors', step: '4', label: '경쟁사 비교', icon: Users, iconBg: 'bg-orange-100', iconColor: 'text-orange-600', accentColor: 'text-orange-500' },
  { href: '/dashboard/report', step: '5', label: '주간 리포트', icon: FileText, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', accentColor: 'text-emerald-500' },
];

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
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-brand-600 mx-auto"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-10 w-10 border border-brand-400/20 mx-auto"></div>
          </div>
          <p className="text-sm text-slate-400 font-medium mt-4">데이터를 불러오는 중...</p>
        </div>
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
        bg: PLATFORM_META[p.platform]?.bg || 'bg-slate-50',
        text: PLATFORM_META[p.platform]?.text || 'text-slate-700',
        bgClass: PLATFORM_META[p.platform]?.bgClass || 'bg-slate-500',
        textClass: PLATFORM_META[p.platform]?.textClass || 'text-slate-500',
        ringClass: PLATFORM_META[p.platform]?.ringClass || 'ring-slate-200',
      }))
    : [];

  // Journey step completion check
  const journeyDone = [
    (dashboard?.stats?.totalPrompts || 0) > 0,
    !!mentionInsight,
    !!abhs,
    (dashboard?.stats?.totalCompetitors || 0) > 0,
    !!abhs,
  ];

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

      {/* 마지막 분석 시간 인디케이터 */}
      {lastAnalysis?.lastCrawl && (
        <div className="mx-4 sm:mx-6 mt-3">
          <div className="flex items-center gap-3 text-xs text-slate-500 glass rounded-xl px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${
                lastAnalysis.lastCrawl.freshness === 'fresh' ? 'bg-emerald-500 animate-pulse' :
                lastAnalysis.lastCrawl.freshness === 'stale' ? 'bg-amber-500' : 'bg-slate-400'
              }`} />
              <span>마지막 분석:</span>
              <span className="font-semibold text-slate-700">
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
                <span className="text-slate-300">|</span>
                <span>{lastAnalysis.lastCrawl.totalPrompts}개 질문</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 space-y-6 stagger-children">
        {/* ═══════════════════════════════════════════
            HERO: SoV North-Star Metric 
        ═══════════════════════════════════════════ */}
        <div className="relative rounded-3xl p-6 sm:p-8 text-white overflow-hidden noise">
          {/* Premium dark gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900" />
          
          {/* Animated mesh orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/15 rounded-full blur-[120px] -translate-y-1/3 translate-x-1/4 animate-pulse-soft" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-violet-500/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 animate-pulse-soft" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 left-1/2 w-56 h-56 bg-blue-500/8 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2" />
          
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }} />
          
          <div className="relative z-10">
            {/* 상단 라벨 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-400/20 flex items-center justify-center backdrop-blur-sm">
                  <Activity className="h-[18px] w-[18px] text-brand-400" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white/90">Voice Share (SoV)</span>
                  <span className="ml-2.5 text-[10px] px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 font-bold border border-brand-400/10">
                    North-Star
                  </span>
                </div>
              </div>
              <Link href="/dashboard/analytics" className="group">
                <span className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors font-medium">
                  상세 분석 <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            </div>

            {/* 메인 SoV 수치 */}
            <div className="flex items-end gap-6 mb-8">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-7xl sm:text-8xl font-black tracking-tighter tabular-nums leading-none">{sovPercent}</span>
                  <span className="text-3xl sm:text-4xl font-bold text-white/30">%</span>
                </div>
                <p className="text-sm text-slate-400 mt-2 font-medium">
                  AI가 우리 병원을 추천하는 비율
                </p>
              </div>

              {/* 주간 변동 */}
              {sovChange !== 0 && (
                <div className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold backdrop-blur-md ${
                  sovChange > 0 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/15' 
                    : 'bg-red-500/15 text-red-400 border border-red-400/15'
                }`}>
                  {sovChange > 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {sovChange > 0 ? '+' : ''}{sovChange}p
                  <span className="text-xs opacity-60 font-medium">vs 지난주</span>
                </div>
              )}
            </div>

            {/* 하단 서브 메트릭 3개 */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-6 border-t border-white/[0.06]">
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.04] hover:bg-white/[0.06] transition-colors">
                <p className="text-[11px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">ABHS 종합</p>
                <p className="text-2xl font-black tabular-nums">{abhsScore}<span className="text-sm text-slate-600 ml-0.5 font-medium">/100</span></p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.04] hover:bg-white/[0.06] transition-colors">
                <p className="text-[11px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">감성 톤</p>
                <p className={`text-2xl font-black tabular-nums ${
                  avgSentiment >= 0.5 ? 'text-emerald-400' : avgSentiment <= -0.5 ? 'text-red-400' : 'text-slate-300'
                }`}>
                  {avgSentiment > 0 ? '+' : ''}{avgSentiment.toFixed(1)}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.04] hover:bg-white/[0.06] transition-colors">
                <p className="text-[11px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">추천 깊이</p>
                <div className="flex items-center gap-2 text-sm">
                  {abhs?.depthDistribution ? (
                    <>
                      <span className="font-black text-emerald-400">R3 {abhs.depthDistribution.R3 ?? 0}</span>
                      <span className="text-white/10">·</span>
                      <span className="font-bold text-blue-400">R2 {abhs.depthDistribution.R2 ?? 0}</span>
                      <span className="text-white/10">·</span>
                      <span className="font-semibold text-amber-400">R1 {abhs.depthDistribution.R1 ?? 0}</span>
                    </>
                  ) : (
                    <span className="text-slate-500 font-medium">수집 중</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 최초 데이터 없을 때 안내 */}
        {dashboard?.overallScore === 0 && (
          <Card className="bg-gradient-to-r from-brand-600 to-brand-700 text-white border-0 shadow-glow">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">AI 크롤링이 곧 시작됩니다!</h3>
                  <p className="text-brand-200 text-sm">
                    매일 ChatGPT, Perplexity, Claude, Gemini에서 AI 가시성을 자동 분석합니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════
            플랫폼별 SoV 미니카드 4개
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {platformSovData.length > 0 ? (
            platformSovData.map((p) => (
              <Card key={p.key} className="hover-lift group cursor-default overflow-hidden">
                <CardContent className="p-4 relative">
                  {/* Subtle top accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: p.color }} />
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ring-2 ring-offset-1 ${p.ringClass}`} style={{ backgroundColor: p.color }} />
                      <span className="text-sm font-bold text-slate-800">{p.name}</span>
                    </div>
                    {p.trend === 'UP' && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                    {p.trend === 'DOWN' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900 tabular-nums">{p.mentionRate}</span>
                    <span className="text-sm text-slate-400 font-semibold">%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(p.mentionRate * 2, 100)}%`, backgroundColor: p.color }}
                    />
                  </div>
                  {p.trendChange !== 0 && (
                    <p className={`text-[11px] mt-2.5 font-bold ${p.trendChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
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
                <Card key={key} className="hover-lift overflow-hidden">
                  <CardContent className="p-4 relative">
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: meta.color }} />
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                      <span className="text-sm font-bold text-slate-700">{meta.name}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900">{score}</span>
                      <span className="text-sm text-slate-400 font-semibold">점</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
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
            차트 + 상세 플랫폼
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
            핵심 지표 요약 3칸 (감성 / 인용 / 기회)
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 감성 분석 요약 */}
          <Link href="/dashboard/insights">
            <Card className="hover-glow cursor-pointer h-full group">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                    <ThumbsUp className="h-[18px] w-[18px] text-emerald-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-900">AI 감성 분석</span>
                </div>
                {dashboard?.sentiment && dashboard.sentiment.total > 0 ? (
                  <>
                    <div className="flex items-center gap-4 mb-4">
                      <div>
                        <span className="text-3xl font-black text-emerald-600 tabular-nums">{dashboard.sentiment.positiveRate}%</span>
                        <span className="text-xs text-slate-400 ml-1 font-medium">긍정</span>
                      </div>
                      <div className="h-8 w-px bg-slate-100" />
                      <div>
                        <span className="text-xl font-bold text-red-500 tabular-nums">{dashboard.sentiment.negativeRate}%</span>
                        <span className="text-xs text-slate-400 ml-1 font-medium">부정</span>
                      </div>
                    </div>
                    <div className="relative h-2 rounded-full overflow-hidden bg-slate-100 flex">
                      <div className="bg-emerald-500 h-full rounded-l-full" style={{ width: `${dashboard.sentiment.positiveRate}%` }} />
                      <div className="bg-slate-200 h-full" style={{ width: `${dashboard.sentiment.neutralRate}%` }} />
                      <div className="bg-red-400 h-full rounded-r-full" style={{ width: `${dashboard.sentiment.negativeRate}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-2.5 font-medium">총 {dashboard.sentiment.total}건 분석</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 font-medium">데이터 수집 중...</p>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* 인용 출처 요약 */}
          <Link href="/dashboard/insights?tab=sources">
            <Card className="hover-glow cursor-pointer h-full group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <Globe className="h-[18px] w-[18px] text-blue-600" />
                    </div>
                    <span className="text-sm font-bold text-slate-900">인용 출처</span>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-black tracking-wide">NEW</span>
                </div>
                {sourceInsight ? (
                  <>
                    <p className="text-3xl font-black text-slate-900 tabular-nums">{sourceInsight.totalUrls || 0}<span className="text-sm text-slate-400 ml-1 font-medium">건</span></p>
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">
                      {sourceInsight.categories?.length || 0}개 채널에서 인용
                      {sourceInsight.missingChannels?.length > 0 && (
                        <span className="text-amber-600 ml-1 font-semibold">
                          · {sourceInsight.missingChannels.length}개 미활용
                        </span>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 font-medium">수집 중...</p>
                )}
                <p className="text-[11px] text-brand-600 mt-4 flex items-center gap-1 font-bold group-hover:gap-2 transition-all">
                  출처 상세 보기 <ChevronRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* 기회 분석 요약 */}
          <Link href="/dashboard/opportunities">
            <Card className="hover-glow cursor-pointer h-full group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                      <Target className="h-[18px] w-[18px] text-red-600" />
                    </div>
                    <span className="text-sm font-bold text-slate-900">기회 분석</span>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-black tracking-wide">NEW</span>
                </div>
                {mentionInsight ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-3xl font-black text-slate-900 tabular-nums">
                          {mentionInsight.totalResponses > 0
                            ? Math.round((mentionInsight.mentionedResponses / mentionInsight.totalResponses) * 100)
                            : 0}%
                        </p>
                        <p className="text-xs text-slate-400 font-medium">AI 언급률</p>
                      </div>
                      <div className="h-10 w-px bg-slate-100" />
                      <div>
                        <p className="text-2xl font-black text-amber-600 tabular-nums">
                          {mentionInsight.recommendationContext?.primaryRecommend || 0}
                        </p>
                        <p className="text-xs text-slate-400 font-medium">1순위 추천</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 font-medium">수집 중...</p>
                )}
                <p className="text-[11px] text-red-600 mt-4 flex items-center gap-1 font-bold group-hover:gap-2 transition-all">
                  놓치는 기회 확인 <ChevronRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ═══════════════════════════════════════════
            경쟁사 비교 + 인사이트
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
            AI 가시성 개선 여정
        ═══════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-brand-500" />
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              AI 가시성 개선 여정
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {JOURNEY_STEPS.map((item, idx) => {
              const done = journeyDone[idx];
              return (
                <Link key={item.href} href={item.href}>
                  <Card className={`hover-lift cursor-pointer h-full ${!done ? 'border-dashed border-slate-200' : ''}`}>
                    <CardContent className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`relative p-2 rounded-xl ${item.iconBg}`}>
                          <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                          {done && (
                            <CheckCircle2 className="absolute -top-1 -right-1 h-3.5 w-3.5 text-emerald-500 bg-white rounded-full shadow-sm" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-xs">{item.label}</p>
                          <p className={`text-[10px] font-black tracking-wider ${done ? 'text-emerald-500' : 'text-slate-300'}`}>
                            STEP {item.step}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            빠른 액션
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Link href="/guide">
            <Card className="hover-lift cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-violet-100">
                    <BookOpen className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">사용 가이드</p>
                    <p className="text-xs text-slate-400 font-medium">서비스 이용 안내</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
              </CardContent>
            </Card>
          </Link>
          <Card className="bg-slate-50/50 border-dashed">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">자동 크롤링</p>
                  <p className="text-xs text-slate-400 font-medium">매일 자동 실행</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-black">ON</span>
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
      <Card className="bg-slate-50/50 border-dashed">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100">
              <Calendar className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">자동 크롤링</p>
              <p className="text-xs text-slate-400 font-medium">매일 자동 실행</p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-black">ON</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-dashed transition-all cursor-pointer hover-lift ${
      crawlStatus === 'running' ? 'bg-amber-50/50 border-amber-300' :
      crawlStatus === 'done' ? 'bg-emerald-50/50 border-emerald-300' :
      'bg-slate-50/50 hover:bg-brand-50/50 hover:border-brand-300'
    }`}
      onClick={() => {
        if (!crawlMutation.isPending && crawlStatus !== 'running' && hospitalId) {
          crawlMutation.mutate();
        }
      }}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${
            crawlStatus === 'running' ? 'bg-amber-100' :
            crawlStatus === 'done' ? 'bg-emerald-100' : 'bg-brand-100'
          }`}>
            {crawlStatus === 'running' ? (
              <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 text-brand-600" />
            )}
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">
              {crawlStatus === 'running' ? '크롤링 중...' :
               crawlStatus === 'done' ? '크롤링 완료!' : '수동 크롤링'}
            </p>
            <p className="text-xs text-slate-400 font-medium">
              {crawlStatus === 'running' ? 'AI 분석 진행 중' :
               crawlStatus === 'done' ? '데이터 갱신됨' : '클릭하여 즉시 실행'}
            </p>
          </div>
        </div>
        {crawlStatus === 'done' ? (
          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-black">완료</span>
        ) : crawlStatus === 'running' ? (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-black animate-pulse">진행 중</span>
        ) : (
          <span className="text-[10px] bg-brand-100 text-brand-700 px-2.5 py-1 rounded-full font-black">실행</span>
        )}
      </CardContent>
    </Card>
  );
}
