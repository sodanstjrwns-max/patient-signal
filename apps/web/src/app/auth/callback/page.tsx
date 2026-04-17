'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

const ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed: 'Google 인증 과정에서 오류가 발생했습니다.',
  token_exchange_failed: 'Google 인증 토큰 교환에 실패했습니다.',
  email_not_verified: 'Google 이메일이 인증되지 않았습니다.',
  missing_code: 'Google 인증 코드가 누락되었습니다.',
  missing_data: '인증 데이터가 누락되었습니다.',
  parse_error: '인증 데이터 처리 중 오류가 발생했습니다.',
  access_denied: 'Google 로그인이 취소되었습니다.',
};

function CallbackHandler() {
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

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

    // 디버그 정보 수집
    setDebugInfo(JSON.stringify({
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      hasUser: !!userStr,
      redirect,
      error,
      url: window.location.href.substring(0, 200),
    }, null, 2));

    if (error) {
      setStatus('error');
      setErrorMessage(ERROR_MESSAGES[error] || error);
      return; // 에러 시 페이지에 머물면서 에러 표시 (자동 리다이렉트 하지 않음)
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
        
        // 저장 완료 후 리다이렉트
        setTimeout(() => {
          window.location.href = redirect;
        }, 500);
        
      } catch (e) {
        console.error('[Auth Callback] Parse error:', e);
        setStatus('error');
        setErrorMessage('인증 데이터 파싱 오류: ' + (e instanceof Error ? e.message : String(e)));
      }
    } else {
      console.error('[Auth Callback] Missing data');
      setStatus('error');
      setErrorMessage('필수 인증 데이터가 누락되었습니다.');
    }
  }, [searchParams, setAuth]);

  if (status === 'error') {
    return (
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
          <div className="rounded-full h-16 w-16 bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-3xl">✕</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">로그인 실패</h2>
          <p className="text-red-600 mb-6">{errorMessage}</p>
          <a
            href="/login"
            className="inline-block w-full py-3 px-6 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            로그인 페이지로 돌아가기
          </a>
          <details className="mt-4 text-left">
            <summary className="text-xs text-slate-400 cursor-pointer">디버그 정보</summary>
            <pre className="mt-2 text-xs bg-slate-50 p-3 rounded overflow-auto max-h-40">{debugInfo}</pre>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className={`rounded-full h-12 w-12 mx-auto mb-4 ${
        status === 'success'
        ? 'bg-green-100 flex items-center justify-center'
        : 'animate-spin border-b-2 border-brand-600'
      }`}>
        {status === 'success' && <span className="text-green-600 text-xl">✓</span>}
      </div>
      <p className="text-slate-600">
        {status === 'processing' && '로그인 처리 중...'}
        {status === 'success' && '로그인 성공! 이동 중...'}
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Suspense fallback={
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-slate-600">로딩 중...</p>
        </div>
      }>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
