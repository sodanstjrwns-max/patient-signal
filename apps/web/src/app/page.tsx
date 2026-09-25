'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Link2, MousePointer2, Plus } from 'lucide-react';
import SiteFooter from '@/components/layout/SiteFooter';
import { PublicHeader, SignalMark } from '@/components/public/PublicBrand';
import { Reveal, SignalSurface } from '@/components/motion/SignalMotion';
import { useAuthStore } from '@/stores/auth';

const HUB_SSO_START_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.patientsignal.kr/api') + '/auth/hub';
const platforms = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Grok', 'CLOVA X', '네이버 AI 브리핑'];
const demoPlatforms = ['ChatGPT', 'Claude', 'Perplexity'];
const examples = [
  {
    label: '임플란트 상담', tag: '진료에 관한 질문',
    question: '우리 동네에서 임플란트 상담을 받을 치과를 찾고 있어요.',
    answers: [
      '병원을 비교할 때는 어떤 진료를 제공하는지, 상담 과정은 어떻게 진행되는지 살펴볼 수 있습니다. 병원 소개에 담긴 진료 정보가 답변에 어떻게 반영되는지 확인해 보세요.',
      '지역과 진료 내용을 함께 살펴보면 비교할 병원의 범위를 좁힐 수 있습니다. 이 화면에서는 AI가 병원을 소개할 때 어떤 특징을 언급했는지 읽어볼 수 있습니다.',
      '지역의 병원 정보를 바탕으로 진료 내용과 상담 안내를 비교하는 답변 예시입니다. 실제 서비스에서는 수집된 답변 원문과 병원 언급 여부를 확인합니다.',
    ],
  },
  {
    label: '아이와 방문', tag: '환자 상황에 관한 질문',
    question: '아이와 함께 방문할 치과를 찾을 때 어떤 정보를 봐야 할까요?',
    answers: [
      '아이와 방문할 병원을 알아볼 때는 해당 진료의 제공 여부와 예약 안내를 확인할 수 있습니다. 이처럼 환자분의 상황에 따라 AI가 답변에서 강조하는 정보가 달라집니다.',
      '병원이 안내하는 진료 대상, 상담 방식, 방문 정보를 함께 살펴보는 답변 예시입니다. 우리 병원의 설명이 어떤 질문과 연결되는지 확인해 보세요.',
      '병원 소개와 방문 안내를 참고해 필요한 정보를 정리하는 답변 예시입니다. Patient Signal에서는 질문별로 수집한 원문을 열어 실제 설명을 읽을 수 있습니다.',
    ],
  },
  {
    label: '퇴근 후 진료', tag: '방문 조건에 관한 질문',
    question: '퇴근 후에 방문할 수 있는 가까운 치과를 어떻게 찾을까요?',
    answers: [
      '방문 가능한 시간과 지역을 함께 확인해 보세요. AI의 설명에 진료 시간이나 위치가 포함됐는지, 병원에서 안내하는 정보와 일치하는지 살펴볼 수 있습니다.',
      '진료 시간과 위치처럼 방문 결정에 필요한 정보를 정리하는 답변 예시입니다. 병원 소개에서 중요한 정보가 AI 답변에도 전달되는지 확인해 보세요.',
      '지역과 진료 시간 조건에 맞는 정보를 비교하는 답변 예시입니다. 실제 방문 전에는 해당 병원의 최신 예약·진료 안내를 확인할 수 있습니다.',
    ],
  },
];
const steps = [
  { title: '병원의 이야기를 연결.', label: 'CONNECT', description: 'Patient Hub의 병원 소개를 가져오세요. 지역과 주력 진료, 병원의 특징을 확인하고 직접 수정할 수 있습니다.', detail: 'Hub에서 연결한 소개도 우리 병원에 맞게 계속 다듬을 수 있습니다.', chips: ['병원 소개', '진료와 지역', '직접 편집'], href: '/dashboard/settings', link: '병원 소개 관리' },
  { title: '중요한 질문을 선택.', label: 'ASK', description: '병원 정보를 바탕으로 추천한 핵심 질문을 검토하세요. 환자분의 관심에 맞춰 다듬고 추적할 질문을 선택합니다.', detail: '환자분이 물어볼 질문에서 우리 병원의 AI 노출 확인이 시작됩니다.', chips: ['질문 추천', '내용 수정', '추적 질문 선택'], href: '/dashboard/prompts', link: '핵심 질문 관리' },
  { title: '답변 속 위치를 발견.', label: 'DISCOVER', description: '질문마다 실제 AI 답변을 열어보세요. 경쟁 병원을 추가하고 같은 답변에서의 등장률과 순위를 비교합니다.', detail: '어떤 말로 소개됐는지, 다른 병원도 함께 등장했는지 원문으로 확인합니다.', chips: ['답변 원문', '경쟁 병원 추가', '등장률 순위'], href: '/dashboard/competitors', link: '경쟁 병원 비교' },
];

