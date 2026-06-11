'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Users, Banknote, ArrowRight, ChevronDown, ChevronUp,
  Filter, Eye, Search, ShieldCheck, CalendarCheck, Loader2,
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
}

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

  const { data, isLoading, refetch, isRefetching } = useQuery<FunnelData>({
    queryKey: ['funnel', hospitalId],
    queryFn: async () => (await api.get(`/scores/${hospitalId}/funnel?days=30`)).data,
    enabled: !!hospitalId,
    staleTime: 5 * 60 * 1000,
  });

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
          <h2 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2">
            <Filter className="w-5 h-5 text-brand-500" />
            환자 여정 4단계 × AI 가시성
          </h2>
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
                            <p className="text-[10px] text-slate-400">목표 {stage.benchmark}% · {stage.totalQueries}개 질문</p>
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
                          <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            기대 효과: {action.expectedEffect}
                          </p>
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
