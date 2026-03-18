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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

const navigation = [
  { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { name: '주간 리포트', href: '/dashboard/report', icon: FileText },
  { name: '질문 관리', href: '/dashboard/prompts', icon: MessageSquare },
  { name: 'AI 응답', href: '/dashboard/responses', icon: Sparkles },
  { name: 'AI 인사이트', href: '/dashboard/insights', icon: Lightbulb },
  { name: 'ABHS 분석', href: '/dashboard/analytics', icon: BarChart3 },
  { name: '경쟁사', href: '/dashboard/competitors', icon: Users },
  { name: '결제/구독', href: '/dashboard/billing', icon: CreditCard },
  { name: '설정', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  // 페이지 이동 시 모바일 메뉴 자동 닫기
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // 모바일 메뉴 열렸을 때 body 스크롤 방지
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const sidebarContent = (
    <>
      {/* 로고 */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Patient Signal</h1>
            <p className="text-xs text-gray-500">AI 검색 가시성 추적</p>
          </div>
        </div>
        {/* 모바일 닫기 버튼 */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* 병원 정보 */}
      {user?.hospital && (
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-gray-900 truncate">
                {user.hospital.name}
              </p>
              <p className={`text-xs font-medium ${
                user.hospital.planType === 'PRO' ? 'text-purple-600' :
                user.hospital.planType === 'STANDARD' ? 'text-blue-600' :
                'text-gray-500'
              }`}>
                {user.hospital.planType === 'PRO' ? 'Pro 플랜' :
                 user.hospital.planType === 'STANDARD' ? 'Standard 플랜' :
                 user.hospital.planType === 'ENTERPRISE' ? 'Enterprise 플랜' :
                 'Starter 플랜'}
              </p>
            </div>
          </div>
          {(!user.hospital.planType || user.hospital.planType === 'STARTER') && (
            <Link
              href="/dashboard/billing"
              className="mt-2 flex items-center justify-center gap-1 w-full py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              업그레이드
            </Link>
          )}
        </div>
      )}

      {/* 네비게이션 */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'text-blue-600' : 'text-gray-400')} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* 사용자 정보 */}
      <div className="px-4 py-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-gray-600">
              {user?.name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* 모바일 햄버거 버튼 (top bar) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 h-14 flex items-center px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Menu className="h-6 w-6 text-gray-700" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Patient Signal</span>
        </div>
      </div>

      {/* 모바일 오버레이 */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 모바일 사이드바 (슬라이드) */}
      <div
        className={cn(
          'lg:hidden fixed top-0 left-0 z-50 w-72 h-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </div>

      {/* 데스크톱 사이드바 */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
        {sidebarContent}
      </div>
    </>
  );
}
