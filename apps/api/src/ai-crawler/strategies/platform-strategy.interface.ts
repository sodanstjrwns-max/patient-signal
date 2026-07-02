import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AIPlatform } from '@prisma/client';
import { AIQueryResult, SourceItem } from '../types';

/**
 * 【P1-5】플랫폼 전략이 사용하는 공유 컨텍스트
 *
 * AICrawlerService가 보유한 공용 분석기/클라이언트를 전략에 주입.
 * 전략은 "API 호출 + 벤더별 응답 파싱"만 담당하고,
 * 매칭/감성/소스 분류 로직은 서비스의 공용 메서드를 그대로 재사용한다.
 */
export interface PlatformQueryContext {
  logger: Logger;

  /** 초기화된 SDK 클라이언트 (없으면 null) */
  getOpenAI(): OpenAI | null;
  getAnthropic(): Anthropic | null;

  /** 응답 텍스트 → 언급/포지션/감성 등 기본 분석 결과 생성 */
  analyzeResponse(
    responseText: string,
    hospitalName: string,
    platform: AIPlatform,
    modelVersion: string,
  ): AIQueryResult;

  /** 텍스트에서 소스 힌트 키워드 추출 */
  extractSourceHintsFromText(text: string): { hintKeywords: string[] };

  /** 텍스트 내 인라인 URL 추출 */
  extractInlineUrls(text: string, platform: string): SourceItem[];

  /** 소스 목록 + 힌트 → 추정 소스 카테고리 분류 */
  classifySources(sources: SourceItem[], hintKeywords: string[]): string[];

  /** URL → 도메인 추출 */
  extractDomain(url: string): string;

  /** 【P1-6】usage/비용 정보를 결과에 기록 */
  applyUsage(
    result: AIQueryResult,
    model: string,
    rawUsage: { inputTokens?: number | null; outputTokens?: number | null } | null,
    promptText: string,
    responseText: string,
  ): void;
}

/**
 * 플랫폼별 질의 전략 인터페이스
 * 구현체: ChatGPT / Claude / Perplexity / Gemini / Grok / CLOVA X
 */
export interface PlatformStrategy {
  readonly platform: AIPlatform;
  /** 로그 등에 쓰는 표시명 (withRetry 라벨) */
  readonly displayName: string;
  query(promptText: string, hospitalName: string): Promise<AIQueryResult>;
}
