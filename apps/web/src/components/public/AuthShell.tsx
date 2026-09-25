import Link from 'next/link';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { PublicBrand, SignalMark } from './PublicBrand';

export default function AuthShell({ children, mode }: { children: React.ReactNode; mode: 'login' | 'register' | 'recovery' }) {
  const registering = mode === 'register';
  return <div className="min-h-screen bg-[#F4F5EF] text-[#15231B]">
    <header className="flex h-[76px] items-center justify-between gap-4 border-b border-[#DEE4D9] px-5 sm:px-10 lg:px-14"><PublicBrand /><Link href={registering ? '/login' : '/register'} className="flex items-center gap-3 border-b border-[#15231B] py-2 text-xs font-semibold">{registering ? '로그인' : '회원가입'}<ArrowUpRight className="h-4 w-4" /></Link></header>
    <div className="mx-auto grid max-w-[1440px] lg:min-h-[calc(100vh-76px)] lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden border-r border-[#DEE4D9] p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div><p className="text-[10px] font-semibold tracking-[0.2em] text-[#778378]">YOUR CLINIC. YOUR SIGNAL.</p><h2 className="mt-10 text-[clamp(3rem,4.4vw,5rem)] font-semibold leading-[1.16] tracking-[-0.07em]">AI가 들려주는<br />우리 병원의<br /><span className="text-[#36765A]">또 다른 모습.</span></h2><p className="mt-7 max-w-sm text-sm leading-7 text-[#637167]">병원 소개에서 핵심 질문으로.<br />질문에서 실제 답변으로.<br />흩어져 있던 AI 검색의 근거를 한곳에서 확인하세요.</p></div>
        <div className="mb-5 mt-16"><div className="relative flex h-24 items-center gap-0" aria-hidden="true"><span className="flex h-14 w-14 items-center justify-center border border-[#C4CFC0] text-2xl font-light">?</span><span className="h-px flex-1 bg-[#C4CFC0]" /><SignalMark className="!h-20 !w-20" /><span className="h-px flex-1 bg-[#C4CFC0]" /><span className="flex h-14 w-14 items-center justify-center border border-[#C4CFC0]"><ArrowUpRight className="h-7 w-7" /></span></div><div className="mt-4 flex justify-between text-[9px] font-semibold tracking-[0.16em] text-[#778378]"><span>QUESTION</span><span>SIGNAL</span><span>ANSWER</span></div><div className="mt-12 flex items-center justify-between border-t border-[#DEE4D9] pt-5 text-xs text-[#778378]"><span>{registering ? '14일 무료 체험 · 카드 등록 없이' : 'Patient Signal by 페이션트퍼널'}</span><ArrowRight className="h-4 w-4" /></div></div>
      </aside>
      <main className="flex items-center justify-center bg-white px-6 py-12 sm:px-12 lg:px-14 lg:py-16"><div className="w-full max-w-[420px]">{children}</div></main>
    </div>
  </div>;
}
