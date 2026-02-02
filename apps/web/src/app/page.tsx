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
  Zap,
  Shield
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

  const pricing = [
    {
      name: 'Starter',
      price: '19만원',
      period: '/월',
      description: '1인 개원의를 위한 시작 플랜',
      features: ['30개 질문 모니터링', '3개 경쟁사 추적', '4개 AI 플랫폼', '주간 이메일 리포트'],
    },
    {
      name: 'Standard',
      price: '39만원',
      period: '/월',
      description: '성장하는 치과를 위한 플랜',
      features: ['80개 질문 모니터링', '5개 경쟁사 추적', '5개 AI 플랫폼', '카카오톡 알림', '감성 분석'],
      popular: true,
    },
    {
      name: 'Pro',
      price: '79만원',
      period: '/월',
      description: '중대형/네트워크 병원 플랜',
      features: ['200개 질문 모니터링', '10개 경쟁사 추적', '네이버 Cue 포함', '월간 PDF 리포트', 'API 접근'],
    },
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
                <Button>무료 체험 시작</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-700 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            한국 최초 병원 전문 AI 검색 가시성 추적 SaaS
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
                7일 무료 체험 시작
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#pricing">
              <Button variant="outline" size="lg">
                가격 보기
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            카드 등록 필요 • 7일 후 자동 결제 없음
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
              <div className="text-3xl sm:text-4xl font-bold text-white">90%+</div>
              <div className="text-blue-200 text-sm mt-1">예상 마진율</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white">2.1배</div>
              <div className="text-blue-200 text-sm mt-1">평균 매출 성장</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
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

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">심플한 가격 정책</h2>
            <p className="text-lg text-gray-600">병원 규모에 맞는 플랜을 선택하세요</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {pricing.map((plan, index) => (
              <div
                key={index}
                className={`p-8 bg-white rounded-2xl border-2 ${
                  plan.popular ? 'border-blue-500 shadow-xl' : 'border-gray-200'
                } relative`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
                    가장 인기
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button
                    variant={plan.popular ? 'default' : 'outline'}
                    className="w-full"
                  >
                    시작하기
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-500 text-sm mt-8">
            연간 결제 시 2개월 무료 (16.7% 할인) • 페이션트퍼널 수강생 첫 3개월 30% 할인
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            지금 바로 AI 가시성을 확인하세요
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            7일 무료 체험으로 우리 병원의 AI 검색 가시성을 측정하고<br />
            경쟁 병원 대비 포지션을 확인해보세요.
          </p>
          <Link href="/register">
            <Button size="lg" className="px-8">
              무료 체험 시작하기
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-white">Patient Signal</span>
            </div>
            <div className="text-sm">
              © 2026 페이션트퍼널 / 서울비디치과. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
