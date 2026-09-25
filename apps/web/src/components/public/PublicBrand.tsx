import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function SignalMark({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center bg-[#D8F36A] text-[#15231B] ${className}`}><svg viewBox="0 0 28 28" className="h-6 w-6" fill="none"><path d="M5 20V14M11 20V8M17 20V11M23 20V3" stroke="currentColor" strokeWidth="3" /></svg></span>;
}

export function PublicBrand({ light = false }: { light?: boolean }) {
  return <Link href="/" aria-label="Patient Signal 홈" className={`inline-flex items-center gap-2.5 ${light ? 'text-white' : 'text-[#15231B]'}`}><SignalMark /><span className="text-[17px] font-semibold leading-none tracking-[-0.06em]">patient<span className="font-normal">signal</span></span></Link>;
}

export function PublicHeader({ active, loggedIn = false }: { active?: 'pricing' | 'guide'; loggedIn?: boolean }) {
  return <header className="border-b border-[#DEE4D9] bg-[#F4F5EF]"><div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-3 px-5 sm:px-10 lg:px-14"><PublicBrand /><nav className="hidden items-center gap-8 text-[13px] font-medium text-[#778378] md:flex" aria-label="주요 메뉴"><Link href="/#how-it-works" className="hover:text-[#15231B]">작동 방식</Link><Link href="/pricing" aria-current={active === 'pricing' ? 'page' : undefined} className={active === 'pricing' ? 'text-[#15231B]' : 'hover:text-[#15231B]'}>요금제</Link><Link href="/guide" aria-current={active === 'guide' ? 'page' : undefined} className={active === 'guide' ? 'text-[#15231B]' : 'hover:text-[#15231B]'}>사용 가이드</Link></nav><Link href={loggedIn ? '/dashboard' : '/login'} className="inline-flex shrink-0 items-center gap-3 border-b border-[#15231B] py-2 text-xs font-semibold sm:text-sm">{loggedIn ? '내 대시보드' : '로그인'}<ArrowUpRight className="h-4 w-4" /></Link></div></header>;
}
