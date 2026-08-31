'use client';

/**
 * 이용 가이드 (온보딩) 페이지
 *
 * 원장님들이 대시보드를 처음 볼 때 필요한 것들:
 * 1. 핵심 지표 읽는 법 (SoV vs 가시성 점수 혼동이 실제 CS로 들어옴 — 예시 중심 설명)
 * 2. 메뉴별 무엇을 보는 곳인지
 * 3. 주간 사용 루틴 (뭘 언제 보면 되는지)
 * 4. 정직한 기능 상태 고지 (56주 캘린더 = 계획 생성까지, 본문 자동 생성은 준비 중)
 */

import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import {
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  Zap,
  BarChart3,
  Target,
  Gauge,
  Lightbulb,
  Search,
  CalendarDays,
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Thermometer,
  Trophy,
  Percent,
} from 'lucide-react';

/* ─────────────────────────── 데이터 ─────────────────────────── */

const CORE_TERMS = [
  {
    icon: Percent,
    color: 'text-blue-600 bg-blue-50',
    name: '언급률 / SoV',
    oneLiner: '출석률',
    desc: 'AI에게 100번 물었을 때 우리 병원 이름이 답변에 등장한 비율입니다. SoV 9%는 "100번 중 9번 등판, 91번은 이름조차 없었다"는 뜻입니다.',
    caution: '순위가 아닙니다. "몇 % 이상이면 5등 안"이라는 환산은 존재하지 않습니다 — 등판했을 때 몇 번째였는지는 아래 두 지표가 담당합니다.',
  },
  {
    icon: Trophy,
    color: 'text-amber-600 bg-amber-50',
    name: '1위 점유율',
    oneLiner: '주연 비율',
    desc: '언급된 답변 중에서 우리가 "첫 번째"로 불린 비율입니다. 오디션 합격(SoV) 후에 주연을 맡았는지 조연이었는지를 보는 지표입니다.',
    caution: 'SoV가 그대로여도 이 값이 떨어지면 경쟁사가 내 앞자리를 차지하기 시작했다는 조기 경보입니다.',
  },
  {
    icon: Thermometer,
    color: 'text-rose-600 bg-rose-50',
    name: '추천 깊이 (R0~R3)',
    oneLiner: '추천의 온도',
    desc: 'R0 미언급 → R1 스치듯 언급("~병원 등이 있습니다") → R2 목록 내 추천 → R3 단독/최상위 추천("이곳을 추천합니다"). AI가 얼마나 세게 밀어줬는지 4단계입니다.',
    caution: 'R1 백 번보다 R3 열 번이 환자를 움직입니다. 그래서 점수 계산에서 같은 1건으로 세지 않습니다.',
  },
  {
    icon: TrendingUp,
    color: 'text-indigo-600 bg-indigo-50',
    name: 'AI 가시성 점수 (0~100)',
    oneLiner: '내신 종합등급',
    desc: '대시보드 추이 차트에 그려지는 점수입니다. 언급률 35% + 추천순서 25% + 감성 15% + 플랫폼 커버리지 20% + 인용 5%를 합산합니다.',
    caution: 'SoV(%)와 다른 지표입니다. SoV 9%인데 점수가 35점일 수 있습니다 — 자주 불리진 못해도, 불릴 때 앞자리에서 좋은 톤으로 여러 AI에서 불리고 있다는 뜻입니다.',
  },
];

