"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  ChevronDown,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { SignalMark } from "@/components/public/PublicBrand";

type NavItem = { label: string; href: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "워크스페이스",
    items: [
      { label: "한눈에 보기", href: "/dashboard", icon: LayoutDashboard },
      { label: "병원 프로필", href: "/dashboard/settings", icon: Building2 },
      { label: "핵심 질문", href: "/dashboard/prompts", icon: FileQuestion },
      {
        label: "질문별 AI 답변",
        href: "/dashboard/responses",
        icon: MessageSquareText,
      },
      { label: "경쟁 병원", href: "/dashboard/competitors", icon: Users },
    ],
  },
  {
    label: "분석",
    items: [
      { label: "ABHS 리포트", href: "/dashboard/analytics", icon: Activity },
      { label: "기회 분석", href: "/dashboard/opportunities", icon: Target },
      { label: "성장 진단", href: "/dashboard/growth", icon: Gauge },
      { label: "AI 인사이트", href: "/dashboard/insights", icon: Lightbulb },
      {
        label: "인용 역분석",
        href: "/dashboard/citation-analysis",
        icon: Search,
      },
      {
        label: "카테고리 분석",
        href: "/dashboard/category-analysis",
        icon: Filter,
      },
      {
        label: "경쟁 추이",
        href: "/dashboard/competitors/trending",
        icon: ScanSearch,
      },
      { label: "리포트", href: "/dashboard/report", icon: BookOpen },
    ],
  },
  {
    label: "도구",
    items: [
      {
        label: "실시간 질문",
        href: "/dashboard/live-query",
        icon: MessageSquareText,
      },
      { label: "환자 퍼널", href: "/dashboard/funnel", icon: Filter },
      {
        label: "콘텐츠 캘린더",
        href: "/dashboard/content-calendar",
        icon: CalendarDays,
      },
      { label: "API 연동", href: "/dashboard/api-keys", icon: Key },
      { label: "결제 및 구독", href: "/dashboard/billing", icon: CreditCard },
      { label: "이용 가이드", href: "/dashboard/guide", icon: BookOpen },
    ],
  },
];

const planLabels: Record<string, string> = {
  FREE: "Free",
  STARTER: "S",
  STANDARD: "M",
  PRO: "L",
  ENTERPRISE: "Enterprise",
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key === "Tab") {
        const items = drawerRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])');
        if (!items?.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = prior;
      document.removeEventListener("keydown", close);
      menuRef.current?.focus();
    };
  }, [mobileOpen]);
  const plan = planLabels[user?.hospital?.planType || "FREE"] || "Free";
  const content = (
    <div className="flex h-full flex-col text-[#b9b8c9]">
      <div className="flex h-[88px] shrink-0 items-center justify-between px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5"
          aria-label="Patient Signal 홈"
        >
          <SignalMark className="!h-8 !w-8" />
          <span className="text-[17px] font-semibold tracking-[-0.06em] text-white">patient<span className="font-normal">signal</span></span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="메뉴 닫기"
          className="p-2 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>

      </div>
      <Link
        href="/dashboard/settings"
        className="signal-interactive mx-4 mb-7 flex items-center gap-3 rounded-xl border border-[#5b4dff]/30 bg-[#5b4dff]/10 px-3 py-3.5 hover:border-[#5b4dff]/60 hover:bg-[#5b4dff]/20"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#353143] text-[#ff6b3d]">
          <Building2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs font-semibold text-[#ededf6]">
            {user?.hospital?.name || "병원 프로필"}
          </strong>
          <span className="mt-1 block text-[10px] text-[#9997ad]">
            {plan} PLAN / WORKSPACE
          </span>
        </span>
        <ChevronRight className="h-3 w-3 shrink-0" />
      </Link>
      <nav
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-5"
        aria-label="시그널 메뉴"
      >
        {navGroups.map((group, idx) => {
          const open =
            idx === 0 ||
            (openGroups[group.label] ??
              group.items.some((item) => item.href === pathname));
          return (
            <section
              key={group.label}
              className={idx ? "mt-6 border-t border-white/10 pt-4" : ""}
            >
              {idx === 0 ? (
                <h2 className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[.2em] text-[#777489]">
                  WORKSPACE
                </h2>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [group.label]: !open }))
                  }
                  aria-expanded={open}
                  className="mb-2 flex w-full items-center justify-between px-3 py-1 text-[11px] font-medium text-[#9997ad] hover:text-white"
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>
              )}
              {open && (
                <div className="signal-enter space-y-1">
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "signal-nav-link group flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px]",
                          active
                            ? "bg-[#ff6b3d] font-semibold text-[#111118]"
                            : "text-[#b9b8c9] hover:bg-white/[.06] hover:text-white",
                        )}
                      >
                        <item.icon
                          className="h-[17px] w-[17px] shrink-0"
                          strokeWidth={1.7}
                        />
                        <span className="flex-1">{item.label}</span>
                        {active && <ArrowUpRight className="h-3.5 w-3.5" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </nav>
      <div className="shrink-0 px-4 pb-5 pt-3">
        <Link
          href="/dashboard/billing"
          className="mb-5 flex items-center justify-between border-b border-white/10 px-2 pb-4 text-[11px] text-[#b9b8c9] hover:text-[#ff6b3d]"
        >
          <span>측정 범위 확장하기</span>
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 text-xs text-[#ff6b3d]">
            {user?.name?.charAt(0) || "U"}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs font-medium text-[#ededf6]">
              {user?.name}
            </strong>
            <span className="block truncate text-[10px] text-[#9997ad]">
              {user?.email}
            </span>
          </span>
          <button
            type="button"
            onClick={logout}
            aria-label="로그아웃"
            className="rounded p-2 hover:bg-white/10"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-[#101016] px-4 text-white lg:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-[17px] font-semibold tracking-[-.06em]"
        >
          <SignalMark className="!h-7 !w-7" /><span>patient<span className="font-normal">signal</span></span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="메뉴 열기"
          aria-expanded={mobileOpen}
          ref={menuRef}
          className="p-2"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {mobileOpen && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setMobileOpen(false)}
          className="signal-route-enter fixed inset-0 z-50 bg-[#101016]/65 backdrop-blur-sm lg:hidden"
        />
      )}
      <>
        {mobileOpen && (
          <aside ref={drawerRef} role="dialog" aria-modal="true" aria-label="시그널 탐색" className="signal-drawer-enter fixed inset-y-0 left-0 z-50 w-[272px] border-r border-white/10 bg-[#101016] lg:hidden">
            {content}
          </aside>
        )}
      </>
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 border-r border-white/10 bg-[#101016] lg:block">
        {content}
      </aside>
    </>
  );
}
