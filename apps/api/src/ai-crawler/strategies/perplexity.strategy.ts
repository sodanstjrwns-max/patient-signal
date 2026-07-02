import { AIPlatform } from '@prisma/client';
import { AIQueryResult, SourceItem } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * 【개선1+2+8】Perplexity 질의 전략 - 시스템 프롬프트 제거, 웹 검색은 기본 탑재
 */
export class PerplexityStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'PERPLEXITY';
  readonly displayName = 'Perplexity';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY?.trim();

    this.ctx.logger.log(`[Perplexity] API 호출 시작 (temp=0, search_domain_filter)`);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: promptText,  // 【개선2】시스템 프롬프트 없음
          },
        ],
        temperature: 0,  // 【개선1】temperature 0
        // 【개선8】Perplexity 웹 검색 관련 파라미터
        search_domain_filter: [],   // 모든 도메인 허용
        return_citations: true,      // 인용 소스 반환
        search_recency_filter: 'month', // 최근 1개월 내 데이터 우선
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Perplexity 에러: ${JSON.stringify(data.error)}`);
    }

    const text = data.choices?.[0]?.message?.content || '';

    // Perplexity citations 추출
    const citations: string[] = data.citations || [];

    const result = this.ctx.analyzeResponse(text, hospitalName, 'PERPLEXITY', 'sonar');
    result.isWebSearch = true; // Perplexity는 항상 웹 검색 기반
    this.ctx.applyUsage(
      result,
      'sonar',
      {
        inputTokens: data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.completion_tokens ?? null,
      },
      promptText,
      text,
    );

    // citations가 있으면 citedSources에 추가
    if (citations.length > 0) {
      result.citedSources = [...new Set([...result.citedSources, ...citations])].slice(0, 15);
    }

    // 【소스 트래킹】Perplexity citations 구조화
    const sourceItems: SourceItem[] = citations.map(url => ({
      url,
      type: 'citation' as const,
      platform: 'PERPLEXITY',
      domain: this.ctx.extractDomain(url),
    }));

    // 텍스트 내 소스 힌트도 추출
    const textHints = this.ctx.extractSourceHintsFromText(text);

    result.sourceHints = {
      sources: sourceItems,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.ctx.classifySources(sourceItems, textHints.hintKeywords),
    };

    this.ctx.logger.log(`[Perplexity] 소스 ${sourceItems.length}개 추출, 힌트 키워드: ${textHints.hintKeywords.join(', ')}`);

    return result;
  }
}
