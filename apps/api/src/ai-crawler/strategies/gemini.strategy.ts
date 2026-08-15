import { AIPlatform } from '@prisma/client';
import { AIQueryResult, SourceItem } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * 【개선1+2+8】Gemini 질의 전략 - gemini-flash-lite-latest + Google Search grounding
 * 【2026.08.15 실측 수정】gemini-2.5-flash-lite는 신규 사용자 폐기(404
 *  "no longer available to new users") → STEP1 전멸하고 비싼 2.5-flash 폴백만 돌았음.
 *  gemini-flash-lite-latest(별칭, 현재 최신 flash-lite로 자동 매핑)로 교체 —
 *  프로덕션 단건 테스트에서 grounding 6개 정상 반환 확인.
 * 3단계 폴백: flash-lite-latest grounding → 2.5-flash grounding → 일반 flash-lite-latest
 */
export class GeminiStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'GEMINI';
  readonly displayName = 'Gemini';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

    this.ctx.logger.log(`[Gemini] API 호출 시작 (gemini-flash-lite-latest, Google Search grounding)`);

    let text = '';
    let isWebSearch = false;
    const geminiSources: SourceItem[] = [];
    let geminiUsage: { inputTokens?: number | null; outputTokens?: number | null } | null = null;
    let geminiModel = 'gemini-flash-lite-latest';

    try {
      // STEP 1: flash-lite-latest + Google Search grounding (최저가)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiApiKey}`,
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
      // STEP 2: flash-lite grounding 실패 → 2.5-flash grounding 폴백 (검색 유지 우선)
      this.ctx.logger.warn(`[Gemini] flash-lite grounding 실패: ${groundingError.message}, 2.5-flash grounding 시도`);

      try {
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
        if (data.error) throw new Error(`[${data.error.code}] ${data.error.message}`);
        const parts = data.candidates?.[0]?.content?.parts || [];
        text = parts.filter((p: any) => p.text).map((p: any) => p.text).join('') || '';
        isWebSearch = true;
        geminiModel = 'gemini-2.5-flash';
        geminiUsage = {
          inputTokens: data.usageMetadata?.promptTokenCount ?? null,
          outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
        };

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
        }
      } catch (fallbackError) {
        // STEP 3: grounding 전체 실패 → flash-lite-latest 일반 모드 최종 폴백 (검색 없음)
        this.ctx.logger.warn(`[Gemini] 2.5-flash grounding 실패: ${fallbackError.message}, flash-lite-latest 일반 모드 시도`);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiApiKey}`,
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
        geminiModel = 'gemini-flash-lite-latest';
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
