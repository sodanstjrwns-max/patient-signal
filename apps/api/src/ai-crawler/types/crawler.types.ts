/**
 * AI Crawler 공유 타입 정의
 * C1: 서비스 분리를 위한 타입 중앙화
 */
import { AIPlatform, SentimentLabel } from '@prisma/client';

// 출처 소스 아이템
export interface SourceItem {
  url: string;
  title?: string;
  type: 'citation' | 'grounding' | 'inline_url' | 'hint';
  platform: string;
  domain?: string;
}

// 소스 힌트 (ChatGPT/Claude 텍스트에서 추출한 단서)
export interface SourceHints {
  sources: SourceItem[];
  hintKeywords: string[];
  estimatedSources: string[];
}

// 【Area 2】Answer Position Taxonomy
export type AnswerPositionType = 'PRIMARY_RECOMMEND' | 'COMPARISON_WINNER' | 'INFORMATION_CITE' | 'CONDITIONAL' | 'NEGATIVE';

// AI 질의 결과
export interface AIQueryResult {
  platform: AIPlatform;
  model: string;
  response: string;
  isMentioned: boolean;
  mentionPosition: number | null;
  totalRecommendations: number | null;
  competitorsMentioned: string[];
  citedSources: string[];
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  matchedVariant?: string;
  allMentionCount?: number;
  repeatIndex?: number;
  isWebSearch?: boolean;
  isVerified?: boolean;
  verificationSource?: string;
  confidenceScore?: number;
  confidenceFactors?: Record<string, number>;
  isLowConfidence?: boolean;
  sourceHints?: SourceHints;
  // 【Area 2】Answer Position 정밀 분류
  answerPositionType?: AnswerPositionType;
  // 【Area 4】Answer Quality Score
  answerQualityScore?: number;
  answerQualityFactors?: Record<string, number>;
  // 【Area 2】시간대 세션
  crawlSession?: string;
  // 【P1-6】LLM 비용 추적
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
}

// 측정 결과 집계
export interface AggregatedResult {
  platform: AIPlatform;
  model: string;
  mentionRate: number;
  avgPosition: number | null;
  avgSentiment: number;
  consistencyScore: number;
  responses: AIQueryResult[];
}

// 서킷브레이커 상태
export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

// ⚠️ 삭제됨: PLATFORM_WEIGHTS (합=1.0 점유율 개념)
// ABHS의 플랫폼 가중치는 "점유율"이 아니라 "예약 전환 기여 배율(1.0~1.4)"이며,
// 단일 출처는 scores/weight.service.ts 의 FALLBACK_WEIGHTS.PLATFORM 이다.
// 여기에 유사 상수를 다시 만들면 두 개의 진실이 생겨 점수가 어긋난다.
