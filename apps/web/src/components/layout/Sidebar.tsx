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
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const groupButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setMobileOpen(false);
    setExpandedGroup(null);
  }, [pathname]);
  useEffect(() => {
    if (expandedGroup === null) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedGroup(null);
        groupButtonRef.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        !panelRef.current?.contains(event.target as Node) &&
        !groupButtonRef.current?.contains(event.target as Node)
      )
        setExpandedGroup(null);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [expandedGroup]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const items = drawerRef.current?.querySelectorAll<HTMLElement>(
        "a[href],button:not([disabled])",
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keys);
      menuRef.current?.focus();
    };
  }, [mobileOpen]);
  const railLabels: Record<string, string> = {
    "/dashboard": "개요",
    "/dashboard/settings": "병원 소개",
    "/dashboard/prompts": "질문",
    "/dashboard/responses": "AI 답변",
    "/dashboard/competitors": "경쟁 병원",
  };
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/15 bg-[#141512] px-4 text-[#f1f1eb] lg:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          aria-label="Patient Signal 홈"
        >
          <SignalMark className="!h-7 !w-7" />
          <span className="text-xl font-black tracking-[-.06em]">
            signal<span className="text-[#ff5d2a]">.</span>
          </span>
        </Link>
        <button
          ref={menuRef}
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="메뉴 열기"
          aria-expanded={mobileOpen}
          className="p-2"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <aside className="sticky top-0 z-30 hidden h-screen w-[88px] shrink-0 flex-col border-r border-white/15 bg-[#141512] text-[#bec3af] lg:flex">
        <Link
          href="/dashboard"
          className="flex h-[76px] shrink-0 items-center justify-center border-b border-white/15"
          aria-label="Patient Signal 홈"
        >
          <SignalMark className="!h-10 !w-10" />
        </Link>
        <nav
          aria-label="시그널 메뉴"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-5"
        >
          {navGroups[0].items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn(
                "desk-rail-item flex min-h-[68px] flex-col items-center justify-center gap-2 text-[10px] font-semibold",
                pathname === item.href
                  ? "bg-[#d0ff43] text-[#141512]"
                  : "hover:bg-white/10 hover:text-[#f1f1eb]",
              )}
            >
              <item.icon className="h-5 w-5" strokeWidth={1.6} />
              <span>{railLabels[item.href]}</span>
            </Link>
          ))}
          <div className="!mt-5 border-t border-white/15 pt-4">
            {navGroups.slice(1).map((group, i) => {
              const active = group.items.some((item) => item.href === pathname);
              const Icon = i === 0 ? Activity : Filter;
              return (
                <button
                  key={group.label}
                  type="button"
                  aria-expanded={expandedGroup === i + 1}
                  aria-controls="signal-extra-nav"
                  onClick={(event) => {
                    groupButtonRef.current = event.currentTarget;
                    setExpandedGroup(expandedGroup === i + 1 ? null : i + 1);
                  }}
                  className={cn(
                    "desk-rail-item flex min-h-[64px] w-full flex-col items-center justify-center gap-2 text-[10px] font-medium",
                    active || expandedGroup === i + 1
                      ? "bg-white/10 text-[#d0ff43]"
                      : "hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.6} />
                  <span>{group.label} +</span>
                </button>
              );
            })}
          </div>
        </nav>
        <Link
          href="/dashboard/billing"
          className="flex min-h-14 shrink-0 items-center justify-center border-t border-white/15 text-[10px] font-bold text-[#d0ff43] hover:bg-white/10"
          aria-label="결제 및 구독"
        >
          {planLabels[user?.hospital?.planType || "FREE"] || "Free"} PLAN{" "}
          <ArrowUpRight className="ml-1 h-3 w-3" />
        </Link>
        <button
          type="button"
          onClick={logout}
          aria-label="로그아웃"
          className="flex min-h-14 shrink-0 items-center justify-center border-t border-white/15 hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
        </button>
        {expandedGroup !== null && (
          <nav
            ref={panelRef}
            id="signal-extra-nav"
            aria-label={`${navGroups[expandedGroup].label} 메뉴`}
            className="signal-panel-enter absolute bottom-0 left-full top-0 w-[256px] border-r border-white/15 bg-[#20231b] px-4 py-6 text-[#f1f1eb] shadow-xl"
          >
            <div className="mb-6 flex items-center justify-between border-b border-white/15 pb-5">
              <strong className="text-xl font-bold">
                {navGroups[expandedGroup].label}
              </strong>
              <button
                aria-label="추가 메뉴 닫기"
                onClick={() => {
                  setExpandedGroup(null);
                  groupButtonRef.current?.focus();
                }}
                className="p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {navGroups[expandedGroup].items.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 border-b border-white/10 px-2 py-4 text-sm transition-colors",
                  pathname === item.href
                    ? "bg-[#d0ff43] text-[#141512]"
                    : "hover:bg-white/10",
                )}
              >
                <span className="font-mono text-[10px] opacity-50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1">{item.label}</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            ))}
          </nav>
        )}
      </aside>
      {mobileOpen && (
        <>
          <button
            aria-label="메뉴 닫기"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-50 bg-black/65 lg:hidden"
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="시그널 탐색"
            className="signal-drawer-enter fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col bg-[#141512] text-[#f1f1eb] lg:hidden"
          >
            <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/15 px-5">
              <Link
                href="/dashboard"
                aria-label="Patient Signal 홈"
                className="text-3xl font-black tracking-[-.07em]"
              >
                signal<span className="text-[#ff5d2a]">.</span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="메뉴 닫기"
                className="p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Link
              href="/dashboard/settings"
              className="border-b border-white/15 bg-[#d0ff43] px-5 py-4 text-sm font-bold text-[#141512]"
            >
              {user?.hospital?.name || "병원 소개"}
            </Link>
            <nav
              aria-label="시그널 메뉴"
              className="flex-1 overflow-y-auto px-5 py-4"
            >
              {navGroups.map((group, index) => (
                <section key={group.label} className={index ? "mt-6" : ""}>
                  <p className="mb-2 font-mono text-[10px] text-[#989b8d]">
                    0{index + 1} / {group.label}
                  </p>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={pathname === item.href ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 border-b border-white/10 px-2 py-3 text-sm",
                        pathname === item.href
                          ? "text-[#d0ff43]"
                          : "text-[#d7dacd]",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </section>
              ))}
            </nav>
            <button
              type="button"
              onClick={logout}
              className="flex items-center justify-between border-t border-white/15 px-5 py-4 text-xs"
            >
              로그아웃
              <LogOut className="h-4 w-4" />
            </button>
          </aside>
        </>
      )}
    </>
  );
}
