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
import { ArrowRight, ArrowUpRight, Check, Plus } from 'lucide-react';
import SiteFooter from '@/components/layout/SiteFooter';
import { PublicHeader } from '@/components/public/PublicBrand';
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
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const loggedIn = _hasHydrated && isAuthenticated;
  const faqs = [
    ['연 결제는 어떻게 되나요?', '10개월치 금액을 한 번에 결제하면 12개월 동안 이용할 수 있습니다. 연 결제 시 2개월 무료 혜택이 적용됩니다.'],
    ['무료 체험에 카드가 필요한가요?', '가입 즉시 14일 무료 체험을 시작할 수 있습니다. 카드 등록 없이 시작하며, 카드를 등록하지 않으면 체험 종료 후 자동 결제되지 않습니다.'],
    ['환불 규정이 궁금합니다.', '결제 후 7일 이내 미사용 시 전액 환불됩니다. 이후에는 일할 계산으로 환불되며, 자세한 기준은 환불규정에서 확인할 수 있습니다.'],
    ['S와 M은 무엇이 다른가요?', 'S는 질문 5개를 주 2회 추적하고 경쟁 병원 3개를 비교합니다. M은 질문 15개를 매일 추적하며, 전체 7개 플랫폼과 경쟁 병원 10개 비교, 리포트 기능을 제공합니다.'],
  ];
  return (
    <div className="min-h-screen bg-[#f1f1eb] text-[#141512]">
      <PublicHeader active="pricing" loggedIn={loggedIn} />
      <main className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-14">
        <section id="pricing-hero" className="grid gap-8 pb-12 pt-14 lg:grid-cols-[1.3fr_0.7fr] lg:items-end lg:pb-16 lg:pt-20">
          <div><p className="mb-6 text-[11px] font-semibold tracking-[0.18em] text-[#72756a]">PLANS / FIND YOUR FREQUENCY</p><h1 className="text-5xl font-semibold leading-[1.13] tracking-[-0.07em] sm:text-6xl lg:text-7xl">질문의 범위만큼,<br />더 선명한 시그널.</h1></div>
          <div className="max-w-sm lg:justify-self-end"><p className="text-sm leading-7 text-[#687253]">우리 병원에 필요한 질문 수와 측정 주기를 선택하세요. 모든 유료 플랜은 14일간 무료로 시작할 수 있습니다.</p><div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium"><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#44551d]" />카드 등록 없음</span><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#44551d]" />연 결제 2개월 무료</span></div></div>
        </section>
        <section id="pricing-tiers" className="grid border-y border-[#141512] md:grid-cols-2 xl:grid-cols-4">
          {TIERS.map(t => <article key={t.id} className={`flex flex-col border-b border-[#d4d6cb] p-6 md:border-r md:p-7 xl:border-b-0 last:border-r-0 ${t.highlight ? 'bg-[#ff5d2a]' : ''}`}>
            <div className="flex min-h-[24px] items-center justify-between text-[10px] font-medium tracking-[0.1em]"><span>{t.subName}</span>{t.highlight && <span className="bg-[#141512] px-2 py-1 text-white">매일 확인하는 병원에</span>}</div>
            <h2 className={`mb-7 mt-6 flex h-[96px] items-end font-medium leading-none tracking-[-0.08em] ${t.tier === 'FREE' ? 'text-[62px]' : 'text-[96px]'}`}>{t.tier}<span className="ml-2 inline-block h-2 w-2 bg-[#d0ff43]" /></h2>
            <div className="flex items-baseline gap-1"><span className="text-3xl font-semibold tracking-[-0.06em]">{t.priceText}</span></div><p className="mt-2 text-[11px] text-[#687253]">{t.priceNote}</p>
            <Link href={loggedIn ? '/dashboard' : t.cta.href} className={`my-7 flex items-center justify-between gap-3 px-4 py-3.5 text-xs font-semibold ${t.highlight ? 'bg-[#141512] text-white hover:bg-[#d0ff43]' : 'border border-[#141512] hover:bg-white'}`}>{loggedIn ? '대시보드로 이동' : t.cta.label}<ArrowUpRight className="h-4 w-4" /></Link>
            <div className="mb-5 grid grid-cols-2 gap-4 border-y border-[#141512]/15 py-4"><div><p className="text-[10px] text-[#687253]">추적 질문</p><p className="mt-1 text-xl font-medium">{t.specs.prompts.replace('추적 질문 ', '')}</p></div><div><p className="text-[10px] text-[#687253]">경쟁 병원</p><p className="mt-1 text-xl font-medium">{t.specs.competitors === '—' ? '미제공' : t.specs.competitors.replace('경쟁사 ', '')}</p></div></div>
            <ul className="space-y-3 text-xs leading-5 text-[#525849]">{[t.specs.platforms, `${t.specs.crawl} 정기 측정`, `라이브 쿼리 ${t.specs.liveQueries}`, ...(t.specs.reports ? ['리포트 내보내기 · AI 개선 추천'] : []), ...(t.specs.contentGap ? ['콘텐츠 갭 분석'] : [])].map(feature => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#44551d]" />{feature}</li>)}</ul>
          </article>)}
        </section>
        <section id="pricing-enterprise" className="flex flex-col justify-between gap-6 border-b border-[#d4d6cb] py-8 sm:flex-row sm:items-center"><div className="flex gap-5"><Plus className="mt-1 hidden h-7 w-7 shrink-0 sm:block" /><div><h2 className="text-xl font-semibold tracking-[-0.04em]">다지점·네트워크 병원을 위한 별도 플랜</h2><p className="mt-2 text-sm leading-6 text-[#687253]">질문·경쟁 병원·측정 무제한, 전체 플랫폼과 전담 지원. 월 150만원부터.</p></div></div><a href="mailto:contact@patientsignal.kr" className="inline-flex shrink-0 items-center gap-8 border-b border-[#141512] pb-2 text-sm font-semibold">견적 문의<ArrowUpRight className="h-4 w-4" /></a></section>
        <section id="pricing-compare" className="py-16 lg:py-24"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><h2 className="text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">모든 기능을 한눈에.</h2><p className="text-[11px] text-[#72756a]">월 이용료 · VAT 별도</p></div><div className="overflow-x-auto border-t border-[#141512]"><table className="w-full min-w-[740px] text-sm"><thead><tr className="border-b border-[#d4d6cb] text-left"><th className="py-5 pr-5 font-medium text-[#72756a]">기능</th>{['FREE', 'S', 'M', 'L', '별도'].map(plan => <th key={plan} className={`px-5 py-5 text-center text-lg font-medium ${plan === 'M' ? 'bg-[#ff5d2a]/35' : ''}`}>{plan}</th>)}</tr></thead><tbody>{COMPARE_ROWS.map(row => <tr key={row.label} className="border-b border-[#d4d6cb]"><td className="py-5 pr-5 text-[13px]">{row.label}</td>{[row.free, row.s, row.m, row.l, row.ent].map((value, i) => <td key={i} className={`px-5 py-5 text-center text-xs ${i === 2 ? 'bg-[#ff5d2a]/20 font-semibold' : 'text-[#687253]'}`}>{value === '✅' ? <Check className="mx-auto h-4 w-4 text-[#44551d]" aria-label="포함" /> : value === '✕' ? <span aria-label="미포함">—</span> : value}</td>)}</tr>)}</tbody></table></div><p className="mt-4 text-[11px] leading-5 text-[#72756a]">지원 플랫폼: {PLATFORMS_ALL}</p></section>
        <section id="pricing-faq" className="grid gap-8 border-t border-[#141512] py-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20"><div><p className="text-[10px] font-medium tracking-[0.16em] text-[#72756a]">GOOD TO KNOW</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">시작하기 전에.</h2><Link href="/refund" className="mt-6 inline-flex items-center gap-3 text-xs font-semibold">환불규정 보기<ArrowRight className="h-3.5 w-3.5" /></Link></div><div>{faqs.map(([question, answer]) => <details key={question} className="group border-b border-[#d4d6cb] py-5 first:pt-0"><summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-semibold">{question}<Plus className="h-4 w-4 shrink-0 transition-transform group-open:rotate-45" /></summary><p className="mt-4 max-w-xl text-sm leading-7 text-[#687253]">{answer}</p></details>)}</div></section>
        <section id="pricing-cta" className="mb-14 mt-8 flex flex-col justify-between gap-8 bg-[#141512] px-7 py-10 text-white sm:px-10 lg:flex-row lg:items-center"><div><p className="mb-3 text-[10px] tracking-[0.18em] text-[#ff5d2a]">START WITH A QUESTION</p><h2 className="text-2xl font-medium leading-tight tracking-[-0.045em] sm:text-3xl">우리 병원의 첫 번째 질문을 등록하세요.</h2></div><Link href={loggedIn ? '/dashboard' : '/register'} className="inline-flex shrink-0 items-center justify-between gap-8 bg-[#ff5d2a] px-6 py-4 text-sm font-semibold text-[#141512]">{loggedIn ? '대시보드로 이동' : '14일 무료로 시작'}<ArrowUpRight className="h-5 w-5" /></Link></section>
      </main><SiteFooter />
    </div>
  );
}
