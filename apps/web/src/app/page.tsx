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
  Bot,
  Activity,
  Target,
  Globe,
  Users,
  FileText,
  Layers,
  ChevronRight,
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
            <span className="text-sm font-medium text-blue-700">병원 AI 가시성 관리 플랫폼</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            AI가 우리 병원을<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
              추천하고 있나요?
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-600 mb-4 max-w-3xl mx-auto leading-relaxed">
            ChatGPT, Perplexity, Claude, Gemini에게 물어보세요.<br />
            <strong>"우리 동네 병원 추천해줘"</strong> — 거기에 우리 병원이 나오나요?
          </p>
          <p className="text-base text-gray-500 mb-10 max-w-2xl mx-auto">
            Patient Signal은 <strong>13개 전체 진료과</strong>의 AI 검색 가시성을<br className="hidden sm:block" />
            자동으로 추적하고 분석하는 <strong>병원 전문</strong> AEO 플랫폼입니다.
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

          {/* 지원 진료과 태그 */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {['🦷 치과', '💆 피부과', '✨ 성형외과', '🦴 정형외과', '🌿 한의원', '👁️ 안과', '🩺 내과', '👂 이비인후과', '🧠 정신건강의학과', '+4개'].map((tag, i) => (
              <span 
                key={i}
                className={`text-xs px-2.5 py-1 rounded-full ${
                  i === 9 
                    ? 'bg-gray-100 text-gray-500 font-medium' 
                    : 'bg-blue-50 text-blue-600'
                }`}
              >
                {tag}
              </span>
            ))}
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
              네이버, 구글 SEO는 이미 하고 계시죠? <strong className="text-white">AI 검색 최적화(AEO)</strong>는 시작하셨나요?
            </p>
          </div>
        </div>
      </section>

      {/* Patient Signal 프레임워크 Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-full px-4 py-1.5 mb-4">
              <Target className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-700">Patient Signal 독자 프레임워크</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              ABHS 5축 분석으로 정밀하게 측정합니다
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              단순 키워드 추적이 아닙니다. 5가지 측정축으로 AI가 우리 병원을 <strong>얼마나 적극적으로</strong> 추천하는지 분석합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { axis: 'Voice Share', desc: 'AI 응답에서 우리 병원이 언급되는 비율', icon: Activity, color: 'blue' },
              { axis: 'Sentiment', desc: '언급 시 긍정·중립·부정 톤 분석', icon: Shield, color: 'green' },
              { axis: 'Rec Depth', desc: '단독추천(R3)부터 단순언급(R1)까지', icon: Layers, color: 'purple' },
              { axis: 'Platform', desc: '4개 플랫폼별 가중치 적용 점수', icon: Globe, color: 'cyan' },
              { axis: 'Intent', desc: '예약·비교·공포 등 질문 의도별 분석', icon: Target, color: 'orange' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-5 text-center hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-xl bg-${item.color}-100 flex items-center justify-center mx-auto mb-3`}>
                  <item.icon className={`h-6 w-6 text-${item.color}-600`} />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{item.axis}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 작동 원리 Section - 3단계 */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              3분이면 시작할 수 있습니다
            </h2>
            <p className="text-gray-500">복잡한 설정 없이, 3단계면 충분합니다</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-7 w-7 text-blue-600" />
              </div>
              <div className="text-sm font-bold text-blue-600 mb-2">STEP 1</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">병원 정보 입력</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                병원명, 진료과, 위치, 주력 진료만<br />
                입력하면 AI 모니터링 질문이<br />
                <strong>자동으로 생성</strong>됩니다
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Search className="h-7 w-7 text-green-600" />
              </div>
              <div className="text-sm font-bold text-green-600 mb-2">STEP 2</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">AI 자동 분석</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                매일, ChatGPT·Perplexity·Claude·Gemini<br />
                4개 플랫폼에 자동으로 질문하고<br />
                <strong>ABHS 5축 분석</strong>을 수행합니다
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-7 w-7 text-purple-600" />
              </div>
              <div className="text-sm font-bold text-purple-600 mb-2">STEP 3</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">인사이트 확인</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                SoV(Voice Share) 중심 대시보드에서<br />
                가시성 점수, 경쟁사 비교,<br />
                <strong>개선 기회</strong>를 확인하세요
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 주요 기능 Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              원장님이 알아야 할 것들
            </h2>
            <p className="text-gray-500">AI가 우리 병원을 어떻게 소개하는지, 정확히 파악하세요</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Eye,
                color: 'blue',
                title: 'SoV 기반 가시성 점수',
                desc: '4개 AI 플랫폼에서 우리 병원이 차지하는 Voice Share를 매일 추적합니다. 점수 변동과 트렌드를 한눈에 확인하세요.',
              },
              {
                icon: TrendingUp,
                color: 'green',
                title: '경쟁사 AEO 비교',
                desc: '같은 지역 경쟁 병원의 AI 노출 현황을 자동으로 비교합니다. 누가 AI의 1순위 추천을 받고 있는지 파악하세요.',
              },
              {
                icon: Shield,
                color: 'purple',
                title: '감성 & 추천 깊이 분석',
                desc: 'AI가 우리 병원을 긍정적으로 추천하는지(R3), 단순 언급(R1)인지, 부정적(R0)인지 자동으로 분류합니다.',
              },
              {
                icon: FileText,
                color: 'orange',
                title: '인용 출처 추적',
                desc: 'AI가 우리 병원을 추천할 때 어떤 출처(블로그, 리뷰 등)를 참고하는지 추적합니다. 소스 관리 전략에 활용하세요.',
              },
              {
                icon: Zap,
                color: 'amber',
                title: '개선 기회 자동 발견',
                desc: '경쟁사는 AI에서 추천되지만 우리 병원은 빠져있는 질문 패턴을 자동으로 감지하고 개선 방향을 제시합니다.',
              },
              {
                icon: Users,
                color: 'cyan',
                title: '13개 진료과 전문 분석',
                desc: '치과, 피부과, 성형외과, 정형외과, 한의원, 안과, 내과 등 13개 진료과별 맞춤 질문과 분석을 제공합니다.',
              },
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className={`w-12 h-12 rounded-xl bg-${feature.color}-100 flex items-center justify-center mb-4`}>
                  <feature.icon className={`h-6 w-6 text-${feature.color}-600`} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
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
              '"경쟁 병원은 AI에서 어떻게 나오나 궁금한" 원장님',
              '"네이버·구글은 하고 있는데 AI는 뭘 해야 할지 모르겠는" 원장님',
              '"AI 시대에 뒤처지고 싶지 않은" 원장님',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/10 backdrop-blur rounded-xl p-4">
                <CheckCircle className="h-5 w-5 text-cyan-300 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-100 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Patient Funnel 연계 Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-8 sm:p-12 border border-blue-100">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-1.5 mb-4 border border-blue-200">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">페이션트 퍼널 × Patient Signal</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                환자 여정의 시작점이 바뀌고 있습니다
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                환자가 병원을 선택하는 10단계 여정, 그 첫 번째 단계인 <strong>"인지"</strong>가 
                이제 AI 추천으로 시작됩니다. Patient Signal은 이 변화를 추적하는 유일한 도구입니다.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <div className="text-3xl font-bold text-blue-600 mb-1">6,000+</div>
                <p className="text-xs text-gray-500">페이션트 퍼널 수강 원장님</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <div className="text-3xl font-bold text-blue-600 mb-1">2.1배</div>
                <p className="text-xs text-gray-500">평균 매출 성장률</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <div className="text-3xl font-bold text-blue-600 mb-1">40%</div>
                <p className="text-xs text-gray-500">광고비 절감</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            지금 바로 확인해보세요
          </h2>
          <p className="text-gray-500 mb-8">
            가입부터 첫 분석까지 3분이면 충분합니다.<br />
            무료 7일 체험으로 시작하세요.
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
