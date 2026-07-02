'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth';
import { api, scoresApi } from '@/lib/api';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Users, Banknote, ArrowRight, ChevronDown, ChevronUp,
  Filter, Eye, Search, ShieldCheck, CalendarCheck, Loader2,
  Play, Target, FlaskConical, Award, XCircle,
} from 'lucide-react';
import Link from 'next/link';

// ─── 타입 ───
interface StageData {
  stage: string;
  label: string;
  patientVoice: string;
  sov: number;
  prevSov: number | null;
  trend: 'up' | 'down' | 'flat';
  benchmark: number;
  benchmarkSource?: 'MEASURED' | 'DEFAULT';
  peerPosition?: string | null;
  peerSampleHospitals?: number | null;
  status: 'healthy' | 'warning' | 'critical';
  totalQueries: number;
  mentionedQueries: number;
  avgSentiment: number | null;
  r3Rate: number;
  topCompetitors: { name: string; count: number }[];
  platformBreakdown: Record<string, { total: number; mentioned: number; sov: number }>;
  samplePrompts: { text: string; mentioned: boolean }[];
}

interface PlaybookAction {
  stage: string;
  stageLabel: string;
  priority: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  expectedEffect: string;
  effort: string;
}

interface FunnelData {
  hospital: { name: string; specialtyType: string; region: string };
  hasData: boolean;
  message?: string;
  healthScore: number;
  healthGrade: string;
  analyzedResponses: number;
  stages: StageData[];
  primaryLeak: { stage: string; label: string; gap: number } | null;
  impactEstimate: {
    missedPatientsMin: number;
    missedPatientsMax: number;
    revenuePerPatient: number;
    revenueBasis: string;
    monthlyLossMin: number;
    monthlyLossMax: number;
    disclaimer: string;
  };
  playbook: PlaybookAction[];
  benchmarkInfo?: {
    mode: 'MEASURED' | 'DEFAULT';
    measuredStageCount: number;
    sampleHospitals: number;
    description: string;
  };
}

interface ActionImpact {
  id: string;
  title: string;
  funnelStage: string | null;
  expectedEffect: string | null;
  priority: string | null;
  effort: string | null;
  status: string;
  startedAt: string | null;
  daysSinceStart: number | null;
  baseline: { sov: number | null; responses: number | null; windowDays: number | null };
  outcome: { sov: number | null; deltaSov: number | null; status: string | null; lastMeasuredAt: string | null };
}

interface ActionImpactData {
  summary: { activeCount: number; completedCount: number; improvedCount: number; totalSovGain: number };
  actions: ActionImpact[];
}

const OUTCOME_STYLE: Record<string, { label: string; bg: string; icon: any }> = {
  MEASURING: { label: '측정 중', bg: 'bg-slate-100 text-slate-600', icon: FlaskConical },
  IMPROVED: { label: '개선됨 ↑', bg: 'bg-emerald-100 text-emerald-700', icon: TrendingUp },
  FLAT: { label: '변화 없음', bg: 'bg-amber-100 text-amber-700', icon: Minus },
  DECLINED: { label: '하락 ↓', bg: 'bg-red-100 text-red-700', icon: TrendingDown },
};

const STAGE_LABELS: Record<string, string> = {
  AWARENESS: '인지', COMPARISON: '탐색·비교', TRUST: '신뢰 검증', DECISION: '결정·예약',
};

const STAGE_ICONS: Record<string, any> = {
  AWARENESS: Eye,
  COMPARISON: Search,
  TRUST: ShieldCheck,
  DECISION: CalendarCheck,
};

const STATUS_STYLE = {
  healthy: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-500', label: '건강' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', bar: 'bg-amber-500', label: '주의' },
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', bar: 'bg-red-500', label: '누수' },
} as const;

const PRIORITY_STYLE = {
  critical: { label: '🔴 긴급', bg: 'bg-red-100 text-red-700' },
  high: { label: '🟠 중요', bg: 'bg-amber-100 text-amber-700' },
  medium: { label: '🔵 권장', bg: 'bg-blue-100 text-blue-700' },
} as const;

const PLATFORM_LABELS: Record<string, string> = {
  CHATGPT: 'ChatGPT', PERPLEXITY: 'Perplexity', CLAUDE: 'Claude',
  GEMINI: 'Gemini', GROK: 'Grok', CLOVA_X: 'CLOVA X',
};

const formatKRW = (won: number) => {
  if (won >= 100_000_000) return `${(won / 100_000_000).toFixed(1)}억원`;
  if (won >= 10_000_000) return `${Math.round(won / 10_000_000) * 1000}만원`;
  if (won >= 10_000) return `${Math.round(won / 10_000).toLocaleString()}만원`;
  return `${won.toLocaleString()}원`;
};

