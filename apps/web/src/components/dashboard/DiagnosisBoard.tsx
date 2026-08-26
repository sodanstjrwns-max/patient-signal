'use client';

/**
 * DiagnosisBoard — 대시보드 최상단 "진단 → 원인 → 처방" 블록
 *
 * 기존 대시보드는 숫자를 나열만 했다. 원장이 SoV 4.9%를 보고
 * "그래서 뭘 해야 하지?"에 답을 못 얻는다.
 *
 * 이 컴포넌트는 수집된 지표를 규칙 기반으로 읽어서
 *   1) 지금 상태 한 줄 요약
 *   2) 그 숫자가 나온 원인 (근거 숫자 포함)
 *   3) 이번 주에 할 일 1가지
 * 를 만들어 낸다. 근거가 없으면 만들지 않는다 — 추측을 처방처럼 보이게 하지 않는다.
 */

import Link from 'next/link';
import {
  Stethoscope, ArrowRight, AlertTriangle, TrendingUp,
  ShieldAlert, Search, Sparkles,
} from 'lucide-react';
import { TermTip } from '@/components/ui/term-tooltip';

export interface DiagnosisInput {
  sovPercent: number | null;
  mentionedCount: number | null;
  totalResponses: number | null;
  depthDistribution: Record<string, number> | null;
  intentScores: Record<string, number> | null;
  platforms: Array<{
    key: string;
    name: string;
    mentionRate: number;
    mentionedCount: number;
    totalQueries: number;
    /** 백엔드 판정: ACTIVE(수집 중) / STALLED(3일+ 응답 없음) / NEVER(한 번도 수집 안 됨) */
    collectionStatus?: 'ACTIVE' | 'STALLED' | 'NEVER' | null;
    staleDays?: number | null;
    /** 백엔드 판정: 0건의 원인. 웹을 안 보는 채널인가, 출처에 우리가 없는 것인가 */
    zeroReason?: 'NO_WEB_SEARCH' | 'SOURCE_GAP' | null;
    /** 이 채널이 원당 불러오는 경쟁 변원 수 */
    competitorsPerResponse?: number | null;
  }>;
  negativeRate: number | null;
  topCompetitor: { name: string; count: number } | null;
}

type Severity = 'critical' | 'warn' | 'good';

export interface Finding {
  id: string;
  severity: Severity;
  /** 한 줄 진단 */
  headline: string;
  /** 왜 이렇게 나왔는지 — 반드시 실제 숫자를 포함 */
  cause: string;
  /** 이번 주 할 일 */
  action: string;
  href: string;
  cta: string;
  /** 툴팁 걸 용어 키 (선택) */
  term?: string;
}

const SEV: Record<Severity, { icon: any; ring: string; chipBg: string; chipText: string; label: string }> = {
  critical: { icon: ShieldAlert,    ring: 'border-red-200/80 bg-red-50/50',       chipBg: 'bg-red-100',     chipText: 'text-red-700',     label: '먼저 해결' },
  warn:     { icon: AlertTriangle,  ring: 'border-amber-200/80 bg-amber-50/40',   chipBg: 'bg-amber-100',   chipText: 'text-amber-700',   label: '개선 기회' },
  good:     { icon: TrendingUp,     ring: 'border-emerald-200/80 bg-emerald-50/40', chipBg: 'bg-emerald-100', chipText: 'text-emerald-700', label: '잘 되는 중' },
};

/**
 * 지표 → 소견 변환. 규칙은 전부 "근거 숫자가 있을 때만" 발동한다.
 */
