import { AIPlatform } from '@prisma/client';
import { AIQueryResult, SourceItem } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * ChatGPT 질의 전략 — 웹검색 포함 최저가 경로
 *
 * 【2026-09-08 교체】gpt-4o-mini-search-preview / gpt-4o-search-preview 가 OpenAI에서 폐기(404)되어
 * 검색 없는 gpt-4o-mini 폴백만 돌던 것을 발견. 측정 목적(실제 검색 결과에 병원이 언급되는가)에는
 * 웹검색이 핵심이므로 검색이 되는 가장 싼 경로로 재구성:
 *   1순위: Responses API · gpt-5-nano + web_search(low) — 토큰 $0.05/$0.40 per 1M (최저가), 검색 호출 최대 1회(도구 호출비 $10/1k 절감)
 *   2순위: Chat Completions · gpt-5-search-api + web_search_options(low) — 검색 내장 모델(토큰 단가는 gpt-5급)
 *   최종: gpt-4.1-nano (검색 없음 → isWebSearch=false, 할루시네이션 주의)
 *
 * 인용 파싱: Responses는 output[].content[].annotations[type=url_citation].url,
 *           Chat Completions 검색 모델은 message.annotations[].url_citation.url.
 */
const PRIMARY_MODEL = 'gpt-5-nano';
const SECONDARY_MODEL = 'gpt-5-search-api';
const LAST_RESORT_MODEL = 'gpt-4.1-nano';

export class ChatGPTStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'CHATGPT';
  readonly displayName = 'ChatGPT';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const openai = this.ctx.getOpenAI();
    if (!openai) throw new Error('OpenAI API가 초기화되지 않았습니다');

    this.ctx.logger.log(`[ChatGPT] API 호출 시작 (${PRIMARY_MODEL} + web_search)`);

    let response = '';
    let model = PRIMARY_MODEL;
    let isWebSearch = false;
    let rawUsage: { inputTokens?: number | null; outputTokens?: number | null } | null = null;
    let annotations: any[] = [];

    try {
      // 1순위: Responses API + web_search 도구 (검색 호출 상한 1회, 저맥락으로 토큰 절약)
      const r: any = await (openai as any).responses.create({
        model: PRIMARY_MODEL,
        input: promptText,
        tools: [{ type: 'web_search', search_context_size: 'low' }],
        tool_choice: 'auto',
        max_tool_calls: 1,
        reasoning: { effort: 'low' },
        max_output_tokens: 2000,
      });
      const outputs: any[] = Array.isArray(r?.output) ? r.output : [];
      const searched = outputs.some((o) => o?.type === 'web_search_call');
      for (const o of outputs) {
        if (o?.type !== 'message') continue;
        for (const c of o.content || []) {
          if (typeof c?.text === 'string') response += c.text;
          for (const a of c?.annotations || []) {
            if (a?.type === 'url_citation' && a?.url) annotations.push({ url: a.url, title: a.title });
          }
        }
      }
      if (!response.trim()) throw new Error(`빈 응답 (status=${r?.status || 'unknown'})`);
      isWebSearch = searched;
      rawUsage = {
        inputTokens: r?.usage?.input_tokens ?? null,
        outputTokens: r?.usage?.output_tokens ?? null,
      };
      this.ctx.logger.log(
        `[ChatGPT] ${PRIMARY_MODEL} 응답 받음 (검색 ${searched ? '사용' : '미사용'}, 인용 ${annotations.length}개)`,
      );
    } catch (primaryError) {
      this.ctx.logger.warn(`[ChatGPT] ${PRIMARY_MODEL} 실패: ${primaryError.message}`);

      try {
        // 2순위: 검색 내장 chat 모델
        const completion = await openai.chat.completions.create({
          model: SECONDARY_MODEL,
          messages: [{ role: 'user', content: promptText }],
          max_tokens: 1500,
          web_search_options: { search_context_size: 'low' },
        } as any);

        response = completion.choices[0]?.message?.content || '';
        model = SECONDARY_MODEL;
        isWebSearch = true;
        annotations = ((completion.choices[0]?.message as any)?.annotations || []).map((a: any) => ({
          url: a?.url_citation?.url ?? a?.url,
          title: a?.url_citation?.title ?? a?.title,
        }));
        rawUsage = {
          inputTokens: completion.usage?.prompt_tokens ?? null,
          outputTokens: completion.usage?.completion_tokens ?? null,
        };
        this.ctx.logger.log(`[ChatGPT] ${SECONDARY_MODEL} 폴백 응답 받음 (인용 ${annotations.length}개)`);
      } catch (fallbackError) {
        // 최종 폴백: 검색 없음 (측정 신뢰도 낮음 — isWebSearch=false 로 표시)
        this.ctx.logger.warn(`[ChatGPT] 검색 경로 전부 실패, ${LAST_RESORT_MODEL} 폴백: ${fallbackError.message}`);

        const completion = await openai.chat.completions.create({
          model: LAST_RESORT_MODEL,
          messages: [{ role: 'user', content: promptText }],
          temperature: 0,
          max_tokens: 1500,
        });

        response = completion.choices[0]?.message?.content || '';
        model = LAST_RESORT_MODEL;
        rawUsage = {
          inputTokens: completion.usage?.prompt_tokens ?? null,
          outputTokens: completion.usage?.completion_tokens ?? null,
        };
      }
    }

    const result = this.ctx.analyzeResponse(response, hospitalName, 'CHATGPT', model);
    result.isWebSearch = isWebSearch;
    this.ctx.applyUsage(result, model, rawUsage, promptText, response);

    // 【소스 트래킹】구조화 인용(url_citation) + 텍스트 URL 병합
    const annotationSources: SourceItem[] = [];
    for (const ann of annotations) {
      const url = ann?.url;
      if (typeof url === 'string' && url.startsWith('http')) {
        annotationSources.push({
          url,
          title: ann?.title || undefined,
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
