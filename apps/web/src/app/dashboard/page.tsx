'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { ScoreChart } from '@/components/dashboard/ScoreChart';
import { PlatformStats } from '@/components/dashboard/PlatformStats';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { CompetitorComparison } from '@/components/dashboard/CompetitorComparison';
import OnboardingTutorial from '@/components/onboarding/OnboardingTutorial';
import { FirstCrawlBanner } from '@/components/dashboard/FirstCrawlBanner';
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
  useRanking,
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
  BarChart3,
  CheckCircle2,
  AlertTriangle as AlertTriangleIcon,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { getPlanLimits, canUseFeature } from '@/components/plan/PlanGate';
import { toast } from '@/hooks/useToast';
import { MetricValue, resolveState } from '@/components/ui/metric-value';
import { TermTip } from '@/components/ui/term-tooltip';
import { DiagnosisBoard, buildFindings } from '@/components/dashboard/DiagnosisBoard';

// ─── 플랫폼 색상/이름 ───
const PLATFORM_META: Record<string, { name: string; color: string; bg: string; text: string; ringClass: string }> = {
  CHATGPT: { name: 'ChatGPT', color: '#10a37f', bg: 'bg-emerald-50', text: 'text-emerald-700', ringClass: 'ring-emerald-200' },
  PERPLEXITY: { name: 'Perplexity', color: '#1E88E5', bg: 'bg-brand-50', text: 'text-brand-700', ringClass: 'ring-blue-200' },
  CLAUDE: { name: 'Claude', color: '#D97706', bg: 'bg-amber-50', text: 'text-amber-700', ringClass: 'ring-amber-200' },
  GEMINI: { name: 'Gemini', color: '#8B5CF6', bg: 'bg-purple-50', text: 'text-purple-700', ringClass: 'ring-violet-200' },
  GROK: { name: 'Grok', color: '#000000', bg: 'bg-slate-50', text: 'text-slate-700', ringClass: 'ring-slate-300' },
  CLOVA_X: { name: 'CLOVA X', color: '#03c75a', bg: 'bg-green-50', text: 'text-green-700', ringClass: 'ring-green-300' },
};

