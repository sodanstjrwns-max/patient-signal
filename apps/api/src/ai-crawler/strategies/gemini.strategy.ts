import { AIPlatform } from '@prisma/client';
import { AIQueryResult, SourceItem } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';
import { pickModels, markUnavailable, isModelIssue, isModelAvailable } from '../model-registry';
import {
  GEMINI_FREE_TIER_MODEL,
  reserveFreeGrounding,
  releaseFreeGrounding,
} from '../gemini-grounding-budget';

/**
 * 【개선1+2+8】Gemini 질의 전략 - Google Search grounding
 * 【2026.08.15 실측 수정】gemini-2.5-flash-lite는 신규 사용자 폐기(404
 *  "no longer available to new users") → STEP1 전멸하고 비싼 2.5-flash 폴백만 돌았음.
 * 【2026.09.09 최저가 재점검】flash-lite-latest 별칭이 gemini-3.5-flash-lite($0.30/$2.50)로 올라감.
 *  서빙 중인 flash-lite 중 최저가는 gemini-3.1-flash-lite($0.25/$1.50).
 * 【2026.09.13 비용】9/1~9/11 청구 ₩387,473 중 96%가 검색 그라운딩 쿼리 과금(Gemini 3.x $14/1k)이었음.
 *  토큰 단가는 무의미하고 "그라운딩 호출 수"가 비용. 그래서:
 *   1) 하루 상한(기본 1,400)까지 gemini-2.5-flash 그라운딩 = 무료(하루 1,500 요청) → gemini-grounding-budget.ts
 *   2) 상한 초과분만 유료 사다리(3.1-flash-lite → 3.5-flash-lite …, $14/1k)
 *   3) 그라운딩 실패 시 "다른 모델로 그라운딩 재시도"(구 STEP 2) 제거 — 실패 호출도 검색이 과금되므로
 *      곧바로 검색 없는 일반 모드 최종 폴백만 남김
 *   4) 응답의 webSearchQueries 수를 로그 — 프롬프트 1건이 검색 몇 건으로 과금되는지(팬아웃) 가시화
 */
export class GeminiStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'GEMINI';
  readonly displayName = 'Gemini';

  constructor(private readonly ctx: PlatformQueryContext) {}

  /** 그라운딩 호출 후보 순서: 무료 예산 남았으면 2.5-flash 먼저, 이어서 유료 사다리 */
  private groundingCandidates(): Array<{ model: string; freeTier: boolean }> {
    const paid = pickModels('GEMINI').map((model) => ({ model, freeTier: false }));
    if (isModelAvailable('GEMINI', GEMINI_FREE_TIER_MODEL) && reserveFreeGrounding()) {
      return [{ model: GEMINI_FREE_TIER_MODEL, freeTier: true }, ...paid];
    }
    return paid;
  }

  private buildBody(model: string, promptText: string, grounding: boolean): string {
    const generationConfig: Record<string, unknown> = { maxOutputTokens: 2000 };
    // 2.5-flash 는 기본으로 thinking 이 켜져 출력 토큰($2.50/1M)이 불어남 — 측정용이라 끔
    if (model.startsWith('gemini-2.5-flash')) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    return JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig,
      ...(grounding ? { tools: [{ google_search: {} }] } : {}),
    });
  }

  private collectSources(groundingMetadata: any, into: SourceItem[]): void {
    if (!groundingMetadata?.groundingChunks) return;
    for (const chunk of groundingMetadata.groundingChunks) {
      if (chunk.web?.uri) {
        into.push({
          url: chunk.web.uri,
          title: chunk.web.title || undefined,
          type: 'grounding',
          platform: 'GEMINI',
          domain: this.ctx.extractDomain(chunk.web.uri),
        });
      }
    }
  }

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

    let text = '';
    let isWebSearch = false;
    const geminiSources: SourceItem[] = [];
    let geminiUsage: { inputTokens?: number | null; outputTokens?: number | null } | null = null;
    let geminiModel = pickModels('GEMINI')[0];

    let groundingError: any = null;
    for (const { model: candidate, freeTier } of this.groundingCandidates()) {
      geminiModel = candidate;
      geminiSources.length = 0;
      try {
        // STEP 1: (무료 예산) 2.5-flash → 유료 사다리(3.1-flash-lite → 3.5-flash-lite …) + Google Search grounding
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${geminiApiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: this.buildBody(candidate, promptText, true) },
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
        this.collectSources(groundingMetadata, geminiSources);
        const searchQueries: string[] = groundingMetadata?.webSearchQueries ?? [];
        this.ctx.logger.log(
          `[Gemini] ${candidate}${freeTier ? '(무료한도)' : '(유료)'} grounding 소스 ${geminiSources.length}개 · 검색 쿼리 ${searchQueries.length}건(과금 단위)`,
        );
        groundingError = null;
        break;
      } catch (e: any) {
        groundingError = e;
        if (isModelIssue(e)) {
          // 모델 자체가 없음 → 호출 불성립. 무료 예약은 돌려주고 다음 후보로
          if (freeTier) releaseFreeGrounding();
          await markUnavailable('GEMINI', candidate, e?.message || String(e));
          continue;
        }
        // 키·한도·네트워크 오류: 다른 모델로 그라운딩을 또 사면 검색이 또 과금되므로 여기서 중단
        break;
      }
    }

    if (groundingError) {
      // STEP 2(최종): grounding 실패 → flash-lite-latest 일반 모드 (검색 없음, 토큰만 과금)
      this.ctx.logger.warn(`[Gemini] ${geminiModel} grounding 실패: ${groundingError.message}, flash-lite-latest 일반 모드 폴백`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiApiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: this.buildBody('gemini-flash-lite-latest', promptText, false) },
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
