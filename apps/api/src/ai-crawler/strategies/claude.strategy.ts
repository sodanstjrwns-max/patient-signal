import { AIPlatform } from '@prisma/client';
import { AIQueryResult, SourceItem } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * Claude 질의 전략 - 최저가 모델 + 웹 검색 도구 (web_search_20250305)
 * 【2026.08 비용 절감】폴백 체인: 3-5-haiku($0.8/$4)+웹검색 → haiku-4-5($1/$5)+웹검색 → haiku-4-5 (검색 없음)
 * ※ 기존 sonnet-4($3/$15) 폴백 제거 — 측정 목적(언급 여부)에 고가 모델 불필요
 */
export class ClaudeStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'CLAUDE';
  readonly displayName = 'Claude';

  constructor(private readonly ctx: PlatformQueryContext) {}

  /**
   * 【2026.08】Claude 구조화 인용 추출
   * Claude는 본문 텍스트에 링크를 거의 남기지 않고 (Perplexity와 다름),
   * 인용 정보를 별도 구조에 담아 반환함:
   *  1) text 블록의 citations[] (type: web_search_result_location) — 실제 본문에 근거로 쓴 출처 (우선)
   *  2) web_search_tool_result 블록의 content[] (type: web_search_result) — 검색으로 열람한 페이지 (보조)
   * 기존에는 텍스트 내 URL만 긁어서 타 플랫폼 대비 인용 데이터가 사실상 공백이었음.
   */
  private extractClaudeCitations(content: any[]): { cited: SourceItem[]; searched: SourceItem[] } {
    const cited: SourceItem[] = [];
    const searched: SourceItem[] = [];
    for (const block of content || []) {
      // 1) 본문 근거 인용 (가장 강한 시그널)
      if (block?.type === 'text' && Array.isArray(block.citations)) {
        for (const c of block.citations) {
          if (typeof c?.url === 'string' && c.url.startsWith('http')) {
            cited.push({
              url: c.url,
              title: c.title || undefined,
              type: 'citation',
              platform: 'CLAUDE',
              domain: this.ctx.extractDomain(c.url),
            });
          }
        }
      }
      // 2) 검색 결과 목록 (열람한 페이지 — 보조 시그널)
      if (block?.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (typeof r?.url === 'string' && r.url.startsWith('http')) {
            searched.push({
              url: r.url,
              title: r.title || undefined,
              type: 'grounding',
              platform: 'CLAUDE',
              domain: this.ctx.extractDomain(r.url),
            });
          }
        }
      }
    }
    return { cited, searched };
  }

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const anthropic = this.ctx.getAnthropic();
    if (!anthropic) throw new Error('Anthropic API가 초기화되지 않았습니다');

    this.ctx.logger.log(`[Claude] API 호출 시작 (claude-3-5-haiku + 웹검색)`);

    let responseText = '';
    let model = 'claude-3-5-haiku-latest';
    let isWebSearch = false;
    let claudeUsage: { inputTokens?: number | null; outputTokens?: number | null } | null = null;
    let citedSources: SourceItem[] = [];
    let searchedSources: SourceItem[] = [];

    try {
      // 1순위: Claude 3.5 Haiku + 웹 검색 도구 (웹검색 지원 최저가: $0.8/$4)
      const message = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 2000,
        tools: [
          {
            type: 'web_search_20250305' as any,
            name: 'web_search',
          } as any,
        ],
        messages: [{ role: 'user', content: promptText }],
      });

      // 응답에서 텍스트 블록 추출 (웹 검색 결과 포함)
      for (const block of message.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      // 웹 검색이 사용되었는지 확인
      isWebSearch = message.content.some((block: any) =>
        block.type === 'tool_use' || block.type === 'web_search_tool_result' || block.type === 'server_tool_use'
      );
      claudeUsage = {
        inputTokens: message.usage?.input_tokens ?? null,
        outputTokens: message.usage?.output_tokens ?? null,
      };
      ({ cited: citedSources, searched: searchedSources } = this.extractClaudeCitations(message.content as any[]));

      this.ctx.logger.log(
        `[Claude] 3.5 Haiku 웹 검색 응답 받음 (검색 사용: ${isWebSearch}, 인용 ${citedSources.length}개 + 검색결과 ${searchedSources.length}개)`,
      );
    } catch (webSearchError) {
      this.ctx.logger.warn(`[Claude] 3.5 Haiku 웹검색 실패: ${webSearchError.message}`);

      try {
        // 2순위 폴백: Claude Haiku 4.5 + 웹검색 (3.5 폐기/미서빙 대비)
        const message = await anthropic.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 2000,
          tools: [
            {
              type: 'web_search_20250305' as any,
              name: 'web_search',
            } as any,
          ],
          messages: [{ role: 'user', content: promptText }],
        });

        for (const block of message.content) {
          if (block.type === 'text') {
            responseText += block.text;
          }
        }
        isWebSearch = message.content.some((block: any) =>
          block.type === 'tool_use' || block.type === 'web_search_tool_result' || block.type === 'server_tool_use'
        );
        model = 'claude-haiku-4-5';
        claudeUsage = {
          inputTokens: message.usage?.input_tokens ?? null,
          outputTokens: message.usage?.output_tokens ?? null,
        };
        ({ cited: citedSources, searched: searchedSources } = this.extractClaudeCitations(message.content as any[]));
        this.ctx.logger.log(`[Claude] Haiku 4.5 폴백 웹검색 응답 받음 (인용 ${citedSources.length}개)`);
      } catch (haikuError) {
        this.ctx.logger.warn(`[Claude] Haiku 4.5도 실패, 일반 모드 폴백: ${haikuError.message}`);

        // 최종 폴백: Claude Haiku 4.5 웹검색 없이
        try {
          const message = await anthropic.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 2000,
            temperature: 0,
            messages: [{ role: 'user', content: promptText }],
          });

          responseText = message.content[0].type === 'text' ? message.content[0].text : '';
          model = 'claude-haiku-4-5-no-search';
          claudeUsage = {
            inputTokens: message.usage?.input_tokens ?? null,
            outputTokens: message.usage?.output_tokens ?? null,
          };
        } catch (fallbackError) {
          this.ctx.logger.error(`[Claude] 모든 모드 실패: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
    }

    const result = this.ctx.analyzeResponse(responseText, hospitalName, 'CLAUDE', model);
    result.isWebSearch = isWebSearch;
    this.ctx.applyUsage(result, model.replace('-no-search', ''), claudeUsage, promptText, responseText);

    // 【소스 트래킹】구조화 인용(citations/tool_result) + 텍스트 내 URL 병합
    // 우선순위: 본문 근거 인용 > 텍스트 URL > 검색결과 목록
    const textHints = this.ctx.extractSourceHintsFromText(responseText);
    const inlineUrls = this.ctx.extractInlineUrls(responseText, 'CLAUDE');
    const mergedSources = [...citedSources, ...inlineUrls, ...searchedSources].filter(
      (s, i, arr) => arr.findIndex((x) => x.url === s.url) === i,
    );
    // citedSources(본문 근거)와 inline URL은 cited_sources DB 컴럼에 반영
    const strongCitations = [...citedSources.map((s) => s.url), ...inlineUrls.map((s) => s.url)];
    if (strongCitations.length > 0) {
      result.citedSources = [...new Set([...result.citedSources, ...strongCitations])].slice(0, 15);
    }
    result.sourceHints = {
      sources: mergedSources,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.ctx.classifySources(mergedSources, textHints.hintKeywords),
    };

    return result;
  }
}
