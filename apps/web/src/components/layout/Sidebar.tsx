'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  CreditCard,
  FileQuestion,
  Filter,
  Gauge,
  Key,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquareText,
  ScanSearch,
  Search,
  Target,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';

type NavItem = { label: string; href: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: '워크스페이스',
    items: [
      { label: '한눈에 보기', href: '/dashboard', icon: LayoutDashboard },
      { label: '병원 프로필', href: '/dashboard/settings', icon: Building2 },
      { label: '핵심 질문', href: '/dashboard/prompts', icon: FileQuestion },
      { label: '질문별 AI 답변', href: '/dashboard/responses', icon: MessageSquareText },
      { label: '경쟁 병원', href: '/dashboard/competitors', icon: Users },
    ],
  },
  {
    label: '분석',
    items: [
      { label: 'ABHS 리포트', href: '/dashboard/analytics', icon: Activity },
      { label: '기회 분석', href: '/dashboard/opportunities', icon: Target },
      { label: '성장 진단', href: '/dashboard/growth', icon: Gauge },
      { label: 'AI 인사이트', href: '/dashboard/insights', icon: Lightbulb },
      { label: '인용 역분석', href: '/dashboard/citation-analysis', icon: Search },
      { label: '카테고리 분석', href: '/dashboard/category-analysis', icon: Filter },
      { label: '경쟁 추이', href: '/dashboard/competitors/trending', icon: ScanSearch },
      { label: '리포트', href: '/dashboard/report', icon: BookOpen },
    ],
  },
  {
    label: '도구',
    items: [
      { label: '실시간 질문', href: '/dashboard/live-query', icon: MessageSquareText },
      { label: '환자 퍼널', href: '/dashboard/funnel', icon: Filter },
      { label: '콘텐츠 캘린더', href: '/dashboard/content-calendar', icon: CalendarDays },
      { label: 'API 연동', href: '/dashboard/api-keys', icon: Key },
      { label: '결제 및 구독', href: '/dashboard/billing', icon: CreditCard },
      { label: '이용 가이드', href: '/dashboard/guide', icon: BookOpen },
    ],
  },
];

const planLabels: Record<string, string> = {
  FREE: 'Free', STARTER: 'S', STANDARD: 'M', PRO: 'L', ENTERPRISE: 'Enterprise',
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const plan = planLabels[user?.hospital?.planType || 'FREE'] || 'Free';
  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-[76px] items-center justify-between border-b border-[#e9edf1] px-5">
        <Link href="/dashboard" className="flex items-center gap-3" aria-label="Patient Signal 홈">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#1a2b43] text-[20px] font-black tracking-[-0.1em] text-white">S<span className="text-[#71e0ca]">.</span></span>
          <span className="leading-tight">
            <strong className="block text-[15px] font-bold tracking-[-0.035em] text-[#17212e]">Patient Signal</strong>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b9aae]">AI visibility studio</span>
          </span>
        </Link>
        <button type="button" onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기" className="lg:hidden rounded-lg p-2 text-[#66778b] hover:bg-[#f1f4f8]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 pb-2 pt-4">
        <Link href="/dashboard/settings" className="group flex items-center gap-3 rounded-[14px] border border-[#e5eaf0] bg-[#f8fafc] px-3 py-3 transition-colors hover:border-[#c9d7ff] hover:bg-[#f3f7ff]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#285cf4] shadow-[0_1px_3px_rgba(18,32,56,0.08)]"><Building2 className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-[#17212e]">{user?.hospital?.name || '병원 프로필'}</span>
            <span className="mt-0.5 block text-[11px] text-[#7b899b]">{plan} 플랜 · 프로필 관리</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#9aa7b6] group-hover:text-[#285cf4]" />
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-5" aria-label="시그널 메뉴">
        {navGroups.map((group) => (
          <section key={group.label} className="mt-5">
            <h2 className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#97a3b1]">{group.label}</h2>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn(
                    'group flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium transition-colors',
                    active ? 'bg-[#ecf2ff] font-semibold text-[#2454de]' : 'text-[#5d6d80] hover:bg-[#f4f6f9] hover:text-[#17212e]'
                  )}>
                    <item.icon className={cn('h-[17px] w-[17px] shrink-0', active ? 'text-[#285cf4]' : 'text-[#8897aa] group-hover:text-[#52667f]')} strokeWidth={active ? 2.2 : 1.8} />
                    <span className="flex-1">{item.label}</span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-[#285cf4]" />}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-[#e9edf1] p-4">
        <Link href="/dashboard/billing" className="mb-3 flex items-center justify-between rounded-[12px] bg-[#1a2b43] px-3.5 py-3 text-white hover:bg-[#223b5d]">
          <span className="text-xs font-semibold">더 많은 질문 측정하기</span>
          <ArrowUpRight className="h-4 w-4 text-[#96e9d6]" />
        </Link>
        <div className="flex items-center gap-2.5 px-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9edf2] text-xs font-bold text-[#466079]">{user?.name?.charAt(0) || 'U'}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-[#344458]">{user?.name}</span>
            <span className="block truncate text-[10px] text-[#94a0ae]">{user?.email}</span>
          </span>
          <button type="button" onClick={logout} aria-label="로그아웃" title="로그아웃" className="rounded-lg p-2 text-[#8c99a8] hover:bg-[#f1f4f8] hover:text-[#344458]"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-[#e9edf1] bg-white px-4 lg:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="메뉴 열기" className="rounded-lg p-2 text-[#344458] hover:bg-[#f1f4f8]"><Menu className="h-5 w-5" /></button>
        <span className="text-sm font-bold tracking-tight text-[#17212e]">Patient Signal</span>
      </div>
      {mobileOpen && <button type="button" aria-label="메뉴 닫기" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-50 bg-[#101c2c]/40 lg:hidden" />}
      <aside className={cn('fixed bottom-0 left-0 top-0 z-50 w-[260px] transform border-r border-[#e9edf1] bg-white transition-transform lg:hidden', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>{sidebarContent}</aside>
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 border-r border-[#e9edf1] bg-white lg:block">{sidebarContent}</aside>
    </>
  );
}