export default function HomePage() {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [platformIndex, setPlatformIndex] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const loggedIn = _hasHydrated && isAuthenticated;
  const startHref = loggedIn ? '/dashboard' : '/register';
  const startLabel = loggedIn ? '대시보드 열기' : '14일 무료로 시작';
  const example = examples[questionIndex];
  const step = steps[activeStep];

  return (
    <div className="min-h-screen bg-[#f4f4f8] text-[#101016]">
      <PublicHeader loggedIn={loggedIn} dark />
      <main>
        <section id="hero-section" className="relative overflow-hidden bg-[#101016] text-white">
          <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-10 sm:px-10 sm:pb-14 sm:pt-14 lg:px-14 lg:pt-20">
            <div className="signal-enter flex items-center gap-3 text-[10px] font-medium tracking-[0.16em] sm:text-xs"><span className="h-2 w-2 bg-[#ff6b3d]" />AI VISIBILITY / FOR YOUR CLINIC<span className="ml-auto hidden text-white/40 sm:inline">MAKE YOUR PRESENCE VISIBLE.</span></div>
            <div className="mt-10 grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-end lg:gap-14">
              <h1 className="signal-enter text-[clamp(3.3rem,7.7vw,7.5rem)] font-semibold leading-[1.07] tracking-[-0.085em]">AI의 답변에,<br />우리 병원의<br /><span className="text-[#ff6b3d]">시그널을.</span><span className="ml-2 inline-block align-top text-[0.5em] text-[#ff6b3d]" aria-hidden="true">↗</span></h1>
              <div className="signal-enter max-w-md pb-2"><p className="text-[15px] leading-7 text-white/65 sm:text-base sm:leading-8">AI는 우리 병원을 어떻게 소개할까요?<br />핵심 질문부터 실제 답변, 경쟁 병원 사이의<br className="hidden xl:block" /> 위치까지. 하나의 화면에서 확인하세요.</p><Link href={startHref} className="signal-interactive group mt-8 inline-flex items-center gap-10 bg-[#ff6b3d] px-6 py-4 text-sm font-bold text-[#101016] hover:bg-white">{startLabel}<ArrowUpRight className="h-5 w-5 transition-transform motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:translate-x-1" /></Link><p className="mt-4 text-[11px] text-white/45">카드 등록 없이 · 병원 정보는 언제든 수정</p><a href="#signal-demo" className="mt-8 flex w-fit items-center gap-2 text-xs text-white/75 transition-colors hover:text-[#ff6b3d]">직접 질문 바꿔보기<ArrowDown className="h-3.5 w-3.5" /></a></div>
            </div>
            <div className="mt-12 flex items-end justify-between gap-5 border-t border-white/15 pt-5 lg:mt-16"><p className="max-w-[240px] text-[10px] leading-5 tracking-[0.08em] text-white/40">병원의 소개가 질문으로.<br />질문이 답변으로. 답변이 다음 판단으로.</p><div className="flex h-12 items-end gap-1.5 sm:h-16 sm:gap-2" aria-hidden="true">{[26, 56, 42, 80, 64, 100, 76, 92].map((height, index) => <span key={index} className={`w-3 transition-transform duration-300 motion-safe:hover:-translate-y-2 sm:w-5 ${index > 4 ? 'bg-[#ff6b3d]' : 'bg-[#5b4dff]'}`} style={{ height: `${height}%` }} />)}</div></div>
          </div>
        </section>

        <section id="signal-demo" className="scroll-mt-8 px-5 py-16 sm:px-10 lg:px-14 lg:py-24">
          <div className="mx-auto max-w-[1328px]">
            <Reveal className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold tracking-[0.18em] text-[#5b4dff]">01 / PLAY WITH THE SIGNAL</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.06em] sm:text-5xl">질문을 바꾸면,<br className="sm:hidden" /> 보이는 것도 달라지니까.</h2></div><span className="flex items-center gap-2 text-xs text-[#606070]"><MousePointer2 className="h-4 w-4" />질문과 플랫폼을 눌러보세요</span></Reveal>
            <SignalSurface className="overflow-hidden border border-[#d9d8e6] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9d8e6] px-5 py-4 sm:px-7"><div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.14em]"><span className="h-2 w-2 bg-[#5b4dff]" />SIGNAL PLAYGROUND</div><p className="text-[10px] font-medium text-[#606070]">직접 작성한 UI 예시 · 실제 AI 답변 아님</p></div>
              <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
                <div className="border-b border-[#d9d8e6] p-5 sm:p-7 lg:border-b-0 lg:border-r lg:p-9"><p className="text-[10px] font-semibold tracking-[0.14em] text-[#737382]">SELECT A QUESTION</p><div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="예시 질문 선택">{examples.map((item, index) => <button key={item.label} type="button" aria-pressed={questionIndex === index} onClick={() => setQuestionIndex(index)} className={`signal-tab border px-3 py-2.5 text-xs font-semibold ${questionIndex === index ? 'signal-tab-active border-[#101016] bg-[#101016] text-white' : 'border-[#d9d8e6] text-[#606070] hover:border-[#101016] hover:text-[#101016]'}`}>{item.label}</button>)}</div><div key={questionIndex} className="signal-panel-enter mt-7 min-h-[120px] sm:min-h-[135px]"><p className="text-[10px] font-medium text-[#5b4dff]">{example.tag}</p><h3 className="mt-3 max-w-md text-[25px] font-medium leading-[1.5] tracking-[-0.05em] sm:text-[29px]">{example.question}</h3></div><div className="mt-8 flex items-center gap-3 border-t border-[#e5e5ed] pt-5 text-xs text-[#737382]"><span className="flex h-8 w-8 items-center justify-center bg-[#f4f4f8]"><ArrowRight className="h-4 w-4" /></span>선택한 질문을 플랫폼별 답변과 연결</div></div>
                <div className="min-w-0 bg-[#ededf5] p-5 sm:p-7 lg:p-9"><div className="flex flex-wrap gap-1.5" role="group" aria-label="예시 플랫폼 선택">{demoPlatforms.map((platform, index) => <button key={platform} type="button" aria-pressed={platformIndex === index} onClick={() => setPlatformIndex(index)} className={`signal-tab px-3 py-2.5 text-xs font-semibold sm:px-4 ${platformIndex === index ? 'signal-tab-active bg-[#5b4dff] text-white' : 'text-[#606070] hover:bg-white'}`}>{platform}</button>)}</div><div key={`${questionIndex}-${platformIndex}`} aria-live="polite" aria-atomic="true" className="signal-panel-enter mt-5 bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-2 border-b border-[#ededf5] pb-4"><span className="text-sm font-semibold">{demoPlatforms[platformIndex]} 답변 미리보기</span><span className="shrink-0 border border-[#dedee8] px-2 py-1 text-[10px] text-[#737382]">설명용 예시</span></div><p className="mt-5 min-h-[156px] text-[14px] leading-[1.9] text-[#606070] sm:min-h-[132px]">{example.answers[platformIndex]}</p><div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#ededf5] pt-4 text-[10px] font-medium text-[#606070]"><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-[#5b4dff]" />어떤 설명인지</span><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-[#5b4dff]" />어떤 질문인지</span><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-[#5b4dff]" />어느 플랫폼인지</span></div></div></div>
              </div>
            </SignalSurface>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-[#737382]"><span className="mr-auto text-[9px] font-semibold tracking-[0.14em]">SUPPORTED PLATFORMS</span>{platforms.map(platform => <span key={platform}>{platform}</span>)}</div><p className="mt-4 text-[10px] text-[#737382]">지원 플랫폼과 측정 주기는 플랜에 따라 다릅니다. 위 예시는 사용 방식 설명을 위한 화면입니다.</p>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-8 bg-[#101016] px-5 py-16 text-white sm:px-10 lg:px-14 lg:py-24">
          <div className="mx-auto max-w-[1328px]">
            <Reveal className="grid gap-6 lg:grid-cols-2"><p className="text-[10px] font-semibold tracking-[0.18em] text-[#ff6b3d]">02 / TURN INFORMATION INTO DIRECTION</p><h2 className="text-3xl font-semibold leading-[1.25] tracking-[-0.06em] sm:text-5xl">한 번의 연결에서,<br />다음 판단까지.</h2></Reveal>
            <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-16"><div className="border-t border-white/25" role="group" aria-label="사용 단계 선택">{steps.map((item, index) => <button key={item.label} type="button" onClick={() => setActiveStep(index)} aria-pressed={activeStep === index} className={`group flex w-full items-start gap-5 border-b border-white/20 py-6 text-left transition-colors sm:gap-7 ${activeStep === index ? 'text-[#ff6b3d]' : 'text-white/50 hover:text-white'}`}><span className="pt-1 font-mono text-xs">0{index + 1}</span><span className="flex-1"><span className="text-[9px] font-semibold tracking-[0.16em]">{item.label}</span><span className="mt-2 block text-xl font-medium tracking-[-0.04em] sm:text-2xl">{item.title}</span></span><Plus className={`mt-4 h-5 w-5 shrink-0 transition-transform duration-300 ${activeStep === index ? 'rotate-45' : ''}`} /></button>)}</div><SignalSurface className="flex min-h-[330px] flex-col justify-between border border-white/20 bg-[#191921] p-6 sm:p-9"><div key={activeStep} className="signal-panel-enter" aria-live="polite"><div className="flex items-start justify-between"><span className="font-mono text-6xl font-light tracking-[-0.08em] text-[#ff6b3d]">0{activeStep + 1}</span><SignalMark className="!h-11 !w-11" /></div><p className="mt-6 max-w-md text-[15px] leading-7 text-white/80">{step.description}</p><div className="mt-5 flex flex-wrap gap-2">{step.chips.map(chip => <span key={chip} className="border border-white/20 px-2.5 py-1.5 text-[10px] text-white/50">{chip}</span>)}</div><p className="mt-5 text-xs leading-6 text-white/45">{step.detail}</p></div><Link href={loggedIn ? step.href : '/register'} className="group mt-7 flex items-center justify-between border-t border-white/20 pt-5 text-xs font-medium text-[#ff6b3d]">{step.link}<ArrowUpRight className="h-5 w-5 transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" /></Link></SignalSurface></div>
          </div>
        </section>

        <section className="overflow-hidden bg-[#ff6b3d] px-5 py-14 sm:px-10 lg:px-14 lg:py-20"><Reveal className="mx-auto max-w-[1328px]"><div className="flex items-center justify-between border-b border-[#101016]/25 pb-5 text-[10px] font-semibold tracking-[0.15em]"><span>YOUR NEXT SIGNAL STARTS HERE</span><ArrowUpRight className="h-5 w-5" /></div><div className="mt-9 grid gap-9 lg:grid-cols-[1fr_auto] lg:items-end"><h2 className="text-[clamp(2.5rem,5.8vw,5.5rem)] font-semibold leading-[1.14] tracking-[-0.075em]">우리 병원의<br />다음 시그널을 켜세요.</h2><div><Link href={startHref} className="signal-interactive inline-flex items-center gap-12 bg-[#101016] px-6 py-4 text-sm font-semibold text-white hover:bg-[#5b4dff]">{startLabel}<ArrowUpRight className="h-5 w-5" /></Link>{!loggedIn && <a href={HUB_SSO_START_URL} className="mt-5 flex items-center gap-2 text-xs font-medium"><Link2 className="h-3.5 w-3.5" />Patient Hub 계정으로 연결<ArrowRight className="h-3.5 w-3.5" /></a>}</div></div></Reveal></section>
      </main>
      <SiteFooter />
    </div>
  );
}
