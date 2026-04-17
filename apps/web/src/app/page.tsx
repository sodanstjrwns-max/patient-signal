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

// Static classes for Tailwind detection
const ABHS_AXES = [
  { axis: 'Voice Share', desc: 'AI 응답에서 우리 병원이 언급되는 비율', icon: Activity, iconBg: 'bg-brand-100', iconColor: 'text-brand-600' },
  { axis: 'Sentiment', desc: '언급 시 긍정·중립·부정 톤 분석', icon: Shield, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  { axis: 'Rec Depth', desc: '단독추천(R3)부터 단순언급(R1)까지', icon: Layers, iconBg: 'bg-violet-100', iconColor: 'text-violet-600' },
  { axis: 'Platform', desc: '4개 플랫폼별 가중치 적용 점수', icon: Globe, iconBg: 'bg-cyan-100', iconColor: 'text-cyan-600' },
  { axis: 'Intent', desc: '예약·비교·공포 등 질문 의도별 분석', icon: Target, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
];

const FEATURES = [
  { icon: Eye, title: 'SoV 기반 가시성 점수', desc: '4개 AI 플랫폼에서 우리 병원이 차지하는 Voice Share를 매일 추적합니다. 점수 변동과 트렌드를 한눈에 확인하세요.', iconBg: 'bg-brand-100', iconColor: 'text-brand-600' },
  { icon: TrendingUp, title: '경쟁사 AEO 비교', desc: '같은 지역 경쟁 병원의 AI 노출 현황을 자동으로 비교합니다. 누가 AI의 1순위 추천을 받고 있는지 파악하세요.', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  { icon: Shield, title: '감성 & 추천 깊이 분석', desc: 'AI가 우리 병원을 긍정적으로 추천하는지(R3), 단순 언급(R1)인지, 부정적(R0)인지 자동으로 분류합니다.', iconBg: 'bg-violet-100', iconColor: 'text-violet-600' },
  { icon: FileText, title: '인용 출처 추적', desc: 'AI가 우리 병원을 추천할 때 어떤 출처(블로그, 리뷰 등)를 참고하는지 추적합니다. 소스 관리 전략에 활용하세요.', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
  { icon: Zap, title: '개선 기회 자동 발견', desc: '경쟁사는 AI에서 추천되지만 우리 병원은 빠져있는 질문 패턴을 자동으로 감지하고 개선 방향을 제시합니다.', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
  { icon: Users, title: '13개 진료과 전문 분석', desc: '치과, 피부과, 성형외과, 정형외과, 한의원, 안과, 내과 등 13개 진료과별 맞춤 질문과 분석을 제공합니다.', iconBg: 'bg-cyan-100', iconColor: 'text-cyan-600' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="glass-strong border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 via-violet-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-black text-xl text-slate-900 tracking-tight">Patient Signal</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className="font-semibold">로그인</Button>
              </Link>
              <Link href="/register">
                <Button className="shadow-md shadow-brand-500/20">무료로 시작하기</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-brand-400/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-violet-400/5 rounded-full blur-[100px]" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass rounded-full px-5 py-2 mb-8 shadow-sm">
            <Bot className="h-4 w-4 text-brand-600" />
            <span className="text-sm font-bold text-brand-700">병원 AI 가시성 관리 플랫폼</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-slate-900 mb-6 leading-[1.1] tracking-tight">
            AI가 우리 병원을<br />
            <span className="text-gradient">
              추천하고 있나요?
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-slate-600 mb-4 max-w-3xl mx-auto leading-relaxed">
            ChatGPT, Perplexity, Claude, Gemini에게 물어보세요.<br />
            <strong className="text-slate-900">"우리 동네 병원 추천해줘"</strong> — 거기에 우리 병원이 나오나요?
          </p>
          <p className="text-base text-slate-500 mb-12 max-w-2xl mx-auto font-medium">
            Patient Signal은 <strong className="text-slate-700">13개 전체 진료과</strong>의 AI 검색 가시성을<br className="hidden sm:block" />
            자동으로 추적하고 분석하는 <strong className="text-slate-700">병원 전문</strong> AEO 플랫폼입니다.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="px-10 py-6 text-base bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 shadow-xl shadow-brand-500/25 font-bold">
                무료로 시작하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/guide">
              <Button variant="outline" size="lg" className="px-8 py-6 text-base glass font-bold">
                서비스 가이드 보기
              </Button>
            </Link>
          </div>

          {/* 지원 진료과 태그 */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-10">
            {['🦷 치과', '💆 피부과', '✨ 성형외과', '🦴 정형외과', '🌿 한의원', '👁️ 안과', '🩺 내과', '👂 이비인후과', '🧠 정신건강의학과', '+4개'].map((tag, i) => (
              <span 
                key={i}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                  i === 9 
                    ? 'bg-slate-100 text-slate-500' 
                    : 'bg-brand-50 text-brand-600 border border-brand-100'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 문제 제기 Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-3xl p-8 sm:p-12 text-white overflow-hidden noise">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900" />
            <div className="absolute top-0 right-0 w-72 h-72 bg-brand-500/15 rounded-full blur-[100px] -translate-y-1/3 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-56 h-56 bg-violet-500/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4" />
            
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-black mb-8 text-center tracking-tight">
                환자의 검색 행동이 바뀌고 있습니다
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {[
                  { num: '73%', desc: '의 MZ세대 환자가\nAI에게 병원 추천을 요청' },
                  { num: '4개', desc: '주요 AI 플랫폼에서\n병원 추천이 실시간 발생' },
                  { num: '0%', desc: '의 병원이 자기 병원의\nAI 노출 현황을 파악 중' },
                ].map((item, i) => (
                  <div key={i} className="rounded-2xl bg-white/[0.06] border border-white/[0.06] p-6 text-center backdrop-blur-sm hover:bg-white/[0.08] transition-colors">
                    <div className="text-4xl sm:text-5xl font-black text-brand-400 mb-3 tabular-nums">{item.num}</div>
                    <p className="text-sm text-slate-400 whitespace-pre-line leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-slate-500 mt-8 text-sm font-medium">
                네이버, 구글 SEO는 이미 하고 계시죠? <strong className="text-white">AI 검색 최적화(AEO)</strong>는 시작하셨나요?
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Patient Signal 프레임워크 Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 glass rounded-full px-5 py-2 mb-5 shadow-sm">
              <Target className="h-4 w-4 text-brand-600" />
              <span className="text-sm font-bold text-brand-700">Patient Signal 독자 프레임워크</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight">
              ABHS 5축 분석으로 정밀하게 측정합니다
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto font-medium">
              단순 키워드 추적이 아닙니다. 5가지 측정축으로 AI가 우리 병원을 <strong className="text-slate-700">얼마나 적극적으로</strong> 추천하는지 분석합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {ABHS_AXES.map((item, i) => (
              <div key={i} className="glass rounded-2xl p-5 text-center hover-lift group">
                <div className={`w-12 h-12 rounded-xl ${item.iconBg} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                  <item.icon className={`h-6 w-6 ${item.iconColor}`} />
                </div>
                <h3 className="font-black text-slate-900 text-sm mb-1.5">{item.axis}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 작동 원리 Section - 3단계 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-mesh">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight">
              3분이면 시작할 수 있습니다
            </h2>
            <p className="text-slate-500 font-medium">복잡한 설정 없이, 3단계면 충분합니다</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: MessageSquare, step: 'STEP 1', title: '병원 정보 입력', desc: '병원명, 진료과, 위치, 주력 진료만\n입력하면 AI 모니터링 질문이\n자동으로 생성됩니다', iconBg: 'bg-brand-100', iconColor: 'text-brand-600', stepColor: 'text-brand-600' },
              { icon: Search, step: 'STEP 2', title: 'AI 자동 분석', desc: '매일, ChatGPT·Perplexity·Claude·Gemini\n4개 플랫폼에 자동으로 질문하고\nABHS 5축 분석을 수행합니다', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', stepColor: 'text-emerald-600' },
              { icon: BarChart3, step: 'STEP 3', title: '인사이트 확인', desc: 'SoV(Voice Share) 중심 대시보드에서\n가시성 점수, 경쟁사 비교,\n개선 기회를 확인하세요', iconBg: 'bg-violet-100', iconColor: 'text-violet-600', stepColor: 'text-violet-600' },
            ].map((item, i) => (
              <div key={i} className="text-center glass rounded-2xl p-8 hover-lift">
                <div className={`w-14 h-14 rounded-2xl ${item.iconBg} flex items-center justify-center mx-auto mb-5`}>
                  <item.icon className={`h-7 w-7 ${item.iconColor}`} />
                </div>
                <div className={`text-sm font-black ${item.stepColor} mb-2 tracking-wider`}>{item.step}</div>
                <h3 className="text-lg font-black text-slate-900 mb-3">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line font-medium">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 주요 기능 Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight">
              원장님이 알아야 할 것들
            </h2>
            <p className="text-slate-500 font-medium">AI가 우리 병원을 어떻게 소개하는지, 정확히 파악하세요</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature, i) => (
              <div key={i} className="glass rounded-2xl p-6 hover-glow group">
                <div className={`w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="font-black text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 대상 고객 Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-600 to-brand-500" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-violet-500/10 rounded-full blur-[80px]" />
        
        <div className="max-w-4xl mx-auto text-center text-white relative z-10">
          <h2 className="text-2xl sm:text-3xl font-black mb-10 tracking-tight">
            이런 원장님께 추천합니다
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-2xl mx-auto">
            {[
              '"ChatGPT한테 우리 병원 물어보면 뭐라 하는지 궁금한" 원장님',
              '"광고비 대비 신환이 줄어드는 느낌이 드는" 원장님',
              '"AEO, AI SEO가 뭔지 알고 싶은" 원장님',
              '"경쟁 병원은 AI에서 어떻게 나오나 궁금한" 원장님',
              '"네이버·구글은 하고 있는데 AI는 뭘 해야 할지 모르겠는" 원장님',
              '"AI 시대에 뒤처지고 싶지 않은" 원장님',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-white/15 transition-colors">
                <CheckCircle className="h-5 w-5 text-brand-200 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-brand-100 leading-relaxed font-medium">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Patient Funnel 연계 Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-50 to-violet-50" />
            <div className="absolute inset-0 border border-brand-100 rounded-3xl" />
            
            <div className="relative z-10">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-5 py-2 mb-5 shadow-sm border border-brand-100">
                  <Sparkles className="h-4 w-4 text-brand-600" />
                  <span className="text-sm font-bold text-brand-700">페이션트 퍼널 × Patient Signal</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-4 tracking-tight">
                  환자 여정의 시작점이 바뀌고 있습니다
                </h2>
                <p className="text-slate-600 max-w-2xl mx-auto font-medium">
                  환자가 병원을 선택하는 10단계 여정, 그 첫 번째 단계인 <strong className="text-slate-900">"인지"</strong>가 
                  이제 AI 추천으로 시작됩니다. Patient Signal은 이 변화를 추적하는 유일한 도구입니다.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                {[
                  { num: '6,000+', desc: '페이션트 퍼널 수강 원장님' },
                  { num: '2.1배', desc: '평균 매출 성장률' },
                  { num: '40%', desc: '광고비 절감' },
                ].map((item, i) => (
                  <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-card hover-lift">
                    <div className="text-3xl font-black text-brand-600 mb-1.5 tabular-nums">{item.num}</div>
                    <p className="text-xs text-slate-500 font-semibold">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-mesh relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-brand-400/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
        
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 via-violet-500 to-brand-600 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-brand-500/25 animate-float">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight">
            지금 바로 확인해보세요
          </h2>
          <p className="text-slate-500 mb-10 font-medium">
            가입부터 첫 분석까지 3분이면 충분합니다.<br />
            무료 7일 체험으로 시작하세요.
          </p>
          <Link href="/register">
            <Button size="lg" className="px-12 py-6 text-base bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 shadow-xl shadow-brand-500/25 font-bold">
              무료로 시작하기
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-xs text-slate-400 mt-5 font-medium">
            신용카드 불필요 · 설치 없음 · 3분 만에 시작
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200/50 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 via-violet-500 to-brand-600 flex items-center justify-center shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold">Patient Signal by 페이션트퍼널</span>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/terms" className="hover:text-slate-600 transition-colors font-medium">
                이용약관
              </Link>
              <Link href="/privacy" className="hover:text-slate-600 transition-colors font-medium">
                개인정보처리방침
              </Link>
              <Link href="/guide" className="hover:text-slate-600 transition-colors font-medium">
                사용 가이드
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
