'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import AuthShell from '@/components/public/AuthShell';
import SignInOptions from '@/components/public/SignInOptions';

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
    <AuthShell mode="register">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#c0c4c7]">Create account</p>
            <h1 className="font-display mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">첫 시그널을 켜세요.</h1>
            <p className="mt-2 text-sm leading-6 text-[#c0c4c7]">계정을 만든 뒤 병원 정보를 연결할 수 있습니다.</p>

            <SignInOptions registering />
            <div className="my-7 flex items-center gap-3 text-xs font-medium text-[#959c9f]"><span className="h-px flex-1 bg-[#30343a]" />이메일로 회원가입<span className="h-px flex-1 bg-[#30343a]" /></div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div role="alert" className="rounded-none border border-red-200 bg-[#291718] p-3 text-sm text-red-400">{error}</div>}
              <div className="space-y-2">
                <label htmlFor="register-name" className="text-sm font-semibold text-[#f5f5ef]">이름</label>
                <Input id="register-name" type="text" placeholder="홍길동" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required autoComplete="name" />
              </div>
              <div className="space-y-2">
                <label htmlFor="register-email" className="text-sm font-semibold text-[#f5f5ef]">이메일</label>
                <Input id="register-email" type="email" placeholder="doctor@clinic.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <label htmlFor="register-password" className="text-sm font-semibold text-[#f5f5ef]">비밀번호</label>
                <div className="relative">
                  <Input id="register-password" type={showPassword ? 'text' : 'password'} placeholder="8자 이상 입력해주세요" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={8} autoComplete="new-password" />
                  <button type="button" aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#959c9f] hover:text-[#f5f5ef]" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="register-phone" className="text-sm font-semibold text-[#f5f5ef]">전화번호 <span className="font-normal text-[#959c9f]">(선택)</span></label>
                <Input id="register-phone" type="tel" placeholder="010-1234-5678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} autoComplete="tel" />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-none border border-[#30343a] bg-[#08090a] p-4 hover:bg-[#181b1e]">
                <input type="checkbox" checked={formData.isPfMember} onChange={(e) => setFormData({ ...formData, isPfMember: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-[#30343a] text-[#c0c4c7] focus:ring-[#d9ff43]" />
                <span><span className="block text-sm font-semibold text-[#f5f5ef]">페이션트퍼널 수강생입니다</span><span className="mt-1 block text-xs leading-5 text-[#c0c4c7]">수강생은 Starter 기능을 무료로 이용할 수 있습니다.</span></span>
              </label>

              <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-none bg-[#08090a] text-sm font-semibold text-white hover:bg-[#d9ff43] disabled:opacity-50">
                {loading ? '가입 중...' : '무료로 시작하기'} {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
              <p className="text-center text-xs leading-5 text-[#959c9f]">
                가입 시 <Link href="/terms" className="underline hover:text-[#c0c4c7]">이용약관</Link> 및 <Link href="/privacy" className="underline hover:text-[#c0c4c7]">개인정보처리방침</Link>에 동의합니다.
              </p>
            </form>
            <div className="mt-7 border-t border-[#30343a] pt-6 text-center text-sm text-[#c0c4c7]">이미 계정이 있으신가요? <Link href="/login" className="font-semibold text-[#c0c4c7] hover:underline">로그인</Link></div>

    </AuthShell>
  );
}
