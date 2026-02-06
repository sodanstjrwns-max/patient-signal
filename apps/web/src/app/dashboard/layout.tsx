'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isHydrated, setIsHydrated] = useState(false);
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  // Zustand hydration 대기
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // 인증 체크 후 리다이렉트
  useEffect(() => {
    if (!isHydrated) return;

    console.log('[Dashboard] Auth check:', { isAuthenticated, user: user?.email, hospitalId: user?.hospitalId });

    if (!isAuthenticated) {
      console.log('[Dashboard] Not authenticated, redirecting to login');
      router.push('/login');
      return;
    }

    if (!user?.hospitalId) {
      console.log('[Dashboard] No hospitalId, redirecting to onboarding');
      router.push('/onboarding');
      return;
    }
  }, [isHydrated, isAuthenticated, user, router]);

  // Hydration 전이거나 인증 체크 중
  if (!isHydrated || !isAuthenticated || !user?.hospitalId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">
            {!isHydrated ? '로딩 중...' : 
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
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
