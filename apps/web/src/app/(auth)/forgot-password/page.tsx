'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScanSearch, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

  if (sent) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] flex items-center justify-center p-5">
        <Card className="w-full max-w-md !rounded-[20px] !border !border-[#e7ecf2] !bg-white !shadow-[0_8px_34px_rgba(18,33,54,0.045)]">
          <CardContent className="px-7 pb-8 pt-8 text-center sm:px-9">
            <div className="w-14 h-14 bg-[#edf7f1] rounded-[14px] flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="h-7 w-7 text-[#23865a]" />
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.04em] text-[#17212e] mb-2">이메일을 확인해주세요</h2>
            <p className="text-slate-600 mb-6">
              <strong>{email}</strong>로<br />
              비밀번호 재설정 링크를 발송했습니다.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              이메일이 도착하지 않았다면 스팸 폴더를 확인해주세요.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                로그인 페이지로 돌아가기
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] flex items-center justify-center p-5">
      <Card className="w-full max-w-md !rounded-[20px] !border !border-[#e7ecf2] !bg-white !shadow-[0_8px_34px_rgba(18,33,54,0.045)]">
        <CardHeader className="text-center px-7 pb-2 pt-8 sm:px-9">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-[11px] bg-[#285cf4] flex items-center justify-center">
              <ScanSearch className="h-5 w-5 text-white" />
            </div>
          </Link>
          <CardTitle className="text-[27px]">비밀번호 찾기</CardTitle>
          <CardDescription>
            가입하신 이메일 주소를 입력해주세요
          </CardDescription>
        </CardHeader>
        <CardContent className="px-7 pb-8 pt-4 sm:px-9">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="forgot-email" className="text-sm font-semibold text-[#334155]">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="doctor@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#285cf4] hover:bg-[#204bce] text-white" loading={loading}>
              비밀번호 재설정 링크 받기
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link 
              href="/login" 
              className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              로그인으로 돌아가기
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
