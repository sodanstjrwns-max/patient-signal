'use client';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  강의록 실행 지표 — 강의록의 원칙을 숫자로 검증하는 화면
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 탭 구성
 *   개요     8개 지표 종합 카드
 *   채널     25번 인용 효율 + 30·32번 포트폴리오 4구역
 *   질문     12·24번 지역 배율 + 28-② 난이도 + 13번 언어
 *   엔티티   20번 원장 실명 + AEO/GEO + 29번 부정 경보
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { TermTip } from '@/components/ui/term-tooltip';
import { useAuthStore } from '@/stores/auth';
import { lectureMetricsApi } from '@/lib/api';
import {
  Loader2, AlertTriangle, CheckCircle2, Info, TrendingUp, TrendingDown,
  Layers, MapPin, Globe2, UserRound, Radar, BellRing, Gauge, Boxes,
  ArrowUpRight, ArrowDownRight, Minus, Target,
} from 'lucide-react';

// ─────────────────────────────────────────────
// 공용 프리미티브
// ─────────────────────────────────────────────

const STATUS_STYLE: Record<string, { ring: string; text: string; bg: string; icon: any; label: string }> = {
  GOOD: { ring: 'border-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2, label: '양호' },
  WARN: { ring: 'border-amber-200', text: 'text-amber-700', bg: 'bg-amber-50', icon: AlertTriangle, label: '주의' },
  BAD: { ring: 'border-red-200', text: 'text-red-700', bg: 'bg-red-50', icon: AlertTriangle, label: '위험' },
  INFO: { ring: 'border-slate-200', text: 'text-slate-600', bg: 'bg-slate-50', icon: Info, label: '참고' },
};

const ZONE_STYLE: Record<string, { bar: string; chip: string }> = {
  HOME_BASE: { bar: 'bg-brand-500', chip: 'bg-brand-50 text-brand-700 border-brand-200' },
  SNIPER: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  VOLUME: { bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  AVOID: { bar: 'bg-red-500', chip: 'bg-red-50 text-red-700 border-red-200' },
};

const DIFF_STYLE: Record<string, string> = {
  EASY: 'bg-slate-400',
  MEDIUM: 'bg-brand-500',
  HARD: 'bg-indigo-600',
};

function SectionTitle({
  icon: Icon, lecture, title, desc,
}: { icon: any; lecture: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="h-10 w-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-brand-600" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-black text-slate-900">{title}</h2>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white tracking-wide">
            강의록 {lecture}
          </span>
        </div>
        <p className="text-xs text-slate-500 font-medium mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function Bar({ pct, className = 'bg-brand-500' }: { pct: number; className?: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${className}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="py-10 text-center">
      <Info className="h-8 w-8 text-slate-300 mx-auto mb-2" />
      <p className="text-sm text-slate-400 font-medium">{msg}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="py-16 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
    </div>
  );
}

/** 벤치마크 대비 표시 — 우리 값이 기준보다 높은지 낮은지 */
function VsBench({ value, bench, unit = '%', higherIsBetter = true }: {
  value: number; bench: number; unit?: string; higherIsBetter?: boolean;
}) {
  const diff = Math.round((value - bench) * 10) / 10;
  const good = higherIsBetter ? diff >= 0 : diff <= 0;
  const Icon = diff === 0 ? Minus : good ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
      diff === 0 ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-red-500'
    }`}>
      <Icon className="h-3 w-3" />
      {diff > 0 ? '+' : ''}{diff}{unit}
      <span className="text-slate-400 font-medium ml-0.5">vs 실측 {bench}{unit}</span>
    </span>
  );
}

// ─────────────────────────────────────────────
// 탭: 개요
// ─────────────────────────────────────────────

function OverviewTab({ hospitalId, days }: { hospitalId: string; days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['lm-summary', hospitalId, days],
    queryFn: () => lectureMetricsApi.getSummary(hospitalId, days).then((r) => r.data),
    enabled: !!hospitalId,
  });

  if (isLoading) return <Loading />;
  if (!data) return <Empty msg="데이터를 불러올 수 없습니다." />;

  const cards: any[] = data.cards || [];
  const warnings: string[] = data.warnings || [];
  const insights: string[] = data.insights || [];

  return (
    <div className="space-y-5">
      {warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-black text-amber-900">
                지금 손봐야 할 것 {warnings.length}건
              </h3>
            </div>
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-900 leading-relaxed flex gap-2">
                  <span className="text-amber-500 font-bold flex-shrink-0">{i + 1}.</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const st = STATUS_STYLE[c.status] || STATUS_STYLE.INFO;
          const Icon = st.icon;
          return (
            <Card key={c.key} className={`border ${st.ring}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 tracking-wide flex-shrink-0">
                    {c.lectureItem}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${st.bg} ${st.text}`}>
                    <Icon className="h-2.5 w-2.5" />
                    {st.label}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-500 mb-1 truncate">{c.title}</p>
                <p className="text-2xl font-black text-slate-900 tabular-nums">
                  {c.value}
                  {c.unit && <span className="text-sm font-bold text-slate-400 ml-0.5">{c.unit}</span>}
                </p>
                {c.note && (
                  <p className="text-[11px] text-slate-500 leading-snug mt-1.5">{c.note}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {insights.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Radar className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-black text-slate-900">강의록이 말하는 것</h3>
            </div>
            <ul className="space-y-2.5">
              {insights.map((s, i) => (
                <li key={i} className="text-xs text-slate-600 leading-relaxed pl-3 border-l-2 border-brand-200">
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭: 채널 (25번 + 30·32번)
// ─────────────────────────────────────────────

function ChannelTab({ hospitalId, days }: { hospitalId: string; days: number }) {
  const eff = useQuery({
    queryKey: ['lm-eff', hospitalId, days],
    queryFn: () => lectureMetricsApi.getCitationEfficiency(hospitalId, days).then((r) => r.data),
    enabled: !!hospitalId,
  });
  const pf = useQuery({
    queryKey: ['lm-pf', hospitalId, days],
    queryFn: () => lectureMetricsApi.getPortfolio(hospitalId, days).then((r) => r.data),
    enabled: !!hospitalId,
  });

  return (
    <div className="space-y-6">
      {/* ── 25번 인용 효율 ── */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle
            icon={Gauge}
            lecture="25번"
            title="문서당 인용 효율"
            desc="인용수 = 선호도 × 공급량. 나누지 않으면 물량 많은 채널이 좋은 채널처럼 보입니다."
          />
          {eff.isLoading ? <Loading /> : !eff.data ? <Empty msg="인용 데이터가 없습니다." /> : (
            <>
              {eff.data.insight && (
                <div className="mb-4 p-3 rounded-xl bg-brand-50 border border-brand-100">
                  <p className="text-xs text-brand-900 font-semibold leading-relaxed">{eff.data.insight}</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                <div>
                  <h4 className="text-xs font-black text-red-700 mb-2 flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5" />
                    <TermTip term="misleadingTop">착시 상위 채널</TermTip>
                  </h4>
                  {(eff.data.misleadingTop || []).length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">해당 채널이 없습니다. 물량 착시는 없는 상태입니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {eff.data.misleadingTop.map((d: any) => (
                        <div key={d.domain} className="p-2.5 rounded-lg bg-red-50 border border-red-100">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate">{d.label || d.domain}</span>
                            <span className="text-[11px] font-bold text-red-600 flex-shrink-0 tabular-nums">
                              인용 {d.citationRank}위 → 효율 {d.efficiencyRank}위
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                            인용 {d.citations}건 · 공급량 {d.supplyIndex} · 효율 {d.efficiency}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-black text-emerald-700 mb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <TermTip term="hiddenGem">숨은 보석</TermTip>
                  </h4>
                  {(eff.data.hiddenGems || []).length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">아직 저공급 고효율 채널을 못 잡았습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {eff.data.hiddenGems.map((d: any) => (
                        <div key={d.domain} className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate">{d.label || d.domain}</span>
                            <span className="text-[11px] font-bold text-emerald-600 flex-shrink-0 tabular-nums">
                              효율 {d.efficiencyRank}위
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                            인용 {d.citations}건 · 공급량 {d.supplyIndex} · 효율 {d.efficiency}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 전체 표 */}
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400">
                      <th className="text-left py-2 px-2 font-bold">채널</th>
                      <th className="text-right py-2 px-2 font-bold">인용</th>
                      <th className="text-right py-2 px-2 font-bold whitespace-nowrap">
                        <TermTip term="supplyIndex" icon={false}>공급량</TermTip>
                      </th>
                      <th className="text-right py-2 px-2 font-bold whitespace-nowrap">
                        <TermTip term="citationEfficiency" icon={false}>효율</TermTip>
                      </th>
                      <th className="text-right py-2 px-2 font-bold whitespace-nowrap">순위 이동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(eff.data.domains || []).slice(0, 20).map((d: any) => (
                      <tr key={d.domain} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                              (ZONE_STYLE[d.zone] || ZONE_STYLE.VOLUME).bar
                            }`} />
                            <span className="font-semibold text-slate-700 truncate max-w-[180px]">
                              {d.label || d.domain}
                            </span>
                          </div>
                        </td>
                        <td className="text-right py-2 px-2 tabular-nums text-slate-600">{d.citations}</td>
                        <td className="text-right py-2 px-2 tabular-nums text-slate-400">{d.supplyIndex}</td>
                        <td className="text-right py-2 px-2 tabular-nums font-bold text-slate-800">{d.efficiency}</td>
                        <td className="text-right py-2 px-2 tabular-nums">
                          {d.rankDelta > 0 ? (
                            <span className="text-emerald-600 font-bold">▲ {d.rankDelta}</span>
                          ) : d.rankDelta < 0 ? (
                            <span className="text-red-500 font-bold">▼ {Math.abs(d.rankDelta)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 30·32번 포트폴리오 ── */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle
            icon={Boxes}
            lecture="30·32번"
            title="채널 포트폴리오 배치"
            desc="본진 / 고효율 저격수 / 물량 파도 / 하지마 — 지금 우리 인용은 어디에 몰려 있나."
          />
          {pf.isLoading ? <Loading /> : !pf.data ? <Empty msg="포트폴리오 데이터가 없습니다." /> : (
            <>
              {(pf.data.warnings || []).length > 0 && (
                <div className="mb-4 space-y-2">
                  {pf.data.warnings.map((w: string, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 leading-relaxed font-medium">{w}</p>
                    </div>
                  ))}
                </div>
              )}

              <h4 className="text-xs font-black text-slate-500 mb-2.5">
                <TermTip term="portfolioZone">포트폴리오 4구역</TermTip>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {(pf.data.zones || []).map((z: any) => {
                  const st = ZONE_STYLE[z.zone] || ZONE_STYLE.VOLUME;
                  return (
                    <div key={z.zone} className="p-3.5 rounded-xl border border-slate-150 bg-white">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${st.chip}`}>
                          {z.label}
                        </span>
                        <span className="text-lg font-black text-slate-900 tabular-nums">{z.share}%</span>
                      </div>
                      <Bar pct={z.share} className={st.bar} />
                      <p className="text-[11px] text-slate-500 mt-2 tabular-nums">
                        인용 {z.citations}건 · 도메인 {z.domainCount}종 · 동반율 {z.companionRate}%
                      </p>
                      {z.guide && (
                        <p className="text-[11px] text-slate-400 leading-snug mt-1.5">{z.guide}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <h4 className="text-xs font-black text-slate-500 mb-2.5">
                <TermTip term="channelDurability">채널 수명</TermTip>
              </h4>
              <div className="space-y-2.5">
                {(pf.data.durability || []).map((d: any) => (
                  <div key={d.durability}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700">{d.label}</span>
                      <span className="tabular-nums text-slate-500">
                        {d.citations}건 · <span className="font-black text-slate-800">{d.share}%</span>
                      </span>
                    </div>
                    <Bar
                      pct={d.share}
                      className={
                        d.durability === 'OWNED' ? 'bg-brand-500'
                        : d.durability === 'ACCUMULATIVE' ? 'bg-emerald-500'
                        : 'bg-amber-400'
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭: 질문 (12·24번 + 28-② + 13번)
// ─────────────────────────────────────────────

function QueryTab({ hospitalId, days }: { hospitalId: string; days: number }) {
  const rg = useQuery({
    queryKey: ['lm-region', hospitalId, days],
    queryFn: () => lectureMetricsApi.getRegionLeverage(hospitalId, days).then((r) => r.data),
    enabled: !!hospitalId,
  });
  const df = useQuery({
    queryKey: ['lm-diff', hospitalId, days],
    queryFn: () => lectureMetricsApi.getDifficulty(hospitalId, days).then((r) => r.data),
    enabled: !!hospitalId,
  });
  const lg = useQuery({
    queryKey: ['lm-lang', hospitalId, days],
    queryFn: () => lectureMetricsApi.getLanguageScoreboard(hospitalId, days).then((r) => r.data),
    enabled: !!hospitalId,
  });

  return (
    <div className="space-y-6">
      {/* ── 12·24번 지역 배율 ── */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle
            icon={MapPin}
            lecture="12·24번"
            title="지역 단위 배율표"
            desc="좁게 물으면 우리가 나온다. 동 단위가 시/구 단위보다 몇 배 유리한가."
          />
          {rg.isLoading ? <Loading /> : !rg.data ? <Empty msg="지역 데이터가 없습니다." /> : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-100">
                  <p className="text-[11px] font-bold text-brand-700 mb-1">
                    <TermTip term="regionLeverage">동 vs 시/군/구</TermTip>
                  </p>
                  <p className="text-2xl font-black text-brand-900 tabular-nums">
                    {rg.data.dongVsSigungu ?? '—'}
                    <span className="text-sm ml-0.5">배</span>
                  </p>
                  {rg.data.dongVsSigungu != null && (
                    <VsBench
                      value={rg.data.dongVsSigungu}
                      bench={rg.data.benchmark?.overallDongVsSigungu ?? 1.7}
                      unit="배"
                    />
                  )}
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-150">
                  <p className="text-[11px] font-bold text-slate-500 mb-1">동 vs 시/도</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums">
                    {rg.data.dongVsSido ?? '—'}
                    <span className="text-sm ml-0.5">배</span>
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">넓은 지역일수록 불리해지는 정도</p>
                </div>
              </div>

              {rg.data.insight && (
                <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-150">
                  <p className="text-xs text-slate-700 font-semibold leading-relaxed">{rg.data.insight}</p>
                </div>
              )}

              <h4 className="text-xs font-black text-slate-500 mb-2.5">지역 단위별 언급률</h4>
              <div className="space-y-2.5 mb-5">
                {(rg.data.overall || []).map((r: any) => (
                  <div key={r.level}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700">{r.label}</span>
                      <span className="tabular-nums text-slate-500">
                        {r.mentioned}/{r.responses} · <span className="font-black text-slate-800">{r.mentionRate}%</span>
                      </span>
                    </div>
                    <Bar
                      pct={r.mentionRate}
                      className={
                        r.level === 'DONG' ? 'bg-brand-500'
                        : r.level === 'SIGUNGU' ? 'bg-brand-300'
                        : r.level === 'SIDO' ? 'bg-slate-400'
                        : 'bg-slate-300'
                      }
                    />
                  </div>
                ))}
              </div>

              {(rg.data.platforms || []).length > 0 && (
                <>
                  <h4 className="text-xs font-black text-slate-500 mb-2.5">플랫폼별 배율</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400">
                          <th className="text-left py-2 px-2 font-bold">플랫폼</th>
                          <th className="text-right py-2 px-2 font-bold whitespace-nowrap">동/구 배율</th>
                          <th className="text-right py-2 px-2 font-bold whitespace-nowrap">동/시도 배율</th>
                          <th className="text-right py-2 px-2 font-bold">응답</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rg.data.platforms.map((p: any) => (
                          <tr key={p.platform} className="border-b border-slate-50">
                            <td className="py-2 px-2 font-semibold text-slate-700">{p.platform}</td>
                            <td className="text-right py-2 px-2 tabular-nums">
                              <span className={`font-black ${
                                (p.dongVsSigungu ?? 0) >= 1.7 ? 'text-emerald-600'
                                : (p.dongVsSigungu ?? 0) < 1 ? 'text-red-500'
                                : 'text-slate-700'
                              }`}>
                                {p.dongVsSigungu ?? '—'}배
                              </span>
                            </td>
                            <td className="text-right py-2 px-2 tabular-nums text-slate-500">
                              {p.dongVsSido ?? '—'}배
                            </td>
                            <td className="text-right py-2 px-2 tabular-nums text-slate-400">{p.totalResponses}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(rg.data.inverted || []).length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <p className="text-xs text-amber-900 font-medium leading-relaxed">
                        <span className="font-black">역전 플랫폼: </span>
                        {rg.data.inverted.map((p: any) => `${p.platform}(${p.ratio}배)`).join(', ')}
                        {' '}— 이 플랫폼에서는 좁은 지역 질문이 오히려 불리합니다. 넓은 지역 콘텐츠를 따로 붙여야 합니다.
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 28-② 난이도 ── */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle
            icon={Target}
            lecture="28-②번"
            title="질문 난이도별 점유율"
            desc="쉬운 질문만 넣고 SoV 90%를 자랑하는 건 경쟁 없는 곳에서 이긴 것입니다."
          />
          {df.isLoading ? <Loading /> : !df.data ? <Empty msg="난이도 데이터가 없습니다." /> : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-150">
                  <p className="text-[11px] font-bold text-slate-500 mb-1">종합 SoV</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums">
                    {df.data.overallSov}<span className="text-sm ml-0.5">%</span>
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    쉬운 질문 비중 {df.data.easyShare}%에 좌우됩니다
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100">
                  <p className="text-[11px] font-bold text-indigo-700 mb-1">
                    <TermTip term="balancedSov">보정 SoV</TermTip>
                  </p>
                  <p className="text-2xl font-black text-indigo-900 tabular-nums">
                    {df.data.balancedSov}<span className="text-sm ml-0.5">%</span>
                  </p>
                  <p className="text-[11px] text-indigo-500 font-medium">난이도 3구간 단순평균</p>
                </div>
              </div>

              {(df.data.warnings || []).map((w: string, i: number) => (
                <div key={i} className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-100 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-relaxed font-medium">{w}</p>
                </div>
              ))}

              <div className="space-y-3.5">
                {(df.data.rows || []).map((r: any) => (
                  <div key={r.difficulty}>
                    <div className="flex items-center justify-between text-xs mb-1 gap-2">
                      <span className="font-bold text-slate-700">
                        <TermTip term="queryDifficulty" icon={false}>{r.label}</TermTip>
                      </span>
                      <span className="tabular-nums text-slate-500 flex-shrink-0">
                        질문 {r.promptCount}개 · 응답 {r.responses}건 ·{' '}
                        <span className="font-black text-slate-800">SoV {r.sov}%</span>
                      </span>
                    </div>
                    <Bar pct={r.sov} className={DIFF_STYLE[r.difficulty] || 'bg-slate-400'} />
                    <p className="text-[11px] text-slate-400 leading-snug mt-1.5">{r.guide}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 13번 언어 ── */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle
            icon={Globe2}
            lecture="13번"
            title="언어별 성적표"
            desc="외국어는 경쟁자가 손을 안 대는 무주공산일 수 있습니다. 확인해야 압니다."
          />
          {lg.isLoading ? <Loading /> : !lg.data ? <Empty msg="언어 데이터가 없습니다." /> : (
            <>
              {lg.data.insight && (
                <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-150">
                  <p className="text-xs text-slate-700 font-semibold leading-relaxed">{lg.data.insight}</p>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400">
                      <th className="text-left py-2 px-2 font-bold">언어</th>
                      <th className="text-right py-2 px-2 font-bold">응답</th>
                      <th className="text-right py-2 px-2 font-bold whitespace-nowrap">언급률</th>
                      <th className="text-right py-2 px-2 font-bold whitespace-nowrap">
                        <TermTip term="firstPositionShare" icon={false}>1위 점유</TermTip>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lg.data.rows || []).map((r: any) => (
                      <tr key={r.language} className="border-b border-slate-50">
                        <td className="py-2 px-2 font-semibold text-slate-700">{r.label}</td>
                        <td className="text-right py-2 px-2 tabular-nums text-slate-500">{r.responses}</td>
                        <td className="text-right py-2 px-2 tabular-nums font-black text-slate-800">
                          {r.mentionRate}%
                        </td>
                        <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                          {r.firstPositionShare}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lg.data.foreignAdvantage != null && (
                <p className="text-[11px] text-slate-500 font-medium mt-3">
                  외국어 언급률 {lg.data.foreignMentionRate}% ÷ 한국어 {lg.data.koreanMentionRate}% ={' '}
                  <span className="font-black text-slate-800">{lg.data.foreignAdvantage}배</span>
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭: 엔티티 (20번 + AEO/GEO + 29번)
// ─────────────────────────────────────────────

function EntityTab({ hospitalId, days }: { hospitalId: string; days: number }) {
  const db = useQuery({
    queryKey: ['lm-director', hospitalId, days],
    queryFn: () => lectureMetricsApi.getDirectorBranding(hospitalId, days).then((r) => r.data),
    enabled: !!hospitalId,
  });
  const ag = useQuery({
    queryKey: ['lm-aeogeo', hospitalId, days],
    queryFn: () => lectureMetricsApi.getAeoGeoSplit(hospitalId, days).then((r) => r.data),
    enabled: !!hospitalId,
  });
  const na = useQuery({
    queryKey: ['lm-neg', hospitalId, days],
    queryFn: () => lectureMetricsApi.getNegativeAlerts(hospitalId, days).then((r) => r.data),
    enabled: !!hospitalId,
  });

  return (
    <div className="space-y-6">
      {/* ── 20번 원장 실명 ── */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle
            icon={UserRound}
            lecture="20번"
            title="원장 실명 브랜딩률"
            desc="AI는 병원은 말해도 사람은 말하지 않습니다. 실명이 엔티티가 되어야 사람이 브랜드가 됩니다."
          />
          {db.isLoading ? <Loading /> : !db.data ? <Empty msg="브랜딩 데이터가 없습니다." /> : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-150">
                  <p className="text-[11px] font-bold text-slate-500 mb-1">'원장' 직함 언급률</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums">
                    {db.data.titleRate}<span className="text-sm ml-0.5">%</span>
                  </p>
                  <VsBench value={db.data.titleRate} bench={db.data.benchmark?.titleRate ?? 25.8} />
                </div>
                <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-100">
                  <p className="text-[11px] font-bold text-brand-700 mb-1">
                    <TermTip term="directorBranding">실명 언급률</TermTip>
                  </p>
                  <p className="text-2xl font-black text-brand-900 tabular-nums">
                    {db.data.realNameRate}<span className="text-sm ml-0.5">%</span>
                  </p>
                  <VsBench value={db.data.realNameRate} bench={db.data.benchmark?.realNameRate ?? 0.7} />
                </div>
              </div>

              {db.data.brandingGap != null && (
                <div className="mb-4">
                  <p className="text-[11px] font-bold text-slate-500 mb-1.5">
                    직함 대비 실명 격차 {db.data.brandingGap}%p
                  </p>
                  <div className="relative h-6 rounded-lg bg-slate-100 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-slate-300"
                      style={{ width: `${Math.min(100, db.data.titleRate)}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-brand-500"
                      style={{ width: `${Math.min(100, db.data.realNameRate)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                      <span className="h-2 w-2 rounded bg-slate-300" /> 직함
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-600">
                      <span className="h-2 w-2 rounded bg-brand-500" /> 실명
                    </span>
                  </div>
                </div>
              )}

              {(db.data.nameHits || []).length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {db.data.nameHits.map((h: any) => (
                    <span key={h.name} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
                      {h.name} {h.count}회
                    </span>
                  ))}
                </div>
              )}

              {db.data.prescription && (
                <div className="p-3 rounded-xl bg-brand-50 border border-brand-100">
                  <p className="text-xs text-brand-900 font-semibold leading-relaxed">{db.data.prescription}</p>
                </div>
              )}

              {(db.data.byPlatform || []).length > 0 && (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400">
                        <th className="text-left py-2 px-2 font-bold">플랫폼</th>
                        <th className="text-right py-2 px-2 font-bold">언급 응답</th>
                        <th className="text-right py-2 px-2 font-bold whitespace-nowrap">직함</th>
                        <th className="text-right py-2 px-2 font-bold whitespace-nowrap">실명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {db.data.byPlatform.map((p: any) => (
                        <tr key={p.platform} className="border-b border-slate-50">
                          <td className="py-2 px-2 font-semibold text-slate-700">{p.platform}</td>
                          <td className="text-right py-2 px-2 tabular-nums text-slate-400">{p.responses}</td>
                          <td className="text-right py-2 px-2 tabular-nums text-slate-600">{p.titleRate}%</td>
                          <td className="text-right py-2 px-2 tabular-nums font-black text-slate-800">{p.realNameRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── AEO / GEO ── */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle
            icon={Layers}
            lecture="AEO/GEO"
            title="실시간 검색 vs 사전학습 진입"
            desc="검색을 거쳐 답한 것과 검색 없이 답한 것은 다른 싸움입니다. 후자가 진짜 자산입니다."
          />
          {ag.isLoading ? <Loading /> : !ag.data ? <Empty msg="검색모드 데이터가 없습니다." /> : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-150">
                  <p className="text-[11px] font-bold text-slate-500 mb-1">AEO — 실시간 검색</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums">
                    {ag.data.aeo?.mentionRate}<span className="text-sm ml-0.5">%</span>
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium tabular-nums">
                    응답 {ag.data.aeo?.responses}건 · 반영 2~4주
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100">
                  <p className="text-[11px] font-bold text-indigo-700 mb-1">GEO — 사전학습 진입</p>
                  <p className="text-2xl font-black text-indigo-900 tabular-nums">
                    {ag.data.geo?.mentionRate}<span className="text-sm ml-0.5">%</span>
                  </p>
                  <p className="text-[11px] text-indigo-500 font-medium tabular-nums">
                    응답 {ag.data.geo?.responses}건 · 모델이 우리를 앎
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-100">
                  <p className="text-[11px] font-bold text-brand-700 mb-1">
                    <TermTip term="geoPenetration">사전학습 침투율</TermTip>
                  </p>
                  <p className="text-2xl font-black text-brand-900 tabular-nums">
                    {ag.data.geoPenetration ?? '—'}
                  </p>
                  <p className="text-[11px] text-brand-500 font-medium">1에 가까울수록 자립</p>
                </div>
              </div>

              {ag.data.insight && (
                <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-150">
                  <p className="text-xs text-slate-700 font-semibold leading-relaxed">{ag.data.insight}</p>
                </div>
              )}

              {(ag.data.byPlatform || []).length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400">
                        <th className="text-left py-2 px-2 font-bold">플랫폼</th>
                        <th className="text-right py-2 px-2 font-bold whitespace-nowrap">AEO 언급률</th>
                        <th className="text-right py-2 px-2 font-bold whitespace-nowrap">GEO 언급률</th>
                        <th className="text-right py-2 px-2 font-bold whitespace-nowrap">침투율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ag.data.byPlatform.map((p: any) => {
                        const pen = p.aeoMentionRate > 0
                          ? Math.round((p.geoMentionRate / p.aeoMentionRate) * 100) / 100
                          : null;
                        return (
                          <tr key={p.platform} className="border-b border-slate-50">
                            <td className="py-2 px-2 font-semibold text-slate-700">{p.platform}</td>
                            <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                              {p.aeoMentionRate}% <span className="text-slate-300">({p.aeoResponses})</span>
                            </td>
                            <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                              {p.geoMentionRate}% <span className="text-slate-300">({p.geoResponses})</span>
                            </td>
                            <td className="text-right py-2 px-2 tabular-nums font-black text-slate-800">
                              {pen ?? '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 29번 부정 경보 ── */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle
            icon={BellRing}
            lecture="29번"
            title="부정 언급 조기경보"
            desc="비율은 0.1%로 작습니다. 그런데 그 답변을 본 환자는 100% 그 문장을 읽습니다."
          />
          {na.isLoading ? <Loading /> : !na.data ? <Empty msg="감성 데이터가 없습니다." /> : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { k: 'positive', label: '긍정', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', bench: na.data.benchmark?.positive },
                  { k: 'neutral', label: '중립', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-150', bench: na.data.benchmark?.neutral },
                  { k: 'negative', label: '부정', color: 'text-red-700', bg: 'bg-red-50 border-red-100', bench: na.data.benchmark?.negative },
                ].map((x) => {
                  const d = na.data.distribution?.[x.k];
                  return (
                    <div key={x.k} className={`p-3.5 rounded-xl border ${x.bg}`}>
                      <p className={`text-[11px] font-bold mb-1 ${x.color}`}>{x.label}</p>
                      <p className={`text-2xl font-black tabular-nums ${x.color}`}>
                        {d?.rate ?? 0}<span className="text-sm ml-0.5">%</span>
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium tabular-nums">
                        {d?.count ?? 0}건 · 실측 {x.bench}%
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-150">
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-slate-500">
                    <TermTip term="negativeAlert">감시 대상 건수</TermTip>
                  </p>
                  <p className="text-xl font-black text-slate-900 tabular-nums">
                    {na.data.alertCount ?? 0}건
                    {(na.data.criticalCount ?? 0) > 0 && (
                      <span className="text-xs font-bold text-red-600 ml-2">
                        (심각 {na.data.criticalCount}건)
                      </span>
                    )}
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-snug max-w-[55%]">
                  {na.data.insight}
                </p>
              </div>

              {(na.data.alerts || []).length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 font-semibold">부정 언급이 감지되지 않았습니다.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(na.data.alerts || []).slice(0, 12).map((a: any) => (
                    <div
                      key={a.responseId}
                      className={`p-3 rounded-xl border ${
                        a.severity === 'CRITICAL' ? 'bg-red-50 border-red-150'
                        : a.severity === 'WARNING' ? 'bg-amber-50 border-amber-150'
                        : 'bg-slate-50 border-slate-150'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          a.severity === 'CRITICAL' ? 'bg-red-600 text-white'
                          : a.severity === 'WARNING' ? 'bg-amber-500 text-white'
                          : 'bg-slate-400 text-white'
                        }`}>
                          {a.severity}
                        </span>
                        <span className="text-[11px] font-bold text-slate-600">{a.platform}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {String(a.responseDate || '').slice(0, 10)}
                        </span>
                        {a.recommendationDepth && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
                            {a.recommendationDepth}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 mb-1 leading-snug">{a.promptText}</p>
                      {(a.evidence || []).length > 0 && (
                        <ul className="space-y-1 mb-1.5">
                          {a.evidence.map((e: string, i: number) => (
                            <li key={i} className="text-[11px] text-slate-600 leading-relaxed pl-2 border-l-2 border-slate-300">
                              {e}
                            </li>
                          ))}
                        </ul>
                      )}
                      {(a.citedDomains || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {a.citedDomains.map((d: string) => (
                            <span key={d} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(na.data.topNegativeSources || []).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-black text-slate-500 mb-2">부정 언급 출처 역추적</h4>
                  <div className="flex flex-wrap gap-2">
                    {na.data.topNegativeSources.map((s: any) => (
                      <span key={s.domain} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 tabular-nums">
                        {s.domain} {s.count}회
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// 페이지
// ─────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: '개요', icon: Radar },
  { key: 'channel', label: '채널', icon: Boxes },
  { key: 'query', label: '질문', icon: MapPin },
  { key: 'entity', label: '엔티티', icon: UserRound },
] as const;

const DAY_OPTIONS = [7, 30, 90] as const;

export default function LectureMetricsPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('overview');
  const [days, setDays] = useState<number>(30);

  if (!hospitalId) {
    return (
      <>
        <Header title="강의록 실행 지표" description="강의록의 원칙을 숫자로 검증합니다" />
        <div className="p-4 sm:p-6">
          <Empty msg="병원 정보를 불러오는 중입니다." />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="강의록 실행 지표"
        description="강의록의 원칙이 우리 병원에서 실제로 작동하는지 숫자로 확인합니다"
      />

      <div className="p-4 sm:p-6 space-y-4">
        {/* 탭 + 기간 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <nav className="flex gap-1.5 overflow-x-auto pb-0.5" aria-label="지표 그룹">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </nav>

          <div className="flex gap-1.5 flex-shrink-0" role="group" aria-label="조회 기간">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  days === d
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {d}일
              </button>
            ))}
          </div>
        </div>

        {tab === 'overview' && <OverviewTab hospitalId={hospitalId} days={days} />}
        {tab === 'channel' && <ChannelTab hospitalId={hospitalId} days={days} />}
        {tab === 'query' && <QueryTab hospitalId={hospitalId} days={days} />}
        {tab === 'entity' && <EntityTab hospitalId={hospitalId} days={days} />}
      </div>
    </>
  );
}
