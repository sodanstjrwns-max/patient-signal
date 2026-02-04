'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

function CallbackHandler() {
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const userStr = searchParams.get('user');
    const redirect = searchParams.get('redirect') || '/dashboard';
    const error = searchParams.get('error');

    if (error) {
      window.location.href = `/login?error=${error}`;
      return;
    }

    if (accessToken && refreshToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        setAuth(user, accessToken, refreshToken);
        window.location.href = redirect;
      } catch (e) {
        window.location.href = '/login?error=parse_error';
      }
    } else {
      window.location.href = '/login?error=missing_data';
    }
  }, [searchParams, setAuth]);

  return (
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">로그인 처리 중...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      }>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
