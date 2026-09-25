'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { competitorsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  useHospital,
  useCompetitorComparison,
} from '@/hooks/useQueries';
import { queryKeys } from '@/lib/queryKeys';
import {
  Plus,
  Trash2,
  Users,
  Sparkles,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Building,
  MapPin,
  Lock,
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  X,
  Lightbulb,
  BarChart3,
  Zap,
  RotateCcw,
  Archive,
  ArrowRight,
} from 'lucide-react';
import { toast } from '@/hooks/useToast';
import { UpgradeModal, UsageBar, getPlanLimits, canUseFeature } from '@/components/plan/PlanGate';
import { TermTip } from '@/components/ui/term-tooltip';

interface Suggestion {
  name: string;
  mentionCount: number;
  coMentionCount: number;
  soloMentionCount: number;
  avgPosition: number | null;
  platforms: string[];
  threatLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  threatScore: number;
  reason: string;
}

const THREAT_CONFIG = {
  HIGH: {
    icon: ShieldAlert,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-700',
    label: '높은 위협',
  },
  MEDIUM: {
    icon: Shield,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    label: '주의 필요',
  },
  LOW: {
    icon: ShieldCheck,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-700',
    label: '낮은 위협',
  },
};

const PLATFORM_LABELS: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  CLAUDE: 'Claude',
  GEMINI: 'Gemini',
};

