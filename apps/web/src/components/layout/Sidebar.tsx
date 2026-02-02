'use client';

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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

const navigation = [
  { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { name: '질문 관리', href: '/dashboard/prompts', icon: MessageSquare },
  { name: 'AI 응답', href: '/dashboard/responses', icon: Sparkles },
  { name: '분석 리포트', href: '/dashboard/analytics', icon: BarChart3 },
  { name: '경쟁사', href: '/dashboard/competitors', icon: Users },
  { name: '설정', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200 h-screen">
      {/* 로고 */}
      <div className="flex items-center gap-3 h-16 px-6 border-b border-gray-200">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900">Patient Signal</h1>
          <p className="text-xs text-gray-500">AI 검색 가시성 추적</p>
        </div>
      </div>

      {/* 병원 정보 */}
      {user?.hospital && (
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-gray-900 truncate">
                {user.hospital.name}
              </p>
              <p className="text-xs text-gray-500">
                {user.hospital.planType} 플랜
              </p>
            </div>
          </div>
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
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
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
    </div>
  );
}
