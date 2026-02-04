'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Sparkles, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

// Google Client ID
const GOOGLE_CLIENT_ID = '141234552582-lijncuv1nn302n1d4en6ascei76ugakp.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await authApi.login(formData);
      setAuth(data.user, data.accessToken, data.refreshToken);
      
      // 강제 리다이렉트 (router.push 대신 window.location 사용)
      const redirectUrl = data.user.hospitalId ? '/dashboard' : '/onboarding';
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err.response?.data?.message || '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // Google 로그인 콜백
  const handleGoogleCallback = async (response: any) => {
    setGoogleLoading(true);
    setError('');
    
    try {
      const { data } = await authApi.googleLogin(response.credential);
      setAuth(data.user, data.accessToken, data.refreshToken);
      
      const redirectUrl = data.user.hospitalId ? '/dashboard' : '/onboarding';
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Google 로그인에 실패했습니다');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Google Sign-In 초기화
  useEffect(() => {
    const initializeGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });
        
        const buttonDiv = document.getElementById('google-signin-button');
        if (buttonDiv) {
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'signin_with',
            locale: 'ko',
          });
        }
      }
    };

    // 스크립트 로드 대기 후 초기화 (여러 번 시도)
    const checkAndInit = () => {
      if (window.google?.accounts?.id) {
        initializeGoogle();
      } else {
        setTimeout(checkAndInit, 100);
      }
    };
    
    // 즉시 체크 + 폴링
    checkAndInit();
  }, []);

  return (
    <>
      <Script 
        src="https://accounts.google.com/gsi/client" 
        strategy="beforeInteractive"
      />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </Link>
          <CardTitle className="text-2xl">로그인</CardTitle>
          <CardDescription>
            Patient Signal 계정으로 로그인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
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

            <Button type="submit" className="w-full" loading={loading}>
              로그인
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
          <div className="space-y-3">
            <div 
              id="google-signin-button" 
              className="flex justify-center"
              style={{ minHeight: '44px' }}
            ></div>
            {googleLoading && (
              <p className="text-center text-sm text-gray-500">Google 로그인 중...</p>
            )}
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            계정이 없으신가요?{' '}
            <Link href="/register" className="text-blue-600 hover:underline font-medium">
              회원가입
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