export default function CompetitorsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;

  // 【캐싱 통합】공유 훅으로 planType 안정적 로딩
  const { data: hospitalData, isLoading: hospitalLoading } = useHospital();

  const planType = hospitalData?.planType || (user as any)?.hospital?.planType || 'FREE';
  const planLimits = getPlanLimits(planType);
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = useState(false);

  // 경쟁사 목록 조회 - 공유 queryKey 사용
  const { data: competitors, isLoading } = useQuery({
    queryKey: queryKeys.competitors.list(hospitalId!),
    queryFn: () => competitorsApi.list(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 비활성(삭제된) 경쟁사 조회
  const { data: inactiveCompetitors, isLoading: inactiveLoading, isError: inactiveError } = useQuery({
    queryKey: ['competitors-inactive', hospitalId],
    queryFn: () => competitorsApi.getInactive(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId && showInactive,
    retry: 1,
  });

  // 경쟁사 비교 데이터 - 공유 훅 사용
  const { data: comparison } = useCompetitorComparison();

  const { data: answerRanking, isLoading: rankingLoading, isError: rankingError } = useQuery({
    queryKey: ['competitor-answer-ranking', hospitalId],
    queryFn: () => competitorsApi.getAnswerRanking(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
    staleTime: 5 * 60 * 1000,
  });

  // 경쟁사 추가
  const addMutation = useMutation({
    mutationFn: () =>
      competitorsApi.add(hospitalId!, {
        competitorName: newCompetitor,
        competitorRegion: newRegion || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.competitors.list(hospitalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.competitors.comparison(hospitalId!) });
      queryClient.invalidateQueries({ queryKey: ['competitor-answer-ranking', hospitalId] });
      setNewCompetitor('');
      setNewRegion('');
      toast.success('경쟁사가 추가되었습니다.');
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData?.error === 'PLAN_LIMIT_REACHED' || errData?.error === 'PLAN_UPGRADE_REQUIRED') {
        setUpgradeFeature('maxCompetitors');
        setShowUpgradeModal(true);
      } else if (error.response?.status === 409) {
        // 중복 경쟁사
        toast.error(errData?.message || '이미 유사한 이름의 경쟁사가 등록되어 있습니다.');
      } else {
        toast.error(errData?.message || '경쟁사 추가에 실패했습니다.');
      }
    },
  });

  // 경쟁사 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => competitorsApi.remove(id, hospitalId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.competitors.list(hospitalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.competitors.comparison(hospitalId!) });
      queryClient.invalidateQueries({ queryKey: ['competitor-answer-ranking', hospitalId] });
      toast.success('경쟁사가 삭제되었습니다.');
    },
  });

  // 경쟁사 전체 복구
  const restoreAllMutation = useMutation({
    mutationFn: () => competitorsApi.restoreAll(hospitalId!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.competitors.list(hospitalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.competitors.comparison(hospitalId!) });
      queryClient.invalidateQueries({ queryKey: ['competitor-answer-ranking', hospitalId] });
      queryClient.invalidateQueries({ queryKey: ['competitors-inactive', hospitalId] });
      const count = res.data?.restored || 0;
      if (count > 0) {
        toast.success(`${count}개 경쟁 병원이 복구되었습니다.`);
      } else {
        toast.info('복구할 병원이 없거나 현재 플랜의 등록 한도에 도달했습니다.');
      }
      setShowInactive(false);
    },
    onError: () => {
      toast.error('경쟁사 복구에 실패했습니다.');
    },
  });

  // 개별 경쟁사 복구
  const restoreOneMutation = useMutation({
    mutationFn: (competitorId: string) => competitorsApi.restoreOne(hospitalId!, competitorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.competitors.list(hospitalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.competitors.comparison(hospitalId!) });
      queryClient.invalidateQueries({ queryKey: ['competitor-answer-ranking', hospitalId] });
      queryClient.invalidateQueries({ queryKey: ['competitors-inactive', hospitalId] });
      toast.success('경쟁사가 복구되었습니다!');
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData?.error === 'PLAN_LIMIT_REACHED') {
        setUpgradeFeature('maxCompetitors');
        setShowUpgradeModal(true);
      } else {
        toast.error(errData?.message || '경쟁 병원을 복구하지 못했습니다.');
      }
    },
  });

  // AI 제안
  const suggestMutation = useMutation({
    mutationFn: () => competitorsApi.suggest(hospitalId!),
    onSuccess: () => {
      setShowSuggestions(true);
      toast.success('AI 분석이 완료되었습니다!');
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData?.error === 'PLAN_UPGRADE_REQUIRED') {
        setUpgradeFeature('autoDetect');
        setShowUpgradeModal(true);
      } else {
        toast.error(errData?.message || 'AI 제안 분석에 실패했습니다.');
      }
    },
  });

  // 제안 수락
  const acceptMutation = useMutation({
    mutationFn: (data: { competitorName: string }) =>
      competitorsApi.acceptSuggestion(hospitalId!, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.competitors.list(hospitalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.competitors.comparison(hospitalId!) });
      queryClient.invalidateQueries({ queryKey: ['competitor-answer-ranking', hospitalId] });
      setDismissedSuggestions((prev) => new Set(Array.from(prev).concat(variables.competitorName)));
      toast.success(`${variables.competitorName}이(가) 경쟁사로 등록되었습니다!`);
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData?.error === 'PLAN_LIMIT_REACHED') {
        setUpgradeFeature('maxCompetitors');
        setShowUpgradeModal(true);
      } else {
        toast.error(errData?.message || '경쟁사 등록에 실패했습니다.');
      }
    },
  });

  const handleAddCompetitor = () => {
    if (!newCompetitor.trim()) return;
    if (planLimits.maxCompetitors !== -1 && (competitors?.length || 0) >= planLimits.maxCompetitors) {
      setUpgradeFeature('maxCompetitors');
      setShowUpgradeModal(true);
      return;
    }
    addMutation.mutate();
  };

  const filteredCompetitors = competitors?.filter((c: any) =>
    c.competitorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getScoreTrend = (competitor: any) => {
    const compData = comparison?.competitors?.find(
      (c: any) => c.name === competitor.competitorName
    );
    if (!compData) return null;

    const myScore = comparison?.myHospital?.score || 0;
    const diff = myScore - compData.score;

    if (diff > 5) return { icon: <TrendingUp className="h-4 w-4 text-green-500" />, text: '우위', color: 'text-green-600' };
    if (diff < -5) return { icon: <TrendingDown className="h-4 w-4 text-red-500" />, text: '열세', color: 'text-red-600' };
    return { icon: <Minus className="h-4 w-4 text-slate-400" />, text: '비슷', color: 'text-slate-500' };
  };

  // 제안 결과에서 이미 등록/거절된 것 필터링
  const suggestions: Suggestion[] = (suggestMutation.data?.data?.suggestions || [])
    .filter((s: Suggestion) => !dismissedSuggestions.has(s.name));

  const analysisInfo = suggestMutation.data?.data?.analysisInfo;
  const rankingRows = answerRanking ? [
    { ...answerRanking.myHospital, mine: true },
    ...(answerRanking.competitors || []).map((item: any) => ({ ...item, mine: false })),
  ].sort((a: any, b: any) => (a.rank ?? 999) - (b.rank ?? 999) || b.mentionCount - a.mentionCount) : [];

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="경쟁사 관리" description="경쟁사를 추가하고 비교합니다" />
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">병원 등록이 필요합니다</h3>
              <p className="text-slate-500 mb-4">경쟁사를 관리하려면 먼저 병원 정보를 등록해주세요.</p>
              <Button onClick={() => window.location.href = '/onboarding'}>병원 등록하기</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="경쟁 병원" description="우리 병원과 함께 AI 답변에 등장하는 병원을 확인합니다" />

      <div className="mx-auto max-w-[1320px] space-y-6 p-5 sm:p-8">
        <div className="flex flex-col justify-between gap-3 rounded-[16px] border border-[#dce6f6] bg-[#f9fbff] p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-[#285cf4]">비교 대상 설정</p>
            <h2 className="text-lg font-bold tracking-[-0.02em] text-[#1d2b3c]">실제로 비교하고 싶은 병원을 추가하세요</h2>
            <p className="mt-1 text-sm leading-6 text-[#6a7b90]">병원 이름으로 직접 등록하고, 측정된 AI 답변에서 함께 등장한 후보도 확인할 수 있습니다.</p>
          </div>
          <a href="#add-competitor" className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-[9px] bg-[#285cf4] px-3 text-xs font-semibold text-white hover:bg-[#1e4edb]">경쟁 병원 추가 <ArrowRight className="h-3.5 w-3.5" /></a>
        </div>

        <Card className="!border-[#d5e0f2]">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-[#285cf4]">경쟁 병원 비교</p>
                <h2 className="flex items-center gap-2 text-lg font-bold tracking-[-0.02em] text-[#17212e]"><BarChart3 className="h-5 w-5 text-[#285cf4]" /> AI 답변 속 순위</h2>
                <p className="mt-1 text-xs leading-5 text-[#718198]">등록한 경쟁 병원과 우리 병원이 같은 기간의 AI 답변에 등장한 비율을 비교합니다.</p>
              </div>
              <span className="rounded-full bg-[#f0f3f7] px-3 py-1.5 text-xs font-semibold text-[#65778c]">최대 최근 {answerRanking?.periodDays || 30}일 · 공통 창 실측 답변 {answerRanking?.totalResponses ?? '—'}건</span>
            </div>

            {rankingLoading ? <div className="flex items-center gap-2 py-8 text-sm text-[#718198]"><Loader2 className="h-4 w-4 animate-spin" /> 순위를 불러오고 있습니다</div> : rankingError ? (
              <div className="rounded-[12px] border border-[#f2dada] bg-[#fff8f8] p-5 text-sm text-[#a74f4f]">순위 데이터를 불러오지 못했습니다.</div>
            ) : answerRanking?.status === 'READY' || answerRanking?.status === 'LOW_SAMPLE' ? (
              <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                <div className="rounded-[14px] bg-[#182a44] p-5 text-white">
                  <p className="text-xs font-semibold text-[#9eafc6]">우리 병원</p>
                  <div className="mt-3 flex items-baseline gap-2"><strong className="text-[44px] font-bold leading-none tracking-[-0.07em]">{answerRanking.rank}</strong><span className="text-sm text-[#bdcce0]">/ {answerRanking.totalClinics}위</span></div>
                  <p className="mt-4 text-xs text-[#c1d0e2]">AI 답변 {answerRanking.myHospital?.mentionCount || 0}건에서 등장 · {Number(answerRanking.myHospital?.mentionRate || 0).toFixed(1)}%</p>
                  {answerRanking.status === 'LOW_SAMPLE' && <span className="mt-3 inline-flex rounded-full bg-[#f9c66d]/15 px-2.5 py-1 text-[11px] font-semibold text-[#f9d592]">표본 {answerRanking.minRecommendedResponses}건 미만 · 임시 순위</span>}
                </div>
                <div className="overflow-hidden rounded-[14px] border border-[#e6ebf2] bg-white">
                  <div className="grid grid-cols-[34px_minmax(0,1fr)_66px] gap-2 border-b border-[#edf0f4] bg-[#f8fafc] px-3 py-2.5 text-[11px] font-semibold text-[#8796a7] sm:grid-cols-[44px_minmax(0,1fr)_78px_72px] sm:px-4"><span>순위</span><span>병원</span><span className="hidden text-right sm:block">등장</span><span className="text-right">비율</span></div>
                  {rankingRows.map((row: any) => <div key={row.id} className={`grid grid-cols-[34px_minmax(0,1fr)_66px] items-center gap-2 border-b border-[#f0f2f5] px-3 py-3 text-sm last:border-b-0 sm:grid-cols-[44px_minmax(0,1fr)_78px_72px] sm:px-4 ${row.mine ? 'bg-[#f5f8ff]' : ''}`}><span className={`font-bold ${row.mine ? 'text-[#285cf4]' : 'text-[#708197]'}`}>{row.rank ?? '—'}</span><span className={`min-w-0 font-semibold ${row.mine ? 'text-[#224aca]' : 'text-[#31445a]'}`}><span className="block truncate">{row.name}{row.mine && <span className="ml-1.5 text-[10px] text-[#6e84af]">우리 병원</span>}</span><span className="block text-[10px] font-normal text-[#91a0b0] sm:hidden">{row.mentionCount}건 등장</span></span><span className="hidden text-right text-[#60748b] sm:block">{row.mentionCount}건</span><span className="text-right font-semibold text-[#31445a]">{Number(row.mentionRate || 0).toFixed(1)}%</span></div>)}
                </div>
              </div>
            ) : (
              <div className="rounded-[12px] border border-dashed border-[#d6e0ea] bg-[#fafbfd] p-6 text-sm text-[#63758a]">
                {answerRanking?.status === 'NO_COMPETITORS' ? '등록한 경쟁 병원이 없습니다. 아래에서 비교할 병원을 추가해 주세요.' : answerRanking?.pendingMeasurement ? '새 경쟁 병원 등록 후 AI 재측정을 기다리고 있습니다. 같은 답변에서 함께 확인한 결과가 쌓이면 순위를 표시합니다.' : answerRanking?.status === 'NO_MENTIONS' ? '공통 비교 기간의 AI 답변에서 우리 병원과 등록된 경쟁 병원이 아직 등장하지 않았습니다.' : '공통 비교 기간에 실측된 AI 답변이 없어 순위를 계산할 수 없습니다.'}
                {answerRanking?.status === 'NO_COMPETITORS' && <a href="#add-competitor" className="ml-2 inline-flex items-center gap-1 font-semibold text-[#285cf4] hover:underline">병원 추가 <ArrowRight className="h-3.5 w-3.5" /></a>}
              </div>
            )}
            <p className="mt-4 text-[11px] leading-5 text-[#8795a6]">{answerRanking?.windowStart && !Number.isNaN(new Date(answerRanking.windowStart).getTime()) ? `${new Date(answerRanking.windowStart).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} 이후` : '공통 비교 기간의'} 동일한 실제 AI 답변을 분모로 사용합니다. 등록 병원 모두 비교할 수 있는 시점부터 계산하며, 동률은 공동 순위입니다. 의료 수준이나 진료 품질의 순위가 아닙니다.</p>
          </CardContent>
        </Card>
        {/* 플랜 사용량 표시 */}
        {planLimits.maxCompetitors !== -1 && (
          <Card className="bg-gradient-to-r from-slate-50 to-white">
            <CardContent className="p-4">
              <UsageBar
                used={competitors?.length || 0}
                limit={planLimits.maxCompetitors}
                label="경쟁사 등록"
                planType={planType}
              />
            </CardContent>
          </Card>
        )}

        {/* 경쟁사 추가 */}
        <Card id="add-competitor" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                경쟁 병원 추가
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="min-w-0 flex-1"><Input
                  placeholder="경쟁 병원 이름"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCompetitor()}
                /></div>
                <div className="sm:w-40"><Input
                  placeholder="지역 (선택)"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCompetitor()}
                /></div>
                <Button
                  onClick={handleAddCompetitor}
                  disabled={addMutation.isPending || !newCompetitor.trim()}
                >
                  {addMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  추가
                </Button>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!canUseFeature(planType, 'autoDetect')) {
                      setUpgradeFeature('autoDetect');
                      setShowUpgradeModal(true);
                      return;
                    }
                    suggestMutation.mutate();
                  }}
                  disabled={suggestMutation.isPending}
                  className="border-purple-200 hover:bg-purple-50"
                >
                  {suggestMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Lightbulb className="h-4 w-4 mr-2 text-purple-600" />
                  )}
                  AI 경쟁 병원 제안
                  {!canUseFeature(planType, 'autoDetect') && (
                    <Lock className="h-3 w-3 ml-1 text-slate-400" />
                  )}
                </Button>
                <p className="text-sm text-slate-500">
                  크롤링 데이터를 분석하여 주요 경쟁사를 제안합니다
                </p>
              </div>
            </CardContent>
          </Card>

        {/* ========== AI 제안 결과 ========== */}
        {showSuggestions && (suggestions.length > 0 || analysisInfo) && (
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-purple-800">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  AI 경쟁사 제안
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSuggestions(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {analysisInfo && (
                <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {analysisInfo.totalResponsesAnalyzed}개 AI 응답 분석
                  </span>
                  <span>최근 {analysisInfo.periodDays}일</span>
                  <span className="flex items-center gap-1">
                    우리 병원 언급률: <strong className="text-purple-700">{analysisInfo.myMentionRate}%</strong>
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">추가 제안할 경쟁사가 없습니다</p>
                  <p className="text-sm text-slate-400 mt-1">크롤링 데이터가 더 쌓이면 새로운 제안이 나올 수 있습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((suggestion) => {
                    const config = THREAT_CONFIG[suggestion.threatLevel];
                    const ThreatIcon = config.icon;

                    return (
                      <div
                        key={suggestion.name}
                        className={`p-4 rounded-xl border transition-all ${config.bg}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`p-2 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm flex-shrink-0`}>
                              <ThreatIcon className={`h-5 w-5 ${config.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-slate-900">{suggestion.name}</h4>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
                                  {config.label} · {suggestion.threatScore}점
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                                {suggestion.reason}
                              </p>
                              {/* 상세 지표 */}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                                <span>총 {suggestion.mentionCount}회 언급</span>
                                {suggestion.soloMentionCount > 0 && (
                                  <span className="text-red-500 font-medium">
                                    <AlertTriangle className="h-3 w-3 inline mr-0.5" />
                                    우리 대신 {suggestion.soloMentionCount}회 추천
                                  </span>
                                )}
                                {suggestion.coMentionCount > 0 && (
                                  <span>동시 비교 {suggestion.coMentionCount}회</span>
                                )}
                                {suggestion.avgPosition && (
                                  <span>평균 {suggestion.avgPosition}위</span>
                                )}
                                <span>
                                  {suggestion.platforms.map((p) => PLATFORM_LABELS[p] || p).join(', ')}
                                </span>
                              </div>
                            </div>
                          </div>
                          {/* 수락/거절 버튼 */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-slate-400 hover:text-slate-600"
                              onClick={() => {
                                setDismissedSuggestions((prev) => new Set(Array.from(prev).concat(suggestion.name)));
                              }}
                            >
                              건너뛰기
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => acceptMutation.mutate({ competitorName: suggestion.name })}
                              disabled={acceptMutation.isPending}
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              {acceptMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              ) : (
                                <Plus className="h-3.5 w-3.5 mr-1" />
                              )}
                              등록
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 검색 + 복구 버튼 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="경쟁 병원 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
              className="border-amber-200 hover:bg-amber-50 text-amber-700"
            >
              <Archive className="h-4 w-4 mr-1.5" />
              삭제된 경쟁사
            </Button>
          </div>
          <p className="text-sm text-slate-500">
            총 {filteredCompetitors?.length || 0}개 경쟁 병원
          </p>
        </div>

        {/* ========== 비활성(삭제된) 경쟁사 복구 패널 ========== */}
        {showInactive && (
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <Archive className="h-5 w-5 text-amber-600" />
                  삭제된 경쟁사 복구
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => restoreAllMutation.mutate()}
                    disabled={restoreAllMutation.isPending || !inactiveCompetitors?.length}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {restoreAllMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    )}
                    전체 복구
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInactive(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                이전에 삭제한 경쟁사를 다시 활성화할 수 있습니다
              </p>
            </CardHeader>
            <CardContent>
              {inactiveLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                </div>
              ) : inactiveError ? (
                <div className="text-center py-6">
                  <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">목록을 불러오지 못했습니다</p>
                  <p className="text-sm text-slate-400 mt-1 mb-4">
                    목록 조회가 안 되더라도 &quot;전체 복구&quot; 버튼으로 바로 복구할 수 있습니다
                  </p>
                  <Button
                    onClick={() => restoreAllMutation.mutate()}
                    disabled={restoreAllMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {restoreAllMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    삭제된 경쟁사 전체 복구 시도
                  </Button>
                </div>
              ) : !inactiveCompetitors || inactiveCompetitors.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">삭제된 경쟁사가 없습니다</p>
                  <p className="text-sm text-slate-400 mt-1">
                    모든 경쟁사가 활성 상태이거나, DB에서 완전 삭제되었을 수 있습니다
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-700 mb-3">
                    {inactiveCompetitors.length}개의 삭제된 경쟁사를 발견했습니다
                  </p>
                  {inactiveCompetitors.map((comp: any) => (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between p-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-2xl bg-slate-100">
                          <Building className="h-4 w-4 text-slate-400" />
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">{comp.competitorName}</span>
                          {comp.competitorRegion && (
                            <span className="text-sm text-slate-400 ml-2">
                              <MapPin className="h-3 w-3 inline" /> {comp.competitorRegion}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restoreOneMutation.mutate(comp.id)}
                        disabled={restoreOneMutation.isPending}
                        className="border-amber-200 hover:bg-amber-50 text-amber-700"
                      >
                        {restoreOneMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        )}
                        복구
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 경쟁사 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            </div>
          ) : filteredCompetitors?.length === 0 ? (
            <div className="col-span-full">
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">
                    {searchTerm ? '검색 결과가 없습니다' : '등록된 경쟁사가 없습니다'}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    경쟁 병원을 직접 추가하거나 AI 후보를 확인해보세요
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            filteredCompetitors?.map((competitor: any) => {
              const trend = getScoreTrend(competitor);
              const compScore = comparison?.competitors?.find(
                (c: any) => c.name === competitor.competitorName
              )?.score;

              return (
                <Card key={competitor.id} className="hover:shadow-card-hover transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-2xl bg-orange-100">
                          <Building className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-900">
                            {competitor.competitorName}
                          </h3>
                          {competitor.competitorRegion && (
                            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {competitor.competitorRegion}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('이 경쟁사를 삭제하시겠습니까?')) {
                            deleteMutation.mutate(competitor.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    {/* 점수 비교 */}
                    {compScore !== undefined && (
                      <div className="mt-4 pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500"><TermTip term="visibilityScore">AI 가시성 점수</TermTip></span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {compScore}점
                            </span>
                            {trend && (
                              <span className="flex items-center gap-1 text-sm">
                                {trend.icon}
                                <span className="text-slate-500">{trend.text}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 배지 */}
                    <div className="flex gap-2 mt-3">
                      {competitor.isAutoDetected && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          AI 제안
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        competitor.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {competitor.isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* 비교 요약 */}
        {comparison && comparison.competitors?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  경쟁사 점수 비교
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  ≈ 표시는 AI 응답 데이터 기반 추정 점수입니다
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* 내 병원 */}
                  <div className="flex items-center gap-3">
                    <div className="w-36 font-medium text-brand-600 truncate" title={comparison.myHospital?.name}>
                      {comparison.myHospital?.name || '우리 병원'}
                    </div>
                    <div className="flex-1 bg-slate-100 rounded-full h-5">
                      <div
                        className="bg-brand-500 rounded-full h-5 transition-all flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(comparison.myHospital?.score || 0, 8)}%` }}
                      >
                        <span className="text-[10px] text-white font-bold">
                          {comparison.myHospital?.score || 0}
                        </span>
                      </div>
                    </div>
                    <div className="w-14 text-right font-semibold text-sm">
                      {comparison.myHospital?.score || 0}점
                    </div>
                  </div>

                  {/* 경쟁사들 (점수순 정렬) */}
                  {[...comparison.competitors]
                    .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
                    .map((comp: any, index: number) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-36 text-sm text-slate-600 truncate" title={comp.name}>
                        {comp.name}
                        {comp.isEstimated && (
                          <span className="text-xs text-amber-500 ml-1" title="AI 응답 기반 추정치">≈</span>
                        )}
                      </div>
                      <div className="flex-1 bg-slate-100 rounded-full h-5">
                        <div
                          className={`rounded-full h-5 transition-all flex items-center justify-end pr-2 ${
                            comp.score > 0
                              ? comp.isEstimated ? 'bg-orange-300' : 'bg-orange-400'
                              : 'bg-slate-200'
                          }`}
                          style={{ width: `${Math.max(comp.score || 0, comp.score > 0 ? 8 : 3)}%` }}
                        >
                          {comp.score > 0 && (
                            <span className="text-[10px] text-white font-bold">
                              {comp.score}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-14 text-right text-sm flex items-center justify-end gap-1">
                        {comp.score === 0 ? (
                          <span className="text-slate-400 text-xs">데이터 없음</span>
                        ) : (
                          <>
                            <span>{comp.score}점</span>
                            {comp.isEstimated && (
                              <span className="text-xs text-amber-500" title="AI 응답 기반 추정치">≈</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
      </div>

      {/* 업그레이드 모달 */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeFeature}
        currentPlan={planType}
      />
    </div>
  );
}
