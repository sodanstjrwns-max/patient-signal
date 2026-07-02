import { AIPlatform } from '@prisma/client';
import { AIQueryResult } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * Claude 질의 전략 - Claude Haiku 4.5 + 웹 검색 도구 (web_search_20250305)
 * 폴백 체인: haiku-4-5+웹검색 → sonnet-4+웹검색 → haiku-4-5 (검색 없음)
 */
export class ClaudeStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'CLAUDE';
  readonly displayName = 'Claude';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const anthropic = this.ctx.getAnthropic();
    if (!anthropic) throw new Error('Anthropic API가 초기화되지 않았습니다');

    this.ctx.logger.log(`[Claude] API 호출 시작 (claude-haiku-4-5 + 웹검색)`);

    let responseText = '';
    let model = 'claude-haiku-4-5';
    let isWebSearch = false;
    let claudeUsage: { inputTokens?: number | null; outputTokens?: number | null } | null = null;

    try {
      // 1순위: Claude Haiku 4.5 + 웹 검색 도구 (웹검색 지원하는 최저가 모델)
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

      this.ctx.logger.log(`[Claude] Haiku 4.5 웹 검색 응답 받음 (검색 사용: ${isWebSearch})`);
    } catch (webSearchError) {
      this.ctx.logger.warn(`[Claude] Haiku 4.5 웹검색 실패: ${webSearchError.message}`);

      try {
        // 2순위 폴백: Claude Sonnet 4 + 웹검색
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4',
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
        model = 'claude-sonnet-4';
        claudeUsage = {
          inputTokens: message.usage?.input_tokens ?? null,
          outputTokens: message.usage?.output_tokens ?? null,
        };
        this.ctx.logger.log(`[Claude] Sonnet 4 폴백 웹검색 응답 받음`);
      } catch (sonnetError) {
        this.ctx.logger.warn(`[Claude] Sonnet 4도 실패, 일반 모드 폴백: ${sonnetError.message}`);

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

    // 【소스 트래킹】Claude 텍스트에서 소스 힌트 추출
    const textHints = this.ctx.extractSourceHintsFromText(responseText);
    const inlineUrls = this.ctx.extractInlineUrls(responseText, 'CLAUDE');
    result.sourceHints = {
      sources: inlineUrls,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.ctx.classifySources(inlineUrls, textHints.hintKeywords),
    };

    return result;
  }
}
