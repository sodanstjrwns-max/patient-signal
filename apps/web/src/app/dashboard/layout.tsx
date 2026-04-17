'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TrialBanner } from '@/components/dashboard/TrialBanner';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { hospitalApi } from '@/lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user, updateUser, _hasHydrated } = useAuthStore();
  const router = useRouter();

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

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !user?.hospitalId) return;

    hospitalApi.get(user.hospitalId).then(({ data }) => {
      if (data) {
        updateUser({ hospital: data });
      }
    }).catch(() => {});
  }, [_hasHydrated, isAuthenticated, user?.hospitalId]);

  if (!_hasHydrated || !isAuthenticated || !user?.hospitalId) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-brand-600 mx-auto mb-4"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            {!_hasHydrated ? '로딩 중...' : 
             !isAuthenticated ? '로그인 확인 중...' : 
             '병원 정보 확인 중...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-mesh">
      <Sidebar />
      {/* Main content - glassmorphism backdrop */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0 min-h-screen relative">
        {/* Subtle grid pattern behind glass cards */}
        <div className="absolute inset-0 grid-pattern pointer-events-none" />
        <div className="relative z-10">
          <TrialBanner />
          <div className="animate-fade-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