const ADVANCED_TERMS = [
  {
    name: 'ABHS 종합 점수',
    desc: 'SoV × 감성 × 추천깊이 × 플랫폼가중치 × 질문의도의 곱셈식 정밀 점수. 곱하기라서 하나가 0이면 전체가 0 — 언급이 많아도 톤이 부정적이면 점수가 오르지 않습니다. 가시성 점수(덧셈·대시보드용)와 달리 빵꾸 하나가 전체를 끌어내리는 정밀 진단용입니다.',
  },
  {
    name: '감성 (Sentiment)',
    desc: '언급될 때 어떤 톤이었나 (-2 ~ +2). "시설이 훌륭하고 신뢰할 만한"(+2) vs "논란이 있는"(-2). 언급 안 된 응답은 계산에서 제외합니다.',
  },
  {
    name: '질문 의도 (Intent)',
    desc: '"어디로 갈까?"(예약 의도)에서의 언급은 금, "원리가 뭐야?"(정보 의도)에서의 언급은 은. 예약 의도 질문에서 불릴수록 가중치가 높습니다.',
  },
  {
    name: '인용 (Citation)',
    desc: 'AI가 답변을 만들 때 참고했다고 밝힌 웹 문서 — "AI의 식단"입니다. 우리 병원이 어떤 채널(문서) 덕분에 언급되는지를 역추적하는 재료입니다.',
  },
  {
    name: '언급 동반율',
    desc: '어떤 채널이 인용될 때 우리 병원도 같이 언급된 비율. 높으면 우리를 띄워주는 채널, 낮으면 인용만 많고 남 좋은 일만 하는 "착시 상위 채널"입니다.',
  },
  {
    name: '골든 프롬프트',
    desc: '우리 병원이 유난히 잘 불리는 질문(SoV 80%+). 이 질문 유형이 우리의 승리 공식이므로, 비슷한 결의 콘텐츠를 늘리는 힌트가 됩니다.',
  },
];

const MENU_GUIDE: {
  group: string;
  items: { icon: any; name: string; href: string; what: string; when: string }[];
}[] = [
  {
    group: '개요',
    items: [
      {
        icon: LayoutDashboard,
        name: '대시보드',
        href: '/dashboard',
        what: '가시성 점수 추이, 플랫폼별 성적, 최근 언급 현황을 한 화면에. 병원의 AI 검색 건강검진 결과지입니다.',
        when: '매일 아침 1분 — 점수가 꺾였는지만 확인',
      },
      {
        icon: Gauge,
        name: '환자 퍼널 진단',
        href: '/dashboard/funnel',
        what: '환자가 AI에게 묻는 질문 여정(인지→비교→예약) 단계별로 우리가 어디서 새는지 진단합니다.',
        when: '주 1회 — 누수 단계 확인',
      },
    ],
  },
  {
    group: '모니터링',
    items: [
      {
        icon: MessageSquare,
        name: '질문 관리',
        href: '/dashboard/prompts',
        what: '매일 AI에게 자동으로 물어볼 질문 목록을 관리합니다. 여기 등록된 질문이 모든 지표의 출발점입니다.',
        when: '월 1회 점검 — 신규 시술/이벤트 시 질문 추가',
      },
      {
        icon: Sparkles,
        name: 'AI 응답',
        href: '/dashboard/responses',
        what: 'AI가 실제로 뭐라고 답했는지 원문을 봅니다. 우리가 어떻게 소개되는지, 경쟁사는 뭐라고 불리는지 눈으로 확인하는 곳.',
        when: '주 1회 — 특히 부정 언급이 있을 때 원문 확인',
      },
      {
        icon: Zap,
        name: '실시간 질문',
        href: '/dashboard/live-query',
        what: '궁금한 질문을 지금 바로 AI 플랫폼들에 던져보고 즉시 결과를 받습니다. 상담실에서 환자가 물어본 그 질문, 바로 테스트해보세요.',
        when: '필요할 때 — 일일 사용량 제한 있음',
      },
    ],
  },
  {
    group: '분석',
    items: [
      {
        icon: BarChart3,
        name: 'ABHS 분석 리포트',
        href: '/dashboard/analytics',
        what: '정밀 점수(ABHS) 분해 리포트. 플랫폼별 기여도, 추천 깊이 분포, 의도별 성적까지 — 점수가 왜 이 숫자인지 해부합니다.',
        when: '주 1회 — 주간 성적표 확인',
      },
      {
        icon: Target,
        name: '기회 분석',
        href: '/dashboard/opportunities',
        what: '경쟁사는 불리는데 우리는 안 불리는 질문(콘텐츠 갭), 카테고리별 성과를 모아 "다음에 뭘 하면 되는지"를 제안합니다.',
        when: '격주 — 콘텐츠 계획 세울 때',
      },
      {
        icon: Gauge,
        name: '성장 진단',
        href: '/dashboard/growth',
        what: '기간별 성장 추이와 병목 진단. 우리가 지금 성장 구간인지 정체 구간인지 판정합니다.',
        when: '월 1회',
      },
      {
        icon: Lightbulb,
        name: 'AI 인사이트',
        href: '/dashboard/insights',
        what: 'AI별 식성 분석(Gemini 실제 식단, 채널 투자 우선순위 등) 심화 위젯 모음. 어느 채널에 투자할지 데이터로 답합니다.',
        when: '월 1회 — 마케팅 예산 배분 전',
      },
    ],
  },
  {
    group: 'GEO 콘텐츠',
    items: [
      {
        icon: Search,
        name: '인용 역분석',
        href: '/dashboard/citation-analysis',
        what: 'AI가 인용하는 문서들을 역분석해서 "왜 저 페이지는 인용되고 우리는 안 되는지" 격차와 처방을 뽑습니다.',
        when: '격주 — 콘텐츠 개선 포인트 찾을 때',
      },
      {
        icon: CalendarDays,
        name: '56주 캘린더',
        href: '/dashboard/content-calendar',
        what: '병원 맞춤 56주(1년+) 콘텐츠 주제 계획을 자동 생성합니다. 어떤 주에 어떤 주제를 다룰지 로드맵이 나옵니다.',
        when: '최초 1회 생성 후 매주 이번 주 주제 확인',
      },
    ],
  },
  {
    group: '경쟁 · 관리',
    items: [
      {
        icon: Users,
        name: '경쟁사',
        href: '/dashboard/competitors',
        what: '경쟁 병원들의 언급 추이를 나란히 추적합니다. 누가 치고 올라오는지 조기 감지.',
        when: '주 1회',
      },
    ],
  },
];

