'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import AuthShell from '@/components/public/AuthShell';

// Hub SSO uses the active Signal API. Google accounts authenticate through Hub as well.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.patientsignal.kr/api';
const HUB_SSO_START_URL = API_BASE_URL + '/auth/hub';

const ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed: 'Google 로그인에 실패했습니다. 다시 시도해주세요.',
  token_exchange_failed: 'Google 인증 토큰 교환에 실패했습니다. 다시 시도해주세요.',
  email_not_verified: 'Google 이메일이 인증되지 않았습니다.',
  missing_code: 'Google 인증 코드가 누락되었습니다.',
  missing_data: '인증 데이터가 누락되었습니다. 다시 시도해주세요.',
  parse_error: '인증 데이터 처리 중 오류가 발생했습니다.',
  access_denied: 'Google 로그인이 취소되었습니다.',
  hub_sso_not_configured: 'Patient Hub 연동이 아직 활성화되지 않았습니다. 관리자에게 문의해주세요.',
  hub_sso_failed: 'Patient Hub 로그인에 실패했습니다. 다시 시도해주세요.',
};

function LoginForm() {
  const { setAuth } = useAuthStore();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const detailParam = searchParams.get('detail');
    if (errorParam) {
      const msg = ERROR_MESSAGES[errorParam] || '로그인 오류: ' + errorParam;
      setError(detailParam ? msg + ' (' + detailParam + ')' : msg);
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await authApi.login(formData);
      setAuth(data.user, data.accessToken, data.refreshToken);
      window.location.href = data.user.hospitalId ? '/dashboard' : '/onboarding';
    } catch (err: any) {
      setError(err.response?.data?.message || '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleHubLogin = () => {
    window.location.href = HUB_SSO_START_URL;
  };

  return (
    <AuthShell mode="login">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#36765A]">Welcome back</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">다시, 시그널.</h1>
            <p className="mt-2 text-sm leading-6 text-[#637167]">Patient Signal에 로그인해 우리 병원의 AI 답변을 확인하세요.</p>

            <button type="button" onClick={handleHubLogin} className="mt-8 flex h-12 w-full items-center justify-center gap-2.5 rounded-none bg-[#15231B] px-4 text-sm font-semibold text-white hover:bg-[#36765A]">
              <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-white/20 text-[10px] font-bold">PH</span>
              Patient Hub 계정으로 로그인 <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-2.5 text-center text-xs text-[#778378]">Google 계정도 Patient Hub에서 로그인할 수 있습니다.</p>

            <div className="my-7 flex items-center gap-3 text-xs font-medium text-[#778378]"><span className="h-px flex-1 bg-[#DEE4D9]" />이메일로 로그인<span className="h-px flex-1 bg-[#DEE4D9]" /></div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div role="alert" className="rounded-none border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-semibold text-[#15231B]">이메일</label>
                <Input id="login-email" type="email" placeholder="doctor@clinic.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-semibold text-[#15231B]">비밀번호</label>
                <div className="relative">
                  <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="비밀번호 입력" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required autoComplete="current-password" />
                  <button type="button" aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#778378] hover:text-[#15231B]" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="text-right"><Link href="/forgot-password" className="text-xs font-semibold text-[#637167] hover:text-[#36765A]">비밀번호를 잊으셨나요?</Link></div>
              <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-none border border-[#DEE4D9] bg-white text-sm font-semibold text-[#15231B] hover:bg-[#F4F5EF] disabled:opacity-50">
                <LockKeyhole className="h-4 w-4" />{loading ? '로그인 중...' : '이메일로 로그인'}
              </button>
            </form>
            <div className="mt-7 border-t border-[#DEE4D9] pt-6 text-center text-sm text-[#637167]">계정이 없으신가요? <Link href="/register" className="font-semibold text-[#36765A] hover:underline">무료 회원가입</Link></div>

    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#F4F5EF]"><span className="h-7 w-7 animate-spin rounded-full border-2 border-[#DEE4D9] border-t-[#36765A]" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
