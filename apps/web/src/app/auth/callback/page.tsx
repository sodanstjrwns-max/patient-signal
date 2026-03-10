'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

function CallbackHandler() {
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const userStr = searchParams.get('user');
    const redirect = searchParams.get('redirect') || '/dashboard';
    const error = searchParams.get('error');

    console.log('[Auth Callback] Params:', { 
      hasAccessToken: !!accessToken, 
      hasRefreshToken: !!refreshToken, 
      hasUser: !!userStr,
      redirect,
      error 
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error);
      setTimeout(() => {
        window.location.href = `/login?error=${error}`;
      }, 1000);
      return;
    }

    if (accessToken && refreshToken && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        console.log('[Auth Callback] User parsed:', user.email);
        
        // localStorage에 직접 저장 (Zustand persist보다 확실하게)
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
          },
          version: 0,
        }));
        
        // Zustand store도 업데이트
        setAuth(user, accessToken, refreshToken);
        
        setStatus('success');
        console.log('[Auth Callback] Auth saved, redirecting to:', redirect);
        
        // 저장 완료 후 리다이렉트 (약간의 딜레이)
        setTimeout(() => {
          window.location.href = redirect;
        }, 500);
        
      } catch (e) {
        console.error('[Auth Callback] Parse error:', e);
        setStatus('error');
        setErrorMessage('데이터 파싱 오류');
        setTimeout(() => {
          window.location.href = '/login?error=parse_error';
        }, 1000);
      }
    } else {
      console.error('[Auth Callback] Missing data');
      setStatus('error');
      setErrorMessage('필수 데이터 누락');
      setTimeout(() => {
        window.location.href = '/login?error=missing_data';
      }, 1000);
    }
  }, [searchParams, setAuth]);

  return (
    <div className="text-center">
      <div className={`rounded-full h-12 w-12 mx-auto mb-4 ${
        status === 'error' 
          ? 'bg-red-100 flex items-center justify-center' 
          : status === 'success'
          ? 'bg-green-100 flex items-center justify-center'
          : 'animate-spin border-b-2 border-blue-600'
      }`}>
        {status === 'error' && <span className="text-red-600 text-xl">✕</span>}
        {status === 'success' && <span className="text-green-600 text-xl">✓</span>}
      </div>
      <p className="text-gray-600">
        {status === 'processing' && '로그인 처리 중...'}
        {status === 'success' && '로그인 성공! 이동 중...'}
        {status === 'error' && `오류: ${errorMessage}`}
      </p>
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
