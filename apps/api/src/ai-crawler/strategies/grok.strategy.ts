import { AIPlatform } from '@prisma/client';
import { AIQueryResult } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * 【NEW】Grok (xAI) 질의 전략 — 실시간 X(Twitter) 통합 + 웹검색 강점
 * 모델: grok-4 (2026.05 기준 플래그십, 256K 컨텍스트, $3/$15 per M tokens)
 *   - 환경변수 GROK_MODEL 로 오버라이드 가능
 * 엔드포인트: https://api.x.ai/v1/chat/completions (OpenAI 호환)
 */
export class GrokStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'GROK';
  readonly displayName = 'Grok';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const xaiApiKey = process.env.XAI_API_KEY?.trim();
    if (!xaiApiKey) throw new Error('XAI_API_KEY가 설정되지 않았습니다');

    const modelName = process.env.GROK_MODEL?.trim() || 'grok-4';

    this.ctx.logger.log(`[Grok] API 호출 시작 (${modelName}, temp=0)`);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: promptText, // 시스템 프롬프트 없음 — 다른 플랫폼과 일관성
          },
        ],
        temperature: 0,
        stream: false,
        // 【측정 정확도 FIX】Live Search 활성화 — 실제 유저의 Grok과 동일 조건
        // 이게 없으면 훈련 데이터만으로 답변 → 언급률 3%로 왜곡되던 원인
        // mode:'auto' = 모델이 필요 시 웹/X 검색 (실제 사용자 기본값과 동일)
        // 비용 주의: Live Search는 소스당 과금($0.025/source) — max 10개로 상한
        //    (GROK_SEARCH_MAX_RESULTS env로 조정 가능)
        search_parameters: {
          mode: 'auto',
          return_citations: true,
          max_search_results: parseInt(process.env.GROK_SEARCH_MAX_RESULTS || '10', 10),
        },
      }),
    });

    const data: any = await response.json();

    if (data.error) {
      throw new Error(`Grok 에러: ${JSON.stringify(data.error)}`);
    }

    const text = data.choices?.[0]?.message?.content || '';

    const result = this.ctx.analyzeResponse(text, hospitalName, 'GROK', modelName);
    // Live Search 활성화 상태로 질의함 (search_parameters.mode=auto)
    result.isWebSearch = true;

    // Live Search 인용(citations) 수집 — 응답 최상위 citations 배열로 반환됨
    const apiCitations: string[] = Array.isArray(data.citations)
      ? data.citations.filter((u: any) => typeof u === 'string')
      : [];
    if (apiCitations.length > 0) {
      result.citedSources = [...new Set([...result.citedSources, ...apiCitations])].slice(0, 15);
    }
    this.ctx.applyUsage(
      result,
      modelName,
      {
        inputTokens: data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.completion_tokens ?? null,
      },
      promptText,
      text,
    );

    // 텍스트 내 소스 힌트 추출 (Grok citation 미지원 시 텍스트에서 URL 패턴 검출)
    const inlineUrls = this.ctx.extractInlineUrls(text, 'GROK');
    const textHints = this.ctx.extractSourceHintsFromText(text);
    if (inlineUrls.length > 0) {
      result.citedSources = [...new Set([...result.citedSources, ...inlineUrls.map((s) => s.url)])].slice(0, 15);
    }
    result.sourceHints = {
      sources: inlineUrls,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.ctx.classifySources(inlineUrls, textHints.hintKeywords),
    };

    this.ctx.logger.log(
      `[Grok] 응답 ${text.length}자, citations ${apiCitations.length}개 + 인라인 URL ${inlineUrls.length}개 추출`,
    );
    return result;
  }
}
