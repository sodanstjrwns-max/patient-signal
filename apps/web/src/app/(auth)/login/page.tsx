'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Eye, EyeOff, Bot, BarChart3, Shield, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

// Google OAuth 설정
const GOOGLE_CLIENT_ID = '141234552582-lijncuv1nn302n1d4en6ascei76ugakp.apps.googleusercontent.com';
const GOOGLE_REDIRECT_URI = 'https://patient-signal.onrender.com/api/auth/google/callback';

const ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed: 'Google 로그인에 실패했습니다. 다시 시도해주세요.',
  token_exchange_failed: 'Google 인증 토큰 교환에 실패했습니다. 다시 시도해주세요.',
  email_not_verified: 'Google 이메일이 인증되지 않았습니다.',
  missing_code: 'Google 인증 코드가 누락되었습니다.',
  missing_data: '인증 데이터가 누락되었습니다. 다시 시도해주세요.',
  parse_error: '인증 데이터 처리 중 오류가 발생했습니다.',
  access_denied: 'Google 로그인이 취소되었습니다.',
};

function LoginForm() {
  const { setAuth } = useAuthStore();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // URL에서 에러 파라미터 읽기
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const detailParam = searchParams.get('detail');
    if (errorParam) {
      const msg = ERROR_MESSAGES[errorParam] || `로그인 오류: ${errorParam}`;
      setError(detailParam ? `${msg} (${detailParam})` : msg);
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
      
      const redirectUrl = data.user.hospitalId ? '/dashboard' : '/onboarding';
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err.response?.data?.message || '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth 로그인 (리다이렉트 방식)
  const handleGoogleLogin = () => {
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('openid email profile')}` +
      `&access_type=offline` +
      `&prompt=consent`;
    
    window.location.href = googleAuthUrl;
  };

  return (
    <div className="min-h-screen flex">
      {/* 좌측: 서비스 소개 */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* 배경 장식 */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-16">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-xl">Patient Signal</span>
          </Link>

          <h2 className="text-3xl font-bold mb-4 leading-tight">
            AI가 우리 병원을<br />
            추천하고 있을까요?
          </h2>
          <p className="text-blue-200 text-base leading-relaxed mb-10">
            ChatGPT, Perplexity, Claude, Gemini<br />
            4개 AI 플랫폼에서의 병원 노출을 자동 추적합니다.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur rounded-xl p-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <p className="font-medium text-sm">AI 가시성 점수 추적</p>
                <p className="text-xs text-blue-300">매주 자동으로 측정 & 리포트</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur rounded-xl p-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-green-300" />
              </div>
              <div>
                <p className="font-medium text-sm">경쟁사 비교 분석</p>
                <p className="text-xs text-blue-300">우리 병원 vs 경쟁 병원 AI 추천 현황</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur rounded-xl p-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-purple-300" />
              </div>
              <div>
                <p className="font-medium text-sm">감성 & 인사이트 분석</p>
                <p className="text-xs text-blue-300">AI가 우리 병원을 어떤 톤으로 소개하는지</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-blue-300/60">
          Patient Signal by 페이션트퍼널
        </div>
      </div>

      {/* 우측: 로그인 폼 */}
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
              <CardTitle className="text-2xl">로그인</CardTitle>
              <CardDescription>
                병원의 AI 가시성을 확인하세요
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
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      autoComplete="current-password"
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

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '로그인 중...' : '로그인'}
                </Button>

                <div className="text-right">
                  <Link 
                    href="/forgot-password" 
                    className="text-sm text-gray-500 hover:text-blue-600"
                  >
                    비밀번호를 잊으셨나요?
                  </Link>
                </div>
              </form>

              {/* 구분선 */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">또는</span>
                </div>
              </div>

              {/* Google 로그인 버튼 */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-white"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-gray-700 font-medium">Google로 로그인</span>
              </button>

              <div className="mt-6 text-center text-sm text-gray-500">
                계정이 없으신가요?{' '}
                <Link href="/register" className="text-blue-600 hover:underline font-medium">
                  무료 회원가입
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* 모바일에서만 보이는 하단 기능 요약 */}
          <div className="lg:hidden mt-8">
            <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <Bot className="h-3.5 w-3.5" />
                <span>4개 AI 플랫폼</span>
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                <span>자동 분석</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                <span>경쟁사 비교</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
