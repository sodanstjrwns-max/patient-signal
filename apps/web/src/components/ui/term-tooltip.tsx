'use client';

import { ReactNode, useRef, useState } from 'react';

/**
 * 대시보드 지표 용어 사전
 * — 각 용어에 마우스 오버 시 설명 툴팁으로 표시
 */
export const TERMS: Record<string, { title: string; desc: string }> = {
  mentionRate: {
    title: '언급률',
    desc: 'AI에게 던진 질문(프롬프트) 응답 중 우리 병원 이름이 등장한 비율. AI 검색 가시성의 가장 기본 지표입니다.',
  },
  totalResponses: {
    title: '전체 응답',
    desc: '기간 내 6개 AI(ChatGPT·Gemini·Perplexity·Claude·Grok·CLOVA 등)에게 질문을 던져 수집한 답변의 총 개수입니다.',
  },
  totalMentions: {
    title: '총 언급',
    desc: '수집한 AI 응답 중 우리 병원 이름이 실제로 등장한 응답의 개수입니다.',
  },
  firstPositionShare: {
    title: '1위 점유율',
    desc: '언급된 응답 중 우리 병원이 "첫 번째"로 추천된 비율. AI는 보통 3~5곳을 추천하는데, 언급률이 그대로여도 이 값이 떨어지면 경쟁사가 치고 올라오고 있다는 조기 경보입니다.',
  },
  positionDistribution: {
    title: 'AI 추천 순서 분포',
    desc: '언급된 응답에서 우리 병원이 몇 번째로 불렸는지의 분포. 1번째로 불릴수록 환자 눈에 꽂힐 확률이 높습니다.',
  },
  sentiment: {
    title: '감성',
    desc: 'AI가 우리 병원을 언급할 때의 톤(긍정/중립/부정)을 분석한 것. 부정 비율이 올라가면 리뷰·언론 등 원인 출처를 추적해야 합니다.',
  },
  positiveSentiment: {
    title: '긍정 감성',
    desc: 'AI가 우리 병원을 묘사할 때 긍정적 톤이었던 비율. 부정 비율이 1%만 넘어도 원인 콘텐츠 추적이 필요합니다.',
  },
  fixedCohort: {
    title: '고정 코호트',
    desc: '기간 시작 전부터 존재하던 프롬프트만 골라 집계하는 방식. 기간 중 새 질문이 추가되면 평균이 희석되는 "착시"가 생기는데, 이를 제거하고 같은 질문 셋으로 순수한 성과 추이를 비교합니다.',
  },
  allPrompts: {
    title: '전체 프롬프트',
    desc: '기간 중 추가된 신규 질문까지 전부 포함해 집계하는 방식. 신규 질문이 많이 유입되면 언급률이 실제보다 낮아 보일 수 있습니다.',
  },
  companionRate: {
    title: '언급 동반율',
    desc: '이 출처(도메인)가 AI 답변에 인용될 때, 우리 병원 이름이 "함께" 언급된 비율. 인용만 되고 병원 이름이 안 나오면 홍보 효과가 없으므로, 낮은 채널은 콘텐츠 보강 대상입니다.',
  },
  totalCitations: {
    title: '총 인용 수',
    desc: 'AI가 답변을 만들 때 근거로 제시한 출처(URL)의 총 횟수. AI가 어떤 콘텐츠를 신뢰해 참조하는지 보여줍니다.',
  },
  citationDomains: {
    title: '인용 도메인',
    desc: 'AI가 출처로 제시한 웹사이트(도메인)의 고유 개수. 다양할수록 여러 채널에서 정보가 수집되고 있다는 의미입니다.',
  },
  naverCitationRate: {
    title: '네이버 인용률',
    desc: '전체 인용 출처 중 네이버 계열(블로그·카페·플레이스 등)이 차지하는 비율. 국내 AI 검색에서 네이버 콘텐츠의 영향력을 보여줍니다.',
  },
  citedSources: {
    title: '인용된 출처',
    desc: 'AI 응답에서 근거로 제시된 고유 출처(URL)의 개수입니다.',
  },
  responsesWithSources: {
    title: '출처 포함 응답',
    desc: '수집된 AI 응답 중 출처 링크를 함께 제시한 응답의 개수. Perplexity·ChatGPT 검색 모드에서 주로 수집됩니다.',
  },
  analysisChannels: {
    title: '분석 채널',
    desc: '인용 출처를 성격별로 분류한 카테고리(블로그·카페·병원 홈페이지·의료 플랫폼 등)의 개수입니다.',
  },
  uniqueUrls: {
    title: '고유 URL',
    desc: '도메인이 아닌 개별 페이지(URL) 단위로 집계한 고유 인용 페이지 수. 어떤 "콘텐츠 한 편"이 강한지 정확히 파악할 수 있습니다.',
  },
  crossAI: {
    title: '크로스-AI 인용',
    desc: '3개 이상의 서로 다른 AI가 공통으로 인용한 페이지. 여러 AI가 동시에 신뢰하는 콘텐츠이므로 가장 가치가 높습니다.',
  },
  geminiDecoded: {
    title: 'Gemini 디코딩',
    desc: 'Gemini는 출처 URL을 마스킹(리다이렉트 주소로 은닉)하는데, 이를 풀어 실제 도메인을 복원한 건수입니다.',
  },
  hospitalMentionRate: {
    title: '병원 언급률',
    desc: '이 페이지가 인용된 응답 중 우리 병원 이름이 함께 언급된 비율. 높을수록 우리 병원 홍보에 직접 기여하는 페이지입니다.',
  },
  authority: {
    title: '종합 권위도',
    desc: 'AI가 인용하는 출처들의 신뢰 등급을 가중 평균한 점수(0~10). 정부·학술기관(Tier S)이 많을수록 높고, 광고성 출처(Tier D)가 많을수록 낮아집니다.',
  },
  authorityTier: {
    title: '권위도 Tier',
    desc: '출처의 신뢰 등급 분류. Tier S(정부·학술) > A(언론·공식) > B(전문 플랫폼) > C(블로그·커뮤니티) > D(광고·저신뢰) 순입니다.',
  },
  categoryDiversity: {
    title: '카테고리 다양성',
    desc: 'AI 인용 출처가 몇 개의 채널 카테고리에 분산되어 있는지. 특정 채널 의존도가 높으면 그 채널이 흔들릴 때 가시성이 급락할 위험이 있습니다.',
  },
  confidence: {
    title: '신뢰도',
    desc: 'AI 응답에서 병원 언급을 추출·판정한 분석의 확신도. 40% 미만 저신뢰 응답이 많으면 수치 해석에 주의가 필요합니다.',
  },
  citedCount: {
    title: '인용 수',
    desc: '이 출처가 AI 답변의 근거로 제시된 횟수입니다.',
  },
  citedAI: {
    title: '인용 AI',
    desc: '이 출처를 인용한 AI 플랫폼 목록. 여러 AI에서 동시에 인용될수록 우선 관리 대상입니다.',
  },
};

