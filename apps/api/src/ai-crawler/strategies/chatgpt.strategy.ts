import { AIPlatform } from '@prisma/client';
import { AIQueryResult, SourceItem } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';
import { pickModels, markUnavailable, isModelIssue } from '../model-registry';

/**
 * ChatGPT 질의 전략 — 웹검색 포함 최저가 경로 (모델 사다리 자동 전환)
 *
 * 【2026-09-08 교체】gpt-4o-mini-search-preview / gpt-4o-search-preview 가 OpenAI에서 폐기(404)되어
 * 검색 없는 gpt-4o-mini 폴백만 돌던 것을 발견. 측정 목적(실제 검색 결과에 병원이 언급되는가)에는
 * 웹검색이 핵심이므로 검색이 되는 가장 싼 경로로 재구성:
 *   1순위: Responses API · 모델 사다리(model-registry CHATGPT: gpt-5-nano → gpt-5-mini → …) + web_search(low, 1회)
 *          — 모델 폐기(404) 시 자동으로 다음 후보로 넘어가고 운영 메일 발송
 *   2순위: Chat Completions · gpt-5-search-api + web_search_options(low)
 *   최종: gpt-4.1-nano (검색 없음 → isWebSearch=false, 할루시네이션 주의)
 *
 * 인용 파싱: Responses는 output[].content[].annotations[type=url_citation].url,
 *           Chat Completions 검색 모델은 message.annotations[].url_citation.url.
 */
const SECONDARY_MODEL = 'gpt-5-search-api';
const LAST_RESORT_MODEL = 'gpt-4.1-nano';

export class ChatGPTStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'CHATGPT';
  readonly displayName = 'ChatGPT';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const openai = this.ctx.getOpenAI();
    if (!openai) throw new Error('OpenAI API가 초기화되지 않았습니다');

    const candidates = pickModels('CHATGPT');
    let response = '';
    let model = candidates[0];
    let isWebSearch = false;
    let rawUsage: { inputTokens?: number | null; outputTokens?: number | null } | null = null;
    let annotations: any[] = [];
    let primaryError: Error | null = null;

    // 1순위: Responses API + web_search 도구 — 사다리 순서대로, 모델 폐기면 다음 후보
    for (const candidate of candidates) {
      model = candidate;
      this.ctx.logger.log(`[ChatGPT] API 호출 시작 (${candidate} + web_search)`);
      try {
        const r: any = await (openai as any).responses.create({
          model: candidate,
          input: promptText,
          tools: [{ type: 'web_search', search_context_size: 'low' }],
          tool_choice: 'auto',
          max_tool_calls: 1,
          reasoning: { effort: 'low' },
          max_output_tokens: 2000,
        });
        const outputs: any[] = Array.isArray(r?.output) ? r.output : [];
        const searched = outputs.some((o) => o?.type === 'web_search_call');
        let text = '';
        const anns: any[] = [];
        for (const o of outputs) {
          if (o?.type !== 'message') continue;
          for (const c of o.content || []) {
            if (typeof c?.text === 'string') text += c.text;
            for (const a of c?.annotations || []) {
              if (a?.type === 'url_citation' && a?.url) anns.push({ url: a.url, title: a.title });
            }
          }
        }
        if (!text.trim()) throw new Error(`빈 응답 (status=${r?.status || 'unknown'})`);
        response = text;
        annotations = anns;
        isWebSearch = searched;
        rawUsage = {
          inputTokens: r?.usage?.input_tokens ?? null,
          outputTokens: r?.usage?.output_tokens ?? null,
        };
        this.ctx.logger.log(
          `[ChatGPT] ${candidate} 응답 받음 (검색 ${searched ? '사용' : '미사용'}, 인용 ${anns.length}개)`,
        );
        primaryError = null;
        break;
      } catch (e: any) {
        primaryError = e;
        if (isModelIssue(e)) {
          await markUnavailable('CHATGPT', candidate, e?.message || String(e));
          continue; // 다음 후보
        }
        break; // 키·한도·네트워크 오류 → 사다리 계속 돌지 않고 2순위 경로로
      }
    }

    if (primaryError) {
      this.ctx.logger.warn(`[ChatGPT] Responses 경로 실패(${model}): ${primaryError.message}`);

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
      } catch (fallbackError: any) {
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
        isWebSearch = false;
        annotations = [];
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
