'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  CheckCircle, 
  ArrowLeft,
  ArrowRight,
  Gift,
  Heart,
  Zap,
} from 'lucide-react';

const allFeatures = [
  '200개 질문 모니터링',
  '10개 경쟁사 추적',
  '4개 AI 플랫폼 (ChatGPT, Perplexity, Claude, Gemini)',
  '카카오톡 + 이메일 알림',
  '감성 분석 리포트',
  '경쟁사 비교 분석',
  '주간/월간 리포트',
  'API 접근',
  '전담 지원',
  '맞춤 컨설팅',
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">Patient Signal</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                홈으로
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Title */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full text-green-700 text-sm font-medium mb-6">
              <Gift className="h-4 w-4" />
              현재 모든 기능 무료 개방 중!
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              모든 기능, 완전 무료
            </h1>
            <p className="text-lg text-gray-600">
              원장님들의 AI 가시성 향상을 위해 모든 기능을 무료로 제공합니다.
            </p>
          </div>

          {/* Free Plan Card */}
          <div className="bg-white rounded-2xl border-2 border-blue-500 shadow-xl p-8 relative mb-12">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-full flex items-center gap-1.5">
              <Gift className="h-4 w-4" />
              완전 무료
            </div>
            
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Patient Signal Full</h3>
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
              <Button className="w-full h-14 text-lg" size="lg">
                무료로 시작하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Why Free Section */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center p-6 bg-white rounded-xl border border-gray-200">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Heart className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">원장님들을 위해</h3>
              <p className="text-sm text-gray-600">
                AI 시대에 모든 원장님들이 자기 병원의 AI 가시성을 확인할 수 있어야 합니다.
              </p>
            </div>
            <div className="text-center p-6 bg-white rounded-xl border border-gray-200">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">빠른 시작</h3>
              <p className="text-sm text-gray-600">
                복잡한 결제 과정 없이 가입하고 바로 사용하세요. 2분이면 충분합니다.
              </p>
            </div>
            <div className="text-center p-6 bg-white rounded-xl border border-gray-200">
              <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">함께 성장</h3>
              <p className="text-sm text-gray-600">
                페이션트퍼널과 함께 AI 시대의 병원 마케팅을 선도합시다.
              </p>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              자주 묻는 질문
            </h2>
            <div className="space-y-4">
              <div className="p-6 bg-white rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">
                  정말 무료인가요?
                </h3>
                <p className="text-gray-600 text-sm">
                  네! 현재 모든 기능을 무료로 제공하고 있습니다. 
                  카드 등록도 필요 없으며, 숨겨진 비용도 없습니다.
                </p>
              </div>
              <div className="p-6 bg-white rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">
                  언제까지 무료인가요?
                </h3>
                <p className="text-gray-600 text-sm">
                  별도 공지 전까지 무료로 운영됩니다. 
                  유료 전환 시 사전에 충분히 안내드릴 예정입니다.
                </p>
              </div>
              <div className="p-6 bg-white rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">
                  어떤 제한이 있나요?
                </h3>
                <p className="text-gray-600 text-sm">
                  현재는 모든 기능에 제한이 없습니다. 
                  200개 질문 모니터링, 10개 경쟁사 추적, 4개 AI 플랫폼 등 모든 기능을 자유롭게 사용하세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          © 2024 페이션트퍼널 / 서울비디치과. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
