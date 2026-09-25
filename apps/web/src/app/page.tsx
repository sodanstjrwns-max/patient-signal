'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, CircleHelp, Link2, MessageSquareText } from 'lucide-react';
import SiteFooter from '@/components/layout/SiteFooter';
import { PublicHeader, SignalMark } from '@/components/public/PublicBrand';
import { useAuthStore } from '@/stores/auth';

const HUB_SSO_START_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.patientsignal.kr/api') + '/auth/hub';
const platforms = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Grok', 'CLOVA X', '네이버 AI 브리핑'];
const steps = [
  { title: '우리 병원에서 시작.', label: 'CONNECT', description: 'Patient Hub의 병원 소개를 연결하세요. 진료와 지역, 병원의 특징까지 확인하고 직접 수정할 수 있습니다.', href: '/dashboard/settings', link: '병원 소개 관리' },
  { title: '중요한 질문에 집중.', label: 'ASK', description: '병원 정보에서 추천한 핵심 질문을 검토하세요. 환자분이 궁금해할 질문을 다듬고, 추적할 질문을 선택합니다.', href: '/dashboard/prompts', link: '핵심 질문 관리' },
  { title: '답변을 열어 확인.', label: 'UNDERSTAND', description: '어떤 질문에서 우리 병원이 등장했을까요? 플랫폼별 실제 답변과 경쟁 병원의 등장률을 함께 확인하세요.', href: '/dashboard/competitors', link: '경쟁 병원 비교' },
];

