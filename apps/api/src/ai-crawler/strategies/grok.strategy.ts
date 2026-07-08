import { AIPlatform } from '@prisma/client';
import { AIQueryResult, SourceItem } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * 【2026.07 마이그레이션】Grok (xAI) 질의 전략 — Responses API + Agent Tools
 *
 * 배경: xAI가 2026-01-12부로 Live Search API(chat/completions의 search_parameters)를
 * 완전 폐기 → 410 "Live search is deprecated" 에러. 2026-07-08 크롤에서
 * 연속 274회 실패 + 서킷브레이커 OPEN으로 발견됨.
 *
 * 신규 방식: POST /v1/responses + tools:[{type:'web_search'}]
 *  - 웹검색은 서버사이드 tool로 실행 (실제 유저의 Grok과 동일 조건 유지)
 *  - 인용은 output_text의 annotations(url_citation) + 인라인 [[N]](url) 마크다운으로 반환
 *  - Responses API는 inline citations 기본 활성화
 *
 * 모델: grok-4 (GROK_MODEL env로 오버라이드, xAI가 최신 버전 자동 서빙 — 실측 grok-4.3)
 * 비용 주의: web_search tool 호출당 과금. 모델이 필요 시에만 검색(auto와 동일).
 */
export class GrokStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'GROK';
  readonly displayName = 'Grok';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const xaiApiKey = process.env.XAI_API_KEY?.trim();
    if (!xaiApiKey) throw new Error('XAI_API_KEY가 설정되지 않았습니다');

    const modelName = process.env.GROK_MODEL?.trim() || 'grok-4';

    this.ctx.logger.log(`[Grok] Responses API 호출 시작 (${modelName}, web_search tool)`);

    const response = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        input: [
          {
            role: 'user',
            content: promptText, // 시스템 프롬프트 없음 — 다른 플랫폼과 일관성
          },
        ],
        tools: [{ type: 'web_search' }],
        // temperature 미지정: grok-4는 reasoning 모델 — Responses API에서
        // 샘플링 파라미터 미지원/무시 가능성이 있어 기본값 사용
      }),
    });

    const data: any = await response.json();

    if (data.error) {
      throw new Error(`Grok 에러: ${JSON.stringify(data.error)}`);
    }
    if (!Array.isArray(data.output)) {
      throw new Error(`Grok 응답 형식 오류: output 배열 없음 (${JSON.stringify(data).slice(0, 200)})`);
    }

    // output 배열에서 message 타입의 output_text 블록 수집
    let text = '';
    const apiCitations: string[] = [];
    for (const item of data.output) {
      if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
      for (const block of item.content) {
        if (block?.type !== 'output_text') continue;
        text += (text ? '\n' : '') + (block.text || '');
        // 구조화 인용: annotations[].url_citation
        if (Array.isArray(block.annotations)) {
          for (const ann of block.annotations) {
            if (ann?.type === 'url_citation' && typeof ann.url === 'string') {
              apiCitations.push(ann.url);
            }
          }
        }
      }
    }

    // 인라인 인용 마크다운 [[N]](url) 제거 — 응답 텍스트 분석 정확도 유지
    // (URL은 이미 annotations에서 수집됨)
    const cleanText = text.replace(/\[\[\d+\]\]\((https?:\/\/[^\s)]+)\)/g, '');

    const result = this.ctx.analyzeResponse(cleanText, hospitalName, 'GROK', modelName);
    // web_search tool 활성화 상태로 질의함
    result.isWebSearch = true;

    if (apiCitations.length > 0) {
      result.citedSources = [...new Set([...result.citedSources, ...apiCitations])].slice(0, 15);
    }

    // 토큰 사용량 (Responses API: usage.input_tokens / usage.output_tokens)
    this.ctx.applyUsage(
      result,
      modelName,
      {
        inputTokens: data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.output_tokens ?? data.usage?.completion_tokens ?? null,
      },
      promptText,
      cleanText,
    );

    // 텍스트 내 소스 힌트 추출 (annotations 미반환 케이스 대비 폴백)
    const inlineUrls = this.ctx.extractInlineUrls(cleanText, 'GROK');
    const textHints = this.ctx.extractSourceHintsFromText(cleanText);
    if (inlineUrls.length > 0) {
      result.citedSources = [...new Set([...result.citedSources, ...inlineUrls.map((s) => s.url)])].slice(0, 15);
    }
    // annotations 인용도 sourceHints.sources에 병합 (채널 분류 대상 포함)
    const annotationSources: SourceItem[] = apiCitations.map((url) => ({
      url,
      domain: this.ctx.extractDomain(url),
      type: 'citation' as const,
      platform: 'GROK',
    }));
    const mergedSources = [...annotationSources, ...inlineUrls].filter(
      (s, i, arr) => arr.findIndex((x) => x.url === s.url) === i,
    );
    result.sourceHints = {
      sources: mergedSources,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.ctx.classifySources(mergedSources, textHints.hintKeywords),
    };

    this.ctx.logger.log(
      `[Grok] 응답 ${cleanText.length}자, annotations 인용 ${apiCitations.length}개 + 인라인 URL ${inlineUrls.length}개 추출`,
    );
    return result;
  }
}