const WEEKLY_ROUTINE = [
  { day: '매일 아침 (1분)', task: '대시보드에서 가시성 점수 추이만 확인 — 꺾였으면 AI 응답에서 원인(부정 언급/경쟁사 등판) 찾기' },
  { day: '월요일 (10분)', task: 'ABHS 분석 리포트로 지난주 성적 확인 + 56주 캘린더에서 이번 주 콘텐츠 주제 확인' },
  { day: '수요일 (10분)', task: 'AI 응답 원문 훑기 — 우리가 어떤 문장으로 소개되는지, R1인지 R3인지 체감' },
  { day: '금요일 (15분)', task: '기회 분석 + 인용 역분석에서 다음 주 콘텐츠 개선 포인트 1개 선정' },
  { day: '월 1회 (30분)', task: 'AI 인사이트에서 채널 투자 우선순위 확인 → 마케팅 예산/외주 지시에 반영, 질문 관리 목록 점검' },
];

/* ─────────────────────────── 페이지 ─────────────────────────── */

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        title="이용 가이드"
        description="Patient Signal을 처음 보는 원장님을 위한 5분 사용 설명서"
      />

      <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8">
        {/* ═══ 0. 이 서비스가 하는 일 ═══ */}
        <section id="intro-section">
          <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-indigo-100 text-indigo-600 shrink-0">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 mb-2">
                    Patient Signal은 &quot;AI 검색 시대의 건강검진&quot;입니다
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    이제 환자들은 네이버 대신 ChatGPT·Gemini에게 &quot;○○동 임플란트 잘하는 병원&quot;을 묻습니다.
                    Patient Signal은 AI 7개 플랫폼(ChatGPT·Claude·Gemini·Perplexity·Grok·CLOVA X·네이버 AI 브리핑)에 등록된 질문을 자동으로 던지고,
                    <strong className="text-slate-900"> 우리 병원이 등판하는지 · 몇 번째로 불리는지 · 어떤 톤으로 소개되는지</strong>를
                    추적해 점수로 보여줍니다. 광고비를 태우기 전에, AI가 우리를 어떻게 보고 있는지부터 아는 것이 순서입니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ═══ 0.5 가장 먼저 볼 3가지 ═══
            2026.08.26 신설: 유료 원장이 "어떤 질문에 노출되는지 어디서 보냐"고 문의
            → 핵심 기능 3개를 가이드 최상단에서 1·2·3으로 즉답 */}
        <section id="first-three-section">
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <span className="block">처음이라면, 이 3가지부터 보세요</span>
                  <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">
                    5분이면 &quot;AI가 우리를 어떻게 보는지&quot; 감이 잡힙니다
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  step: 1,
                  title: '어떤 질문에 우리가 나오는지 확인',
                  desc: '환자가 AI에게 이렇게 물으면 우리 병원이 답변에 등장합니다 — 어떤 질문에서, 어느 AI가, 몇 번째로 불렀는지까지 나옵니다. 대시보드 첫 화면의 "이번 주 언급된 질문 TOP 5"가 요약본이고, 전체는 여기서 봅니다.',
                  href: '/dashboard/responses?filter=mentioned',
                  cta: 'AI 응답 → "언급됨만" 필터',
                },
                {
                  step: 2,
                  title: '경쟁 병원만 나오는 질문 확인',
                  desc: '같은 질문에 경쟁 병원은 나오는데 우리만 빠진 곳 — 여기가 가장 싸게 이길 수 있는 자리입니다. 콘텐츠 방향을 잡을 때 이 화면부터 여세요.',
                  href: '/dashboard/opportunities',
                  cta: '기회 분석 열기',
                },
                {
                  step: 3,
                  title: '궁금한 질문은 그 자리에서 직접 테스트',
                  desc: '"지금 ○○동 임플란트 물으면 우리 나와?" — 크롤링을 기다릴 필요 없이 직접 입력해서 AI들의 실시간 답변과 언급 여부를 즉시 확인합니다.',
                  href: '/dashboard/live-query',
                  cta: '실시간 질문 열기',
                },
              ].map(item => (
                <Link
                  key={item.step}
                  href={item.href}
                  className="flex items-start gap-3.5 rounded-2xl border border-amber-100 bg-white/70 p-4 hover:border-amber-300 hover:shadow-sm transition-all group"
                >
                  <span className="w-7 h-7 rounded-xl bg-amber-500 text-white text-sm font-black flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">{item.desc}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 mt-2 group-hover:gap-2 transition-all">
                      {item.cta} →
                    </span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* ═══ 1. 핵심 용어 4총사 ═══ */}
        <section id="core-terms-section">
          <h2 className="text-xl font-black text-slate-900 mb-1">1. 숫자 읽는 법 — 핵심 4총사</h2>
          <p className="text-sm text-slate-500 mb-4">이 네 가지만 구분하면 대시보드의 80%가 읽힙니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CORE_TERMS.map((t) => (
              <Card key={t.name} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${t.color}`}>
                      <t.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      <span className="text-xs font-bold text-slate-400">한 줄 요약: &quot;{t.oneLiner}&quot;</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-slate-600 leading-relaxed">{t.desc}</p>
                  <div className="flex items-start gap-2 text-xs bg-slate-50 rounded-lg p-2.5 text-slate-500">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>{t.caution}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 30초 요약 박스 */}
          <div className="mt-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4">
            <p className="text-sm font-bold text-indigo-900">
              💡 30초 요약: <span className="font-medium text-indigo-800">
                SoV는 출석률, 1위 점유율은 주연 비율, R0~R3는 추천의 온도, 가시성 점수는 이걸 다 합친 내신등급입니다.
                차트의 점수가 SoV%보다 높아 보이는 건 — 자주 불리진 못해도 불릴 때 앞자리에서 좋은 톤으로 불리고 있다는 뜻입니다.
              </span>
            </p>
          </div>
        </section>

        {/* ═══ 2. 심화 용어 ═══ */}
        <section id="advanced-terms-section">
          <h2 className="text-xl font-black text-slate-900 mb-1">2. 리포트에 나오는 심화 용어</h2>
          <p className="text-sm text-slate-500 mb-4">ABHS 리포트·인사이트 페이지에서 만나는 개념들. 각 지표 옆 ⓘ 아이콘에서도 같은 설명을 볼 수 있습니다.</p>
          <Card>
            <CardContent className="pt-6 divide-y divide-slate-100">
              {ADVANCED_TERMS.map((t) => (
                <div key={t.name} className="py-3 first:pt-0 last:pb-0">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{t.name}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* ═══ 3. 메뉴 안내 ═══ */}
        <section id="menu-guide-section">
          <h2 className="text-xl font-black text-slate-900 mb-1">3. 메뉴별 안내 — 어디서 뭘 보나</h2>
          <p className="text-sm text-slate-500 mb-4">각 카드를 누르면 해당 메뉴로 이동합니다.</p>
          <div className="space-y-6">
            {MENU_GUIDE.map((group) => (
              <div key={group.group}>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">{group.group}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.items.map((item) => (
                    <Link key={item.name} href={item.href} className="block group">
                      <Card className="h-full hover:border-indigo-300 hover:shadow-md transition-all">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <item.icon className="w-4 h-4 text-indigo-500" />
                            <span className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">{item.name}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed mb-2">{item.what}</p>
                          <p className="text-[11px] font-semibold text-emerald-600">🕐 {item.when}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ 4. 56주 캘린더 사용법 ═══ */}
        <section id="calendar-guide-section">
          <h2 className="text-xl font-black text-slate-900 mb-1">4. 56주 캘린더 — 이렇게 쓰세요</h2>
          <p className="text-sm text-slate-500 mb-4">1년치 콘텐츠 계획을 대신 짜주는 기능입니다.</p>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <ol className="space-y-3">
                {[
                  { step: '1', title: '캘린더 생성 (최초 1회)', desc: '「56주 캘린더 생성」 버튼을 누르면 병원의 진료과목·지역·현재 약점(콘텐츠 갭)을 반영해 주차별 콘텐츠 주제 56개가 자동으로 짜입니다. 몇 분 걸립니다.' },
                  { step: '2', title: '매주 월요일, 이번 주 주제 확인', desc: '이번 주에 어떤 주제를 다루면 되는지 확인합니다. 주제는 AI가 자주 받는 질문과 우리 병원의 빈 곳을 교차해 선정된 것입니다.' },
                  { step: '3', title: '초안이 필요하면 「AI 콘텐츠」 메뉴 활용', desc: '주제를 들고 AI 콘텐츠 메뉴로 가서 GEO 구조(AI가 잘 읽는 형식)의 초안을 생성한 뒤, 병원 실제 사례와 원장님의 목소리를 입혀서 발행하세요.' },
                  { step: '4', title: '발행 후에는 지표로 검증', desc: '발행 2~4주 후 해당 주제 관련 질문의 언급률 변화를 대시보드에서 확인합니다. 오르면 그 결의 콘텐츠를 늘리는 겁니다.' },
                ].map((s) => (
                  <li key={s.step} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{s.title}</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* 정직 고지 */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-900 mb-1">솔직하게 말씀드리면 🙏</p>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    현재 56주 캘린더는 <strong>&quot;주제 계획 생성&quot;까지</strong> 지원합니다.
                    캘린더에서 각 주제의 <strong>본문 원고를 원클릭으로 자동 생성하는 기능은 아직 정식 구현 전</strong>입니다
                    (현재는 AI 콘텐츠 메뉴에서 주제를 직접 입력해 초안을 만드는 방식). 캘린더→원고 원클릭 연결은 준비 중이며,
                    완성되는 대로 이 페이지와 공지로 알려드리겠습니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ═══ 5. 주간 루틴 ═══ */}
        <section id="routine-section">
          <h2 className="text-xl font-black text-slate-900 mb-1">5. 추천 주간 루틴 — 주 37분이면 충분합니다</h2>
          <p className="text-sm text-slate-500 mb-4">매일 다 볼 필요 없습니다. 이 루틴대로만 보세요.</p>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {WEEKLY_ROUTINE.map((r) => (
                  <div key={r.day} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm font-bold text-slate-900">{r.day}</span>
                      <p className="text-sm text-slate-600 leading-relaxed">{r.task}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ═══ 마무리 ═══ */}
        <section id="closing-section" className="pb-8">
          <div className="rounded-xl bg-slate-900 text-white p-6 text-center">
            <p className="text-sm font-medium text-slate-300 leading-relaxed">
              지표가 이해되지 않을 때는 각 숫자 옆의 <span className="text-white font-bold">ⓘ 아이콘</span>을 눌러보세요.
              그래도 궁금하면 언제든 문의 주세요 — 질문 주신 내용은 이 가이드에 계속 반영됩니다.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
