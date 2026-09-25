'use client';

import Link from 'next/link';
import {
  Activity, ArrowRight, ArrowUpRight, Building2, Check, CircleHelp,
  Layers3, Link2, MessageSquareText, ScanSearch, Sparkles, Target,
} from 'lucide-react';
import SiteFooter from '@/components/layout/SiteFooter';
import { useAuthStore } from '@/stores/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.patientsignal.kr/api';
const HUB_SSO_START_URL = API_BASE_URL + '/auth/hub';

const workflow = [
  { number: '01', icon: Building2, title: '병원 소개를 연결하세요', description: 'Patient Hub의 병원 정보를 가져와 확인하고, 시그널 안에서 직접 수정할 수 있습니다.' },
  { number: '02', icon: CircleHelp, title: '중요한 질문을 정하세요', description: '지역과 진료, 병원 소개를 바탕으로 추천된 질문을 검토하고 원하는 질문을 추가합니다.' },
  { number: '03', icon: MessageSquareText, title: '답변을 확인하세요', description: '질문마다 AI가 남긴 답변을 보고 언급 여부와 경쟁 병원을 함께 살핍니다.' },
];

const capabilities = [
  { icon: MessageSquareText, title: '질문별 답변 확인', description: '질문과 답변을 연결해 AI가 병원을 어떻게 설명했는지 확인합니다.' },
  { icon: Target, title: '병원에 맞는 질문', description: '진료와 지역을 반영한 추천 질문으로 추적을 시작하고 필요할 때 조정합니다.' },
  { icon: Layers3, title: '경쟁 병원 비교', description: '관심 있는 경쟁 병원을 추가해 같은 질문에서 함께 등장하는지 비교합니다.' },
  { icon: Activity, title: '변화의 흐름', description: '반복 측정 결과를 살펴보고 이전 답변과 달라진 부분을 찾습니다.' },
];

