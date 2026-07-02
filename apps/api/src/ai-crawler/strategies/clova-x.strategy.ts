import { AIPlatform } from '@prisma/client';
import { AIQueryResult } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * 【NEW】Naver HyperCLOVA X 질의 전략 — 한국 시장 토종 LLM
 * 모델: HCX-005 (최신 chat completion 모델)
 * 엔드포인트: https://clovastudio.stream.ntruss.com/testapp/v3/chat-completions/HCX-005
 * 인증: Authorization: Bearer {CLOVA_X_API_KEY}
 */
export class ClovaXStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'CLOVA_X';
  readonly displayName = 'CLOVA X';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const clovaKey = process.env.CLOVA_X_API_KEY?.trim();
    if (!clovaKey) throw new Error('CLOVA_X_API_KEY가 설정되지 않았습니다');

    this.ctx.logger.log(`[CLOVA X] API 호출 시작 (HCX-005, 한국어 최적화)`);

    const endpoint =
      process.env.CLOVA_X_ENDPOINT?.trim() ||
      'https://clovastudio.stream.ntruss.com/testapp/v3/chat-completions/HCX-005';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clovaKey}`,
        'Content-Type': 'application/json',
        'X-NCP-CLOVASTUDIO-REQUEST-ID': `psv2-${Date.now()}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: promptText,
          },
        ],
        topP: 0.8,
        topK: 0,
        maxTokens: 1024,
        temperature: 0.1, // CLOVA X는 0 비허용, 최저값 사용
        repeatPenalty: 5.0,
        stopBefore: [],
        includeAiFilters: false,
      }),
    });

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`CLOVA X 응답 JSON 파싱 실패: ${rawText.slice(0, 200)}`);
    }

    if (data.status?.code && data.status.code !== '20000') {
      throw new Error(`CLOVA X 에러: ${data.status.code} - ${data.status.message || rawText.slice(0, 200)}`);
    }

    // CLOVA X 응답 구조: data.result.message.content
    const text =
      data.result?.message?.content ||
      data.message?.content ||
      data.choices?.[0]?.message?.content ||
      '';

    if (!text) {
      throw new Error(`CLOVA X 빈 응답: ${rawText.slice(0, 200)}`);
    }

    const result = this.ctx.analyzeResponse(text, hospitalName, 'CLOVA_X', 'HCX-005');
    // CLOVA X는 기본 학습 데이터 기반 (네이버 플레이스 통합은 별도 옵션)
    result.isWebSearch = false;
    this.ctx.applyUsage(
      result,
      'HCX-005',
      {
        inputTokens: data.result?.usage?.promptTokens ?? null,
        outputTokens: data.result?.usage?.completionTokens ?? null,
      },
      promptText,
      text,
    );

    const inlineUrls = this.ctx.extractInlineUrls(text, 'CLOVA_X');
    const textHints = this.ctx.extractSourceHintsFromText(text);
    if (inlineUrls.length > 0) {
      result.citedSources = [...new Set([...result.citedSources, ...inlineUrls.map((s) => s.url)])].slice(0, 15);
    }
    result.sourceHints = {
      sources: inlineUrls,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.ctx.classifySources(inlineUrls, textHints.hintKeywords),
    };

    this.ctx.logger.log(`[CLOVA X] 응답 ${text.length}자, URL ${inlineUrls.length}개 추출`);
    return result;
  }
}