export default function HomePage() {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const loggedIn = _hasHydrated && isAuthenticated;
  const startHref = loggedIn ? '/dashboard' : '/register';
  const startLabel = loggedIn ? '대시보드 열기' : '14일 무료로 시작';

  return (
    <div className="min-h-screen bg-[#F4F5EF] text-[#15231B]">
      <PublicHeader loggedIn={loggedIn} />
      <main>
        <section id="hero-section" className="mx-auto max-w-[1440px] px-5 pb-12 pt-12 sm:px-10 sm:pb-16 sm:pt-16 lg:px-14 lg:pt-20">
          <div className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.18em] sm:text-xs"><span className="h-2 w-2 bg-[#36765A]" />AI VISIBILITY INTELLIGENCE<span className="ml-auto hidden text-[#778378] sm:inline">FOR YOUR CLINIC</span></div>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.45fr_0.65fr] lg:items-end lg:gap-16">
            <h1 className="text-[clamp(2.8rem,6.9vw,6.8rem)] font-semibold leading-[1.12] tracking-[-0.075em]">AI 검색 속,<br />우리 병원의 <span className="relative inline-block">자리.<svg viewBox="0 0 190 13" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-2.5 w-full text-[#B8D743] sm:h-3"><path d="M2 9C44 2 119 2 188 6" stroke="currentColor" strokeWidth="7" fill="none" /></svg></span></h1>
            <div className="pb-2"><p className="max-w-sm text-[15px] leading-7 text-[#637167] sm:text-base sm:leading-8">질문을 고르고, AI의 답변을 열고,<br className="hidden sm:block" />경쟁 병원 사이에서 우리의 위치를 확인하세요.</p><Link href={startHref} className="mt-7 inline-flex h-13 items-center gap-8 bg-[#15231B] px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#36765A]">{startLabel}<ArrowUpRight className="h-5 w-5" /></Link><p className="mt-3 text-[11px] text-[#778378]">카드 등록 없이 · 병원 정보는 언제든 수정</p></div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-8" aria-label="Patient Signal 제품 흐름 예시">
          <div className="relative overflow-hidden bg-[#13251D] px-5 pb-7 pt-6 text-white sm:px-8 sm:pb-10 sm:pt-8 lg:px-12">
            <div className="flex items-center justify-between border-b border-white/15 pb-5 text-[10px] font-medium tracking-[0.18em] text-white/50"><span>SIGNAL / HOW IT CONNECTS</span><span className="border border-white/20 px-2 py-1 tracking-normal">제품 흐름 예시</span></div>
            <div className="relative grid gap-0 lg:grid-cols-[1fr_0.7fr_1.1fr] lg:items-center">
              <div className="py-8 lg:py-12"><div className="flex items-center gap-2 text-xs text-[#D8F36A]"><CircleHelp className="h-4 w-4" /> 하나의 중요한 질문</div><p className="mt-5 max-w-sm text-2xl font-medium leading-[1.5] tracking-[-0.04em] sm:text-3xl">“우리 지역에서<br />임플란트 상담을 받으려면<br />무엇을 비교해야 할까?”</p><div className="mt-7 flex gap-2 text-[11px] text-white/50"><span className="border border-white/20 px-2.5 py-1.5">지역</span><span className="border border-white/20 px-2.5 py-1.5">주력 진료</span><span className="border border-white/20 px-2.5 py-1.5">환자의 관심</span></div></div>
              <div className="relative hidden h-72 items-center justify-center lg:flex" aria-hidden="true"><svg className="absolute h-full w-full" viewBox="0 0 240 288" fill="none"><path d="M0 144H80M160 144H240M160 144C195 144 195 44 240 44M160 144C195 144 195 244 240 244" stroke="#657A66" /><circle cx="120" cy="144" r="57" stroke="#465C48" /><circle cx="120" cy="144" r="84" stroke="#2D4535" strokeDasharray="2 8" /></svg><SignalMark className="relative !h-16 !w-16" /></div>
              <div className="border-t border-white/15 pt-6 lg:border-t-0 lg:py-8"><div className="flex items-center justify-between text-xs"><span className="text-white/60">AI 답변을 하나의 근거로</span><MessageSquareText className="h-4 w-4 text-[#D8F36A]" /></div><div className="mt-5 bg-[#F4F5EF] p-5 text-[#15231B] sm:p-6"><div className="mb-5 flex items-center justify-between text-[11px] font-semibold"><span>질문별 AI 답변</span><span className="flex items-center gap-1 text-[#36765A]"><Check className="h-3.5 w-3.5" /> 원문 연결</span></div><div className="space-y-3">{['어느 플랫폼에서 언급됐는지', '실제로 어떤 설명이 나왔는지', '경쟁 병원도 함께 등장했는지'].map((text, i) => <div key={text} className="flex items-center gap-3 border-t border-[#DEE4D9] pt-3 text-[13px]"><span className="font-mono text-[10px] text-[#778378]">0{i + 1}</span>{text}</div>)}</div><div className="mt-5 flex items-center justify-between border-t border-[#DEE4D9] pt-4 text-xs font-semibold"><span>답변으로 확인하는 우리 병원</span><ArrowUpRight className="h-4 w-4" /></div></div></div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/15 pt-5 text-xs text-white/60 sm:gap-x-7"><span className="mr-auto text-[9px] tracking-[0.14em] text-white/35">CONNECTED PLATFORMS</span>{platforms.map(p => <span key={p}>{p}</span>)}</div>
          </div>
          <p className="mt-3 px-2 text-right text-[10px] text-[#778378]">지원 플랫폼과 측정 주기는 플랜에 따라 다릅니다.</p>
        </section>

        <section id="how-it-works" className="mx-auto max-w-[1440px] px-5 py-20 sm:px-10 lg:px-14 lg:py-28">
          <div className="mb-10 grid gap-5 lg:grid-cols-2"><p className="text-[11px] font-semibold tracking-[0.18em] text-[#778378]">01 — FROM PROFILE TO PROOF</p><h2 className="text-3xl font-semibold leading-tight tracking-[-0.055em] sm:text-4xl">병원 소개가 질문이 되고,<br />답변이 다음 판단의 근거가 됩니다.</h2></div>
          <div className="border-t border-[#15231B]">{steps.map((step, i) => <article key={step.label} className="grid gap-5 border-b border-[#DEE4D9] py-7 md:grid-cols-[70px_1fr_1.2fr_130px] md:items-start md:gap-8 md:py-9"><span className="font-mono text-sm text-[#778378]">0{i + 1}</span><div><p className="text-[10px] font-semibold tracking-[0.16em] text-[#36765A]">{step.label}</p><h3 className="mt-2 text-2xl font-semibold tracking-[-0.045em]">{step.title}</h3></div><p className="max-w-md text-sm leading-7 text-[#637167]">{step.description}</p><Link href={loggedIn ? step.href : '/register'} className="inline-flex items-center gap-2 text-xs font-semibold md:justify-end">{step.link}<ArrowUpRight className="h-4 w-4" /></Link></article>)}</div>
        </section>

        <section className="bg-[#D8F36A] px-5 py-14 sm:px-10 lg:px-14 lg:py-20"><div className="mx-auto grid max-w-[1328px] gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="mb-5 text-[10px] font-semibold tracking-[0.18em]">YOUR NEXT SIGNAL STARTS HERE</p><h2 className="text-4xl font-semibold leading-[1.2] tracking-[-0.065em] sm:text-5xl lg:text-6xl">우리 병원의 이야기가<br />어떻게 전달되는지, 지금.</h2></div><div><Link href={startHref} className="inline-flex items-center gap-12 border-b-2 border-[#15231B] pb-4 text-lg font-semibold">{startLabel}<ArrowUpRight className="h-6 w-6" /></Link>{!loggedIn && <a href={HUB_SSO_START_URL} className="mt-5 flex items-center gap-2 text-xs font-medium"><Link2 className="h-3.5 w-3.5" />Patient Hub 계정으로 연결<ArrowRight className="h-3.5 w-3.5" /></a>}</div></div></section>
      </main>
      <SiteFooter />
    </div>
  );
}
