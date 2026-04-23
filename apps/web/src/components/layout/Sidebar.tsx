'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Sparkles,
  Building2,
  FileText,
  Menu,
  X,
  CreditCard,
  Lightbulb,
  Zap,
  PieChart,
  Globe,
  Target,
  ChevronDown,
  Crown,
  PenTool,
  Search,
  CalendarDays,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: '개요',
    defaultOpen: true,
    items: [
      { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
      { name: '주간 리포트', href: '/dashboard/report', icon: FileText },
    ],
  },
  {
    label: '모니터링',
    defaultOpen: true,
    items: [
      { name: '질문 관리', href: '/dashboard/prompts', icon: MessageSquare },
      { name: 'AI 응답', href: '/dashboard/responses', icon: Sparkles },
      { name: '실시간 질문', href: '/dashboard/live-query', icon: Zap },
    ],
  },
  {
    label: '분석',
    defaultOpen: true,
    items: [
      { name: 'ABHS 분석', href: '/dashboard/analytics', icon: BarChart3 },
      { name: '카테고리 성과', href: '/dashboard/category-analysis', icon: PieChart },
      { name: '기회 분석', href: '/dashboard/opportunities', icon: Target, badge: 'NEW' },
      { name: 'AI 인사이트', href: '/dashboard/insights', icon: Lightbulb },
      { name: '인용 출처', href: '/dashboard/insights?tab=sources', icon: Globe },
    ],
  },
  {
    label: 'GEO 콘텐츠',
    defaultOpen: true,
    items: [
      { name: 'AI 콘텐츠', href: '/dashboard/geo-content', icon: PenTool },
      { name: '인용 역분석', href: '/dashboard/citation-analysis', icon: Search, badge: 'NEW' },
      { name: '56주 캘린더', href: '/dashboard/content-calendar', icon: CalendarDays, badge: 'NEW' },
    ],
  },
  {
    label: '경쟁',
    defaultOpen: true,
    items: [
      { name: '경쟁사', href: '/dashboard/competitors', icon: Users },
    ],
  },
  {
    label: '관리',
    defaultOpen: false,
    items: [
      { name: '결제/구독', href: '/dashboard/billing', icon: CreditCard },
      { name: '설정', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

const getPathname = (href: string) => href.split('?')[0];

const PLAN_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  ENTERPRISE: { label: 'Enterprise', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  PRO: { label: 'Pro', color: 'text-purple-300', bg: 'bg-purple-500/10' },
  STANDARD: { label: 'Standard', color: 'text-brand-300', bg: 'bg-brand-500/10' },
  STARTER: { label: 'Starter', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  FREE: { label: 'Free', color: 'text-slate-400', bg: 'bg-slate-500/10' },
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      const hasActive = group.items.some((item) => pathname === getPathname(item.href));
      initial[group.label] = hasActive || !!group.defaultOpen;
    });
    return initial;
  });

  useEffect(() => {
    setMobileOpen(false);
    setOpenGroups((prev) => {
      const next = { ...prev };
      navGroups.forEach((group) => {
        if (group.items.some((item) => pathname === getPathname(item.href))) {
          next[group.label] = true;
        }
      });
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const planType = user?.hospital?.planType || 'FREE';
  const planStyle = PLAN_STYLES[planType] || PLAN_STYLES.FREE;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* ─── Logo ─── */}
      <div className="flex items-center justify-between h-16 px-5">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
            <Sparkles className="h-5 w-5 text-white" />
            <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h1 className="font-bold text-white text-[15px] tracking-tight">Patient Signal</h1>
            <p className="text-[10px] text-slate-400 font-medium">AI Search Visibility</p>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5 text-slate-400" />
        </button>
      </div>

      {/* ─── Hospital Card ─── */}
      {user?.hospital && (
        <div className="px-4 pb-3 pt-1">
          <div className="p-3 rounded-xl bg-white/[0.06] border border-white/[0.06] hover:bg-white/[0.08] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 border border-indigo-500/10">
                <Building2 className="h-4 w-4 text-indigo-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-white truncate">
                  {user.hospital.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {(planType === 'ENTERPRISE' || planType === 'PRO') && (
                    <Crown className="h-3 w-3 text-amber-400" />
                  )}
                  <span className={`text-[11px] font-semibold ${planStyle.color}`}>
                    {planStyle.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {(!planType || planType === 'FREE' || planType === 'STARTER') && (
            <Link
              href="/dashboard/billing"
              className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 text-xs font-semibold text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-all border border-indigo-500/10 hover:border-indigo-500/20"
            >
              <Sparkles className="h-3 w-3" />
              업그레이드
            </Link>
          )}
        </div>
      )}

      {/* ─── Navigation ─── */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-0.5">
        {navGroups.map((group) => {
          const isGroupOpen = openGroups[group.label] ?? true;

          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex items-center justify-between w-full px-3 py-2 group/header"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {group.label}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 text-slate-600 transition-transform duration-200',
                    isGroupOpen ? 'rotate-0' : '-rotate-90'
                  )}
                />
              </button>

              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  isGroupOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                )}
              >
                {group.items.map((item) => {
                  const isActive = pathname === getPathname(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group/item relative',
                        isActive
                          ? 'bg-white/[0.12] text-white shadow-sm'
                          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                      )}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-indigo-400 rounded-r-full" />
                      )}
                      <item.icon
                        className={cn(
                          'h-[17px] w-[17px] flex-shrink-0 transition-colors',
                          isActive ? 'text-indigo-400' : 'text-slate-500 group-hover/item:text-slate-400'
                        )}
                      />
                      <span className="flex-1">{item.name}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-indigo-500/80 text-white leading-none animate-pulse-soft">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ─── User Info ─── */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 ring-2 ring-white/[0.08]">
            <span className="text-sm font-semibold text-white">
              {user?.name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 rounded-lg transition-all"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ─── Mobile Top Bar ─── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass-strong h-14 flex items-center px-4 border-b border-slate-200/50">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Menu className="h-5 w-5 text-slate-700" />
        </button>
        <div className="flex items-center gap-2.5 ml-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-sm tracking-tight">Patient Signal</span>
        </div>
      </div>

      {/* ─── Mobile Overlay ─── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Mobile Sidebar ─── */}
      <div
        className={cn(
          'lg:hidden fixed top-0 left-0 z-50 w-72 h-full glass-sidebar shadow-2xl transform transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </div>

      {/* ─── Desktop Sidebar ─── */}
      <div className="hidden lg:flex lg:flex-col lg:w-[272px] glass-sidebar h-screen sticky top-0">
        {sidebarContent}
      </div>
    </>
  );
}
