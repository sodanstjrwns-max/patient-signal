'use client';

/**
 * /pricing — 시그널 가격 페이지
 * 【2026.08.19 가격·구성 최종본】이 페이지의 숫자는 「전 제품 가격·구성 최종본」 문서가 기준.
 *  FREE / S 99,000 / M 290,000 ⭐ / L 490,000 / 별도 150만~ (월·VAT 별도)
 *  - 티어명은 S/M/L 통일 (내부 enum: STARTER/STANDARD/PRO/ENTERPRISE)
 *  - 연 결제 시 2개월 무료 (10개월치 일시납) — 다른 할인 방식 금지
 *  - 14일 무료 체험, 카드 등록 없음
 */

import Link from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  Check,
  X,
  Crown,
  ArrowRight,
  ShieldCheck,
  CalendarCheck,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import SiteFooter from '@/components/layout/SiteFooter';
import { useAuthStore } from '@/stores/auth';

const PLATFORMS_ALL = 'ChatGPT · Claude · Gemini · Perplexity · Grok · CLOVA X · 네이버 AI 브리핑';

interface TierSpec {
  id: string;
  tier: string;
  subName: string;
  priceText: string;
  priceNote: string;
  highlight?: boolean;
  cta: { label: string; href: string };
  specs: {
    platforms: string;
    prompts: string;
    crawl: string;
    competitors: string;
    liveQueries: string;
    reports: boolean;
    contentGap: boolean;
  };
}

const TIERS: TierSpec[] = [
  {
    id: 'FREE',
    tier: 'FREE',
    subName: '무료 체험판',
    priceText: '0원',
    priceNote: '카드 등록 없음',
    cta: { label: '무료로 시작', href: '/register' },
    specs: {
      platforms: 'AI 플랫폼 1개 (Perplexity)',
      prompts: '추적 질문 1개',
      crawl: '주 1회',
      competitors: '—',
      liveQueries: '1회/일',
      reports: false,
      contentGap: false,
    },
  },
  {
    id: 'STARTER',
    tier: 'S',
    subName: '소규모 · 1인 원장',
    priceText: '99,000원',
    priceNote: '월 · VAT 별도',
    cta: { label: '14일 무료 체험', href: '/register?plan=STARTER' },
    specs: {
      platforms: 'AI 플랫폼 4개 + 티저(Grok·CLOVA X 맛보기)',
      prompts: '추적 질문 5개',
      crawl: '주 2회',
      competitors: '경쟁사 3개',
      liveQueries: '5회/일',
      reports: false,
      contentGap: false,
    },
  },
  {
    id: 'STANDARD',
    tier: 'M',
    subName: '주력 플랜',
    priceText: '290,000원',
    priceNote: '월 · VAT 별도',
    highlight: true,
    cta: { label: '14일 무료 체험', href: '/register?plan=STANDARD' },
    specs: {
      platforms: 'AI 플랫폼 7개 전체',
      prompts: '추적 질문 15개',
      crawl: '매일',
      competitors: '경쟁사 10개',
      liveQueries: '10회/일',
      reports: true,
      contentGap: false,
    },
  },
  {
    id: 'PRO',
    tier: 'L',
    subName: '대형 · 다진료과',
    priceText: '490,000원',
    priceNote: '월 · VAT 별도',
    cta: { label: '14일 무료 체험', href: '/register?plan=PRO' },
    specs: {
      platforms: 'AI 플랫폼 7개 전체',
      prompts: '추적 질문 35개',
      crawl: '매일',
      competitors: '경쟁사 20개',
      liveQueries: '30회/일',
      reports: true,
      contentGap: true,
    },
  },
];

// 비교표 행 정의
const COMPARE_ROWS: { label: string; free: string; s: string; m: string; l: string; ent: string }[] = [
  { label: 'AI 플랫폼', free: '1개', s: '4개 + 티저', m: '7개 전체', l: '7개 전체', ent: '7개 전체' },
  { label: '추적 질문', free: '1개', s: '5개', m: '15개', l: '35개', ent: '무제한' },
  { label: '크롤 주기', free: '주 1회', s: '주 2회', m: '매일', l: '매일', ent: '무제한' },
  { label: '경쟁사 추적', free: '✕', s: '3개', m: '10개', l: '20개', ent: '무제한' },
  { label: '라이브 쿼리', free: '1회/일', s: '5회/일', m: '10회/일', l: '30회/일', ent: '무제한' },
  { label: '리포트 내보내기 · AI 개선 추천 · 경쟁사 AEO 분석', free: '✕', s: '✕', m: '✅', l: '✅', ent: '✅' },
  { label: '콘텐츠 갭 분석', free: '✕', s: '✕', m: '✕', l: '✅', ent: '✅' },
];

