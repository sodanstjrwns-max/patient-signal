'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Eye, EyeOff, CheckCircle, Bot, BarChart3, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    <div className="min-h-screen flex">
      {/* 좌측: 서비스 소개 */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* 배경 장식 */}
        <div className="absolute top-20 right-10 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-16">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-xl">Patient Signal</span>
          </Link>

          <h2 className="text-3xl font-bold mb-4 leading-tight">
            3분 만에 시작하는<br />
            AI 가시성 분석
          </h2>
          <p className="text-blue-200 text-base leading-relaxed mb-10">
            가입 → 병원 등록 → 질문 설정<br />
            이후엔 매주 자동으로 분석해드립니다.
          </p>

          {/* 혜택 리스트 */}
          <div className="space-y-4">
            {[
              { icon: <Zap className="h-5 w-5" />, title: '무료로 시작', desc: '신용카드 없이 바로 이용 가능' },
              { icon: <Bot className="h-5 w-5" />, title: '4개 AI 플랫폼', desc: 'ChatGPT, Perplexity, Claude, Gemini' },
              { icon: <BarChart3 className="h-5 w-5" />, title: '주 2회 자동 분석', desc: '설정 후 자동으로 추적 & 리포트' },
              { icon: <Shield className="h-5 w-5" />, title: '경쟁사 비교', desc: '같은 지역 병원 대비 AI 노출 현황' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/5 backdrop-blur rounded-xl p-4">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-cyan-300">
                  {item.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-blue-200">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sm text-blue-300/60">
          Patient Signal by 페이션트퍼널
        </div>
      </div>

      {/* 우측: 회원가입 폼 */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* 모바일에서만 보이는 로고 */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">Patient Signal</span>
            </Link>
          </div>

          <Card className="shadow-xl border-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">회원가입</CardTitle>
              <CardDescription>
                무료로 AI 가시성 분석을 시작하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">이름</label>
                  <Input
                    type="text"
                    placeholder="홍길동"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">이메일</label>
                  <Input
                    type="email"
                    placeholder="doctor@clinic.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    autoComplete="email"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">비밀번호</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="8자 이상 입력해주세요"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">전화번호 <span className="text-gray-400 font-normal">(선택)</span></label>
                  <Input
                    type="tel"
                    placeholder="010-1234-5678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    autoComplete="tel"
                  />
                </div>

                <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.isPfMember}
                    onChange={(e) => setFormData({ ...formData, isPfMember: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      페이션트퍼널 수강생입니다
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">수강생은 PRO 기능을 무료로 이용할 수 있습니다</p>
                  </div>
                </label>

                <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600" loading={loading}>
                  무료로 시작하기
                </Button>

                <p className="text-xs text-center text-gray-400">
                  가입 시 <Link href="/terms" className="underline hover:text-gray-600">이용약관</Link> 및{' '}
                  <Link href="/privacy" className="underline hover:text-gray-600">개인정보처리방침</Link>에 동의합니다
                </p>
              </form>

              <div className="mt-6 text-center text-sm text-gray-500">
                이미 계정이 있으신가요?{' '}
                <Link href="/login" className="text-blue-600 hover:underline font-medium">
                  로그인
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* 모바일에서만 보이는 하단 기능 요약 */}
          <div className="lg:hidden mt-8 space-y-3">
            <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <span>무료</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <span>4개 AI 플랫폼</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <span>자동 분석</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