interface TermTipProps {
  /** TERMS 사전의 키 */
  term: keyof typeof TERMS | string;
  /** 화면에 표시할 라벨 (생략 시 사전의 title 사용) */
  children?: ReactNode;
  className?: string;
  /** ⓘ 아이콘 표시 여부 (기본 true) */
  icon?: boolean;
}

/**
 * 지표 용어 툴팁 — 마우스 오버/포커스 시 설명 표시.
 * position:fixed 렌더링이라 overflow 컨테이너(테이블 스크롤 등) 안에서도 잘리지 않음.
 */
export function TermTip({ term, children, className = '', icon = true }: TermTipProps) {
  const t = TERMS[term];
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);

  if (!t) return <>{children ?? term}</>;

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const TIP_W = 264; // w-64 + padding 여유
    const half = TIP_W / 2;
    const left = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8);
    const below = r.top < 120; // 화면 상단이면 아래로 표시
    setPos({ top: below ? r.bottom + 8 : r.top - 8, left, below });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={ref}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className={`inline-flex items-center gap-0.5 cursor-help ${className}`}
    >
      <span className="border-b border-dotted border-slate-400/70">{children ?? t.title}</span>
      {icon && <span className="text-[0.85em] opacity-60 select-none" aria-hidden>ⓘ</span>}
      {pos && (
        <span
          role="tooltip"
          className={`fixed z-[100] w-64 -translate-x-1/2 ${pos.below ? '' : '-translate-y-full'} rounded-xl bg-slate-900/95 text-white p-3 shadow-xl pointer-events-none whitespace-normal text-left`}
          style={{ top: pos.top, left: pos.left }}
        >
          <span className="block text-xs font-semibold mb-1">{t.title}</span>
          <span className="block text-[11px] leading-relaxed text-slate-200 font-normal">{t.desc}</span>
        </span>
      )}
    </span>
  );
}
