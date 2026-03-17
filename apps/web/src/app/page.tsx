'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  ArrowRight, 
  Search, 
  BarChart3, 
  Shield, 
  TrendingUp,
  MessageSquare,
  Eye,
  Zap,
  CheckCircle,
  Bot
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/30 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
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

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 mb-8">
            <Bot className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">AI 시대, 병원 마케팅의 새로운 기준</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            AI가 우리 병원을<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
              추천하고 있나요?
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-600 mb-4 max-w-3xl mx-auto leading-relaxed">
            ChatGPT, Perplexity, Claude, Gemini에게 물어보세요.<br />
            <strong>"우리 동네 치과 추천해줘"</strong> — 거기에 우리 병원이 나오나요?
          </p>
          <p className="text-base text-gray-500 mb-10 max-w-2xl mx-auto">
            Patient Signal은 AI 검색엔진에서 우리 병원이 얼마나 노출되는지<br className="hidden sm:block" />
            자동으로 추적하고 분석해주는 도구입니다.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="px-8 py-6 text-base bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/25">
                무료로 시작하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/guide">
              <Button variant="outline" size="lg" className="px-8 py-6 text-base">
                서비스 가이드 보기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 문제 제기 Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 sm:p-12 text-white">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center">
              환자의 검색 행동이 바뀌고 있습니다
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
                <div className="text-4xl font-bold text-cyan-400 mb-2">73%</div>
                <p className="text-sm text-gray-300">의 MZ세대 환자가<br />AI에게 병원 추천을 요청</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
                <div className="text-4xl font-bold text-cyan-400 mb-2">4개</div>
                <p className="text-sm text-gray-300">주요 AI 플랫폼에서<br />병원 추천이 실시간 발생</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
                <div className="text-4xl font-bold text-cyan-400 mb-2">0%</div>
                <p className="text-sm text-gray-300">의 병원이 자기 병원의<br />AI 노출 현황을 파악 중</p>
              </div>
            </div>
            <p className="text-center text-gray-400 mt-8 text-sm">
              네이버, 구글 SEO는 이미 하고 계시죠? <strong className="text-white">AI SEO(AEO)</strong>는 시작하셨나요?
            </p>
          </div>
        </div>
      </section>

      {/* 작동 원리 Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              이렇게 작동합니다
            </h2>
            <p className="text-gray-500">복잡한 설정 없이, 3단계면 충분합니다</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-7 w-7 text-blue-600" />
              </div>
              <div className="text-sm font-bold text-blue-600 mb-2">STEP 1</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">질문 등록</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                "천안 임플란트 잘하는 치과" 같은<br />
                환자가 실제로 할 만한 질문을<br />
                최대 10개까지 등록하세요
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Search className="h-7 w-7 text-green-600" />
              </div>
              <div className="text-sm font-bold text-green-600 mb-2">STEP 2</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">자동 크롤링</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                매주 2회, 4개 AI 플랫폼에<br />
                자동으로 질문하고 응답을<br />
                수집·분석합니다
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-7 w-7 text-purple-600" />
              </div>
              <div className="text-sm font-bold text-purple-600 mb-2">STEP 3</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">리포트 확인</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                대시보드에서 AI 가시성 점수,<br />
                경쟁사 비교, 개선 인사이트를<br />
                한눈에 확인하세요
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 주요 기능 Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              원장님이 알아야 할 것들
            </h2>
            <p className="text-gray-500">AI가 우리 병원을 어떻게 소개하는지, 정확히 파악하세요</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                <Eye className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">AI 가시성 점수</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                ChatGPT, Perplexity, Claude, Gemini에서 우리 병원이 언급되는 빈도, 
                순위, 감성을 종합한 점수를 매주 추적합니다.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">경쟁사 비교 분석</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                같은 지역 경쟁 병원 대비 AI 노출 현황을 비교합니다. 
                어떤 병원이 더 자주 추천되는지 한눈에 파악하세요.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">감성 분석</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                AI가 우리 병원을 긍정적으로 추천하는지, 
                부정적으로 언급하는지 자동으로 분석합니다.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">주간 인사이트 리포트</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                매주 자동으로 분석 리포트를 생성합니다. 
                점수 변동, 새로운 언급, 개선 포인트를 쉽게 확인하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 대상 고객 Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-500">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8">
            이런 원장님께 추천합니다
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
            {[
              '"ChatGPT한테 우리 병원 물어보면 뭐라 하는지 궁금한" 원장님',
              '"광고비 대비 신환이 줄어드는 느낌이 드는" 원장님',
              '"AEO, AI SEO가 뭔지 알고 싶은" 원장님',
              '"경쟁 치과는 AI에서 어떻게 나오나 궁금한" 원장님',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/10 backdrop-blur rounded-xl p-4">
                <CheckCircle className="h-5 w-5 text-cyan-300 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-100 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            지금 바로 확인해보세요
          </h2>
          <p className="text-gray-500 mb-8">
            가입부터 첫 분석까지 3분이면 충분합니다.<br />
            무료로 시작하세요.
          </p>
          <Link href="/register">
            <Button size="lg" className="px-10 py-6 text-base bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/25">
              무료로 시작하기
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-xs text-gray-400 mt-4">
            신용카드 불필요 · 설치 없음 · 3분 만에 시작
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span>Patient Signal by 페이션트퍼널</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="hover:text-gray-600 transition-colors">
                이용약관
              </Link>
              <Link href="/privacy" className="hover:text-gray-600 transition-colors">
                개인정보처리방침
              </Link>
              <Link href="/guide" className="hover:text-gray-600 transition-colors">
                사용 가이드
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
