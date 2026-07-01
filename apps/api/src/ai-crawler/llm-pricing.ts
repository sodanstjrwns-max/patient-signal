/**
 * LLM 비용 추적 — 모델별 단가표 + 비용 추정 유틸
 *
 * 목적: 병원당/플랫폼당 크롤링 원가를 데이터로 파악 → 플랜 가격 검증
 * 단가 출처: 각 벤더 공식 가격 페이지 (2026.06 기준, USD per 1M tokens)
 *
 * 주의: 가격은 벤더가 수시로 변경 — 어드민 비용 뷰는 "추정치"로 표기할 것.
 *       usage 데이터가 없는 응답(구형 데이터/일부 벤더)은 문자수 기반 근사치 사용.
 */

export interface LlmUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
}

interface ModelPricing {
  /** USD per 1M input tokens */
  input: number;
  /** USD per 1M output tokens */
  output: number;
}

/** 모델명 prefix 매칭 단가표 (구체적인 prefix를 먼저 배치) */
const PRICING_TABLE: Array<{ prefix: string; pricing: ModelPricing }> = [
  // OpenAI
  { prefix: 'gpt-4o-mini-search-preview', pricing: { input: 0.15, output: 0.6 } },
  { prefix: 'gpt-4o-search-preview', pricing: { input: 2.5, output: 10 } },
  { prefix: 'gpt-4o-mini', pricing: { input: 0.15, output: 0.6 } },
  { prefix: 'gpt-4o', pricing: { input: 2.5, output: 10 } },
  // Anthropic
  { prefix: 'claude-haiku-4-5', pricing: { input: 1, output: 5 } },
  { prefix: 'claude-sonnet-4', pricing: { input: 3, output: 15 } },
  { prefix: 'claude-3-5-haiku', pricing: { input: 0.8, output: 4 } },
  // Perplexity
  { prefix: 'sonar-pro', pricing: { input: 3, output: 15 } },
  { prefix: 'sonar', pricing: { input: 1, output: 1 } },
  // Google Gemini
  { prefix: 'gemini-2.5-flash-lite', pricing: { input: 0.1, output: 0.4 } },
  { prefix: 'gemini-2.5-flash', pricing: { input: 0.3, output: 2.5 } },
  // xAI Grok
  { prefix: 'grok-4', pricing: { input: 3, output: 15 } },
  { prefix: 'grok-3-fast', pricing: { input: 5, output: 25 } },
  { prefix: 'grok-3', pricing: { input: 3, output: 15 } },
  // Naver CLOVA X (KRW→USD 환산 근사: HCX-005 약 ₩0.005/token 수준 가정)
  { prefix: 'HCX-005', pricing: { input: 1.5, output: 1.5 } },
  { prefix: 'HCX', pricing: { input: 1.5, output: 1.5 } },
];

/** 모델명으로 단가 조회 (prefix 매칭) */
export function getModelPricing(model: string): ModelPricing | null {
  if (!model) return null;
  const entry = PRICING_TABLE.find((e) => model.startsWith(e.prefix));
  return entry?.pricing || null;
}

/** 토큰 수 기반 비용 추정 (USD) */
export function estimateCostUsd(
  model: string,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
): number | null {
  const pricing = getModelPricing(model);
  if (!pricing) return null;
  const inTok = inputTokens ?? 0;
  const outTok = outputTokens ?? 0;
  if (inTok === 0 && outTok === 0) return null;
  const cost = (inTok / 1_000_000) * pricing.input + (outTok / 1_000_000) * pricing.output;
  // 소수 8자리 반올림 (마이크로 센트 단위)
  return Math.round(cost * 1e8) / 1e8;
}

/**
 * usage 미제공 벤더용 근사 토큰 추정
 * 한국어 기준 대략 1토큰 ≈ 1.5자 (보수적으로 문자수/1.5)
 */
export function approximateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 1.5);
}

/**
 * 벤더 usage 객체 → 표준 LlmUsage 변환 + 비용 계산
 * usage가 없으면 프롬프트/응답 텍스트 기반 근사치 사용
 */
export function buildUsage(
  model: string,
  rawUsage: { inputTokens?: number | null; outputTokens?: number | null } | null,
  fallbackTexts?: { prompt?: string; response?: string },
): LlmUsage {
  let inputTokens = rawUsage?.inputTokens ?? null;
  let outputTokens = rawUsage?.outputTokens ?? null;

  if (inputTokens == null && fallbackTexts?.prompt) {
    inputTokens = approximateTokens(fallbackTexts.prompt);
  }
  if (outputTokens == null && fallbackTexts?.response) {
    outputTokens = approximateTokens(fallbackTexts.response);
  }

  return {
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateCostUsd(model, inputTokens, outputTokens),
  };
}