export default function FunnelPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<FunnelData>({
    queryKey: ['funnel', hospitalId],
    queryFn: async () => (await api.get(`/scores/${hospitalId}/funnel?days=30`)).data,
    enabled: !!hospitalId,
    staleTime: 5 * 60 * 1000,
  });

  // 【본질 강화 1】액션 임팩트 트래커
  const { data: impactData } = useQuery<ActionImpactData>({
    queryKey: ['action-impacts', hospitalId],
    queryFn: async () => (await scoresApi.getActionImpacts(hospitalId!)).data,
    enabled: !!hospitalId,
    staleTime: 5 * 60 * 1000,
  });

  const startTracking = useMutation({
    mutationFn: (action: PlaybookAction) =>
      scoresApi.startActionTracking(hospitalId!, {
        funnelStage: action.stage,
        title: action.title,
        description: action.description,
        expectedEffect: action.expectedEffect,
        priority: action.priority,
        effort: action.effort,
        source: 'PLAYBOOK',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-impacts', hospitalId] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ actionId, status }: { actionId: string; status: 'COMPLETED' | 'DISMISSED' }) =>
      scoresApi.updateActionStatus(hospitalId!, actionId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-impacts', hospitalId] });
    },
  });

  const trackedTitles = new Set(
    (impactData?.actions || [])
      .filter((a) => a.status === 'IN_PROGRESS' || a.status === 'COMPLETED')
      .map((a) => a.title),
  );

  if (isLoading) {
    return (
      <div className="flex-1">
        <Header title="AI 환자 퍼널 진단" description="환자 여정 4단계 × AI 가시성 분석" />
        <main className="p-6 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-brand-500 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">환자 여정 데이터를 분석하는 중...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!data?.hasData) {
    return (
      <div className="flex-1">
        <Header title="AI 환자 퍼널 진단" description="환자 여정 4단계 × AI 가시성 분석" />
        <main className="p-6">
          <Card>
            <CardContent className="py-16 text-center">
              <Filter className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-semibold mb-2">아직 퍼널 진단 데이터가 없습니다</p>
              <p className="text-sm text-slate-400">{data?.message || '첫 AI 크롤링이 완료되면 환자 여정 분석이 시작됩니다.'}</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { stages, primaryLeak, impactEstimate, playbook, healthScore, healthGrade } = data;

  return (
    <div className="flex-1">
      <Header
        title="AI 환자 퍼널 진단"
        description={`${data.hospital.name} · 최근 30일 · ${data.analyzedResponses}개 AI 응답 분석`}
        onRefresh={() => refetch()}
        refreshing={isRefetching}
      />
      <main className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto bg-aurora rounded-3xl">

        {/* ─── Hero: 퍼널 건강 점수 + 신환 임팩트 ─── */}
        <section id="funnel-hero" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 건강 점수 */}
          <Card className="lg:col-span-1">
            <CardContent className="p-6 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">퍼널 건강 점수</p>
              <div className="flex items-end justify-center gap-2">
                <span className={`text-6xl font-black tabular-nums ${healthScore >= 60 ? 'text-emerald-600' : healthScore >= 40 ? 'text-amber-500' : 'text-red-500'}`} style={{ textShadow: '0 4px 24px rgba(99,102,241,0.15)' }}>
                  {healthScore}
                </span>
                <span className="text-2xl font-bold text-slate-400 mb-2">/ 100</span>
              </div>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-bold ${
                healthGrade === 'A' ? 'bg-emerald-100 text-emerald-700' :
                healthGrade === 'B' ? 'bg-brand-100 text-brand-700' :
                healthGrade === 'C' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              }`}>
                {healthGrade}등급
              </span>
              {primaryLeak && (
                <p className="mt-3 text-sm text-red-600 font-semibold flex items-center justify-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  최대 누수: {primaryLeak.label} 단계
                </p>
              )}
            </CardContent>
          </Card>

          {/* 신환 임팩트 */}
          <Card className="lg:col-span-2 border-2 border-red-100 ambient-sheen">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">이번 달 추정 기회 손실</p>
                  <p className="text-sm text-slate-500">전환 직결 단계(비교·결정)에서 AI 미노출로 놓치는 잠재 신환</p>
                </div>
                <Banknote className="w-8 h-8 text-red-300" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-red-600">놓친 신환 (월)</span>
                  </div>
                  <p className="text-2xl font-black text-red-700">
                    {impactEstimate.missedPatientsMin}~{impactEstimate.missedPatientsMax}명
                  </p>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Banknote className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-red-600">매출 환산 (월)</span>
                  </div>
                  <p className="text-2xl font-black text-red-700">
                    {formatKRW(impactEstimate.monthlyLossMin)}~{formatKRW(impactEstimate.monthlyLossMax)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-400">
                기준: {impactEstimate.revenueBasis} 객단가 {formatKRW(impactEstimate.revenuePerPatient)} · {impactEstimate.disclaimer}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* ─── 퍼널 시각화 ─── */}
        <section id="funnel-stages">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Filter className="w-5 h-5 text-brand-500" />
              환자 여정 4단계 × AI 가시성
            </h2>
            {data.benchmarkInfo && (
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  data.benchmarkInfo.mode === 'MEASURED'
                    ? 'bg-brand-50 text-brand-600'
                    : 'bg-slate-100 text-slate-500'
                }`}
                title={data.benchmarkInfo.description}
              >
                {data.benchmarkInfo.mode === 'MEASURED'
                  ? `📊 실측 벤치마크 (동일 진료과 ${data.benchmarkInfo.sampleHospitals}개 병원 분포)`
                  : '벤치마크: 업계 권장 기본값 (표본 누적 중)'}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {stages.map((stage, idx) => {
              const Icon = STAGE_ICONS[stage.stage] || Eye;
              const style = STATUS_STYLE[stage.status];
              const isExpanded = expandedStage === stage.stage;
              const widthPct = 100 - idx * 12; // 퍼널 모양

              return (
                <div key={stage.stage} className="flex justify-center">
                  <Card
                    className={`cursor-pointer transition-all hover:shadow-md ${style.border} border-2`}
                    style={{ width: `${widthPct}%`, minWidth: '280px' }}
                    onClick={() => setExpandedStage(isExpanded ? null : stage.stage)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-5 h-5 ${style.text}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-800">{idx + 1}. {stage.label}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${style.bg} ${style.text}`}>
                                {style.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate">{stage.patientVoice}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <span className={`text-xl font-black ${style.text}`}>{stage.sov}%</span>
                              {stage.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
                              {stage.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                              {stage.trend === 'flat' && <Minus className="w-4 h-4 text-slate-300" />}
                            </div>
                            <p className="text-[10px] text-slate-400">
                              목표 {stage.benchmark}%
                              {stage.benchmarkSource === 'MEASURED' && (
                                <span className="ml-1 px-1 py-px bg-brand-50 text-brand-600 rounded font-bold" title={`동일 진료과 ${stage.peerSampleHospitals}개 병원 실측 분포 기반`}>실측</span>
                              )}
                              {stage.peerPosition && (
                                <span className="ml-1 font-semibold text-slate-500">· 동료 중 {stage.peerPosition}</span>
                              )}
                              {' '}· {stage.totalQueries}개 질문
                            </p>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      {/* SoV 게이지 */}
                      <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden relative">
                        <div className={`h-full ${style.bar} rounded-full transition-all bar-shine`} style={{ width: `${Math.min(100, stage.sov)}%` }} />
                        <div className="absolute top-0 h-full w-0.5 bg-slate-400" style={{ left: `${Math.min(100, stage.benchmark)}%` }} title={`벤치마크 ${stage.benchmark}%`} />
                      </div>

                      {/* 펼침 상세 */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4" onClick={(e) => e.stopPropagation()}>
                          <div>
                            <p className="text-xs font-bold text-slate-500 mb-2">플랫폼별 노출률</p>
                            <div className="space-y-1.5">
                              {Object.entries(stage.platformBreakdown).map(([p, b]) => (
                                <div key={p} className="flex items-center gap-2 text-xs">
                                  <span className="w-20 text-slate-600 font-medium flex-shrink-0">{PLATFORM_LABELS[p] || p}</span>
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-400 rounded-full" style={{ width: `${b.sov}%` }} />
                                  </div>
                                  <span className="w-12 text-right font-bold text-slate-700">{b.sov}%</span>
                                </div>
                              ))}
                            </div>
                            {stage.topCompetitors.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-bold text-slate-500 mb-1.5">이 단계 위협 경쟁사</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {stage.topCompetitors.map((c) => (
                                    <span key={c.name} className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[11px] font-semibold">
                                      {c.name} ({c.count}회)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-500 mb-2">대표 질문 (미언급 우선)</p>
                            <div className="space-y-1.5">
                              {stage.samplePrompts.map((sp, i) => (
                                <div key={i} className={`text-xs p-2 rounded-lg flex items-start gap-1.5 ${sp.mentioned ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                  {sp.mentioned ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                                  <span>{sp.text}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 flex gap-3 text-xs text-slate-500">
                              <span>감성 <b className="text-slate-700">{stage.avgSentiment ?? '—'}</b></span>
                              <span>단독추천(R3) <b className="text-slate-700">{stage.r3Rate}%</b></span>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── 【본질 강화 1】액션 임팩트 트래커 ─── */}
        {impactData && impactData.actions.length > 0 && (
          <section id="action-impact-tracker">
            <h2 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-brand-500" />
              액션 임팩트 트래커 — 처방이 실제로 효과가 있었나?
            </h2>

            {/* 성과 요약 */}
            {impactData.summary.improvedCount > 0 && (
              <Card className="mb-3 border-2 border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <Award className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                  <div>
                    <p className="font-black text-emerald-800">
                      실행한 액션 {impactData.summary.improvedCount}개에서 총 SoV +{impactData.summary.totalSovGain}%p 상승 검증됨
                    </p>
                    <p className="text-xs text-emerald-600">베이스라인 대비 실측 — 처방→실행→재측정 루프가 작동 중입니다 🔁</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              {impactData.actions.filter((a) => a.status !== 'DISMISSED').map((a) => {
                const os = OUTCOME_STYLE[a.outcome.status || 'MEASURING'] || OUTCOME_STYLE.MEASURING;
                const OIcon = os.icon;
                return (
                  <Card key={a.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${os.bg} inline-flex items-center gap-1`}>
                              <OIcon className="w-3 h-3" />{os.label}
                            </span>
                            {a.funnelStage && (
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                {STAGE_LABELS[a.funnelStage] || a.funnelStage} 단계
                              </span>
                            )}
                            {a.daysSinceStart !== null && a.status === 'IN_PROGRESS' && (
                              <span className="text-[10px] text-slate-400">{a.daysSinceStart}일째 추적 중</span>
                            )}
                            {a.status === 'COMPLETED' && (
                              <span className="text-[10px] text-emerald-600 font-bold">완료</span>
                            )}
                          </div>
                          <p className="font-bold text-slate-800 text-sm truncate">{a.title}</p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400">시작 시점</p>
                            <p className="font-black text-slate-600 tabular-nums">{a.baseline.sov ?? '—'}%</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-300" />
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400">현재</p>
                            <p className="font-black text-slate-800 tabular-nums">{a.outcome.sov ?? '—'}%</p>
                          </div>
                          {a.outcome.deltaSov !== null && (
                            <span className={`px-2 py-1 rounded-lg text-sm font-black tabular-nums ${
                              a.outcome.deltaSov >= 3 ? 'bg-emerald-100 text-emerald-700'
                              : a.outcome.deltaSov <= -3 ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                            }`}>
                              {a.outcome.deltaSov > 0 ? '+' : ''}{a.outcome.deltaSov}%p
                            </span>
                          )}
                          {a.status === 'IN_PROGRESS' && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => updateStatus.mutate({ actionId: a.id, status: 'COMPLETED' })}
                                className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500"
                                title="완료 처리 (최종 성과 동결)"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => updateStatus.mutate({ actionId: a.id, status: 'DISMISSED' })}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                                title="추적 중단"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {a.outcome.status === 'MEASURING' && a.status === 'IN_PROGRESS' && (
                        <p className="mt-2 text-[11px] text-slate-400">
                          ⏳ 효과 판정까지 최소 14일 + 표본 10개 필요 — 매일 크롤링 후 자동 재측정됩니다
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── 액션 플레이북 ─── */}
        <section id="funnel-playbook">
          <h2 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-brand-500" />
            이번 주 처방전 — 퍼널 누수 막기
          </h2>
          {playbook.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="font-semibold">모든 퍼널 단계가 건강합니다! 현 상태 유지에 집중하세요. 🎉</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {playbook.map((action, i) => {
                const ps = PRIORITY_STYLE[action.priority];
                return (
                  <Card key={i} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-1 rounded-md text-[11px] font-bold flex-shrink-0 ${ps.bg}`}>{ps.label}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{action.stageLabel} 단계</span>
                            <span className="text-[11px] text-slate-400">실행 난이도: {action.effort}</span>
                          </div>
                          <h3 className="font-bold text-slate-800 mb-1.5">{action.title}</h3>
                          <p className="text-sm text-slate-600 leading-relaxed mb-2">{action.description}</p>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5" />
                              기대 효과: {action.expectedEffect}
                            </p>
                            {trackedTitles.has(action.title) ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-500 bg-brand-50 px-3 py-1.5 rounded-lg">
                                <FlaskConical className="w-3.5 h-3.5" /> 효과 추적 중
                              </span>
                            ) : (
                              <button
                                onClick={() => startTracking.mutate(action)}
                                disabled={startTracking.isPending}
                                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                title="현재 단계 SoV를 베이스라인으로 동결하고 효과 측정을 시작합니다"
                              >
                                <Play className="w-3.5 h-3.5" /> 실행 시작 — 효과 측정하기
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/dashboard/geo-content" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:text-brand-700">
              AI 콘텐츠로 바로 실행하기 <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/dashboard/opportunities" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700">
              기회 분석 보기 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
