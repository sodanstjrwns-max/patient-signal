import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function SignalMark({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center bg-[#ff6b3d] text-[#101016] ${className}`}><svg viewBox="0 0 28 28" className="h-6 w-6" fill="none"><path d="M5 22V14M11 22V8M17 22V12M23 22V3" stroke="currentColor" strokeWidth="3" /></svg></span>;
}

export function PublicBrand({ light = false }: { light?: boolean }) {
  return <Link href="/" aria-label="Patient Signal 홈" className={`group inline-flex items-center gap-2.5 ${light ? 'text-white' : 'text-[#101016]'}`}><SignalMark className="transition-transform duration-300 motion-safe:group-hover:-rotate-6" /><span className="text-[18px] font-bold leading-none tracking-[-0.06em]">patient<span className="font-normal">signal</span></span></Link>;
}

export function PublicHeader({ active, loggedIn = false, dark = false }: { active?: 'pricing' | 'guide'; loggedIn?: boolean; dark?: boolean }) {
  return <header className={`relative z-10 border-b ${dark ? 'border-white/15 bg-[#101016] text-white' : 'border-[#dedee8] bg-[#f4f4f8] text-[#101016]'}`}><div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-3 px-5 sm:px-10 lg:px-14"><PublicBrand light={dark} /><nav className="hidden items-center gap-8 text-[13px] font-medium md:flex" aria-label="주요 메뉴"><Link href="/#how-it-works" className="opacity-65 transition-opacity hover:opacity-100">작동 방식</Link><Link href="/pricing" aria-current={active === 'pricing' ? 'page' : undefined} className={`transition-opacity hover:opacity-100 ${active === 'pricing' ? 'opacity-100' : 'opacity-65'}`}>요금제</Link><Link href="/guide" aria-current={active === 'guide' ? 'page' : undefined} className={`transition-opacity hover:opacity-100 ${active === 'guide' ? 'opacity-100' : 'opacity-65'}`}>사용 가이드</Link></nav><Link href={loggedIn ? '/dashboard' : '/login'} className={`group inline-flex shrink-0 items-center gap-3 border px-3 py-2.5 text-xs font-semibold transition-colors sm:px-4 ${dark ? 'border-white/30 hover:border-[#ff6b3d] hover:bg-[#ff6b3d] hover:text-[#101016]' : 'border-[#101016] hover:bg-[#101016] hover:text-white'}`}>{loggedIn ? '내 대시보드' : '로그인'}<ArrowUpRight className="h-4 w-4 transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" /></Link></div></header>;
}