export default function PricingPage() {
  // 로그인 상태면 "무료로 시작" 계열 CTA를 "대시보드로 이동"으로 분기
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const loggedIn = _hasHydrated && isAuthenticated;

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#17212e]">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-[#e7ecf2] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-[72px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-semibold">Patient Signal</span>
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            <span className="text-sm font-semibold text-slate-900">요금제</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
        {/* Hero */}
        <section id="pricing-hero" className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#285cf4] mb-4">Plans & pricing</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.055em] text-[#17212e] mb-5">
            우리 병원에 맞는<br className="hidden sm:block" />
            <span className="text-[#285cf4]"> 질문 추적 플랜</span>을 선택하세요
          </h1>
          <p className="text-base text-[#69788b] max-w-2xl mx-auto mb-7 leading-7">
            핵심 질문과 경쟁 병원을 함께 추적하세요. 필요한 질문 수와 측정 주기에 따라 선택할 수 있습니다.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-[#526175]">
            <span className="flex items-center gap-1.5 rounded-full border border-[#e7ecf2] bg-white px-3 py-1.5">
              <CalendarCheck className="h-3.5 w-3.5 text-[#285cf4]" /> 14일 무료 체험 · 카드 등록 없음
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-[#e7ecf2] bg-white px-3 py-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-[#285cf4]" /> 연 결제 시 2개월 무료
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-[#e7ecf2] bg-white px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#285cf4]" /> 결제 후 7일 이내 미사용 시 전액 환불
            </span>
          </div>
        </section>

        {/* Tier Cards */}
        <section id="pricing-tiers" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          {TIERS.map((t) => (
            <article
              key={t.id}
              className={`relative rounded-[18px] border bg-white p-6 flex flex-col transition-shadow hover:shadow-[0_12px_28px_rgba(18,33,54,0.06)] ${
                t.highlight
                  ? 'border-[#285cf4] shadow-[0_8px_28px_rgba(40,92,244,0.10)]'
                  : 'border-[#e7ecf2] shadow-[0_1px_2px_rgba(18,33,54,0.025)]'
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-6 bg-[#285cf4] text-white text-[11px] font-bold px-3 py-1 rounded-full">
                  가장 많이 선택하는 플랜
                </span>
              )}
              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl font-bold tracking-[-0.04em] text-[#17212e]">{t.tier}</h2>
                  <span className="text-xs text-[#8390a0]">{t.subName}</span>
                </div>
                <div className="mt-5">
                  <span className="text-3xl font-bold tracking-[-0.05em] text-[#17212e]">{t.priceText}</span>
                </div>
                <p className="text-xs text-[#8390a0] mt-1">{t.priceNote}</p>
              </div>

              <ul className="space-y-3 border-t border-[#eef1f5] pt-5 text-[13px] leading-5 text-[#526175] flex-1">
                <li className="flex gap-2"><Check className="h-4 w-4 text-[#285cf4] shrink-0 mt-0.5" />{t.specs.platforms}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-[#285cf4] shrink-0 mt-0.5" />{t.specs.prompts}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-[#285cf4] shrink-0 mt-0.5" />크롤 주기: {t.specs.crawl}</li>
                <li className="flex gap-2">
                  {t.specs.competitors === '—'
                    ? <X className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                    : <Check className="h-4 w-4 text-[#285cf4] shrink-0 mt-0.5" />}
                  경쟁사 추적 {t.specs.competitors === '—' ? '없음' : t.specs.competitors}
                </li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-[#285cf4] shrink-0 mt-0.5" />라이브 쿼리 {t.specs.liveQueries}</li>
                <li className="flex gap-2">
                  {t.specs.reports
                    ? <Check className="h-4 w-4 text-[#285cf4] shrink-0 mt-0.5" />
                    : <X className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />}
                  리포트 내보내기 · AI 개선 추천
                </li>
                <li className="flex gap-2">
                  {t.specs.contentGap
                    ? <Check className="h-4 w-4 text-[#285cf4] shrink-0 mt-0.5" />
                    : <X className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />}
                  콘텐츠 갭 분석
                </li>
              </ul>

              <Link href={loggedIn ? '/dashboard' : t.cta.href} className="mt-7">
                <Button
                  className={`w-full font-semibold ${
                    t.highlight
                      ? 'bg-[#285cf4] hover:bg-[#204bce] text-white'
                      : ''
                  }`}
                  variant={t.highlight ? 'default' : 'outline'}
                >
                  {loggedIn ? '대시보드로 이동' : t.cta.label}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </article>
          ))}
        </section>

        {/* Enterprise band */}
        <section id="pricing-enterprise" className="mb-16">
          <div className="rounded-[18px] border border-[#dfe6ef] bg-[#17212e] p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-[11px] bg-white/10 flex items-center justify-center shrink-0">
                <Crown className="h-5 w-5 text-[#a9bcff]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">별도 플랜 — 80명 초과 · 다지점 · 네트워크 병원</h2>
                <p className="text-sm text-[#abb8c9] mt-1">
                  질문·경쟁사·크롤 전부 무제한 + 7개 플랫폼 전체 + 전담 지원. <strong>월 150만원부터, 견적 상담.</strong>
                </p>
              </div>
            </div>
            <a href="mailto:contact@patientsignal.kr">
              <Button variant="outline" className="border-white/20 bg-white font-bold whitespace-nowrap">
                견적 문의
              </Button>
            </a>
          </div>
        </section>

        {/* Compare table */}
        <section id="pricing-compare" className="mb-14">
          <h2 className="text-2xl font-bold tracking-[-0.04em] text-[#17212e] mb-6 text-center">플랜 전체 비교</h2>
          <div className="overflow-x-auto rounded-[18px] border border-[#e7ecf2] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e7ecf2] bg-[#fbfcfe] text-[#526175]">
                  <th className="text-left px-4 py-3 font-semibold min-w-[180px]">기능</th>
                  <th className="px-4 py-3 font-semibold">FREE</th>
                  <th className="px-4 py-3 font-semibold">S<div className="text-xs font-normal text-slate-500">9.9만/월</div></th>
                  <th className="px-4 py-3 font-bold text-brand-700 bg-brand-50">M<div className="text-xs font-normal text-brand-600">29만/월</div></th>
                  <th className="px-4 py-3 font-semibold">L<div className="text-xs font-normal text-slate-500">49만/월</div></th>
                  <th className="px-4 py-3 font-semibold">별도<div className="text-xs font-normal text-slate-500">150만~</div></th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-[#eef1f5] last:border-0">
                    <td className="px-4 py-3 text-slate-700">{row.label}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.free}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.s}</td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-900 bg-brand-50/50">{row.m}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.l}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.ent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#8390a0] mt-3 text-center">
            플랫폼 7개: {PLATFORMS_ALL}. 플랜별 제공 범위를 위 표에서 확인할 수 있습니다.
          </p>
        </section>

        {/* FAQ */}
        <section id="pricing-faq" className="mb-14 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold tracking-[-0.04em] text-[#17212e] mb-6 text-center">자주 묻는 질문</h2>
          <div className="space-y-4">
            <div className="rounded-[14px] border border-[#e7ecf2] bg-white p-5">
              <h3 className="font-semibold text-slate-900 mb-1.5">Q. 연 결제 할인이 있나요?</h3>
              <p className="text-sm text-slate-600">연 결제 시 <strong>2개월 무료</strong>입니다 (10개월치 일시납으로 12개월 이용).</p>
            </div>
            <div className="rounded-[14px] border border-[#e7ecf2] bg-white p-5">
              <h3 className="font-semibold text-slate-900 mb-1.5">Q. 무료 체험은 어떻게 하나요?</h3>
              <p className="text-sm text-slate-600">가입 즉시 <strong>14일 무료 체험</strong>이 시작됩니다. 카드 등록 없이 시작하고, 체험 종료 후 자동 결제도 없습니다.</p>
            </div>
            <div className="rounded-[14px] border border-[#e7ecf2] bg-white p-5">
              <h3 className="font-semibold text-slate-900 mb-1.5">Q. 환불 규정은요?</h3>
              <p className="text-sm text-slate-600">결제 후 <strong>7일 이내 미사용 시 전액 환불</strong>, 이후에는 일할 계산으로 환불됩니다.</p>
            </div>
            <div className="rounded-[14px] border border-[#e7ecf2] bg-white p-5">
              <h3 className="font-semibold text-slate-900 mb-1.5">Q. S 플랜과 M 플랜의 가장 큰 차이는요?</h3>
              <p className="text-sm text-slate-600">
                두 가지입니다. ① <strong>크롤 주기</strong> — S는 주 2회, M부터 매일 추적합니다. AI 답변은 매일 바뀌기 때문에 순위 변동을 놓치지 않으려면 매일 크롤이 필요합니다.
                ② <strong>한국 AI 2종</strong> — CLOVA X와 네이버 AI 브리핑 전체 추적은 M부터입니다 (S는 맛보기 1개 질문만).
              </p>
            </div>
            <div className="rounded-[14px] border border-[#e7ecf2] bg-white p-5">
              <h3 className="font-semibold text-slate-900 mb-1.5">Q. 우리 병원 규모면 어떤 플랜인가요?</h3>
              <p className="text-sm text-slate-600">
                직원 1~15명 규모의 1인 원장 병원은 <strong>S</strong>, 16~30명 규모는 <strong>M</strong>, 31~80명 대형·다진료과는 <strong>L</strong>을 권장합니다.
                80명 초과·다지점은 별도 견적으로 상담해 드립니다.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section id="pricing-cta" className="text-center pb-10">
          <div className="rounded-[20px] bg-[#17212e] p-9 sm:p-11 text-white">
            <h2 className="text-2xl font-bold mb-3">광고비를 태우기 전에, AI가 우리를 어떻게 보는지부터.</h2>
            <p className="text-[#abb8c9] mb-6">14일 무료 체험 — 카드 등록 없이 지금 바로 시작하세요.</p>
            <Link href={loggedIn ? '/dashboard' : '/register'}>
              <Button size="lg" className="bg-white text-[#17212e] hover:bg-[#edf2ff] font-bold px-10">
                {loggedIn ? '대시보드로 이동' : '무료로 시작하기'}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
