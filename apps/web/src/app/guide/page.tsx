'use client';

import Link from 'next/link';
import { 
  Sparkles, 
  Search, 
  BarChart3, 
  Building2, 
  Rocket,
  ArrowLeft,
  Play,
  CheckCircle,
  HelpCircle,
  MessageSquare,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5" />
            <span>대시보드로 돌아가기</span>
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-gray-900">Patient Signal 가이드</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Patient Signal 사용 가이드
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            AI 시대의 병원 마케팅, Patient Signal로 시작하세요.
            <br />
            이 가이드를 통해 서비스를 100% 활용하는 방법을 알아보세요.
          </p>
        </div>

        {/* What is Patient Signal */}
        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <HelpCircle className="h-5 w-5 text-purple-600" />
                </div>
                Patient Signal이란?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600 leading-relaxed">
                Patient Signal은 <strong>AI 검색 가시성 추적 서비스</strong>입니다.
                ChatGPT, Perplexity, Claude 등 AI 서비스에게 환자들이 자주 묻는 질문을 던지고,
                응답에서 우리 병원이 얼마나 자주, 긍정적으로 언급되는지 분석합니다.
              </p>
              
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-blue-800 font-medium mb-2">💡 왜 중요한가요?</p>
                <p className="text-blue-700 text-sm">
                  이제 환자들은 &quot;강남 치과 추천해줘&quot;라고 AI에게 물어봅니다.
                  AI가 추천하는 병원이 곧 환자가 선택하는 병원이 됩니다.
                  기존 SEO가 구글/네이버였다면, 이제는 AI 가시성이 핵심입니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* How it works */}
        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-green-600" />
                </div>
                작동 방식
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold text-xl flex items-center justify-center mx-auto mb-3">
                    1
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">질문 설정</h4>
                  <p className="text-sm text-gray-600">
                    AI에게 물어볼 질문(프롬프트)을 설정합니다.
                    자동 생성 기능으로 쉽게 만들 수 있어요.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold text-xl flex items-center justify-center mx-auto mb-3">
                    2
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">AI 크롤링</h4>
                  <p className="text-sm text-gray-600">
                    Patient Signal이 ChatGPT 등 AI에게
                    자동으로 질문하고 응답을 수집합니다.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold text-xl flex items-center justify-center mx-auto mb-3">
                    3
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">분석 & 리포트</h4>
                  <p className="text-sm text-gray-600">
                    우리 병원 언급 여부, 순위, 감성 분석 등
                    상세한 리포트를 제공합니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Getting Started */}
        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Play className="h-5 w-5 text-orange-600" />
                </div>
                시작하기
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">1단계: 병원 정보 등록</h4>
                  <p className="text-gray-600 text-sm">
                    병원명, 지역, 진료과목 등 기본 정보를 입력합니다.
                    이 정보를 바탕으로 AI 질문이 자동 생성됩니다.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">2단계: 프롬프트 설정</h4>
                  <p className="text-gray-600 text-sm">
                    AI에게 물어볼 질문을 설정합니다. 예시:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-500">
                    <li>• &quot;강남역 근처 임플란트 잘하는 치과 추천해줘&quot;</li>
                    <li>• &quot;서울 교정 치과 어디가 좋아?&quot;</li>
                    <li>• &quot;00동 치과 후기 알려줘&quot;</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">3단계: 크롤링 시작</h4>
                  <p className="text-gray-600 text-sm">
                    대시보드에서 &quot;크롤링 시작&quot; 버튼을 클릭하면 AI 응답 수집이 시작됩니다.
                    결과는 몇 분 내에 대시보드에 반영됩니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Dashboard Guide */}
        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                대시보드 활용법
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <h4 className="font-semibold text-gray-900">AI 가시성 점수</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    0~100점으로 표시되는 종합 점수입니다.
                    높을수록 AI가 우리 병원을 자주 추천합니다.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    <h4 className="font-semibold text-gray-900">경쟁사 비교</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    경쟁 병원과의 AI 가시성을 비교합니다.
                    어떤 병원이 더 많이 추천되는지 확인하세요.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                    <h4 className="font-semibold text-gray-900">AI 응답 원문</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    AI가 실제로 어떻게 답변했는지 원문을 확인할 수 있습니다.
                    우리 병원이 어떤 맥락에서 언급되는지 파악하세요.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-orange-600" />
                    <h4 className="font-semibold text-gray-900">인사이트</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    AI 가시성을 높이기 위한 맞춤형 제안을 받아보세요.
                    어떤 키워드를 강화해야 하는지 알 수 있습니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
                  <HelpCircle className="h-5 w-5 text-pink-600" />
                </div>
                자주 묻는 질문
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-b pb-4">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Q. 크롤링은 얼마나 자주 하나요?
                </h4>
                <p className="text-gray-600 text-sm">
                  기본적으로 매일 자동으로 크롤링됩니다. 
                  대시보드에서 수동으로 즉시 크롤링을 실행할 수도 있습니다.
                </p>
              </div>

              <div className="border-b pb-4">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Q. 어떤 AI 플랫폼을 지원하나요?
                </h4>
                <p className="text-gray-600 text-sm">
                  현재 ChatGPT(OpenAI)를 지원하며, 
                  Perplexity, Claude, Gemini 등 추가 플랫폼을 순차적으로 지원 예정입니다.
                </p>
              </div>

              <div className="border-b pb-4">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Q. AI 가시성 점수를 높이려면 어떻게 해야 하나요?
                </h4>
                <p className="text-gray-600 text-sm">
                  AI는 웹상의 정보를 학습합니다. 블로그, 리뷰 사이트, 공식 홈페이지 등에서
                  병원 정보를 풍부하게 관리하면 AI 가시성이 높아집니다.
                  자세한 전략은 인사이트 탭에서 확인하세요.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  Q. 경쟁사는 어떻게 추가하나요?
                </h4>
                <p className="text-gray-600 text-sm">
                  대시보드 &gt; 경쟁사 관리에서 직접 추가하거나,
                  자동 감지 기능을 통해 같은 지역의 경쟁 병원을 찾을 수 있습니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Link href="/dashboard">
            <Button size="lg" className="px-8">
              <Rocket className="h-5 w-5 mr-2" />
              대시보드로 이동
            </Button>
          </Link>
          <p className="text-gray-500 text-sm mt-4">
            추가 문의사항이 있으시면 support@patientsignal.kr로 연락주세요.
          </p>
        </div>
      </main>
    </div>
  );
}
