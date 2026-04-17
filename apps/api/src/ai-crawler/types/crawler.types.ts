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

// 플랫폼 가중치 상수
export const PLATFORM_WEIGHTS: Record<string, number> = {
  CHATGPT: 0.35,
  PERPLEXITY: 0.30,
  CLAUDE: 0.20,
  GEMINI: 0.15,
};
