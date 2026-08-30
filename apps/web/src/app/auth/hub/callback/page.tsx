'use client';

// Patient Hub SSO 콜백 — 허브(hub.patientfunnel.kr)가 ?sso_token=<JWT>로
// 리다이렉트하면 API(POST /api/auth/hub/callback)에 검증을 위임하고,
// 정상 로그인과 동일하게 토큰을 저장한 뒤 대시보드/온보딩으로 이동한다.

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

function HubCallbackHandler() {
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const requested = useRef(false);

  useEffect(() => {
    // StrictMode/재렌더로 인한 중복 호출 방지 (sso_token은 1회용·120초 만료)
    if (requested.current) return;
    requested.current = true;

    const ssoToken = searchParams.get('sso_token');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMessage(`Patient Hub 인증이 거부되었습니다: ${error}`);
      return;
    }

    if (!ssoToken) {
      setStatus('error');
      setErrorMessage('SSO 토큰이 누락되었습니다. 다시 시도해주세요.');
      return;
    }

    (async () => {
      try {
        const { data } = await api.post('/auth/hub/callback', { ssoToken });
        const { user, accessToken, refreshToken, redirect, pendingHospitalName } = data;

        // 병원 미보유 유저: 허브 병원명을 보관 → 온보딩 병원명 프리필 (생성 완료 시 제거)
        if (pendingHospitalName) {
          try {
            localStorage.setItem('hub_pending_hospital_name', pendingHospitalName);
          } catch {}
        }

        // localStorage에 직접 저장 (기존 /auth/callback과 동일한 방식)
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem(
          'auth-storage',
          JSON.stringify({
            state: { user, accessToken, refreshToken, isAuthenticated: true },
            version: 0,
          }),
        );
        setAuth(user, accessToken, refreshToken);

        setStatus('success');
        setTimeout(() => {
          window.location.href = redirect || '/dashboard';
        }, 500);
      } catch (err: any) {
        const status = err?.response?.status;
        let msg =
          err?.response?.data?.message ||
          err?.response?.data?.error?.message ||
          'Patient Hub 로그인에 실패했습니다.';
        if (status === 503) {
          msg = 'Patient Hub 연동이 아직 활성화되지 않았습니다. 관리자에게 문의해주세요.';
        } else if (status === 401) {
          msg = 'SSO 토큰이 유효하지 않거나 만료되었습니다. 다시 로그인해주세요.';
        }
        setStatus('error');
        setErrorMessage(msg);
      }
    })();
  }, [searchParams, setAuth]);

  if (status === 'error') {
    return (
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
          <div className="rounded-full h-16 w-16 bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-3xl">✕</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Patient Hub 로그인 실패</h2>
          <p className="text-red-600 mb-6">{errorMessage}</p>
          <a
            href="/login"
            className="inline-block w-full py-3 px-6 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            로그인 페이지로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div
        className={`rounded-full h-12 w-12 mx-auto mb-4 ${
          status === 'success'
            ? 'bg-green-100 flex items-center justify-center'
            : 'animate-spin border-b-2 border-brand-600'
        }`}
      >
        {status === 'success' && <span className="text-green-600 text-xl">✓</span>}
      </div>
      <p className="text-slate-600">
        {status === 'processing' && 'Patient Hub 계정으로 로그인 중...'}
        {status === 'success' && '로그인 성공! 이동 중...'}
      </p>
    </div>
  );
}

export default function HubCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Suspense
        fallback={
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
            <p className="text-slate-600">로딩 중...</p>
          </div>
        }
      >
        <HubCallbackHandler />
      </Suspense>
    </div>
  );
}
