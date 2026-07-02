import { AIPlatform } from '@prisma/client';
import { AIQueryResult, SourceItem } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * 【개선1+2+8】Gemini 질의 전략 - gemini-2.5-flash + Google Search grounding
 * 2.5-flash는 thinking model이므로 temperature 미설정 (기본값 사용)
 * 3단계 폴백: grounding → 일반 2.5-flash → 2.5-flash-lite
 */
export class GeminiStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'GEMINI';
  readonly displayName = 'Gemini';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

    this.ctx.logger.log(`[Gemini] API 호출 시작 (gemini-2.5-flash, Google Search grounding)`);

    let text = '';
    let isWebSearch = false;
    const geminiSources: SourceItem[] = [];
    let geminiUsage: { inputTokens?: number | null; outputTokens?: number | null } | null = null;
    let geminiModel = 'gemini-2.5-flash';

    try {
      // STEP 1: Google Search grounding 활성화
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { maxOutputTokens: 2000 },
            tools: [{ google_search: {} }],
          }),
        },
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(`[${data.error.code}] ${data.error.message}`);
      }

      // 2.5-flash는 parts가 여러개일 수 있음 (thinking + response)
      const parts = data.candidates?.[0]?.content?.parts || [];
      text = parts.filter((p: any) => p.text).map((p: any) => p.text).join('') || '';
      isWebSearch = true;
      geminiUsage = {
        inputTokens: data.usageMetadata?.promptTokenCount ?? null,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
      };

      // 【소스 트래킹】grounding metadata에서 인용 소스 추출
      const groundingMetadata = data.candidates?.[0]?.groundingMetadata;

      if (groundingMetadata?.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web?.uri) {
            geminiSources.push({
              url: chunk.web.uri,
              title: chunk.web.title || undefined,
              type: 'grounding',
              platform: 'GEMINI',
              domain: this.ctx.extractDomain(chunk.web.uri),
            });
          }
        }
        this.ctx.logger.log(`[Gemini] grounding 소스 ${geminiSources.length}개 추출`);
      }

      if (groundingMetadata?.searchEntryPoint?.renderedContent) {
        this.ctx.logger.log(`[Gemini] Google Search grounding 활성 확인`);
      }

    } catch (groundingError) {
      // STEP 2: grounding 실패 → 일반 모드 폴백
      this.ctx.logger.warn(`[Gemini] grounding 실패: ${groundingError.message}, 일반 모드 시도`);

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { maxOutputTokens: 2000 },
            }),
          },
        );

        const data = await response.json();
        if (data.error) throw new Error(`[${data.error.code}] ${data.error.message}`);
        const parts = data.candidates?.[0]?.content?.parts || [];
        text = parts.filter((p: any) => p.text).map((p: any) => p.text).join('') || '';
        geminiUsage = {
          inputTokens: data.usageMetadata?.promptTokenCount ?? null,
          outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
        };
      } catch (fallbackError) {
        // STEP 3: 2.5-flash 자체 실패 → 2.5-flash-lite로 최종 폴백
        this.ctx.logger.warn(`[Gemini] 2.5-flash 실패: ${fallbackError.message}, 2.5-flash-lite 시도`);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { maxOutputTokens: 2000 },
            }),
          },
        );

        const data = await response.json();
        if (data.error) throw new Error(`Gemini 전체 실패: [${data.error.code}] ${data.error.message}`);
        const parts = data.candidates?.[0]?.content?.parts || [];
        text = parts.filter((p: any) => p.text).map((p: any) => p.text).join('') || '';
        geminiModel = 'gemini-2.5-flash-lite';
        geminiUsage = {
          inputTokens: data.usageMetadata?.promptTokenCount ?? null,
          outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
        };
      }
    }

    const result = this.ctx.analyzeResponse(text, hospitalName, 'GEMINI', geminiModel);
    result.isWebSearch = isWebSearch;
    this.ctx.applyUsage(result, geminiModel, geminiUsage, promptText, text);

    // 【소스 트래킹】Gemini 소스 구조화
    if (geminiSources.length > 0) {
      result.citedSources = [...new Set([...result.citedSources, ...geminiSources.map(s => s.url)])].slice(0, 15);
    }
    const textHints = this.ctx.extractSourceHintsFromText(text);
    result.sourceHints = {
      sources: geminiSources,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.ctx.classifySources(geminiSources, textHints.hintKeywords),
    };

    return result;
  }
}