export default function HomePage() {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const loggedIn = _hasHydrated && isAuthenticated;
  const startHref = loggedIn ? '/dashboard' : '/register';
  const startLabel = loggedIn ? '대시보드로 이동' : '무료로 시작하기';

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#17212e]">
      <header className="sticky top-0 z-50 border-b border-[#e7ecf2] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-3" aria-label="Patient Signal 홈">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#285cf4] text-white sm:h-9 sm:w-9"><ScanSearch className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.2} /></span>
            <span className="whitespace-nowrap text-[14px] font-bold tracking-[-0.04em] sm:text-[17px]">Patient Signal</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#667487] md:flex" aria-label="주요 메뉴">
            <a href="#how-it-works" className="hover:text-[#17212e]">작동 방식</a>
            <a href="#capabilities" className="hover:text-[#17212e]">주요 기능</a>
            <Link href="/pricing" className="hover:text-[#17212e]">요금제</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <Link href={loggedIn ? '/dashboard' : '/login'} className="whitespace-nowrap rounded-[10px] px-2 py-2.5 text-xs font-semibold text-[#526175] hover:bg-[#f2f5f9] sm:px-3 sm:text-sm">
              {loggedIn ? '내 대시보드' : '로그인'}
            </Link>
            <Link href={startHref} className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-[10px] bg-[#285cf4] px-3 text-xs font-semibold text-white shadow-[0_3px_9px_rgba(40,92,244,0.16)] hover:bg-[#204bce] sm:gap-2 sm:px-4 sm:text-sm">
              <span className="sm:hidden">{loggedIn ? '대시보드' : '시작하기'}</span><span className="hidden sm:inline">{startLabel}</span><ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section id="hero-section" className="relative overflow-hidden border-b border-[#e7ecf2] bg-white">
          <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: 'linear-gradient(#edf1f6 1px, transparent 1px), linear-gradient(90deg, #edf1f6 1px, transparent 1px)', backgroundSize: '54px 54px', maskImage: 'linear-gradient(to right, transparent, black)' }} />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:py-28">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dce7ff] bg-[#eff4ff] px-3.5 py-1.5 text-xs font-bold text-[#285cf4]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#285cf4]" />AI 검색에서 보이는 우리 병원
              </div>
              <h1 className="max-w-[720px] text-[clamp(2.8rem,5vw,5rem)] font-bold leading-[1.1] tracking-[-0.07em]">
                AI는 우리 병원을<br /><span className="text-[#285cf4]">어떻게 말할까요?</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-[#5e6d80] sm:text-lg">
                환자가 AI에 묻는 핵심 질문을 추적하고, 질문마다 나온 답변을 바로 확인하세요. 병원 소개부터 경쟁 병원까지 한곳에서 관리할 수 있습니다.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href={startHref} className="inline-flex h-12 items-center gap-2 rounded-[11px] bg-[#285cf4] px-6 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(40,92,244,0.18)] hover:bg-[#204bce]">
                  {startLabel}<ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/pricing" className="inline-flex h-12 items-center gap-2 rounded-[11px] border border-[#dce2e9] bg-white px-6 text-sm font-semibold text-[#263548] hover:bg-[#f6f8fb]">
                  요금제 살펴보기<ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
              {!loggedIn && (
                <a href={HUB_SSO_START_URL} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#526175] hover:text-[#285cf4]">
                  <Link2 className="h-4 w-4" /> Patient Hub 계정으로 연결하기 <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </div>

            <div className="rounded-[22px] border border-[#dfe6ef] bg-white p-3 shadow-[0_24px_70px_rgba(24,43,73,0.11)] sm:p-5" aria-label="제품 흐름 예시">
              <div className="flex items-center justify-between border-b border-[#e7ecf2] px-2 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#eff4ff] text-[#285cf4]"><ScanSearch className="h-4 w-4" /></span>
                  <span className="text-sm font-bold">질문과 답변</span>
                </div>
                <span className="rounded-full bg-[#f2f5f9] px-2.5 py-1 text-[11px] font-semibold text-[#758297]">화면 예시</span>
              </div>
              <div className="space-y-3 pt-4">
                <div className="rounded-[14px] border border-[#dce7ff] bg-[#f7f9ff] p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#285cf4]"><CircleHelp className="h-3.5 w-3.5" /> 추적 질문</div>
                  <p className="mt-3 text-base font-semibold tracking-[-0.025em]">“우리 지역에서 임플란트 상담을 받으려면 무엇을 비교해야 할까?”</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {['지역', '주력 진료', '비교 의도'].map((tag) => <span key={tag} className="rounded-full border border-[#dce7ff] bg-white px-2.5 py-1 text-[11px] text-[#526175]">{tag}</span>)}
                  </div>
                </div>
                <div className="rounded-[14px] border border-[#e7ecf2] bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#526175]">연결된 AI 답변</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#edf7f1] px-2.5 py-1 text-[11px] font-semibold text-[#23865a]"><Check className="h-3 w-3" /> 원문 확인</span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    <div className="h-2.5 w-full rounded-full bg-[#e8edf4]" />
                    <div className="h-2.5 w-[91%] rounded-full bg-[#e8edf4]" />
                    <div className="h-2.5 w-[68%] rounded-full bg-[#e8edf4]" />
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-[#eef1f5] pt-3 text-xs text-[#69788b]">
                    <span>질문 · 플랫폼 · 측정일 연결</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#285cf4]">답변 보기 <ArrowRight className="h-3.5 w-3.5" /></span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[13px] border border-[#e7ecf2] bg-[#fbfcfe] p-3.5"><p className="text-[11px] text-[#69788b]">우리 병원</p><p className="mt-1 text-sm font-bold">언급 여부 확인</p></div>
                  <div className="rounded-[13px] border border-[#e7ecf2] bg-[#fbfcfe] p-3.5"><p className="text-[11px] text-[#69788b]">경쟁 병원</p><p className="mt-1 text-sm font-bold">같은 질문에서 비교</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#285cf4]">How it works</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.055em] sm:text-4xl">병원 정보에서 실제 답변까지</h2></div>
            <p className="max-w-sm text-sm leading-7 text-[#69788b]">무엇을 물었고, 어떤 답변이 돌아왔는지 한 흐름으로 확인합니다.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {workflow.map((item) => (
              <article key={item.number} className="rounded-[18px] border border-[#e7ecf2] bg-white p-6 shadow-[0_1px_2px_rgba(18,33,54,0.025)] sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eff4ff] text-[#285cf4]"><item.icon className="h-5 w-5" /></span>
                  <span className="text-xs font-bold tracking-[0.14em] text-[#a0acbb]">{item.number}</span>
                </div>
                <h3 className="mt-7 text-lg font-bold tracking-[-0.035em]">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#69788b]">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="capabilities" className="border-y border-[#e7ecf2] bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20 lg:py-28">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#285cf4]">A clearer signal</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.055em] sm:text-4xl">숫자 뒤에 있는<br />답변을 보세요.</h2>
              <p className="mt-5 text-sm leading-7 text-[#69788b]">우리 병원에 중요한 질문을 고르고, AI의 응답을 근거로 다음 행동을 판단할 수 있습니다.</p>
              <Link href="/pricing" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#285cf4] hover:text-[#204bce]">플랜 비교하기 <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {capabilities.map((item) => (
                <article key={item.title} className="rounded-[16px] border border-[#e7ecf2] bg-[#fbfcfe] p-5 sm:p-6">
                  <item.icon className="h-5 w-5 text-[#285cf4]" />
                  <h3 className="mt-5 text-base font-bold tracking-[-0.025em]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#69788b]">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="flex flex-col gap-8 rounded-[22px] bg-[#17212e] px-7 py-10 text-white sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:py-12">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a9bcff]"><Sparkles className="h-4 w-4" /> Start with Signal</span>
              <h2 className="mt-3 text-2xl font-bold tracking-[-0.045em] sm:text-3xl">우리 병원이 AI에서 어떻게 보이는지 확인하세요.</h2>
              <p className="mt-3 text-sm leading-6 text-[#abb8c9]">병원 정보를 연결하고 질문별 답변을 확인하는 데서 시작합니다.</p>
            </div>
            <Link href={startHref} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-[11px] bg-white px-6 text-sm font-bold text-[#17212e] hover:bg-[#edf2ff]">
              {startLabel}<ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
