'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AuthShell from '@/components/public/AuthShell';
import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || '요청 처리에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="recovery">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-[#c0c4c7]">ACCOUNT RECOVERY</p>
      <h1 className="font-display mt-3 text-4xl font-semibold leading-tight tracking-[-0.06em]">{sent ? '이메일을 확인해주세요.' : '다시 연결하세요.'}</h1>
      {sent ? <div className="mt-7"><CheckCircle className="mb-5 h-9 w-9 text-[#c0c4c7]" /><p className="break-words text-sm leading-7 text-[#c0c4c7]"><strong>{email}</strong>로 비밀번호 재설정 링크를 발송했습니다.</p><p className="mt-3 text-xs leading-6 text-[#959c9f]">이메일이 도착하지 않았다면 스팸 폴더를 확인해주세요.</p><Link href="/login" className="mt-8 flex items-center justify-between border-b border-[#30343a] py-3 text-sm font-semibold">로그인으로 돌아가기<ArrowLeft className="h-4 w-4" /></Link></div> : <><p className="mt-4 text-sm leading-7 text-[#c0c4c7]">가입한 이메일 주소로 비밀번호를 재설정할 수 있습니다.</p><form onSubmit={handleSubmit} className="mt-9 space-y-5">{error && <div role="alert" className="border border-red-200 bg-[#291718] p-3 text-sm text-red-400">{error}</div>}<div className="space-y-2"><label htmlFor="forgot-email" className="text-sm font-medium">이메일</label><Input id="forgot-email" type="email" placeholder="doctor@clinic.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div><Button type="submit" className="w-full rounded-none bg-[#08090a] text-white hover:bg-[#d9ff43]" loading={loading}>비밀번호 재설정 링크 받기</Button></form><Link href="/login" className="mt-7 inline-flex items-center gap-2 text-xs text-[#c0c4c7]"><ArrowLeft className="h-3.5 w-3.5" />로그인으로 돌아가기</Link></>}
    </AuthShell>
  );
}