export function buildFindings(d: DiagnosisInput): Finding[] {
  const out: Finding[] = [];
  const n = (v: number | null | undefined) => (typeof v === 'number' && !Number.isNaN(v) ? v : null);

  const sov = n(d.sovPercent);
  const total = n(d.totalResponses);
  const mentioned = n(d.mentionedCount);

  // ── 1. 노출 자체가 되는가 (읽히지 않으면 순위는 존재하지 않는다) ──
  if (sov !== null && total !== null && total > 0) {
    if (sov < 5) {
      out.push({
        id: 'sov-low',
        severity: 'critical',
        headline: `AI가 우리 병원을 거의 모릅니다 (${sov}%)`,
        cause: `${total.toLocaleString()}번의 환자 질문 중 우리 이름이 나온 건 ${(mentioned ?? 0).toLocaleString()}번뿐입니다. AI는 우리를 "선택지에 넣을 근거"를 아직 충분히 찾지 못했습니다.`,
        action: '경쟁사는 나오는데 우리는 안 나오는 질문부터 확인하세요. 그 빈칸이 가장 싸게 이기는 자리입니다.',
        href: '/dashboard/opportunities',
        cta: '비어 있는 질문 보기',
        term: 'sov',
      });
    } else if (sov < 20) {
      out.push({
        id: 'sov-mid',
        severity: 'warn',
        headline: `노출은 시작됐지만 아직 소수입니다 (${sov}%)`,
        cause: `${total.toLocaleString()}번 중 ${(mentioned ?? 0).toLocaleString()}번 언급. 5번에 1번도 못 미칩니다.`,
        action: '이미 언급되는 주제를 더 깊게 파는 편이, 새 주제를 여는 것보다 빠릅니다.',
        href: '/dashboard/citation-analysis',
        cta: '노출 중인 주제 강화',
        term: 'sov',
      });
    } else {
      out.push({
        id: 'sov-good',
        severity: 'good',
        headline: `AI 추천 후보에 안정적으로 올라 있습니다 (${sov}%)`,
        cause: `${total.toLocaleString()}번 중 ${(mentioned ?? 0).toLocaleString()}번 언급됐습니다.`,
        action: '이제는 "나오느냐"가 아니라 "몇 번째로, 어떤 말과 함께 나오느냐"가 매출을 가릅니다.',
        href: '/dashboard/analytics',
        cta: '추천 위치 분석',
        term: 'sov',
      });
    }
  }

  // ── 2. 언급의 질 — 이름만 스치는가, 1순위로 꼽히는가 ──
  const dd = d.depthDistribution;
  if (dd) {
    const r1 = dd.R1 ?? 0, r2 = dd.R2 ?? 0, r3 = dd.R3 ?? 0;
    const deep = r2 + r3;
    const any = r1 + deep;
    if (any > 0) {
      const deepRate = Math.round((deep / any) * 100);
      if (deepRate < 40) {
        out.push({
          id: 'depth-shallow',
          severity: 'warn',
          headline: `언급은 되는데 "그냥 이름만" 나옵니다`,
          cause: `언급 ${any}건 중 상위 추천(R2·R3)은 ${deep}건(${deepRate}%)뿐입니다. 나머지 ${r1}건은 여러 병원 목록 안에 섞여 스쳐 지나갑니다.`,
          action: '환자가 비교하는 기준(수술실·전문의·장비·사후관리)을 우리 페이지에서 먼저 명시하세요. AI는 근거가 있는 곳을 1순위로 올립니다.',
          href: '/dashboard/citation-analysis',
          cta: '인용 근거 역분석하기',
          term: 'recommendationDepth',
        });
      } else {
        out.push({
          id: 'depth-good',
          severity: 'good',
          headline: '언급될 때 상위로 추천됩니다',
          cause: `언급 ${any}건 중 ${deep}건(${deepRate}%)이 1~2순위 추천입니다.`,
          action: '지금 통하는 근거를 다른 진료과목 페이지에도 복제하세요.',
          href: '/dashboard/analytics',
          cta: '통하는 패턴 확인',
          term: 'recommendationDepth',
        });
      }
    }
  }

  // ── 2.5 수집 중단 — 모든 소견에 앞선다 (지표가 틀렸을 수 있다는 뜻이므로)
  //   배경: 2026-07-14 xAI 크레딧이 느낌없이 소진돼 Grok 수집이 12일간 멈췄는데
  //   화면엔 그저 "0%"로 보여 아무도 몰랐다. 숫자보다 "이 숫자를 믿지 말라"가 먼저다.
  //   【2026.08.26 문구 사고 수정】기존 문구가 "API 연동에서 상태를 확인하세요"라며
  //   /dashboard/api-keys(외부 연동용 키 '발급' 페이지)로 보냈음 → 원장이 자기가 뭘
  //   고쳐야 하는 줄 알고 혼란 (실사례: "API를 점검하라는데 먼말인지 몰라서요^^;;").
  //   수집은 전적으로 시그널 운영 몫 — 사용자에게 할 일을 시키지 않는다.
  const stalled = d.platforms.filter(p => p.collectionStatus === 'STALLED');
  if (stalled.length > 0) {
    const worst = Math.max(...stalled.map(p => p.staleDays ?? 0));
    out.push({
      id: 'collection-stalled',
      severity: 'critical',
      headline: `${stalled.map(p => p.name).join(' · ')} 수집이 잠시 멈춰 있습니다`,
      cause: `${stalled.map(p => `${p.name} ${p.staleDays ?? 0}일째 새 응답 없음`).join(', ')}. ` +
        `이 채널의 숫자는 최대 ${worst}일 전 기록입니다. ` +
        `병원에서 노출이 줄어든 것이 아니라, 저희 쪽 수집이 지연된 것입니다.`,
      action: '원장님이 하실 일은 없습니다. 시그널 운영팀이 자동 감지해 복구합니다. 복구 전까지 이 채널 수치는 참고만 해주세요 — 다른 채널 수치는 정상입니다.',
      href: '/dashboard/responses',
      cta: '마지막 수집 응답 보기',
    });
  }

  // ── 3. 채널 구멍 — 한 군데도 안 나오는 플랫폼 (수집이 살아있는 채널만 판단) ──
  //   같은 "0%"라도 원인이 둘로 갈린다. 처방이 정반대이므로 반드시 나눠서 말한다.
  const alive = d.platforms.filter(
    p => p.totalQueries >= 30 && p.mentionedCount === 0 && p.collectionStatus !== 'STALLED',
  );

  // 3-a. 웹을 아예 안 보는 채널 — 콘텐츠를 늘려도 안 나온다 (헛돈 쓰는 것 방지)
  const noWeb = alive.filter(p => p.zeroReason === 'NO_WEB_SEARCH');
  if (noWeb.length > 0) {
    out.push({
      id: 'platform-no-web',
      severity: 'warn',
      headline: `${noWeb.map(p => p.name).join(' · ')}은 웹을 보지 않는 채널입니다`,
      cause: `${noWeb.map(p => `${p.name} ${p.totalQueries}번 질문 전부 웹상 검상 없이 답변`).join(', ')}. ` +
        `이 채널은 학습된 지식으로만 답하고, 경쟁 변원 이름도 거의 안 가를킵니다. ` +
        `우리가 뭐를 하든 단기에는 반식되지 않습니다.`,
      action: '이 채널에 상당을 쓰지 마세요. 웹을 보는 채널(ChatGPT·Perplexity·Grok)에 자원을 몰아주십시오.',
      href: '/dashboard/insights?tab=sources',
      cta: '웹 기반 채널 집중 확인',
    });
  }

  // 3-b. 웹은 보는데 경쟁사만 뽑는 채널 — 여기가 진짜 싸울 곳
  const dead = alive.filter(p => p.zeroReason !== 'NO_WEB_SEARCH');
  if (dead.length > 0) {
    const withComp = dead.filter(p => (p.competitorsPerResponse ?? 0) >= 1);
    out.push({
      id: 'platform-dead',
      severity: 'critical',
      headline: `${dead.map(p => p.name).join(' · ')}에서는 한 번도 안 나옵니다`,
      cause: `${dead.map(p => `${p.name} ${p.totalQueries}번 질문 중 0번`).join(', ')}. ` +
        (withComp.length > 0
          ? `그런데 이 채널은 한 번 답할 때마다 경쟁 변원을 ` +
            `${withComp.map(p => `${p.name} ${p.competitorsPerResponse}개`).join(', ')}썯 생색합니다. ` +
            `모릅다는 것이 아니라, 이 채널이 읽는 출처에 우리만 없는 것입니다.`
          : `이 채널이 참고하는 출처에 우리가 없다는 뜻입니다.`),
      action: '경쟁 변원이 인용되는 바로 그 출처를 먼저 확인하고, 거기에 우리 근거 문서를 심으십시오.',
      href: '/dashboard/insights?tab=sources',
      cta: '인용 출처 점검',
      term: 'citedSources',
    });
  }

  // ── 4. 불안 질문(FEAR) 공백 — 경쟁 병원이 가장 자주 비워두는 구간 ──
  const intents = d.intentScores;
  if (intents && Object.keys(intents).length > 0) {
    const fear = intents.FEAR ?? intents.fear ?? 0;
    const reservation = intents.RESERVATION ?? intents.reservation ?? 0;
    if (fear === 0 && reservation > 0) {
      out.push({
        id: 'fear-gap',
        severity: 'warn',
        headline: '"아프지 않나요" 같은 불안 질문에서 우리가 없습니다',
        cause: `예약 의도 질문에서는 ${reservation}점을 받는데, 불안 기반 질문에서는 0점입니다. 환자는 결정 직전에 반드시 이 질문을 합니다.`,
        action: '통증·부작용·실패 사례를 숨기지 말고 정면으로 다루는 페이지를 만드세요. 먼저 안심시킨 병원이 선택됩니다.',
        href: '/dashboard/content-calendar',
        cta: '불안 해소 콘텐츠 기획',
        term: 'intentFear',
      });
    }
  }

  // ── 5. 부정 언급 ──
  const neg = n(d.negativeRate);
  if (neg !== null && neg >= 10) {
    out.push({
      id: 'negative',
      severity: 'critical',
      headline: `AI 답변 중 ${neg}%가 부정적 맥락입니다`,
      cause: '부정 언급은 노출을 늘려도 상쇄되지 않습니다. 노출이 커질수록 같이 커집니다.',
      action: '어떤 문장에서 부정이 나오는지 원문을 먼저 확인하세요.',
      href: '/dashboard/responses',
      cta: '원문 확인',
      term: 'negativeAlert',
    });
  }

  // ── 6. 경쟁 기준선 ──
  if (d.topCompetitor && sov !== null && total !== null && total > 0) {
    const myCount = mentioned ?? 0;
    if (d.topCompetitor.count > myCount) {
      out.push({
        id: 'competitor',
        severity: 'warn',
        headline: `같은 질문에서 ${d.topCompetitor.name}이 더 자주 나옵니다`,
        cause: `우리 ${myCount}회 vs ${d.topCompetitor.name} ${d.topCompetitor.count}회. 같은 환자, 같은 질문인데 결과가 다릅니다.`,
        action: '그 병원이 인용되는 출처를 확인하고, 우리에게 없는 채널을 하나만 고르세요.',
        href: '/dashboard/competitors',
        cta: '경쟁 병원 비교',
        term: 'competitorShare',
      });
    }
  }

  const order: Record<Severity, number> = { critical: 0, warn: 1, good: 2 };
  // 수집 중단은 "지표 자체를 믿지 말라"는 경고이므로 무조건 최상단
  return out.sort((a, b) => {
    if (a.id === 'collection-stalled') return -1;
    if (b.id === 'collection-stalled') return 1;
    return order[a.severity] - order[b.severity];
  });
}

