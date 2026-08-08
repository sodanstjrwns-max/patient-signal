import { AIPlatform } from '@prisma/client';
import { AIQueryResult } from '../types';
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

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const anthropic = this.ctx.getAnthropic();
    if (!anthropic) throw new Error('Anthropic API가 초기화되지 않았습니다');

    this.ctx.logger.log(`[Claude] API 호출 시작 (claude-3-5-haiku + 웹검색)`);

    let responseText = '';
    let model = 'claude-3-5-haiku-latest';
    let isWebSearch = false;
    let claudeUsage: { inputTokens?: number | null; outputTokens?: number | null } | null = null;

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

      this.ctx.logger.log(`[Claude] 3.5 Haiku 웹 검색 응답 받음 (검색 사용: ${isWebSearch})`);
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
        this.ctx.logger.log(`[Claude] Haiku 4.5 폴백 웹검색 응답 받음`);
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
