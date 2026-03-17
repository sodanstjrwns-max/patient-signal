'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user, _hasHydrated } = useAuthStore();
  const router = useRouter();

  // 인증 체크 후 리다이렉트 - Zustand persist hydration 완료 후에만 실행
  useEffect(() => {
    if (!_hasHydrated) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (!user?.hospitalId) {
      router.push('/onboarding');
      return;
    }
  }, [_hasHydrated, isAuthenticated, user, router]);

  // Zustand persist hydration 완료 전이거나 인증 체크 중
  if (!_hasHydrated || !isAuthenticated || !user?.hospitalId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">
            {!_hasHydrated ? '로딩 중...' : 
             !isAuthenticated ? '로그인 확인 중...' : 
             '병원 정보 확인 중...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* pt-14: 모바일 top bar 높이만큼 패딩, lg:pt-0: 데스크톱은 패딩 없음 */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
