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

  // ━━━ 성장 진단 용어 ━━━
  supplyIndex: {
    title: '공급량 지수',
    desc: '그 채널에 세상에 존재하는 문서의 상대적 양. 인스타그램을 1000으로 잡은 기준값입니다. 이 값이 클수록 "흔한 채널"이라서 인용이 많이 나오는 게 당연합니다.',
  },
  citationEfficiency: {
    title: '문서당 인용 효율',
    desc: '인용수 ÷ 공급량. 인용수만 보면 "인스타가 1위니까 인스타를 더 하자"는 결론이 나오는데, 그건 인스타 문서가 원래 많아서 그런 것입니다. 효율은 문서 1개가 얼마나 일하는지를 봅니다.',
  },
  misleadingTop: {
    title: '착시 상위 채널',
    desc: '인용수 순위는 높지만 문서당 효율 순위는 낮은 채널. "많이 인용되니까 좋은 채널"이라는 역인과 오류의 발원지입니다. 물량으로 이긴 것이지 채널이 좋은 게 아닙니다.',
  },
  hiddenGem: {
    title: '숨은 보석',
    desc: '인용수는 적지만 문서당 효율이 압도적으로 높은 채널. 문서 1개만 더 올려도 인용이 늘어나는 구간이라 투입 대비 회수가 가장 좋습니다.',
  },
  portfolioZone: {
    title: '포트폴리오 4구역',
    desc: '본진(내가 통제하는 홈페이지·GBP) / 고효율 저격수(공급 적고 권위 높은 위키·플랫폼) / 물량 파도(공급 많아 계속 밀어야 하는 SNS) / 하지마(투입 대비 회수 안 되는 곳)로 인용 출처를 분류한 것입니다.',
  },
  channelDurability: {
    title: '채널 수명',
    desc: '축적형(위키·홈페이지 — 한 번 올리면 계속 인용됨)과 소모형(SNS — 2~6주면 밀려남)의 구분. 소모형 비중이 높으면 발행을 멈추는 순간 가시성이 같이 사라집니다.',
  },
  regionLeverage: {
    title: '지역 단위 배율',
    desc: '"역삼동 치과"처럼 좁은 지역 질문이 "서울 치과"처럼 넓은 질문보다 몇 배 유리한지. 실측 벤치마크는 동 단위가 시/구 단위보다 1.7배, Gemini에서는 3.0배 유리합니다.',
  },
  directorBranding: {
    title: '원장 실명 브랜딩률',
    desc: 'AI가 "원장"이라는 일반명사를 말하는 비율(실측 25.8%)과 원장 실명을 말하는 비율(실측 0.7%)의 차이. 실명이 언급되려면 실명 자체가 AI에게 하나의 개체(엔티티)로 학습돼 있어야 합니다.',
  },
  aeoVsGeo: {
    title: 'AEO vs GEO',
    desc: 'AEO는 AI가 실시간 검색을 거쳐 답한 경우(반영 2~4주, 단기전). GEO는 검색 없이 답한 경우로, 여기서 언급되면 모델이 우리를 이미 "알고" 있다는 뜻입니다(장기전).',
  },
  geoPenetration: {
    title: '사전학습 침투율',
    desc: 'GEO 언급률 ÷ AEO 언급률. 1에 가까울수록 검색 없이도 우리를 아는 상태입니다. 낮으면 검색 노출에만 의존하고 있다는 뜻입니다.',
  },
  languageScoreboard: {
    title: '언어별 성적표',
    desc: '한국어/영어/중국어/일본어 질문별 언급률. 외국어 영역은 경쟁자가 손을 안 대는 경우가 많아 상대적으로 잡기 쉬운 무주공산일 수 있습니다.',
  },
  queryDifficulty: {
    title: '질문 난이도',
    desc: '쉬움(지역+시술 롱테일, 경쟁 없음) / 보통 / 어려움(넓은 지역·비교 요구 빅키워드). 쉬운 질문만 넣고 SoV 90%를 자랑하는 건 경쟁 없는 곳에서 이긴 것입니다.',
  },
  balancedSov: {
    title: '보정 SoV',
    desc: '난이도 3구간의 SoV를 단순평균한 값. 쉬운 질문이 많으면 종합 SoV가 부풀려지므로, 이 값과 함께 봐야 착시가 사라집니다.',
  },
  negativeAlert: {
    title: '부정 언급 조기경보',
    desc: '부정 감성은 실측 0.1%로 드물지만, 그 답변을 본 환자는 100% 그 문장을 읽습니다. 비율이 아니라 건수로 감시하고 어느 출처에서 왔는지 역추적해야 합니다.',
  },
  // ─────────────────────────────────────────────────────────
  // ABHS 점수 체계 — 노출은 목적이 아니라 예약으로 가는 경로다
  // ─────────────────────────────────────────────────────────
  abhs: {
    title: 'ABHS 종합 점수',
    desc: 'AI-Based Hospital Score. "AI가 우리 병원을 얼마나 잘 추천하는가"를 0~100으로 환산한 종합 점수입니다. 단순 언급률이 아니라 SoV × 감성 × 추천깊이 × 플랫폼가중치 × 질문의도를 곱해서 냅니다. 이름만 불리는 것과 "여기 가세요"라고 단독 추천받는 것을 같은 1건으로 세지 않기 위한 설계입니다.',
  },
  abhsFormula: {
    title: 'ABHS 계산식',
    desc: 'SoV(얼마나 자주 불리나) × Sentiment(어떤 톤으로) × Depth(얼마나 강하게 추천) × Weight(어느 AI에서) × Intent(어떤 의도의 질문에서). 다섯 축을 곱하기 때문에 하나가 0이면 전체가 0이 됩니다 — 언급돼도 부정적이면 점수가 안 오릅니다.',
  },
  sov: {
    title: 'SoV (점유율)',
    desc: 'Share of Voice. AI 답변이라는 한정된 공간에서 우리 병원이 차지한 지분입니다. AI는 보통 3~5곳만 추천하므로, 6번째부터는 존재하지 않는 것과 같습니다.',
  },
  recommendationDepth: {
    title: '추천 깊이 (R0~R3)',
    desc: 'AI가 우리 병원을 "어떤 강도로" 추천했는지 4단계로 구분합니다. 이름만 스쳐 지나간 것(R1)과 "이곳을 추천합니다"라고 단독 지목한 것(R3)은 환자 행동에 미치는 영향이 완전히 다릅니다.',
  },
  r0: {
    title: 'R0 — 미언급',
    desc: '질문했지만 우리 병원이 아예 등장하지 않았습니다. 점수 기여 0. 경쟁사만 답변에 들어간 상태입니다.',
  },
  r1: {
    title: 'R1 — 단순 언급',
    desc: '이름은 나왔지만 추천 맥락이 아닙니다(예: 여러 곳 나열 중 하나, 지역 설명 중 언급). 환자 결정에 거의 영향이 없어 기여도가 낮습니다.',
  },
  r2: {
    title: 'R2 — 목록 내 추천',
    desc: '추천 목록 안에 정식으로 포함됐습니다. 여기서부터 환자가 우리를 후보로 인식합니다.',
  },
  r3: {
    title: 'R3 — 단독/최상위 추천',
    desc: 'AI가 우리를 최우선으로 지목했습니다. 가장 가치가 높은 상태이며, 사실상 AI가 환자를 우리에게 안내하는 것과 같습니다.',
  },
  platformWeight: {
    title: '플랫폼 가중치',
    desc: 'AI 플랫폼별로 "예약까지 이어질 확률"이 다르기 때문에 부여하는 배율(1.0~1.4). Perplexity처럼 출처를 붙여 답하는 AI는 환자 신뢰도가 높아 가중치가 큽니다. 트래픽 점유율이 아니라 전환 기여도 기준입니다.',
  },
  queryIntent: {
    title: '질문 의도',
    desc: '환자가 던진 질문의 속내를 5종으로 분류합니다(예약·비교·정보·후기·두려움). "강남 임플란트 예약"과 "임플란트란 무엇인가"는 같은 노출 1건이어도 매출 거리가 전혀 다릅니다.',
  },
  intentReservation: {
    title: '예약 의도',
    desc: '"예약", "가격", "상담" 같은 실행 직전 질문. 여기서 노출되는 1건이 정보성 질문 10건보다 값집니다. 가중치가 가장 높습니다(1.5).',
  },
  intentFear: {
    title: '두려움 의도',
    desc: '"아프지 않나요", "부작용", "실패하면" 같은 불안 기반 질문. 환자의 두려움을 먼저 해소해 준 병원이 선택됩니다. 경쟁 병원이 가장 자주 비워두는 구간입니다.',
  },
  abhsContribution: {
    title: '응답 기여도',
    desc: '이 AI 응답 1건이 ABHS 종합 점수에 실제로 얼마나 보탬이 됐는지 수치화한 값. 어떤 질문·어떤 플랫폼을 손봐야 점수가 오르는지 역추적할 때 씁니다.',
  },

  // ─────────────────────────────────────────────────────────
  // 퍼널 — 인지에서 소개까지의 환자 여정
  // ─────────────────────────────────────────────────────────
  funnelHealth: {
    title: '퍼널 건강 점수',
    desc: '환자가 우리를 인지하고→비교하고→결정하는 각 단계에서 AI에 제대로 노출되는지 진단한 점수. 특정 단계만 뚫려 있으면 앞뒤가 새는 구조라 매출로 이어지지 않습니다.',
  },
  funnelStage: {
    title: '퍼널 단계',
    desc: '환자 여정을 인지 → 흥미 → 비교 → 결정 → 예약으로 나눈 단계. 각 단계마다 환자가 던지는 질문이 다르므로, 단계별로 노출을 따로 관리해야 합니다.',
  },
  funnelLeak: {
    title: '퍼널 누수',
    desc: '전환 직결 단계(비교·결정)에서 AI에 노출되지 않아 놓치고 있는 잠재 신환 규모. 인지 단계만 잘 잡혀 있으면 광고비만 새고 예약은 안 늘어납니다.',
  },

  // ─────────────────────────────────────────────────────────
  // 경쟁 / 콘텐츠 갭
  // ─────────────────────────────────────────────────────────
  competitorShare: {
    title: '경쟁 점유율',
    desc: 'AI 답변 공간을 경쟁 병원들이 차지한 비율. 우리 언급률이 그대로인데 이 값이 오르면, 우리가 후퇴한 게 아니라 남이 전진한 상황입니다.',
  },
  visibilityScore: {
    title: 'AI 가시성 점수',
    desc: '경쟁사가 AI 답변에서 얼마나 잘 보이는지 추정한 점수. AI 응답 기반 추정치이므로 절대값보다 우리와의 격차 추이로 읽어야 합니다.',
  },
  contentGap: {
    title: '콘텐츠 갭',
    desc: '경쟁사는 노출되는데 우리는 안 되는 주제. 아무도 제대로 답하지 않은 질문을 우리가 먼저 채우면 가장 적은 비용으로 이깁니다.',
  },
  opportunityScore: {
    title: '기회 점수',
    desc: '질문의 수요(자주 물어봄) × 우리 부재(안 나옴) × 난이도(경쟁 적음)를 조합한 우선순위 점수. 높은 것부터 손대면 같은 노력으로 더 오릅니다.',
  },

  // ─────────────────────────────────────────────────────────
  // 신뢰도 / 품질
  // ─────────────────────────────────────────────────────────
  confidenceScore: {
    title: '응답 신뢰도',
    desc: 'AI 답변이 실제 사실에 근거했는지 0~1로 평가한 값. AI는 없는 병원·틀린 주소를 그럴듯하게 지어내기 때문에(환각), 낮은 값은 집계에서 걸러야 합니다.',
  },
  lowConfidence: {
    title: '저신뢰 응답',
    desc: '신뢰도 0.4 미만으로, AI가 근거 없이 지어낸 것으로 의심되는 답변. 이 응답으로 성과를 판단하면 실체 없는 숫자를 보게 됩니다.',
  },
  answerQuality: {
    title: '답변 품질 점수',
    desc: 'AI가 우리 병원을 언급할 때 주소·진료과목·강점을 정확히 말했는지 채점한 값. 이름만 맞고 정보가 틀리면 환자가 다른 병원으로 갑니다.',
  },
  answerPositionType: {
    title: '답변 내 위치 유형',
    desc: '우리가 답변에서 어떤 역할로 등장했는지 분류합니다(최우선 추천 · 비교 우위 · 정보 인용 · 조건부 · 부정). 같은 노출도 역할에 따라 가치가 다릅니다.',
  },
  isWebSearch: {
    title: '웹 검색 모드',
    desc: 'AI가 답변할 때 실시간 웹 검색을 썼는지 여부. 검색 없이도 우리를 안다면 AI 머릿속(사전학습)에 자산으로 박힌 것이고, 검색해야만 안다면 검색 노출에 의존하는 상태입니다.',
  },
  verified: {
    title: '검증됨',
    desc: '네이버 플레이스·카카오맵 등 실제 등록 정보와 대조해 환각이 아님을 확인한 응답입니다.',
  },

  // ─────────────────────────────────────────────────────────
  // 출처 / 권위
  // ─────────────────────────────────────────────────────────
  naverBriefing: {
    title: '네이버 AI 브리핑',
    desc: '네이버 검색 결과 최상단에 AI가 요약해주는 영역. 한국 환자 대부분이 네이버에서 출발하므로, 여기 진입 여부가 국내 유입의 관문입니다.',
  },
  pbnSuspect: {
    title: '위성 사이트 의심',
    desc: '인용 링크를 몰아주기 위해 급조된 것으로 보이는 도메인(PBN). 잠깐 순위가 오를 수 있으나 AI가 신뢰를 회수하면 그동안 쌓은 게 함께 사라집니다. 손대지 말아야 할 구역입니다.',
  },
  newChannel: {
    title: '신규 채널',
    desc: '최근 처음으로 AI 인용에 등장한 도메인. 경쟁사가 새 채널을 뚫었다는 신호일 수 있어 조기에 확인해야 합니다.',
  },
  surgingChannel: {
    title: '급상승 채널',
    desc: '인용 빈도가 단기간에 급격히 늘어난 도메인. 누군가 의도적으로 밀고 있거나, AI가 그 채널을 새로 신뢰하기 시작한 것입니다.',
  },
  eeat: {
    title: 'E-E-A-T',
    desc: '경험·전문성·권위·신뢰. 의료는 사람 몸을 다루기 때문에 AI가 특히 엄격하게 보는 기준입니다. 원장 실명·전문의 자격·논문·실제 진료 사례가 여기에 해당합니다.',
  },
  schemaMarkup: {
    title: '구조화 데이터',
    desc: '사람 눈에는 안 보이지만 기계가 읽는 병원 정보 표기법(LocalBusiness·FAQPage·Physician). 이게 없으면 AI가 우리 홈페이지를 읽고도 무슨 병원인지 확신하지 못합니다.',
  },
  crawlability: {
    title: '크롤 가능성',
    desc: 'AI 로봇이 우리 홈페이지를 읽을 수 있는 상태인지. 순위를 올리기 전에 먼저 "읽을 수 있게" 만드는 것이 순서입니다. 못 읽으면 순위 자체가 존재하지 않습니다.',
  },

  // ─────────────────────────────────────────────────────────
  // 콘텐츠 / 운영
  // ─────────────────────────────────────────────────────────
  geoContent: {
    title: 'GEO 콘텐츠',
    desc: 'AI가 인용하기 쉬운 형태로 만든 콘텐츠. 결론을 맨 앞에 놓고, 한 문단이 그 자체로 완결되게 쓰며, Q&A 구조를 갖춥니다. 사람이 읽기 좋은 글과 AI가 인용하기 좋은 글은 형태가 다릅니다.',
  },
  patientLanguage: {
    title: '환자의 언어',
    desc: '환자는 "보철"이 아니라 "씌우는 거"라고 검색합니다. 전문 용어로만 쓴 콘텐츠는 실제 질문과 만나지 못합니다.',
  },
  goldenPrompt: {
    title: '골든 프롬프트',
    desc: '매출로 직결되는 핵심 질문. 수십 개를 얕게 보는 대신 이 몇 개를 집중 추적해야 의미 있는 변화를 봅니다.',
  },
  promptType: {
    title: '질문 유형',
    desc: '자동 생성 · 직접 등록 · 프리셋으로 구분됩니다. 직접 등록한 질문이 실제 환자 언어에 가까워 신뢰도가 높습니다.',
  },
  liveQuery: {
    title: '실시간 질문',
    desc: '지금 즉시 6개 AI에 같은 질문을 던져 답변을 받아보는 기능. 정기 수집과 달리 방금 바꾼 콘텐츠가 반영됐는지 바로 확인할 때 씁니다.',
  },
  crawlSession: {
    title: '수집 시간대',
    desc: '오전·오후·저녁 중 언제 수집한 응답인지. 같은 질문도 시간대별로 답이 달라질 수 있어 편향을 걸러내는 데 씁니다.',
  },
  repeatIndex: {
    title: '반복 측정',
    desc: '같은 질문을 여러 번 던진 회차. AI 답변은 매번 조금씩 달라지므로, 1회 결과로 판단하면 우연을 성과로 착각합니다.',
  },
  weeklyReport: {
    title: '주간 리포트',
    desc: '한 주간의 ABHS 변화·경쟁 구도·조치 항목을 정리한 보고서. 팀 공유와 의사결정 기록용입니다.',
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