// Journey step config
const JOURNEY_STEPS = [
  { href: '/dashboard/prompts', step: '1', label: '질문 설정', icon: MessageSquare, iconBg: 'bg-brand-100', iconColor: 'text-brand-600' },
  { href: '/dashboard/insights', step: '2', label: 'AI 인사이트', icon: Lightbulb, iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
  { href: '/dashboard/analytics', step: '3', label: 'ABHS 분석', icon: BarChart3, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  { href: '/dashboard/competitors', step: '4', label: '경쟁사 비교', icon: Users, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
  { href: '/dashboard/opportunities', step: '5', label: '기회 분석', icon: Target, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
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
  const { data: platformDetails, isLoading: platformLoading, isError: platformError } = usePlatformScores();
  const { data: mentionInsight } = useMentionInsight();
  const { data: sourceInsight } = useSourceInsight();
  const {
    data: abhs,
    isLoading: abhsLoading,
    isError: abhsError,
    refetch: refetchAbhs,
  } = useABHS();
  const { data: ranking } = useRanking();

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

  // ─── 지표 상태 판정 ───
  // ⚠️ 과거에는 `abhs?.sovPercent ?? 0` 으로 값을 꺼냈다. API가 타임아웃/에러여도
  //    화면엔 "0%"가 찍혀서, 원장이 "우리 병원 AI 노출 0%"로 오독했다.
  //    모르는 건 모른다고 표시한다. 0은 "정말 0일 때"만 쓴다.
  const abhsState = resolveState({
    isLoading: abhsLoading,
    isError: abhsError,
    hasData: abhs ? (abhs as any).hasData !== false : undefined,
  });
  const abhsOk = abhsState === 'ok' && !!abhs;

  const sovPercent = abhsOk ? (abhs as any).sovPercent ?? null : null;
  const sovChange = weekly?.scoreChange ?? 0;
  const abhsScore = abhsOk ? (abhs as any).abhsScore ?? null : null;
  const avgSentiment = abhsOk ? (abhs as any).avgSentimentV2 ?? null : null;
  const depthDist = abhsOk ? ((abhs as any).depthDistribution ?? null) : null;
  const intentScores = abhsOk ? ((abhs as any).intentScores ?? null) : null;

  // ─── 플랫폼 데이터: 단일 출처(scores/platforms) ───
  // 과거엔 abhs.platformContributions / platforms / dashboard.platformScores
  // 세 곳에서 같은 개념을 각각 계산해 화면마다 값이 달랐다. platforms 하나로 통일한다.
  const platformState = resolveState({
    isLoading: platformLoading,
    isError: platformError,
    hasData: Array.isArray(platformDetails) ? platformDetails.length > 0 : undefined,
  });
  const platformSovData = Array.isArray(platformDetails)
    ? platformDetails.map((p: any) => ({
        key: p.platform,
        name: PLATFORM_META[p.platform]?.name || p.platformName,
        mentionRate: p.mentionRate ?? 0,
        mentionedCount: p.mentionedCount ?? 0,
        totalQueries: p.totalQueries ?? 0,
        score: p.visibilityScore ?? 0,
        hasData: p.hasData !== false && (p.totalQueries ?? 0) > 0,
        // 【수집 신선도】"0%"와 "수집이 멈춤"은 다른 문제 — 백엔드가 판정해서 내려준다
        collectionStatus: (p.collectionStatus ?? null) as 'ACTIVE' | 'STALLED' | 'NEVER' | null,
        staleDays: (p.staleDays ?? null) as number | null,
        // 【같은 0%, 다른 원인】웹을 안 보는 채널인가 vs 출처에 우리가 없는 것인가
        zeroReason: (p.zeroReason ?? null) as 'NO_WEB_SEARCH' | 'SOURCE_GAP' | null,
        competitorsPerResponse: (p.competitorsPerResponse ?? null) as number | null,
        trend: p.trend?.direction || 'STABLE',
        trendChange: p.trend?.change ?? 0,
        color: PLATFORM_META[p.platform]?.color || '#6B7280',
        bg: PLATFORM_META[p.platform]?.bg || 'bg-slate-50',
        text: PLATFORM_META[p.platform]?.text || 'text-slate-700',
        ringClass: PLATFORM_META[p.platform]?.ringClass || 'ring-slate-200',
      }))
    : [];

  // ─── 진단 소견 생성 (근거 있는 것만) ───
  const findings = buildFindings({
    sovPercent,
    mentionedCount: abhsOk ? (abhs as any).mentionedCount ?? null : null,
    totalResponses: abhsOk ? (abhs as any).totalResponses ?? null : null,
    depthDistribution: depthDist,
    intentScores,
    platforms: platformSovData.map(p => ({
      key: p.key,
      name: p.name,
      mentionRate: p.mentionRate,
      mentionedCount: p.mentionedCount,
      totalQueries: p.totalQueries,
      collectionStatus: p.collectionStatus,
      staleDays: p.staleDays,
      zeroReason: p.zeroReason,
      competitorsPerResponse: p.competitorsPerResponse,
    })),
    negativeRate: dashboard?.sentiment?.negativeRate ?? null,
    topCompetitor: weekly?.topCompetitors?.[0] ?? null,
  });

  // Journey step completion
  const journeyDone = [
    (dashboard?.stats?.totalPrompts || 0) > 0,
    !!mentionInsight,
    abhsOk,
    (dashboard?.stats?.totalCompetitors || 0) > 0,
    abhsOk,
  ];

  return (
    <div className="min-h-screen">
      {showTutorial && (
        <OnboardingTutorial onComplete={handleTutorialComplete} onSkip={handleTutorialComplete} />
      )}

      <Header
        title="대시보드"
        description={`${dashboard?.hospital?.name || '병원'}의 AI 가시성 현황`}
        onRefresh={handleRefresh}
      />

      {/* 【Day-0 아하모먼트】온보딩 직후 첫 크롤 진행/결과 배너 */}
      <FirstCrawlBanner hospitalId={hospitalId} />

      {/* 마지막 분석 시간 */}
      {lastAnalysis?.lastCrawl && (
        <div className="mx-4 sm:mx-6 mt-3">
          <div className="flex items-center gap-3 text-xs text-slate-500 glass rounded-2xl px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${
                lastAnalysis.lastCrawl.freshness === 'fresh' ? 'bg-emerald-500 animate-pulse' :
                lastAnalysis.lastCrawl.freshness === 'stale' ? 'bg-amber-500' : 'bg-slate-400'
              }`} />
              <span className="font-medium">마지막 분석:</span>
              <span className="font-bold text-slate-700">
                {lastAnalysis.lastCrawl.hoursAgo !== null
                  ? lastAnalysis.lastCrawl.hoursAgo < 1 ? '방금 전'
                    : lastAnalysis.lastCrawl.hoursAgo < 24 ? `${Math.round(lastAnalysis.lastCrawl.hoursAgo)}시간 전`
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

      <div className="p-4 sm:p-6 space-y-4 stagger-children">

        {/* ═══════════════════════════════════════════
            BENTO ROW 1: Hero SoV (2/3) + ABHS Ring (1/3)
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Hero: SoV North-Star (2 cols) ── */}
          <div className="lg:col-span-2 relative rounded-[28px] p-6 sm:p-8 text-white overflow-hidden noise">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/15 rounded-full blur-[120px] -translate-y-1/3 translate-x-1/4 animate-pulse-soft" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-violet-500/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 animate-pulse-soft" style={{ animationDelay: '1.5s' }} />
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-400/20 flex items-center justify-center backdrop-blur-sm">
                    <Activity className="h-[18px] w-[18px] text-brand-400" />
                  </div>
                  <span className="text-sm font-bold text-white/90">Voice Share (SoV)</span>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 font-black border border-brand-400/10">
                    North-Star
                  </span>
                </div>
                <Link href="/dashboard/analytics" className="group">
                  <span className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors font-semibold">
                    상세 <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </div>

              {/* ── 랭킹 뱃지 (인라인) ── */}
              {ranking?.rank && ranking?.badge && (
                <div className="mb-5 flex items-center gap-3">
                  <div className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-2xl backdrop-blur-md border ${
                    ranking.badge.tier === 'DIAMOND' ? 'bg-cyan-500/15 border-cyan-400/20' :
                    ranking.badge.tier === 'PLATINUM' ? 'bg-slate-300/15 border-slate-300/20' :
                    ranking.badge.tier === 'GOLD' ? 'bg-yellow-500/15 border-yellow-400/20' :
                    ranking.badge.tier === 'SILVER' ? 'bg-slate-200/15 border-slate-200/20' :
                    ranking.badge.tier === 'BRONZE' ? 'bg-orange-500/15 border-orange-400/20' :
                    'bg-emerald-500/15 border-emerald-400/20'
                  }`}>
                    <span className="text-xl leading-none">{ranking.badge.emoji}</span>
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-black" style={{ color: ranking.badge.color }}>
                          {ranking.badge.label}
                        </span>
                        <span className="text-[10px] text-white/40 font-bold">등급</span>
                      </div>
                      <p className="text-[11px] text-white/50 font-medium mt-0.5">
                        상위 <span className="text-white/80 font-black">{ranking.topPercent}%</span>
                      </p>
                    </div>
                  </div>

                  {/* 순위 변동 */}
                  {ranking.rankChange !== null && ranking.rankChange !== 0 && (
                    <div className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold backdrop-blur-md border ${
                      ranking.rankChange > 0
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-400/15'
                        : 'bg-red-500/15 text-red-400 border-red-400/15'
                    }`}>
                      {ranking.rankChange > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {Math.abs(ranking.rankChange)}계단
                    </div>
                  )}

                  {/* 이웃 병원 갭 */}
                  {ranking.neighbors?.above && (
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.04] text-[11px] text-white/40 font-medium">
                      <ArrowUpRight className="h-3 w-3 text-amber-400" />
                      <span>다음 순위까지 <span className="text-amber-300 font-black">{ranking.neighbors.above.gap}점</span></span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-end gap-6 mb-6">
                <div>
                  <div className="flex items-baseline gap-1">
                    <MetricValue
                      state={abhsState}
                      dark
                      skeletonWidth="w-40"
                      emptyLabel="아직 분석 전"
                      onRetry={() => refetchAbhs()}
                    >
                      <>
                        <span className="text-7xl sm:text-8xl font-black tracking-tighter tabular-nums leading-none">{sovPercent}</span>
                        <span className="text-3xl font-bold text-white/25">%</span>
                      </>
                    </MetricValue>
                  </div>
                  <p className="text-sm text-slate-400 mt-2 font-medium">
                    {abhsState === 'ok' && sovPercent !== null && (abhs as any)?.totalResponses
                      ? `환자 질문 ${((abhs as any).totalResponses as number).toLocaleString()}번 중 ${(((abhs as any).mentionedCount ?? 0) as number).toLocaleString()}번 우리 병원이 언급됐습니다`
                      : 'AI가 우리 병원을 추천하는 비율'}
                  </p>
                </div>
                {sovChange !== 0 && (
                  <div className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold backdrop-blur-md ${
                    sovChange > 0 
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/15' 
                      : 'bg-red-500/15 text-red-400 border border-red-400/15'
                  }`}>
                    {sovChange > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {sovChange > 0 ? '+' : ''}{sovChange}p
                    <span className="text-xs opacity-60 font-medium">vs 지난주</span>
                  </div>
                )}
              </div>

              {/* 하단 서브 메트릭 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-white/[0.06]">
                <div className="p-3.5 rounded-2xl bg-brand-500/[0.08] border border-brand-400/[0.12]">
                  <p className="text-[10px] text-brand-300/70 mb-1 font-bold uppercase tracking-widest">종합점수</p>
                  <p className="text-2xl font-black tabular-nums text-brand-300">{ranking?.score ?? dashboard?.overallScore ?? 0}<span className="text-sm text-slate-600 ml-0.5 font-medium">/100</span></p>
                  {ranking?.rank && ranking?.totalHospitals ? (
                    <p className="text-[10px] text-white/40 font-semibold mt-0.5">전체 {ranking.rank}위 / {ranking.totalHospitals}곳</p>
                  ) : null}
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.04]">
                  <p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-widest">
                    <TermTip term="abhs" className="text-slate-500">추천 품질</TermTip>
                  </p>
                  <MetricValue state={abhsState} dark skeletonWidth="w-16" emptyLabel="분석 전" onRetry={() => refetchAbhs()}>
                    <p className="text-2xl font-black tabular-nums">{abhsScore}<span className="text-sm text-slate-600 ml-0.5 font-medium">/100</span></p>
                  </MetricValue>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.04]">
                  <p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-widest">
                    <TermTip term="sentiment" className="text-slate-500">말투</TermTip>
                  </p>
                  <MetricValue state={abhsState} dark skeletonWidth="w-14" emptyLabel="분석 전" onRetry={() => refetchAbhs()}>
                    <p className={`text-2xl font-black tabular-nums ${(avgSentiment ?? 0) >= 0.5 ? 'text-emerald-400' : (avgSentiment ?? 0) <= -0.5 ? 'text-red-400' : 'text-slate-300'}`}>
                      {(avgSentiment ?? 0) > 0 ? '+' : ''}{(avgSentiment ?? 0).toFixed(1)}
                    </p>
                  </MetricValue>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.04]">
                  <p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-widest">
                    <TermTip term="recommendationDepth" className="text-slate-500">추천 깊이</TermTip>
                  </p>
                  <MetricValue state={abhsState} dark skeletonWidth="w-24" emptyLabel="분석 전" onRetry={() => refetchAbhs()}>
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-black text-emerald-400">1순위 {depthDist?.R3 ?? 0}</span>
                      <span className="text-white/10">·</span>
                      <span className="font-bold text-brand-400">상위 {depthDist?.R2 ?? 0}</span>
                      <span className="text-white/10">·</span>
                      <span className="font-semibold text-amber-400">단순 {depthDist?.R1 ?? 0}</span>
                    </div>
                  </MetricValue>
                </div>
              </div>
            </div>
          </div>

          {/* ── Bento: 감성 분석 (1 col - tall) ── */}
          <Link href="/dashboard/insights" className="block">
            <div className="glass-bento h-full p-6 group cursor-pointer">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ThumbsUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <span className="text-sm font-black text-slate-900">AI 감성 분석</span>
                  <p className="text-[10px] text-slate-400 font-semibold">긍정 · 부정 · 중립</p>
                </div>
              </div>
              {dashboard?.sentiment && dashboard.sentiment.total > 0 ? (
                <>
                  <div className="flex items-center gap-5 mb-5">
                    <div>
                      <span className="text-4xl font-black text-emerald-600 tabular-nums">{dashboard.sentiment.positiveRate}%</span>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">긍정</p>
                    </div>
                    <div className="h-10 w-px bg-slate-100" />
                    <div>
                      <span className="text-2xl font-black text-red-500 tabular-nums">{dashboard.sentiment.negativeRate}%</span>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">부정</p>
                    </div>
                  </div>
                  <div className="relative h-3 rounded-full overflow-hidden bg-slate-100/80 flex">
                    <div className="bg-emerald-500 h-full rounded-l-full" style={{ width: `${dashboard.sentiment.positiveRate}%` }} />
                    <div className="bg-slate-200 h-full" style={{ width: `${dashboard.sentiment.neutralRate}%` }} />
                    <div className="bg-red-400 h-full rounded-r-full" style={{ width: `${dashboard.sentiment.negativeRate}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-3 font-medium">총 {dashboard.sentiment.total}건 분석</p>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center py-8">
                  <p className="text-sm text-slate-400 font-medium">데이터 수집 중...</p>
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* ═══════════════════════════════════════════
            진단 → 원인 → 처방 (이 화면의 핵심)
        ═══════════════════════════════════════════ */}
        <DiagnosisBoard findings={findings} loading={abhsLoading || platformLoading} />

        {/* ═══════════════════════════════════════════
            BENTO ROW 2: Platform cards
            ⚠️ 출처는 scores/platforms 하나뿐이다. 과거엔 여기서
               dashboard.platformScores로 폴백해, 같은 화면 안에
               서로 다른 언급률이 동시에 표시됐다.
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {(platformSovData.length > 0 ? platformSovData : ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI', 'GROK', 'CLOVA_X'].map(key => ({
            key,
            name: PLATFORM_META[key]?.name || key,
            mentionRate: 0,
            mentionedCount: 0,
            totalQueries: 0,
            score: 0,
            hasData: false,
            collectionStatus: null as 'ACTIVE' | 'STALLED' | 'NEVER' | null,
            staleDays: null as number | null,
            zeroReason: null as 'NO_WEB_SEARCH' | 'SOURCE_GAP' | null,
            competitorsPerResponse: null as number | null,
            trend: 'STABLE',
            trendChange: 0,
            color: PLATFORM_META[key]?.color || '#6B7280',
            bg: PLATFORM_META[key]?.bg || 'bg-slate-50',
            text: PLATFORM_META[key]?.text || 'text-slate-700',
            ringClass: PLATFORM_META[key]?.ringClass || 'ring-slate-200',
          }))).map((p) => {
            // 【티저】STARTER 플랜은 GROK/CLOVA_X를 첫 질문 1개만 미리보기로 수집
            const isTeaser = planType === 'STARTER' && (p.key === 'GROK' || p.key === 'CLOVA_X');
            // 【수집 중단】3일 넘게 새 응답이 없으면 숫자보다 이 사실이 먼저다
            const isStalled = p.collectionStatus === 'STALLED';
            return (
            <div key={p.key} className="glass-bento p-5 group relative overflow-hidden">
              {/* Accent top bar */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-full" style={{ backgroundColor: p.color }} />
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ring-2 ring-offset-2 ring-offset-white/60 ${p.ringClass}`} style={{ backgroundColor: p.color }} />
                  <span className="text-sm font-black text-slate-800">{p.name}</span>
                  {isTeaser && !isStalled && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 whitespace-nowrap">
                      미리보기
                    </span>
                  )}
                  {isStalled && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">
                      수집 멈춤
                    </span>
                  )}
                </div>
                {p.trend === 'UP' && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                {p.trend === 'DOWN' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
              </div>
              <MetricValue
                state={p.hasData ? platformState : (platformState === 'ok' ? 'empty' : platformState)}
                skeletonWidth="w-20"
                emptyLabel="아직 수집 전"
              >
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900 tabular-nums">{p.mentionRate}</span>
                    <span className="text-sm text-slate-400 font-bold">%</span>
                  </div>
                  {/* 분모를 함께 보여준다 — "0%"가 실패인지 진짜 0인지 한눈에 구분 */}
                  <p className="text-[11px] text-slate-400 font-semibold mt-1 tabular-nums">
                    질문 {p.totalQueries.toLocaleString()}번 중 {p.mentionedCount.toLocaleString()}번 언급
                  </p>
                  <div className="w-full h-2 bg-slate-100/80 rounded-full mt-2.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(p.mentionRate * 2, 100)}%`, backgroundColor: p.color }} />
                  </div>
                  {isStalled ? (
                    <p className="text-[11px] mt-2.5 font-bold text-amber-700 leading-snug">
                      {p.staleDays}일째 새 응답이 없습니다 — 이 숫자는 옛날 것입니다
                    </p>
                  ) : p.zeroReason === 'NO_WEB_SEARCH' ? (
                    <p className="text-[11px] mt-2.5 font-bold text-slate-500 leading-snug">
                      웹을 보지 않는 채널 — 콘텐츠로 움직이기 어렵습니다
                    </p>
                  ) : p.mentionedCount === 0 && p.totalQueries > 0 ? (
                    <p className="text-[11px] mt-2.5 font-bold text-red-500 leading-snug">
                      한 번도 안 나옵니다
                      {(p.competitorsPerResponse ?? 0) >= 1 && (
                        <span className="block font-semibold text-slate-500 mt-0.5">
                          그러나 경쟁 변원은 한 번에 {p.competitorsPerResponse}개썯 나옵니다
                        </span>
                      )}
                    </p>
                  ) : null}
                  {p.trendChange !== 0 && (
                    <p className={`text-[11px] mt-2.5 font-bold ${p.trendChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {p.trendChange > 0 ? '+' : ''}{p.trendChange}%p vs 이전
                    </p>
                  )}
                </>
              </MetricValue>
              {isTeaser && !isStalled && (
                <Link href="/dashboard/billing" className="block text-[11px] mt-2.5 font-bold text-violet-600 hover:text-violet-800 transition-colors">
                  일부 질문만 미리보기로 분석 중 — 전체 분석은 STANDARD부터 →
                </Link>
              )}
            </div>
          );})}
        </div>

        {/* 최초 데이터 없을 때 안내 */}
        {dashboard?.overallScore === 0 && (
          <div className="glass-bento-dark p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-brand-500/20 backdrop-blur-sm">
                <Calendar className="h-6 w-6 text-brand-400" />
              </div>
              <div>
                <h3 className="font-black mb-1">AI 크롤링이 곧 시작됩니다!</h3>
                <p className="text-slate-400 text-sm font-medium">매일 ChatGPT, Perplexity, Claude, Gemini, Grok, CLOVA X에서 AI 가시성을 자동 분석합니다.</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            BENTO ROW 3: Chart (2/3) + Platform Detail (1/3)
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ScoreChart
              data={dashboard?.scoreHistory || []}
              title="AI 가시성 점수 추이"
              subtitle="언급률·추천순서·감성·플랫폼 커버리지·인용을 합산한 종합 점수 (0~100) — SoV(%)와는 다른 지표입니다"
            />
          </div>
          <PlatformStats 
            data={platformDetails || (dashboard?.platformScores || {})} 
            planType={(user as any)?.hospital?.planType || 'FREE'}
          />
        </div>

        {/* ═══════════════════════════════════════════
            BENTO ROW 4: 인용 출처 (1/2) + 기회 분석 (1/2)
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 인용 출처 */}
          <Link href="/dashboard/insights?tab=sources" className="block">
            <div className="glass-bento p-6 h-full group cursor-pointer">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Globe className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-slate-900">인용 출처</span>
                    <p className="text-[10px] text-slate-400 font-semibold">AI가 참고하는 소스</p>
                  </div>
                </div>
                <span className="text-[9px] px-2.5 py-1 rounded-full bg-brand-100 text-brand-700 font-black tracking-wide">NEW</span>
              </div>
              {sourceInsight ? (
                <>
                  <p className="text-4xl font-black text-slate-900 tabular-nums">{sourceInsight.totalUrls || 0}<span className="text-lg text-slate-300 ml-1 font-bold">건</span></p>
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    {sourceInsight.categories?.length || 0}개 채널에서 인용
                    {sourceInsight.missingChannels?.length > 0 && (
                      <span className="text-amber-600 ml-1 font-bold">· {sourceInsight.missingChannels.length}개 미활용</span>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400 font-medium py-4">수집 중...</p>
              )}
              <p className="text-[11px] text-brand-600 mt-5 flex items-center gap-1 font-bold group-hover:gap-2 transition-all">
                출처 상세 보기 <ChevronRight className="h-3 w-3" />
              </p>
            </div>
          </Link>

          {/* 기회 분석 */}
          <Link href="/dashboard/opportunities" className="block">
            <div className="glass-bento p-6 h-full group cursor-pointer">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Target className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-slate-900">기회 분석</span>
                    <p className="text-[10px] text-slate-400 font-semibold">놓치고 있는 기회 발견</p>
                  </div>
                </div>
                <span className="text-[9px] px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-black tracking-wide">NEW</span>
              </div>
              {mentionInsight ? (
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-4xl font-black text-slate-900 tabular-nums">
                      {mentionInsight.totalResponses > 0
                        ? Math.round((mentionInsight.mentionedResponses / mentionInsight.totalResponses) * 100)
                        : 0}%
                    </p>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">AI 언급률</p>
                  </div>
                  <div className="h-12 w-px bg-slate-100" />
                  <div>
                    <p className="text-3xl font-black text-amber-600 tabular-nums">
                      {mentionInsight.recommendationContext?.primaryRecommend || 0}
                    </p>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">1순위 추천</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 font-medium py-4">수집 중...</p>
              )}
              <p className="text-[11px] text-red-600 mt-5 flex items-center gap-1 font-bold group-hover:gap-2 transition-all">
                놓치는 기회 확인 <ChevronRight className="h-3 w-3" />
              </p>
            </div>
          </Link>
        </div>

        {/* ═══════════════════════════════════════════
            BENTO ROW 5: 경쟁사 비교 + 인사이트
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InsightCard insights={weekly?.insights || []} />
          {comparison && (
            <CompetitorComparison myHospital={comparison.myHospital} competitors={comparison.competitors} />
          )}
        </div>

        {/* ═══════════════════════════════════════════
            BENTO ROW 6: 개선 여정 (5 mini tiles)
        ═══════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-brand-500" />
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">AI 가시성 개선 여정</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {JOURNEY_STEPS.map((item, idx) => {
              const done = journeyDone[idx];
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`glass-bento p-4 cursor-pointer ${!done ? '!border-dashed !border-slate-200/80' : ''}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`relative p-2 rounded-xl ${item.iconBg}`}>
                        <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                        {done && (
                          <CheckCircle2 className="absolute -top-1 -right-1 h-3.5 w-3.5 text-emerald-500 bg-white/80 backdrop-blur-sm rounded-full shadow-sm" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 text-xs">{item.label}</p>
                        <p className={`text-[10px] font-black tracking-wider ${done ? 'text-emerald-500' : 'text-slate-300'}`}>
                          STEP {item.step}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            BENTO ROW 7: 빠른 액션 (3 tiles)
        ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Link href="/guide">
            <div className="glass-bento p-4 cursor-pointer flex items-center justify-between">
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
            </div>
          </Link>
          <div className="glass-bento p-4 !border-dashed flex items-center justify-between">
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
          </div>
          <CrawlCard user={user} hospitalId={hospitalId} onComplete={handleRefresh} />
        </div>
      </div>
    </div>
  );
}

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
      <div className="glass-bento p-4 !border-dashed flex items-center justify-between">
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
      </div>
    );
  }

  return (
    <div 
      className={`glass-bento p-4 !border-dashed cursor-pointer flex items-center justify-between ${
        crawlStatus === 'running' ? '!bg-amber-50/60' :
        crawlStatus === 'done' ? '!bg-emerald-50/60' : ''
      }`}
      onClick={() => {
        if (!crawlMutation.isPending && crawlStatus !== 'running' && hospitalId) {
          crawlMutation.mutate();
        }
      }}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${
          crawlStatus === 'running' ? 'bg-amber-100' : crawlStatus === 'done' ? 'bg-emerald-100' : 'bg-brand-100'
        }`}>
          {crawlStatus === 'running' ? <Loader2 className="h-4 w-4 text-amber-600 animate-spin" /> : <Zap className="h-4 w-4 text-brand-600" />}
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm">
            {crawlStatus === 'running' ? '크롤링 중...' : crawlStatus === 'done' ? '크롤링 완료!' : '수동 크롤링'}
          </p>
          <p className="text-xs text-slate-400 font-medium">
            {crawlStatus === 'running' ? 'AI 분석 진행 중' : crawlStatus === 'done' ? '데이터 갱신됨' : '클릭하여 즉시 실행'}
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
    </div>
  );
}
