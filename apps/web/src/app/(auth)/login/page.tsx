'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, MessageSquareText, ScanSearch } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

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
    <div className="grid min-h-screen bg-[#f6f7f9] text-[#17212e] lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#17212e] p-10 text-white lg:flex xl:p-16">
        <div className="pointer-events-none absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'linear-gradient(#dce7ff 1px, transparent 1px), linear-gradient(90deg, #dce7ff 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-3 text-lg font-bold tracking-[-0.04em]">
            <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#285cf4]"><ScanSearch className="h-5 w-5" /></span>
            Patient Signal
          </Link>
          <div className="mt-24 max-w-lg">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#a9bcff]">Your AI visibility workspace</span>
            <h1 className="mt-4 text-4xl font-bold leading-[1.16] tracking-[-0.06em] xl:text-5xl">질문에서 답변까지,<br />한눈에 확인하세요.</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-[#abb8c9]">우리 병원에 중요한 질문을 고르고, AI가 실제로 남긴 답변을 확인하는 작업 공간입니다.</p>
          </div>
          <div className="mt-12 max-w-md rounded-[18px] border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#285cf4]"><MessageSquareText className="h-4 w-4" /></span>
              <div><p className="text-sm font-semibold">질문 · 답변 · 경쟁 병원</p><p className="text-xs text-[#abb8c9]">필요한 근거를 한곳에</p></div>
            </div>
            <div className="mt-5 space-y-2.5">
              <div className="h-2.5 w-full rounded-full bg-white/20" />
              <div className="h-2.5 w-[83%] rounded-full bg-white/15" />
              <div className="h-2.5 w-[61%] rounded-full bg-white/10" />
            </div>
          </div>
        </div>
        <p className="relative text-xs text-[#7e8da1]">Patient Signal by 페이션트퍼널</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-12">
        <div className="w-full max-w-[440px]">
          <Link href="/" className="mb-10 inline-flex items-center gap-3 text-[17px] font-bold tracking-[-0.04em] lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#285cf4] text-white"><ScanSearch className="h-5 w-5" /></span>
            Patient Signal
          </Link>
          <div className="rounded-[20px] border border-[#e7ecf2] bg-white p-6 shadow-[0_8px_34px_rgba(18,33,54,0.045)] sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#285cf4]">Welcome back</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.05em]">다시 만나 반갑습니다</h2>
            <p className="mt-2 text-sm leading-6 text-[#69788b]">Patient Signal에 로그인해 우리 병원의 AI 답변을 확인하세요.</p>

            <button type="button" onClick={handleHubLogin} className="mt-8 flex h-12 w-full items-center justify-center gap-2.5 rounded-[11px] bg-[#285cf4] px-4 text-sm font-semibold text-white hover:bg-[#204bce]">
              <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-white/20 text-[10px] font-bold">PH</span>
              Patient Hub 계정으로 로그인 <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-2.5 text-center text-xs text-[#8390a0]">Google 계정도 Patient Hub에서 로그인할 수 있습니다.</p>

            <div className="my-7 flex items-center gap-3 text-xs font-medium text-[#9aa6b5]"><span className="h-px flex-1 bg-[#e7ecf2]" />이메일로 로그인<span className="h-px flex-1 bg-[#e7ecf2]" /></div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div role="alert" className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-semibold text-[#334155]">이메일</label>
                <Input id="login-email" type="email" placeholder="doctor@clinic.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-semibold text-[#334155]">비밀번호</label>
                <div className="relative">
                  <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="비밀번호 입력" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required autoComplete="current-password" />
                  <button type="button" aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8390a0] hover:text-[#334155]" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="text-right"><Link href="/forgot-password" className="text-xs font-semibold text-[#69788b] hover:text-[#285cf4]">비밀번호를 잊으셨나요?</Link></div>
              <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-[#dce2e9] bg-white text-sm font-semibold text-[#263548] hover:bg-[#f6f8fb] disabled:opacity-50">
                <LockKeyhole className="h-4 w-4" />{loading ? '로그인 중...' : '이메일로 로그인'}
              </button>
            </form>
            <div className="mt-7 border-t border-[#eef1f5] pt-6 text-center text-sm text-[#69788b]">계정이 없으신가요? <Link href="/register" className="font-semibold text-[#285cf4] hover:underline">무료 회원가입</Link></div>
          </div>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[#8390a0]"><Check className="h-3.5 w-3.5 text-[#285cf4]" /> 병원 정보는 로그인 후 설정에서 수정할 수 있습니다.</p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]"><span className="h-7 w-7 animate-spin rounded-full border-2 border-[#dce7ff] border-t-[#285cf4]" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
