'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Building2, MessageSquareText, ScanLine } from 'lucide-react';
import { PublicBrand } from './PublicBrand';
import { SignalSurface } from '@/components/motion/SignalMotion';

const stages = [
  { label: '병원 연결', title: '우리 병원에서 시작.', description: 'Patient Hub의 병원 소개를 연결하고, 우리 병원에 맞게 직접 다듬으세요.', icon: Building2, eyebrow: 'YOUR PROFILE' },
  { label: '질문 선택', title: '환자의 질문에 집중.', description: '병원 정보를 바탕으로 추천한 핵심 질문을 검토하고 추적할 질문을 선택하세요.', icon: MessageSquareText, eyebrow: 'YOUR QUESTIONS' },
  { label: '답변 확인', title: '답변 속 위치를 발견.', description: '실제 AI 답변을 읽고, 같은 답변에 등장한 경쟁 병원과 우리 병원의 위치를 비교하세요.', icon: ScanLine, eyebrow: 'YOUR SIGNAL' },
];

export default function AuthShell({ children, mode }: { children: React.ReactNode; mode: 'login' | 'register' | 'recovery' }) {
  const [activeStage, setActiveStage] = useState(0);
  const registering = mode === 'register';
  const stage = stages[activeStage];
  const StageIcon = stage.icon;

  return <div className="min-h-screen bg-[#101016] text-[#101016]">
    <header className="flex h-[76px] items-center justify-between gap-4 border-b border-white/15 px-5 text-white sm:px-10 lg:px-14"><PublicBrand light /><Link href={registering ? '/login' : '/register'} className="group flex items-center gap-3 border border-white/30 px-3 py-2.5 text-xs font-semibold transition-colors hover:border-[#ff6b3d] hover:text-[#ff6b3d] sm:px-4">{registering ? '로그인' : '회원가입'}<ArrowUpRight className="h-4 w-4 transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" /></Link></header>
    <div className="mx-auto grid max-w-[1600px] lg:min-h-[calc(100vh-76px)] lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="signal-enter"><p className="flex items-center gap-2.5 text-[10px] font-medium tracking-[0.18em] text-white/50"><span className="h-2 w-2 bg-[#ff6b3d]" />YOUR CLINIC. YOUR SIGNAL.</p><h2 className="mt-8 text-[clamp(3rem,4.9vw,5.25rem)] font-semibold leading-[1.12] tracking-[-0.075em]">AI의 답변에,<br />우리 병원의<br /><span className="text-[#ff6b3d]">시그널을.</span><span aria-hidden="true" className="ml-1 align-top text-[0.55em] text-[#ff6b3d]">↗</span></h2></div>
        <div className="mt-12"><SignalSurface className="overflow-hidden border border-white/20 bg-[#191921]"><div className="grid grid-cols-3 border-b border-white/15" role="group" aria-label="Patient Signal 사용 단계">{stages.map((item, index) => <button key={item.label} type="button" aria-pressed={index === activeStage} onClick={() => setActiveStage(index)} className={`signal-tab flex items-center justify-center gap-2 px-2 py-4 text-[11px] font-medium ${index === activeStage ? 'signal-tab-active bg-[#ff6b3d] text-[#101016]' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}><span className="font-mono text-[9px]">0{index + 1}</span>{item.label}</button>)}</div><div key={activeStage} className="signal-panel-enter min-h-[205px] p-6" aria-live="polite"><div className="flex items-center justify-between"><p className="text-[9px] font-semibold tracking-[0.18em] text-[#ff6b3d]">{stage.eyebrow}</p><StageIcon aria-hidden="true" className="h-5 w-5 text-white/35" /></div><h3 className="mt-5 text-xl font-medium tracking-[-0.04em]">{stage.title}</h3><p className="mt-3 max-w-sm text-[13px] leading-6 text-white/55">{stage.description}</p></div></SignalSurface><div className="mt-7 flex items-center justify-between text-[10px] text-white/40"><span>{registering ? '14일 무료 체험 · 카드 등록 없이' : 'Patient Signal by 페이션트퍼널'}</span><ArrowRight className="h-4 w-4" /></div></div>
      </aside>
      <main className="relative flex items-center justify-center bg-[#f4f4f8] px-6 py-12 sm:px-12 lg:px-14 lg:py-16"><div aria-hidden="true" className="absolute left-0 right-0 top-0 flex h-1"><span className="w-2/3 bg-[#ff6b3d]" /><span className="flex-1 bg-[#5b4dff]" /></div><div className="signal-enter w-full max-w-[420px]">{children}</div></main>
    </div>
  </div>;
}
