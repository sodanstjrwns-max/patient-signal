'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Eye, EyeOff, ScanSearch, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    isPfMember: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await authApi.register(formData);
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.push('/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다');
    } finally {
      setLoading(false);
    }
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
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#a9bcff]">Get started</span>
            <h1 className="mt-4 text-4xl font-bold leading-[1.16] tracking-[-0.06em] xl:text-5xl">우리 병원의<br />AI 검색 현황을 보세요.</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-[#abb8c9]">병원 소개를 정리하고 중요한 질문을 고르면, 질문별 AI 답변을 확인할 수 있습니다.</p>
          </div>
          <div className="mt-12 max-w-md rounded-[18px] border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a9bcff]">시작하는 순서</p>
            <div className="mt-5 space-y-4">
              {['병원 소개 확인 및 수정', '주력 진료와 경쟁 병원 설정', '핵심 질문과 AI 답변 확인'].map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#a9bcff]/50 text-xs font-bold text-[#dce7ff]">{index + 1}</span>
                  <span className="text-sm font-medium text-white/90">{item}</span>
                </div>
              ))}
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
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#285cf4]">Create account</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.05em]">시그널 시작하기</h2>
            <p className="mt-2 text-sm leading-6 text-[#69788b]">계정을 만든 뒤 병원 정보를 연결할 수 있습니다.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {error && <div role="alert" className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <div className="space-y-2">
                <label htmlFor="register-name" className="text-sm font-semibold text-[#334155]">이름</label>
                <Input id="register-name" type="text" placeholder="홍길동" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required autoComplete="name" />
              </div>
              <div className="space-y-2">
                <label htmlFor="register-email" className="text-sm font-semibold text-[#334155]">이메일</label>
                <Input id="register-email" type="email" placeholder="doctor@clinic.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <label htmlFor="register-password" className="text-sm font-semibold text-[#334155]">비밀번호</label>
                <div className="relative">
                  <Input id="register-password" type={showPassword ? 'text' : 'password'} placeholder="8자 이상 입력해주세요" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={8} autoComplete="new-password" />
                  <button type="button" aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8390a0] hover:text-[#334155]" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="register-phone" className="text-sm font-semibold text-[#334155]">전화번호 <span className="font-normal text-[#9aa6b5]">(선택)</span></label>
                <Input id="register-phone" type="tel" placeholder="010-1234-5678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} autoComplete="tel" />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-[11px] border border-[#dce7ff] bg-[#f7f9ff] p-4 hover:bg-[#eff4ff]">
                <input type="checkbox" checked={formData.isPfMember} onChange={(e) => setFormData({ ...formData, isPfMember: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-[#c8d1df] text-[#285cf4] focus:ring-[#285cf4]" />
                <span><span className="block text-sm font-semibold text-[#263548]">페이션트퍼널 수강생입니다</span><span className="mt-1 block text-xs leading-5 text-[#69788b]">수강생은 Starter 기능을 무료로 이용할 수 있습니다.</span></span>
              </label>

              <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-[11px] bg-[#285cf4] text-sm font-semibold text-white hover:bg-[#204bce] disabled:opacity-50">
                {loading ? '가입 중...' : '무료로 시작하기'} {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
              <p className="text-center text-xs leading-5 text-[#8390a0]">
                가입 시 <Link href="/terms" className="underline hover:text-[#285cf4]">이용약관</Link> 및 <Link href="/privacy" className="underline hover:text-[#285cf4]">개인정보처리방침</Link>에 동의합니다.
              </p>
            </form>
            <div className="mt-7 border-t border-[#eef1f5] pt-6 text-center text-sm text-[#69788b]">이미 계정이 있으신가요? <Link href="/login" className="font-semibold text-[#285cf4] hover:underline">로그인</Link></div>
          </div>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[#8390a0]"><Check className="h-3.5 w-3.5 text-[#285cf4]" /> 병원 정보는 가입 후 입력하고 수정할 수 있습니다.</p>
        </div>
      </main>
    </div>
  );
}