export function DiagnosisBoard({ findings, loading }: { findings: Finding[]; loading?: boolean }) {
  if (loading) {
    return (
      <section id="diagnosis-board" className="glass-bento p-6">
        <div className="h-5 w-40 rounded-lg bg-slate-200/70 animate-pulse mb-5" />
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100/70 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (findings.length === 0) {
    return (
      <section id="diagnosis-board" className="glass-bento p-6">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">오늘의 진단</h2>
            <p className="text-[11px] text-slate-400 font-semibold">아직 판단할 근거가 부족합니다</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          분석 데이터가 쌓이면 이 자리에 <span className="font-bold text-slate-700">무엇이 문제인지, 왜 그런지, 이번 주에 뭘 할지</span>가 표시됩니다.
          추측으로 채우지 않습니다.
        </p>
        <Link href="/dashboard/prompts" className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-brand-600 hover:gap-2.5 transition-all">
          분석할 질문 설정하기 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    );
  }

  const critical = findings.filter(f => f.severity === 'critical').length;

  return (
    <section id="diagnosis-board" className="glass-bento p-6">
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">오늘의 진단</h2>
            <p className="text-[11px] text-slate-400 font-semibold">
              숫자가 왜 이런지, 그래서 뭘 할지
            </p>
          </div>
        </div>
        {critical > 0 && (
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-black">
            먼저 해결 {critical}건
          </span>
        )}
      </header>

      <ol className="space-y-3">
        {findings.map((f) => {
          const s = SEV[f.severity];
          const Icon = s.icon;
          return (
            <li key={f.id} className={`rounded-2xl border p-4 ${s.ring}`}>
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${s.chipText}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${s.chipBg} ${s.chipText}`}>
                      {s.label}
                    </span>
                    <h3 className="text-sm font-black text-slate-900">{f.headline}</h3>
                  </div>

                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    <span className="font-bold text-slate-500">왜 </span>
                    {f.cause}
                    {f.term && (
                      <>
                        {' '}
                        <TermTip term={f.term} className="text-[11px] text-slate-400 font-semibold" />
                      </>
                    )}
                  </p>

                  <p className="text-[13px] text-slate-800 leading-relaxed mt-2">
                    <span className="font-bold text-brand-600">할 일 </span>
                    {f.action}
                  </p>

                  <Link
                    href={f.href}
                    className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-brand-600 hover:gap-2.5 transition-all"
                  >
                    {f.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mt-4 pt-4 border-t border-slate-100">
        <Sparkles className="h-3 w-3" />
        실제 수집된 응답에서만 판단합니다. 근거가 없으면 소견을 만들지 않습니다.
      </p>
    </section>
  );
}
