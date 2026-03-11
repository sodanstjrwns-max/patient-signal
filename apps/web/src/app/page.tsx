'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  BarChart3, 
  Users, 
  Bell, 
  ArrowRight,
  CheckCircle,
  Globe,
  Gift,
  Zap,
  Heart
} from 'lucide-react';

export default function HomePage() {
  const features = [
    {
      icon: <Globe className="h-6 w-6" />,
      title: '멀티 플랫폼 모니터링',
      description: 'ChatGPT, Perplexity, Claude, Gemini, 네이버 Cue 등 주요 AI 플랫폼을 모두 모니터링합니다.',
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: 'AI 가시성 점수',
      description: '0~100점 종합 점수로 우리 병원의 AI 검색 가시성을 한눈에 파악할 수 있습니다.',
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: '경쟁사 분석',
      description: '경쟁 병원 대비 포지션을 확인하고 갭 분석을 통해 개선점을 파악합니다.',
    },
    {
      icon: <Bell className="h-6 w-6" />,
      title: '실시간 알림',
      description: '새로운 언급, 순위 변동, 부정 감성 급증 시 이메일과 카카오톡으로 알려드립니다.',
    },
  ];

  const allFeatures = [
    '200개 질문 모니터링',
    '10개 경쟁사 추적',
    '6개 AI 플랫폼 (ChatGPT, Perplexity, Claude, Gemini, 네이버 Cue, Google AI Overview)',
    '카카오톡 + 이메일 알림',
    '감성 분석 리포트',
    '경쟁사 비교 분석',
    '주간/월간 리포트',
    'API 접근',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">Patient Signal</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">로그인</Button>
              </Link>
              <Link href="/register">
                <Button>무료로 시작하기</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full text-green-700 text-sm font-medium mb-6">
            <Gift className="h-4 w-4" />
            현재 모든 기능 무료 개방 중!
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            AI가 우리 병원을<br />
            <span className="text-blue-600">얼마나 추천하는지</span> 아시나요?
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            ChatGPT, Perplexity, Claude, Gemini, 네이버 Cue에서<br />
            우리 병원이 어떻게 노출되는지 추적하고 최적화하세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="px-8">
                무료로 시작하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg">
                기능 살펴보기
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            카드 등록 없이 바로 사용 가능 · 모든 기능 무료
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white">500+</div>
              <div className="text-blue-200 text-sm mt-1">의료 전문 질문 템플릿</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white">6개</div>
              <div className="text-blue-200 text-sm mt-1">AI 플랫폼 지원</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white">100%</div>
              <div className="text-blue-200 text-sm mt-1">무료</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white">2.1배</div>
              <div className="text-blue-200 text-sm mt-1">평균 매출 성장</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">핵심 기능</h2>
            <p className="text-lg text-gray-600">AI 시대의 병원 마케팅을 위한 필수 도구</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free Plan */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">모든 기능, 완전 무료</h2>
            <p className="text-lg text-gray-600">
              원장님들의 AI 가시성 향상을 응원합니다
            </p>
          </div>
          <div className="bg-white rounded-2xl border-2 border-blue-500 shadow-xl p-8 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-full flex items-center gap-1.5">
              <Gift className="h-4 w-4" />
              완전 무료
            </div>
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Patient Signal</h3>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold text-blue-600">₩0</span>
                <span className="text-gray-500 text-lg">/월</span>
              </div>
              <p className="text-gray-500 mt-2">카드 등록 없이 모든 기능을 사용하세요</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-8">
              {allFeatures.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
            <Link href="/register">
              <Button className="w-full h-12 text-lg" size="lg">
                무료로 시작하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Free */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">왜 무료인가요?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Heart className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">원장님들을 위해</h3>
              <p className="text-sm text-gray-600">
                AI 시대에 모든 원장님들이 자기 병원의 AI 가시성을 확인할 수 있어야 합니다.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">빠른 시작</h3>
              <p className="text-sm text-gray-600">
                복잡한 결제 과정 없이 가입하고 바로 사용하세요. 2분이면 충분합니다.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">함께 성장</h3>
              <p className="text-sm text-gray-600">
                페이션트퍼널과 함께 AI 시대의 병원 마케팅을 선도합시다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            지금 바로 AI 가시성을 확인하세요
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            가입하고 2분만에 우리 병원의 AI 검색 가시성을 측정하고<br />
            경쟁 병원 대비 포지션을 확인해보세요.
          </p>
          <Link href="/register">
            <Button size="lg" className="px-8">
              무료로 시작하기
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            카드 등록 없음 · 설치 불필요 · 바로 사용 가능
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-white">Patient Signal</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/terms" className="hover:text-white transition-colors">
                이용약관
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                개인정보처리방침
              </Link>
              <a href="mailto:support@patientsignal.kr" className="hover:text-white transition-colors">
                문의하기
              </a>
            </div>
            <div className="text-sm">
              © 2024 페이션트퍼널 / 서울비디치과. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
