import { AIPlatform } from '@prisma/client';
import { AIQueryResult } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * ChatGPT 질의 전략 - gpt-4o-search-preview 메인 (실제 웹검색으로 할루시네이션 최소화)
 * 폴백 체인: gpt-4o-search-preview → gpt-4o-mini-search-preview → gpt-4o-mini
 */
export class ChatGPTStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'CHATGPT';
  readonly displayName = 'ChatGPT';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const openai = this.ctx.getOpenAI();
    if (!openai) throw new Error('OpenAI API가 초기화되지 않았습니다');

    this.ctx.logger.log(`[ChatGPT] API 호출 시작 (gpt-4o-search-preview)`);

    let response = '';
    let model = 'gpt-4o-search-preview';
    let isWebSearch = false;
    let rawUsage: { inputTokens?: number | null; outputTokens?: number | null } | null = null;

    try {
      // 1순위: gpt-4o-search-preview (실제 웹검색, 할루시네이션 최소)
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-search-preview',
        messages: [{ role: 'user', content: promptText }],
        max_tokens: 2000,
        web_search_options: { search_context_size: 'medium' },
      } as any);

      response = completion.choices[0]?.message?.content || '';
      isWebSearch = true;
      rawUsage = {
        inputTokens: completion.usage?.prompt_tokens ?? null,
        outputTokens: completion.usage?.completion_tokens ?? null,
      };
      this.ctx.logger.log(`[ChatGPT] gpt-4o-search-preview 웹 검색 응답 받음`);
    } catch (searchError) {
      this.ctx.logger.warn(`[ChatGPT] gpt-4o-search-preview 실패: ${searchError.message}`);

      try {
        // 2순위 폴백: gpt-4o-mini-search-preview (비용 절감 웹검색)
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini-search-preview',
          messages: [{ role: 'user', content: promptText }],
          max_tokens: 2000,
          web_search_options: { search_context_size: 'medium' },
        } as any);

        response = completion.choices[0]?.message?.content || '';
        model = 'gpt-4o-mini-search-preview';
        isWebSearch = true;
        rawUsage = {
          inputTokens: completion.usage?.prompt_tokens ?? null,
          outputTokens: completion.usage?.completion_tokens ?? null,
        };
        this.ctx.logger.log(`[ChatGPT] gpt-4o-mini-search-preview 폴백 응답 받음`);
      } catch (fallbackError) {
        // 최종 폴백: gpt-4o-mini (웹검색 없음 → 할루시네이션 주의)
        this.ctx.logger.warn(`[ChatGPT] 검색 모델 전부 실패, gpt-4o-mini 폴백: ${fallbackError.message}`);

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: promptText }],
          temperature: 0,
          max_tokens: 2000,
        });

        response = completion.choices[0]?.message?.content || '';
        model = 'gpt-4o-mini';
        rawUsage = {
          inputTokens: completion.usage?.prompt_tokens ?? null,
          outputTokens: completion.usage?.completion_tokens ?? null,
        };
      }
    }

    const result = this.ctx.analyzeResponse(response, hospitalName, 'CHATGPT', model);
    result.isWebSearch = isWebSearch;
    this.ctx.applyUsage(result, model, rawUsage, promptText, response);

    // 【소스 트래킹】ChatGPT 텍스트에서 소스 힌트 추출
    const textHints = this.ctx.extractSourceHintsFromText(response);
    const inlineUrls = this.ctx.extractInlineUrls(response, 'CHATGPT');
    result.sourceHints = {
      sources: inlineUrls,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.ctx.classifySources(inlineUrls, textHints.hintKeywords),
    };

    return result;
  }
}
