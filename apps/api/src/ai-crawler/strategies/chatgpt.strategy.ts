import { AIPlatform } from '@prisma/client';
import { AIQueryResult, SourceItem } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * ChatGPT 질의 전략 - gpt-4o-mini-search-preview 메인 (실제 웹검색으로 할루시네이션 최소화)
 * 폴백 체인: gpt-4o-mini-search-preview → gpt-4o-search-preview → gpt-4o-mini
 *
 * 【2026.08 파싱 감사】search-preview 모델은 message.annotations[]에
 * url_citation(본문 근거 출처)을 구조화로 반환 — 텍스트 URL만 긁던 기존 방식은
 * 이걸 버려서 Claude와 동일 유형의 인용 누수가 있었음. annotations 파싱 추가.
 */
export class ChatGPTStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'CHATGPT';
  readonly displayName = 'ChatGPT';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const openai = this.ctx.getOpenAI();
    if (!openai) throw new Error('OpenAI API가 초기화되지 않았습니다');

    this.ctx.logger.log(`[ChatGPT] API 호출 시작 (gpt-4o-mini-search-preview)`);

    let response = '';
    let model = 'gpt-4o-mini-search-preview';
    let isWebSearch = false;
    let rawUsage: { inputTokens?: number | null; outputTokens?: number | null } | null = null;
    let annotations: any[] = [];

    try {
      // 【2026.08 비용 절감】1순위: gpt-4o-mini-search-preview ($0.15/$0.60 — 4o-search대비 -94%)
      // 측정 목적(언급 여부)에는 웹검색 유무가 핵심이므로 mini로 충분
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini-search-preview',
        messages: [{ role: 'user', content: promptText }],
        max_tokens: 2000,
        web_search_options: { search_context_size: 'medium' },
      } as any);

      response = completion.choices[0]?.message?.content || '';
      isWebSearch = true;
      annotations = (completion.choices[0]?.message as any)?.annotations || [];
      rawUsage = {
        inputTokens: completion.usage?.prompt_tokens ?? null,
        outputTokens: completion.usage?.completion_tokens ?? null,
      };
      this.ctx.logger.log(`[ChatGPT] gpt-4o-mini-search-preview 웹 검색 응답 받음 (annotations ${annotations.length}개)`);
    } catch (searchError) {
      this.ctx.logger.warn(`[ChatGPT] gpt-4o-mini-search-preview 실패: ${searchError.message}`);

      try {
        // 2순위 폴백: gpt-4o-search-preview (mini 미서빙/장애 시)
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-search-preview',
          messages: [{ role: 'user', content: promptText }],
          max_tokens: 2000,
          web_search_options: { search_context_size: 'medium' },
        } as any);

        response = completion.choices[0]?.message?.content || '';
        model = 'gpt-4o-search-preview';
        isWebSearch = true;
        annotations = (completion.choices[0]?.message as any)?.annotations || [];
        rawUsage = {
          inputTokens: completion.usage?.prompt_tokens ?? null,
          outputTokens: completion.usage?.completion_tokens ?? null,
        };
        this.ctx.logger.log(`[ChatGPT] gpt-4o-search-preview 폴백 응답 받음 (annotations ${annotations.length}개)`);
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

    // 【소스 트래킹】구조화 인용(annotations url_citation) + 텍스트 URL 병합
    const annotationSources: SourceItem[] = [];
    for (const ann of annotations) {
      const url = ann?.url_citation?.url ?? ann?.url;
      if (typeof url === 'string' && url.startsWith('http')) {
        annotationSources.push({
          url,
          title: ann?.url_citation?.title || ann?.title || undefined,
          type: 'citation',
          platform: 'CHATGPT',
          domain: this.ctx.extractDomain(url),
        });
      }
    }
    if (annotationSources.length > 0) {
      result.citedSources = [
        ...new Set([...result.citedSources, ...annotationSources.map((s) => s.url)]),
      ].slice(0, 15);
    }
    const textHints = this.ctx.extractSourceHintsFromText(response);
    const inlineUrls = this.ctx.extractInlineUrls(response, 'CHATGPT');
    const mergedSources = [...annotationSources, ...inlineUrls].filter(
      (s, i, arr) => arr.findIndex((x) => x.url === s.url) === i,
    );
    result.sourceHints = {
      sources: mergedSources,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.ctx.classifySources(mergedSources, textHints.hintKeywords),
    };

    return result;
  }
}
