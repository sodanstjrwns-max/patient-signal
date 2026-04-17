import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma/prisma.service';
import { AIPlatform, SentimentLabel } from '@prisma/client';
import {
  AIQueryResult,
  AggregatedResult,
  SourceItem,
  SourceHints,
  CircuitBreakerState,
  PLATFORM_WEIGHTS,
  AnswerPositionType,
} from './types';

@Injectable()
export class AICrawlerService {
  private readonly logger = new Logger(AICrawlerService.name);
  private openai: OpenAI;
  private anthropic: Anthropic;

  // 플랫폼당 측정 횟수 (비용 최적화: 1회, 필요 시 3으로 올려 일관성 검증 가능)
  private readonly REPEAT_COUNT = 1;

  // C2: 서킷브레이커 상태 관리
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly CB_FAILURE_THRESHOLD = 5;  // 5번 연속 실패 시 회로 개방
  private readonly CB_RECOVERY_TIME = 60000;  // 60초 후 반개방으로 전환

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.initializeApis();
  }

  private initializeApis() {
    this.logger.log('=== AI API 초기화 시작 ===');
    
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey && openaiKey.length > 20) {
      try {
        this.openai = new OpenAI({ apiKey: openaiKey });
        this.logger.log('✅ OpenAI 초기화 완료');
      } catch (e) {
        this.logger.error(`❌ OpenAI 초기화 실패: ${e.message}`);
      }
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (anthropicKey && anthropicKey.length > 20) {
      try {
        this.anthropic = new Anthropic({ apiKey: anthropicKey });
        this.logger.log('✅ Anthropic 초기화 완료');
      } catch (e) {
        this.logger.error(`❌ Anthropic 초기화 실패: ${e.message}`);
      }
    }
    
    this.logger.log(`=== 초기화 결과: OpenAI=${!!this.openai}, Anthropic=${!!this.anthropic} ===`);
  }

  private getOpenAI(): OpenAI | null {
    return this.openai || null;
  }

  private getAnthropic(): Anthropic | null {
    return this.anthropic || null;
  }

  // ==================== 테스트 메서드 (기존 유지) ====================

  async testOpenAICall(): Promise<any> {
    if (!this.openai) throw new Error('OpenAI 클라이언트가 초기화되지 않았습니다');
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: '안녕하세요. 테스트입니다. 간단히 답변해주세요.' }],
      max_tokens: 50,
    });
    const response = completion.choices[0]?.message?.content || '';
    return { response, model: 'gpt-4o-mini' };
  }

  async testGeminiCall(): Promise<any> {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) throw new Error('Gemini API 키가 없습니다');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: '안녕하세요. 테스트입니다. 간단히 답변해주세요.' }] }],
          generationConfig: { maxOutputTokens: 50 },
        }),
      },
    );
    const data = await response.json();
    if (data.error) throw new Error(`Gemini 에러: ${data.error.message}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { response: text, model: 'gemini-2.0-flash' };
  }

  async testClaudeCall(): Promise<any> {
    if (!this.anthropic) throw new Error('Anthropic 클라이언트가 초기화되지 않았습니다');
    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 50,
      messages: [{ role: 'user', content: '안녕하세요. 테스트입니다. 간단히 답변해주세요.' }],
    });
    const response = message.content[0].type === 'text' ? message.content[0].text : '';
    return { response, model: 'claude-3-5-haiku-20241022' };
  }

  async testPerplexityCall(): Promise<any> {
    const perplexityKey = process.env.PERPLEXITY_API_KEY?.trim();
    if (!perplexityKey) throw new Error('Perplexity API 키가 없습니다');
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: '안녕하세요. 테스트입니다. 간단히 답변해주세요.' }],
        max_tokens: 50,
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(`Perplexity 에러: ${JSON.stringify(data.error)}`);
    const text = data.choices?.[0]?.message?.content || '';
    return { response: text, model: 'sonar' };
  }

  getApiStatus(): Record<string, any> {
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const perplexityKey = process.env.PERPLEXITY_API_KEY?.trim();
    
    return {
      openai: {
        hasKey: !!openaiKey,
        keyLength: openaiKey?.length || 0,
        keyPrefix: openaiKey?.substring(0, 10) || 'EMPTY',
        isInitialized: !!this.openai,
        clientType: this.openai?.constructor?.name || 'none',
      },
      anthropic: {
        hasKey: !!anthropicKey,
        keyLength: anthropicKey?.length || 0,
        isInitialized: !!this.anthropic,
      },
      gemini: {
        hasKey: !!geminiKey,
        keyLength: geminiKey?.length || 0,
      },
      perplexity: {
        hasKey: !!perplexityKey,
        keyLength: perplexityKey?.length || 0,
      },
      improvements: {
        measurementPerPlatform: `${this.REPEAT_COUNT}회 측정`,
        temperatureZero: true,
        systemPromptRemoved: true,
        webSearchEnabled: true,
        aiSentiment: true,
        hallucinationFilter: true,
        competitorScoring: true,
        contentGap: true,
      },
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== AI 플랫폼 질의 (temperature 0, 웹검색 활성화) ====================

  /**
   * 모든 AI 플랫폼에 질의 - temperature 0, 시스템 프롬프트 제거, ABHS 분석
   */
  async queryAllPlatforms(
    promptId: string,
    hospitalId: string,
    hospitalName: string,
    promptText: string,
    platforms: AIPlatform[] = ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'],
  ): Promise<AIQueryResult[]> {
    const allResults: AIQueryResult[] = [];
    
    this.logger.log(`=== queryAllPlatforms 시작 (플랫폼당 ${this.REPEAT_COUNT}회 측정) ===`);
    this.logger.log(`프롬프트: "${promptText.substring(0, 50)}..."`);
    this.logger.log(`병원: ${hospitalName}`);

    const availablePlatforms = platforms.filter(p => this.isPlatformAvailable(p));
    this.logger.log(`사용 가능한 플랫폼: ${availablePlatforms.join(', ') || '없음'}`);
    
    if (availablePlatforms.length === 0) {
      this.logger.warn('사용 가능한 AI 플랫폼이 없습니다.');
    }

    // 【최적화】경쟁사 DB 조회를 루프 밖으로 이동 (N+1 쿼리 방지)
    const registeredCompetitors = await this.prisma.competitor.findMany({
      where: { hospitalId, isActive: true },
      select: { competitorName: true },
    });
    const registeredNames = registeredCompetitors.map(c => c.competitorName);

    // 【최적화 R2】플랫폼별 질의를 병렬로 실행 (API 레이트 리밋은 withRetry에서 처리)
    const platformPromises = availablePlatforms.map(async (platform) => {
      const platformResults: AIQueryResult[] = [];
      for (let repeatIdx = 0; repeatIdx < this.REPEAT_COUNT; repeatIdx++) {
        try {
          this.logger.log(`🔄 ${platform} [${repeatIdx + 1}/${this.REPEAT_COUNT}] 질의 시작`);
          
          const result = await this.queryPlatform(platform, promptText, hospitalName);
          result.repeatIndex = repeatIdx;
          
          // 【고도화 #5】환각 필터링 - 등록된 경쟁사 DB와 대조 + 패턴 기반
          const verifiedCompetitors = await this.verifyCompetitorsEnhanced(
            result.competitorsMentioned, 
            registeredNames,
          );
          result.competitorsMentioned = verifiedCompetitors.verified;
          result.isVerified = true;
          result.verificationSource = 'keyword_pattern';

          // 【할루시네이션 감소】응답 신뢰도 점수 계산
          const confidence = this.calculateConfidenceScore(result, promptText);
          result.confidenceScore = confidence.confidenceScore;
          result.confidenceFactors = confidence.confidenceFactors;
          result.isLowConfidence = confidence.isLowConfidence;
          
          this.logger.log(`✅ ${platform} [${repeatIdx + 1}] 응답 받음, 언급: ${result.isMentioned}, 신뢰도: ${(confidence.confidenceScore * 100).toFixed(0)}%`);
          platformResults.push(result);

          // 【초고도화】ABHS 통합 분석 (감성V2 + 추천깊이 + 질문의도)
          let sentimentV2: number | null = null;
          let recDepth: string | null = null;
          let queryIntent: string | null = null;
          let abhsContribution: number | null = null;
          let citedUrl: string | null = null;

          if (result.isMentioned) {
            const abhsAnalysis = await this.analyzeResponseWithABHS(result.response, hospitalName, promptText);
            if (abhsAnalysis) {
              result.sentimentScore = abhsAnalysis.score;
              result.sentimentLabel = abhsAnalysis.label;
              sentimentV2 = abhsAnalysis.sentimentV2;
              recDepth = abhsAnalysis.recommendationDepth;
              queryIntent = abhsAnalysis.queryIntent;
              
              // ABHS 기여분 계산
              const platformWeight = this.getPlatformWeight(platform);
              const sentFactor = this.sentimentToFactor(sentimentV2);
              const depthScore = this.getDepthScore(recDepth);
              const intentMultiplier = this.getIntentMultiplier(queryIntent);
              abhsContribution = sentFactor * depthScore * platformWeight * intentMultiplier;
              citedUrl = result.citedSources?.[0] || null;
            }

            // 【Area 2】Answer Position 정밀 분류
            result.answerPositionType = this.classifyAnswerPosition(result, sentimentV2, recDepth);

            // 【Area 4】Answer Quality Score 계산
            const aqs = this.calculateAnswerQualityScore(result, hospitalName, promptText);
            result.answerQualityScore = aqs.score;
            result.answerQualityFactors = aqs.factors;
          } else {
            // 미언급 시 의도만 분류
            queryIntent = this.classifyQueryIntentSimple(promptText);
          }

          // DB에 저장 (ABHS + 신뢰도 데이터 통합)
          // 【P0-2 FIX】confidenceScore를 create에 직접 포함 (불필요한 findFirst+update 제거)
          await this.prisma.aIResponse.create({
            data: {
              promptId,
              hospitalId,
              aiPlatform: platform,
              aiModelVersion: result.model,
              responseText: result.response,
              responseDate: new Date(),
              isMentioned: result.isMentioned,
              mentionPosition: result.mentionPosition,
              totalRecommendations: result.totalRecommendations,
              sentimentScore: result.sentimentScore,
              sentimentLabel: result.sentimentLabel,
              citedSources: result.citedSources,
              competitorsMentioned: result.competitorsMentioned,
              repeatIndex: repeatIdx,
              isWebSearch: result.isWebSearch || false,
              isVerified: result.isVerified,
              verificationSource: result.verificationSource,
              // 초고도화 ABHS 필드
              sentimentScoreV2: sentimentV2,
              recommendationDepth: recDepth as any,
              queryIntent: queryIntent as any,
              platformWeight: this.getPlatformWeight(platform),
              abhsContribution,
              citedUrl,
              // 소스 트래킹 데이터
              sourceHints: result.sourceHints ? JSON.parse(JSON.stringify(result.sourceHints)) : undefined,
              // 할루시네이션 감소 신뢰도 데이터 (직접 포함)
              confidenceScore: result.confidenceScore ?? null,
              confidenceFactors: result.confidenceFactors ? (result.confidenceFactors as any) : undefined,
              isLowConfidence: result.isLowConfidence ?? false,
              // 【Area 2】Answer Position 정밀 분류
              answerPositionType: result.answerPositionType as any ?? undefined,
              // 【Area 4】Answer Quality Score
              answerQualityScore: result.answerQualityScore ?? null,
              answerQualityFactors: result.answerQualityFactors ? (result.answerQualityFactors as any) : undefined,
              // 【Area 2】시간대 세션
              crawlSession: result.crawlSession ?? undefined,
            },
          });

          // API 레이트 리밋 방지 (측정 사이 1.5초 딜레이)
          if (repeatIdx < this.REPEAT_COUNT - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        } catch (error) {
          this.logger.error(`❌ ${platform} [${repeatIdx + 1}] 실패: ${error.message}`);
        }
      }
      return platformResults;
    });

    // 모든 플랫폼 병렬 실행 후 결과 합산 (개별 실패는 빈 배열로 처리)
    const platformResultArrays = await Promise.allSettled(platformPromises);
    for (const settled of platformResultArrays) {
      if (settled.status === 'fulfilled') {
        allResults.push(...settled.value);
      }
    }

    // 【할루시네이션 감소】교차 검증 적용 - 다중 플랫폼 간 일관성 검증
    if (allResults.length >= 2) {
      this.applyCrossValidation(allResults);
      
      // 교차 검증 후 DB 업데이트 (confidenceScore 재계산)
      for (const result of allResults) {
        if (result.confidenceScore !== undefined) {
          try {
            // 가장 최근 생성된 레코드를 찾아 업데이트
            const latestResponse = await this.prisma.aIResponse.findFirst({
              where: {
                hospitalId,
                promptId,
                aiPlatform: result.platform,
              },
              orderBy: { createdAt: 'desc' },
            });
            if (latestResponse) {
              await this.prisma.aIResponse.update({
                where: { id: latestResponse.id },
                data: {
                  confidenceScore: result.confidenceScore,
                  confidenceFactors: result.confidenceFactors as any,
                  isLowConfidence: result.isLowConfidence ?? false,
                },
              });
            }
          } catch (updateError) {
            this.logger.warn(`[교차검증] DB 업데이트 실패: ${updateError.message}`);
          }
        }
      }

      const lowConfCount = allResults.filter(r => r.isLowConfidence).length;
      if (lowConfCount > 0) {
        this.logger.warn(`[할루시네이션] ${allResults.length}개 응답 중 ${lowConfCount}개가 저신뢰(< 40%)`);
      }
    }

    return allResults;
  }

  /**
   * 플랫폼 사용 가능 여부 확인
   */
  private isPlatformAvailable(platform: AIPlatform): boolean {
    switch (platform) {
      case 'CHATGPT':
        return !!this.openai;
      case 'CLAUDE':
        return !!this.anthropic;
      case 'PERPLEXITY':
        const pplxKey = process.env.PERPLEXITY_API_KEY?.trim();
        return !!pplxKey && pplxKey.length > 10;
      case 'GEMINI':
        const geminiKey = process.env.GEMINI_API_KEY?.trim();
        return !!geminiKey && geminiKey.length > 10;
      default:
        return false;
    }
  }

  /**
   * 【고도화 #3】리트라이 래퍼 - 타임아웃 + 레이트리밋 + 지수 백오프
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    label: string,
    maxRetries: number = 2,
    baseDelay: number = 3000,
  ): Promise<T> {
    // C2: 서킷브레이커 체크
    const cb = this.circuitBreakers.get(label) || { failures: 0, lastFailure: 0, state: 'closed' as const };
    
    if (cb.state === 'open') {
      if (Date.now() - cb.lastFailure > this.CB_RECOVERY_TIME) {
        cb.state = 'half-open';
        this.logger.warn(`[CircuitBreaker] ${label}: open → half-open (복구 시도)`);
      } else {
        throw new Error(`[CircuitBreaker] ${label}: 서비스 일시 중단 (${Math.ceil((this.CB_RECOVERY_TIME - (Date.now() - cb.lastFailure)) / 1000)}초 후 재시도)`);
      }
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 타임아웃 30초
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`${label} 타임아웃 (30초)`)), 30000)
          ),
        ]);
        
        // 성공 시 서킷브레이커 리셋
        if (cb.failures > 0) {
          cb.failures = 0;
          cb.state = 'closed';
          this.circuitBreakers.set(label, cb);
          this.logger.log(`[CircuitBreaker] ${label}: 복구 완료 → closed`);
        }
        return result;
      } catch (error: any) {
        lastError = error;
        const isRetryable = 
          error.message?.includes('timeout') ||
          error.message?.includes('타임아웃') ||
          error.message?.includes('429') ||
          error.message?.includes('rate_limit') ||
          error.message?.includes('overloaded') ||
          error.message?.includes('503') ||
          error.message?.includes('502') ||
          error.status === 429 ||
          error.status === 503 ||
          error.status === 502;

        if (attempt < maxRetries && isRetryable) {
          // C2: Rate Limit 429는 더 긴 대기
          const isRateLimit = error.message?.includes('429') || error.status === 429;
          const delay = isRateLimit 
            ? baseDelay * Math.pow(3, attempt) // 429: 3s → 9s → 27s
            : baseDelay * Math.pow(2, attempt); // 기타: 3s → 6s → 12s
          this.logger.warn(`[${label}] 시도 ${attempt + 1}/${maxRetries + 1} 실패 (${error.message}), ${delay}ms 후 재시도${isRateLimit ? ' [Rate Limit]' : ''}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (attempt < maxRetries) {
          this.logger.warn(`[${label}] 시도 ${attempt + 1} 비재시도 에러: ${error.message}`);
          break; // 재시도 불가능한 에러는 바로 종료
        }
      }
    }
    
    // 실패 시 서킷브레이커 업데이트
    cb.failures++;
    cb.lastFailure = Date.now();
    if (cb.failures >= this.CB_FAILURE_THRESHOLD) {
      cb.state = 'open';
      this.logger.error(`[CircuitBreaker] ${label}: → OPEN (연속 ${cb.failures}회 실패, ${this.CB_RECOVERY_TIME / 1000}초간 차단)`);
    }
    this.circuitBreakers.set(label, cb);

    throw lastError || new Error(`${label} 최대 재시도 초과`);
  }

  /**
   * 실시간 질문용 - 외부에서 호출 가능한 단일 플랫폼 질의
   */
  async queryPlatformPublic(
    platform: AIPlatform,
    promptText: string,
    hospitalName: string,
  ): Promise<AIQueryResult> {
    return this.queryPlatform(platform, promptText, hospitalName);
  }

  /**
   * 개별 플랫폼 질의
   */
  private async queryPlatform(
    platform: AIPlatform,
    promptText: string,
    hospitalName: string,
  ): Promise<AIQueryResult> {
    switch (platform) {
      case 'CHATGPT':
        return this.withRetry(() => this.queryChatGPT(promptText, hospitalName), 'ChatGPT');
      case 'CLAUDE':
        return this.withRetry(() => this.queryClaude(promptText, hospitalName), 'Claude');
      case 'PERPLEXITY':
        return this.withRetry(() => this.queryPerplexity(promptText, hospitalName), 'Perplexity');
      case 'GEMINI':
        return this.withRetry(() => this.queryGemini(promptText, hospitalName), 'Gemini');
      default:
        throw new Error(`지원하지 않는 플랫폼: ${platform}`);
    }
  }

  // ==================== 개선2: 시스템 프롬프트 제거 + 개선1: temperature 0 ====================

  /**
   * ChatGPT 질의 - gpt-4o-search-preview 메인 (실제 웹검색으로 할루시네이션 최소화)
   */
  private async queryChatGPT(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    if (!this.openai) throw new Error('OpenAI API가 초기화되지 않았습니다');
    
    this.logger.log(`[ChatGPT] API 호출 시작 (gpt-4o-search-preview)`);
    
    let response = '';
    let model = 'gpt-4o-search-preview';
    let isWebSearch = false;

    try {
      // 1순위: gpt-4o-search-preview (실제 웹검색, 할루시네이션 최소)
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-search-preview',
        messages: [
          {
            role: 'user',
            content: promptText,
          },
        ],
        max_tokens: 2000,
        web_search_options: {
          search_context_size: 'medium',
        },
      } as any);

      response = completion.choices[0]?.message?.content || '';
      isWebSearch = true;
      this.logger.log(`[ChatGPT] gpt-4o-search-preview 웹 검색 응답 받음`);
    } catch (searchError) {
      this.logger.warn(`[ChatGPT] gpt-4o-search-preview 실패: ${searchError.message}`);
      
      try {
        // 2순위 폴백: gpt-4o-mini-search-preview (비용 절감 웹검색)
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini-search-preview',
          messages: [
            {
              role: 'user',
              content: promptText,
            },
          ],
          max_tokens: 2000,
          web_search_options: {
            search_context_size: 'medium',
          },
        } as any);

        response = completion.choices[0]?.message?.content || '';
        model = 'gpt-4o-mini-search-preview';
        isWebSearch = true;
        this.logger.log(`[ChatGPT] gpt-4o-mini-search-preview 폴백 응답 받음`);
      } catch (fallbackError) {
        // 최종 폴백: gpt-4o-mini (웹검색 없음 → 할루시네이션 주의)
        this.logger.warn(`[ChatGPT] 검색 모델 전부 실패, gpt-4o-mini 폴백: ${fallbackError.message}`);
        
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: promptText,
            },
          ],
          temperature: 0,
          max_tokens: 2000,
        });

        response = completion.choices[0]?.message?.content || '';
        model = 'gpt-4o-mini';
      }
    }

    const result = this.analyzeResponse(response, hospitalName, 'CHATGPT', model);
    result.isWebSearch = isWebSearch;
    
    // 【소스 트래킹】ChatGPT 텍스트에서 소스 힌트 추출
    const textHints = this.extractSourceHintsFromText(response);
    const inlineUrls = this.extractInlineUrls(response, 'CHATGPT');
    result.sourceHints = {
      sources: inlineUrls,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.classifySources(inlineUrls, textHints.hintKeywords),
    };
    
    return result;
  }

  /**
   * Claude 질의 - Claude Haiku 4.5 + 웹 검색 도구 (web_search_20250305)
   */
  private async queryClaude(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    if (!this.anthropic) throw new Error('Anthropic API가 초기화되지 않았습니다');
    
    this.logger.log(`[Claude] API 호출 시작 (claude-haiku-4-5 + 웹검색)`);
    
    let responseText = '';
    let model = 'claude-haiku-4-5';
    let isWebSearch = false;

    try {
      // 1순위: Claude Haiku 4.5 + 웹 검색 도구 (웹검색 지원하는 최저가 모델)
      const message = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 2000,
        tools: [
          {
            type: 'web_search_20250305' as any,
            name: 'web_search',
          } as any,
        ],
        messages: [
          {
            role: 'user',
            content: promptText,
          },
        ],
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
      
      this.logger.log(`[Claude] Haiku 4.5 웹 검색 응답 받음 (검색 사용: ${isWebSearch})`);
    } catch (webSearchError) {
      this.logger.warn(`[Claude] Haiku 4.5 웹검색 실패: ${webSearchError.message}`);
      
      try {
        // 2순위 폴백: Claude Sonnet 4 + 웹검색
        const message = await this.anthropic.messages.create({
          model: 'claude-sonnet-4',
          max_tokens: 2000,
          tools: [
            {
              type: 'web_search_20250305' as any,
              name: 'web_search',
            } as any,
          ],
          messages: [
            {
              role: 'user',
              content: promptText,
            },
          ],
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
        this.logger.log(`[Claude] Sonnet 4 폴백 웹검색 응답 받음`);
      } catch (sonnetError) {
        this.logger.warn(`[Claude] Sonnet 4도 실패, 일반 모드 폴백: ${sonnetError.message}`);
        
        // 최종 폴백: Claude Haiku 4.5 웹검색 없이
        try {
          const message = await this.anthropic.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 2000,
            temperature: 0,
            messages: [
              {
                role: 'user',
                content: promptText,
              },
            ],
          });

          responseText = message.content[0].type === 'text' ? message.content[0].text : '';
          model = 'claude-haiku-4-5-no-search';
        } catch (fallbackError) {
          this.logger.error(`[Claude] 모든 모드 실패: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
    }
    
    const result = this.analyzeResponse(responseText, hospitalName, 'CLAUDE', model);
    result.isWebSearch = isWebSearch;
    
    // 【소스 트래킹】Claude 텍스트에서 소스 힌트 추출
    const textHints = this.extractSourceHintsFromText(responseText);
    const inlineUrls = this.extractInlineUrls(responseText, 'CLAUDE');
    result.sourceHints = {
      sources: inlineUrls,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.classifySources(inlineUrls, textHints.hintKeywords),
    };
    
    return result;
  }

  /**
   * 【개선1+2+8】Perplexity 질의 - 시스템 프롬프트 제거, 웹 검색은 기본 탑재
   */
  private async queryPerplexity(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY?.trim();
    
    this.logger.log(`[Perplexity] API 호출 시작 (temp=0, search_domain_filter)`);
    
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
    
    const result = this.analyzeResponse(text, hospitalName, 'PERPLEXITY', 'sonar');
    result.isWebSearch = true; // Perplexity는 항상 웹 검색 기반
    
    // citations가 있으면 citedSources에 추가
    if (citations.length > 0) {
      result.citedSources = [...new Set([...result.citedSources, ...citations])].slice(0, 15);
    }
    
    // 【소스 트래킹】Perplexity citations 구조화
    const sourceItems: SourceItem[] = citations.map(url => ({
      url,
      type: 'citation' as const,
      platform: 'PERPLEXITY',
      domain: this.extractDomain(url),
    }));
    
    // 텍스트 내 소스 힌트도 추출
    const textHints = this.extractSourceHintsFromText(text);
    
    result.sourceHints = {
      sources: sourceItems,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.classifySources(sourceItems, textHints.hintKeywords),
    };
    
    this.logger.log(`[Perplexity] 소스 ${sourceItems.length}개 추출, 힌트 키워드: ${textHints.hintKeywords.join(', ')}`);
    
    return result;
  }

  /**
   * 【개선1+2+8】Gemini 질의 - temperature 0, 시스템 프롬프트 제거, grounding with Google Search
   */
  private async queryGemini(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
    
    this.logger.log(`[Gemini] API 호출 시작 (temp=0, Google Search grounding)`);
    
    let text = '';
    let isWebSearch = false;
    let geminiSources: SourceItem[] = [];

    try {
      // 【개선8】Google Search grounding 활성화
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptText }],  // 【개선2】시스템 프롬프트 없음
              },
            ],
            generationConfig: {
              temperature: 0,  // 【개선1】temperature 0
              maxOutputTokens: 2000,
            },
            tools: [
              {
                google_search: {},  // 【개선8】Google Search grounding
              },
            ],
          }),
        },
      );

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      isWebSearch = true;
      
      // 【소스 트래킹】grounding metadata에서 인용 소스 추출
      const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
      // 【P0-1 FIX】외부 geminiSources에 직접 push (재선언 버그 수정)
      
      if (groundingMetadata?.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web?.uri) {
            geminiSources.push({
              url: chunk.web.uri,
              title: chunk.web.title || undefined,
              type: 'grounding',
              platform: 'GEMINI',
              domain: this.extractDomain(chunk.web.uri),
            });
          }
        }
        this.logger.log(`[Gemini] grounding 소스 ${geminiSources.length}개 추출`);
      }
      
      // searchEntryPoint에서 검색 쿼리 정보도 저장
      if (groundingMetadata?.searchEntryPoint?.renderedContent) {
        this.logger.log(`[Gemini] Google Search grounding 활성 확인`);
      }
      
    } catch (groundingError) {
      // grounding 실패 시 일반 모드로 폴백
      this.logger.warn(`[Gemini] grounding 실패, 일반 모드: ${groundingError.message}`);
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptText }],  // 【개선2】시스템 프롬프트 없음
              },
            ],
            generationConfig: {
              temperature: 0,  // 【개선1】temperature 0
              maxOutputTokens: 2000,
            },
          }),
        },
      );

      const data = await response.json();
      if (data.error) throw new Error(`Gemini API 에러: ${data.error.message}`);
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const result = this.analyzeResponse(text, hospitalName, 'GEMINI', 'gemini-2.0-flash');
    result.isWebSearch = isWebSearch;
    
    // 【소스 트래킹】Gemini 소스 구조화
    if (geminiSources.length > 0) {
      result.citedSources = [...new Set([...result.citedSources, ...geminiSources.map(s => s.url)])].slice(0, 15);
    }
    const textHints = this.extractSourceHintsFromText(text);
    result.sourceHints = {
      sources: geminiSources,
      hintKeywords: textHints.hintKeywords,
      estimatedSources: this.classifySources(geminiSources, textHints.hintKeywords),
    };
    
    return result;
  }



  // ==================== 초고도화: ABHS 통합 AI 분석 ====================

  /**
   * 【초고도화】GPT를 활용한 ABHS 통합 분석
   * 한 번의 API 호출로 Sentiment(-2~+2), RecommendationDepth(R0~R3), QueryIntent를 동시 분류
   */
  async analyzeResponseWithABHS(
    responseText: string,
    hospitalName: string,
    promptText: string,
  ): Promise<{
    score: number;
    label: SentimentLabel;
    sentimentV2: number;
    recommendationDepth: string;
    queryIntent: string;
  } | null> {
    if (!this.openai) return null;
    
    try {
      // 비용 절감: 응답 텍스트가 너무 길면 병원명 주변만 추출
      let contextText = responseText;
      const lowerResponse = responseText.toLowerCase();
      // 【최적화】캐시된 변형 사용
      const hospitalVariants = this.getCachedVariants(hospitalName);
      
      let firstIdx = -1;
      for (const variant of hospitalVariants) {
        const idx = lowerResponse.indexOf(variant.toLowerCase());
        if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
          firstIdx = idx;
        }
      }
      
      if (firstIdx !== -1) {
        const start = Math.max(0, firstIdx - 300);
        const end = Math.min(responseText.length, firstIdx + hospitalName.length + 400);
        contextText = responseText.slice(start, end);
      } else if (responseText.length > 800) {
        contextText = responseText.substring(0, 800);
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `병원 AI 가시성 분석: "${hospitalName}"

환자 질문: "${promptText.substring(0, 100)}"

AI 응답:
"""
${contextText}
"""

다음 3가지를 JSON으로만 답변하세요:

1. sentiment (-2~+2 정수):
  +2: 강한 긍정 (단독 강력 추천, "꼭 가보세요")
  +1: 긍정 (일반 추천, 장점 나열)
   0: 중립 (단순 언급, 팩트 전달)
  -1: 부정 (단점 언급, 부정 후기)
  -2: 강한 부정 (비추천, "피하세요", 부작용 경고)

2. depth (R0~R3):
  R3: 단독 추천 (유일하게 추천된 병원)
  R2: 복수 추천 중 상위 (1~2번째)
  R1: 단순 언급 (리스트 하위 또는 이름만)
  R0: 미언급 또는 부정적 맥락

3. intent (질문의 의도):
  RESERVATION: 예약/방문 의도
  COMPARISON: 비교 의도
  INFORMATION: 정보 탐색
  REVIEW: 후기/리뷰
  FEAR: 공포/걱정

JSON만 답변:
{"sentiment": <-2~+2>, "depth": "<R0~R3>", "intent": "<INTENT>", "reason": "<한줄>"}`,
          },
        ],
        temperature: 0,
        max_tokens: 150,
      });

      const aiResponse = completion.choices[0]?.message?.content || '';
      
      const jsonMatch = aiResponse.match(/\{[^}]+\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const sentimentV2 = Math.max(-2, Math.min(2, parseInt(parsed.sentiment) || 0));
          const depth = ['R0', 'R1', 'R2', 'R3'].includes(parsed.depth) ? parsed.depth : 'R0';
          const intent = ['RESERVATION', 'COMPARISON', 'INFORMATION', 'REVIEW', 'FEAR'].includes(parsed.intent) ? parsed.intent : 'INFORMATION';
          
          // V2 → 기존 호환 변환
          const score = sentimentV2 / 2; // -2~+2 → -1~+1
          let label: SentimentLabel = 'NEUTRAL';
          if (sentimentV2 >= 1) label = 'POSITIVE';
          else if (sentimentV2 <= -1) label = 'NEGATIVE';
          
          this.logger.log(`[ABHS분석] ${hospitalName}: sent=${sentimentV2}, depth=${depth}, intent=${intent}`);
          return { score, label, sentimentV2, recommendationDepth: depth, queryIntent: intent };
        } catch (parseError) {
          this.logger.warn(`[ABHS분석] JSON 파싱 실패: ${parseError.message}`);
        }
      }
    } catch (error) {
      this.logger.warn(`[ABHS분석] 실패, 폴백: ${error.message}`);
    }
    
    return null;
  }

  /**
   * 하위 호환: 기존 감성 분석 (ABHS 분석 실패 시 폴백)
   */
  private async analyzeContextSentimentWithAI(
    responseText: string,
    hospitalName: string,
  ): Promise<{ score: number; label: SentimentLabel } | null> {
    const result = await this.analyzeResponseWithABHS(responseText, hospitalName, '');
    if (result) {
      return { score: result.score, label: result.label };
    }
    return null;
  }

  // ==================== 개선10: AI 환각 필터링 ====================

  /**
   * 【고도화 #5】경쟁사 이름 환각 필터링 (강화)
   * 1단계: DB 등록 경쟁사와 유사도 매칭 (무조건 통과)
   * 2단계: 패턴 기반 실존 가능성 판단
   */
  private async verifyCompetitorsEnhanced(
    competitorNames: string[],
    registeredNames: string[],
  ): Promise<{ verified: string[]; filtered: string[] }> {
    const verified: string[] = [];
    const filtered: string[] = [];
    
    for (const name of competitorNames) {
      // 1단계: DB 등록 경쟁사와 유사도 비교 (0.6 이상이면 통과)
      const isRegistered = registeredNames.some(registered => {
        const similarity = this.calculateNameSimilarity(name, registered);
        return similarity >= 0.6;
      });
      
      if (isRegistered) {
        verified.push(name);
        continue;
      }
      
      // 2단계: 패턴 기반 검증
      if (this.isLikelyRealHospital(name)) {
        verified.push(name);
      } else {
        filtered.push(name);
        this.logger.log(`[환각 필터] 의심 병원명 제거: "${name}"`);
      }
    }
    
    return { verified, filtered };
  }

  /**
   * 【개선10】경쟁사 이름 환각 필터링 (기존 호환)
   */
  private async verifyCompetitors(
    competitorNames: string[],
  ): Promise<{ verified: string[]; filtered: string[] }> {
    const verified: string[] = [];
    const filtered: string[] = [];
    
    for (const name of competitorNames) {
      if (this.isLikelyRealHospital(name)) {
        verified.push(name);
      } else {
        filtered.push(name);
        this.logger.log(`[환각 필터] 의심 병원명 제거: "${name}"`);
      }
    }
    
    return { verified, filtered };
  }

  /**
   * 【개선10】병원명 실존 가능성 판단 (패턴 기반)
   * 향후 외부 API 연동 시 실제 검증으로 업그레이드
   */
  private isLikelyRealHospital(name: string): boolean {
    // 1. 너무 짧거나 긴 이름 필터
    if (name.length < 3 || name.length > 20) return false;
    
    // 2. 병원/치과/의원/클리닉으로 끝나는지 확인
    const validSuffixes = ['치과', '치과의원', '치과병원', '병원', '의원', '클리닉', '메디컬', '덴탈'];
    const hasValidSuffix = validSuffixes.some(suffix => name.endsWith(suffix));
    if (!hasValidSuffix) return false;
    
    // 3. 너무 일반적인(generic) 이름 패턴 필터
    const genericPatterns = [
      /^[가-힣]{1}치과$/, // 1글자+치과 (예: "가치과") - 너무 짧아서 의심
      /^좋은[가-힣]+$/, // "좋은치과" 같은 AI가 만들기 쉬운 이름
      /^행복[가-힣]+$/, 
      /^최고[가-힣]+$/, 
      /^사랑의[가-힣]+$/,
      /^스마일[가-힣]+$/,
      /^해피[가-힣]+$/,
    ];
    
    // generic 패턴은 필터하지 않음 (실제 있을 수 있음) - 대신 로그만 남김
    for (const pattern of genericPatterns) {
      if (pattern.test(name)) {
        this.logger.log(`[환각 필터] 의심 패턴이지만 통과: "${name}"`);
        break;
      }
    }
    
    // 4. 한글이 포함되어 있는지 확인
    if (!/[가-힣]/.test(name)) return false;
    
    return true;
  }

  /**
   * 【개선10】병원 실존 여부 검증 (패턴 기반)
   */
  async verifyHospitalExists(hospitalName: string, region?: string): Promise<{
    exists: boolean;
    source: string;
    details?: any;
  }> {
    // 패턴 기반 검증
    const isReal = this.isLikelyRealHospital(hospitalName);
    return {
      exists: isReal,
      source: 'pattern_based',
      details: { hospitalName, region },
    };
  }

  /**
   * 이름 유사도 계산 (간단한 문자열 포함 기반)
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const clean1 = name1.replace(/\s+/g, '').toLowerCase();
    const clean2 = name2.replace(/\s+/g, '').toLowerCase();
    
    if (clean1 === clean2) return 1.0;
    if (clean1.includes(clean2) || clean2.includes(clean1)) return 0.8;
    
    // Jaccard similarity (문자 기반)
    const chars1 = new Set(clean1.split(''));
    const chars2 = new Set(clean2.split(''));
    const intersection = new Set([...chars1].filter(c => chars2.has(c)));
    const union = new Set([...chars1, ...chars2]);
    
    return intersection.size / union.size;
  }

  // ==================== 개선3: 경쟁사 실제 AEO 점수 측정 ====================

  /**
   * 【개선3】경쟁사 AEO 점수 측정
   * 동일한 프롬프트로 경쟁사 이름을 대입하여 점수 계산
   */
  async measureCompetitorAEO(
    hospitalId: string,
    competitorId: string,
    competitorName: string,
  ): Promise<{ score: number; mentionCount: number; details: any }> {
    this.logger.log(`=== 경쟁사 AEO 측정: ${competitorName} ===`);
    
    // 해당 병원의 활성 프롬프트 조회
    const prompts = await this.prisma.prompt.findMany({
      where: { hospitalId, isActive: true },
      take: 10, // 비용 제한을 위해 상위 10개만
    });
    
    if (prompts.length === 0) {
      return { score: 0, mentionCount: 0, details: { message: '활성 프롬프트 없음' } };
    }

    let totalMentioned = 0;
    let totalQueries = 0;
    let totalPositionScore = 0;
    let positionCount = 0;
    const platformResults: Record<string, { mentioned: number; total: number }> = {};

    // 각 플랫폼에서 경쟁사 이름으로 측정
    const platforms: AIPlatform[] = ['CHATGPT', 'CLAUDE', 'GEMINI'];
    const availablePlatforms = platforms.filter(p => this.isPlatformAvailable(p));

    for (const prompt of prompts) {
      for (const platform of availablePlatforms) {
        try {
          const result = await this.queryPlatform(platform, prompt.promptText, competitorName);
          
          if (!platformResults[platform]) {
            platformResults[platform] = { mentioned: 0, total: 0 };
          }
          platformResults[platform].total++;
          totalQueries++;
          
          if (result.isMentioned) {
            totalMentioned++;
            platformResults[platform].mentioned++;
            
            if (result.mentionPosition) {
              const posScore = result.mentionPosition <= 1 ? 100 :
                              result.mentionPosition <= 2 ? 80 :
                              result.mentionPosition <= 3 ? 60 :
                              result.mentionPosition <= 5 ? 40 : 20;
              totalPositionScore += posScore;
              positionCount++;
            }
          }
          
          // 레이트 리밋 방지
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          this.logger.error(`[경쟁사 AEO] ${platform} 실패: ${error.message}`);
        }
      }
    }
    
    // 점수 계산
    const mentionRate = totalQueries > 0 ? (totalMentioned / totalQueries) * 100 : 0;
    const avgPositionScore = positionCount > 0 ? totalPositionScore / positionCount : 0;
    const overallScore = Math.round(mentionRate * 0.6 + avgPositionScore * 0.4);

    // 경쟁사 점수 저장
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await this.prisma.competitorScore.upsert({
      where: {
        competitorId_scoreDate: {
          competitorId,
          scoreDate: today,
        },
      },
      update: {
        overallScore,
        mentionCount: totalMentioned,
      },
      create: {
        competitorId,
        scoreDate: today,
        overallScore,
        mentionCount: totalMentioned,
      },
    });
    
    this.logger.log(`[경쟁사 AEO] ${competitorName}: 점수=${overallScore}, 언급=${totalMentioned}/${totalQueries}`);

    return {
      score: overallScore,
      mentionCount: totalMentioned,
      details: {
        totalQueries,
        mentionRate: Math.round(mentionRate),
        avgPositionScore: Math.round(avgPositionScore),
        platformResults,
      },
    };
  }

  // ==================== 개선5: Content Gap 개선 가이드 자동 생성 ====================

  /**
   * 【개선5】Content Gap 분석 및 AI 기반 개선 가이드 자동 생성
   */
  async generateContentGapGuide(hospitalId: string): Promise<any[]> {
    this.logger.log(`=== Content Gap 분석 시작: ${hospitalId} ===`);
    
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    // 우리 병원이 언급 안 된 응답 중 경쟁사가 언급된 것들
    const missedResponses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        isMentioned: false,
        responseDate: { gte: last30Days },
        competitorsMentioned: { isEmpty: false },
      },
      select: {
        id: true,
        promptId: true,
        aiPlatform: true,
        responseText: true,
        responseDate: true,
        competitorsMentioned: true,
        isMentioned: true,
        prompt: { select: { id: true, promptText: true, specialtyCategory: true } },
      },
      orderBy: { responseDate: 'desc' },
    });
    
    if (missedResponses.length === 0) {
      return [];
    }

    // 프롬프트별로 그룹핑
    const promptGaps: Map<string, {
      promptText: string;
      promptId: string;
      competitors: string[];
      platforms: string[];
      category: string;
    }> = new Map();

    for (const resp of missedResponses) {
      const key = resp.promptId;
      if (!promptGaps.has(key)) {
        promptGaps.set(key, {
          promptText: resp.prompt.promptText,
          promptId: resp.promptId,
          competitors: [],
          platforms: [],
          category: resp.prompt.specialtyCategory || '기타',
        });
      }
      const gap = promptGaps.get(key)!;
      gap.competitors.push(...resp.competitorsMentioned);
      gap.platforms.push(resp.aiPlatform);
    }

    const gaps: any[] = [];
    
    // 【최적화 R3】병원 조회를 루프 밖으로 이동 (N+1 방지)
    const hospital = this.openai ? await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { name: true },
    }) : null;
    
    for (const [promptId, gapData] of promptGaps) {
      const uniqueCompetitors = [...new Set(gapData.competitors)].slice(0, 5);
      const uniquePlatforms = [...new Set(gapData.platforms)];
      
      // 【개선5】AI로 개선 가이드 생성
      let aiGuide = '';
      if (this.openai) {
        try {
          const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: `당신은 병원 AEO(Answer Engine Optimization) 전문가입니다.

환자가 AI에게 "${gapData.promptText}" 라고 질문했을 때,
우리 병원(${hospital?.name || '미상'})은 추천되지 않고, 경쟁사(${uniqueCompetitors.join(', ')})가 추천되고 있습니다.

이 갭을 해소하기 위한 구체적인 콘텐츠/마케팅 전략을 3가지 제안해주세요.
각 전략은 반드시 실행 가능하고 구체적이어야 합니다.

JSON 형식으로만 답변:
{"strategies": [{"title": "전략명", "description": "상세 설명 (2~3문장)", "priority": "high|medium|low", "expectedImpact": "예상 효과"}]}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 500,
          });
          
          aiGuide = completion.choices[0]?.message?.content || '';
        } catch (error) {
          this.logger.warn(`[Content Gap] AI 가이드 생성 실패: ${error.message}`);
        }
      }

      // DB에 저장
      const contentGap = await this.prisma.contentGap.create({
        data: {
          hospitalId,
          gapType: 'CONTENT',
          topic: gapData.promptText,
          competitorHas: true,
          priorityScore: uniquePlatforms.length * 25, // 더 많은 플랫폼에서 갭 = 높은 우선순위
          suggestedAction: aiGuide ? `AI 분석 기반 가이드 생성됨` : '수동 분석 필요',
          competitorNames: uniqueCompetitors,
          relatedPromptIds: [promptId],
          aiGeneratedGuide: aiGuide,
        },
      });

      // 【버그 수정】JSON 파싱 실패 시 안전하게 처리
      let parsedGuide: any = null;
      if (aiGuide) {
        try {
          const jsonMatch = aiGuide.match(/```json\s*([\s\S]*?)\s*```/) || aiGuide.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiGuide;
          parsedGuide = JSON.parse(jsonStr);
        } catch (parseError) {
          this.logger.warn(`[Content Gap] AI 가이드 JSON 파싱 실패: ${parseError.message}`);
          parsedGuide = { strategies: [{ title: '전략 생성됨', description: aiGuide.substring(0, 200), priority: 'medium', expectedImpact: '재분석 필요' }] };
        }
      }

      gaps.push({
        id: contentGap.id,
        promptText: gapData.promptText,
        category: gapData.category,
        competitors: uniqueCompetitors,
        platforms: uniquePlatforms,
        priorityScore: contentGap.priorityScore,
        aiGuide: parsedGuide,
      });
    }

    this.logger.log(`[Content Gap] ${gaps.length}개 갭 분석 완료`);
    return gaps;
  }

  // ==================== 개선5-2: 콘텐츠 갭 → 블로그 초안 생성 (Claude 4 Sonnet) ====================

  /**
   * 【개선5-2】콘텐츠 갭 기반 블로그 초안 생성
   * Claude 4 Sonnet을 사용하여 치과 전문 블로그 글을 생성합니다.
   */
  async generateBlogDraft(hospitalId: string, gapId: string): Promise<any> {
    if (!this.anthropic) {
      throw new Error('Anthropic API가 초기화되지 않았습니다. ANTHROPIC_API_KEY를 확인해주세요.');
    }

    // 콘텐츠 갭 데이터 조회
    const contentGap = await this.prisma.contentGap.findUnique({
      where: { id: gapId },
    });

    if (!contentGap || contentGap.hospitalId !== hospitalId) {
      throw new Error('콘텐츠 갭을 찾을 수 없습니다');
    }

    // 병원 정보 조회
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new Error('병원 정보를 찾을 수 없습니다');
    }

    const regionFull = [hospital.regionSido, hospital.regionSigungu, hospital.regionDong]
      .filter(Boolean).join(' ');
    const specialties = (hospital.subSpecialties as string[] || []).join(', ') || '일반 치과';
    const procedures = (hospital.keyProcedures as string[] || []).join(', ') || '';
    const competitorNames = (contentGap.competitorNames as string[] || []).join(', ') || '경쟁사';

    this.logger.log(`[Blog Draft] 생성 시작: "${contentGap.topic}" for ${hospital.name}`);

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `당신은 한국 치과 마케팅 전문 블로그 작가입니다. 10년 이상 의료 콘텐츠를 작성해온 전문가로서, SEO에 최적화되면서도 환자가 읽기 쉽고 신뢰할 수 있는 글을 작성합니다.

## 배경 상황
환자들이 AI(ChatGPT, Claude, Perplexity, Gemini)에게 "${contentGap.topic}" 라고 질문하면,
현재 ${competitorNames}은(는) 추천되지만 **${hospital.name}**은(는) 추천되지 않고 있습니다.
이 콘텐츠 갭을 해소하기 위한 블로그 글을 작성해주세요.

## 병원 정보
- 병원명: ${hospital.name}
- 지역: ${regionFull}
- 전문 분야: ${specialties}
- 주요 시술: ${procedures}
- 웹사이트: ${hospital.websiteUrl || '미등록'}

## 작성 요구사항

1. **제목**: SEO 최적화 + 클릭을 유도하는 매력적인 제목 (50자 이내)
2. **메타 설명**: 네이버/구글 검색 결과에 노출될 설명 (150자 이내)
3. **본문**: 다음 구조로 2,000~3,000자 분량
   - 도입: 환자의 고민/궁금증으로 시작 (공감 유도)
   - 핵심 정보: 해당 시술/주제에 대한 전문 정보 (3~5개 소제목)
   - 병원 차별점: ${hospital.name}만의 강점을 자연스럽게 녹여내기
   - 마무리: 내원 유도 CTA (너무 광고스럽지 않게)
4. **SEO 키워드**: 본문에 자연스럽게 포함할 키워드 5개
5. **해시태그**: 네이버 블로그/인스타용 해시태그 10개

## 중요 규칙
- "~습니다" 체를 사용하되 딱딱하지 않게 (친근하면서도 전문적인 톤)
- 의학적으로 과장되거나 허위인 내용 절대 금지
- "최고", "최첨단", "완벽한" 같은 과장 표현 자제
- 실제 환자가 궁금해할 정보 위주로 작성
- AI가 이 글을 학습하면 ${hospital.name}을 추천할 수 있도록 지역명 + 시술명 조합을 자연스럽게 포함

다음 JSON 형식으로만 답변해주세요:
{
  "title": "블로그 제목",
  "metaDescription": "메타 설명",
  "content": "마크다운 형식의 본문 전체",
  "seoKeywords": ["키워드1", "키워드2", ...],
  "hashtags": ["#해시태그1", "#해시태그2", ...],
  "estimatedReadTime": "예상 읽기 시간 (예: 3분)",
  "targetPlatform": "네이버 블로그"
}`,
          },
        ],
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      
      // JSON 파싱 시도
      let blogDraft: any;
      try {
        // JSON 블록 추출 (```json ... ``` 형태 대응)
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                          responseText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
        blogDraft = JSON.parse(jsonStr);
      } catch {
        // JSON 파싱 실패 시 원본 텍스트 그대로
        blogDraft = {
          title: contentGap.topic,
          metaDescription: '',
          content: responseText,
          seoKeywords: [],
          hashtags: [],
          estimatedReadTime: '3분',
          targetPlatform: '네이버 블로그',
        };
      }

      // 결과에 메타 정보 추가
      blogDraft.gapId = gapId;
      blogDraft.gapTopic = contentGap.topic;
      blogDraft.hospitalName = hospital.name;
      blogDraft.model = 'claude-sonnet-4-20250514';
      blogDraft.generatedAt = new Date().toISOString();
      blogDraft.competitors = contentGap.competitorNames;
      blogDraft.priorityScore = contentGap.priorityScore;

      this.logger.log(`[Blog Draft] 생성 완료: "${blogDraft.title}" (${blogDraft.estimatedReadTime})`);

      return blogDraft;
    } catch (error) {
      this.logger.error(`[Blog Draft] 생성 실패: ${error.message}`);
      throw new Error(`블로그 초안 생성 실패: ${error.message}`);
    }
  }

  // ==================== 개선4: 프롬프트별 성과 분석 ====================

  /**
   * 【개선4】프롬프트별 성과 상세 분석
   */
  async getPromptPerformance(hospitalId: string): Promise<any[]> {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    // 【최적화 R3】select절로 필요 필드만 가져오기 (responseText 제외)
    const prompts = await this.prisma.prompt.findMany({
      where: { hospitalId, isActive: true },
      include: {
        aiResponses: {
          where: { responseDate: { gte: last30Days } },
          select: {
            aiPlatform: true,
            isMentioned: true,
            mentionPosition: true,
            sentimentLabel: true,
            competitorsMentioned: true,
            repeatIndex: true,
          },
          orderBy: { responseDate: 'desc' },
        },
      },
    });

    return prompts.map(prompt => {
      const responses = prompt.aiResponses;
      const totalQueries = responses.length;
      const mentionedResponses = responses.filter(r => r.isMentioned);
      const mentionRate = totalQueries > 0 ? (mentionedResponses.length / totalQueries) * 100 : 0;
      
      // 플랫폼별 성과
      const platforms = ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'] as const;
      const platformPerformance: Record<string, any> = {};
      
      for (const platform of platforms) {
        const platResponses = responses.filter(r => r.aiPlatform === platform);
        const platMentioned = platResponses.filter(r => r.isMentioned);
        
        if (platResponses.length > 0) {
          // 측정 일관성 분석 (REPEAT_COUNT > 1 시 의미 있음)
          const repeatGroups: Map<number, boolean[]> = new Map();
          platResponses.forEach(r => {
            const idx = (r as any).repeatIndex ?? 0;
            if (!repeatGroups.has(idx)) repeatGroups.set(idx, []);
          });
          
          // 순위 분석
          const positions = platResponses
            .filter(r => r.mentionPosition !== null)
            .map(r => r.mentionPosition!);
          
          platformPerformance[platform] = {
            totalQueries: platResponses.length,
            mentioned: platMentioned.length,
            mentionRate: Math.round((platMentioned.length / platResponses.length) * 100),
            avgPosition: positions.length > 0 
              ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
              : null,
            bestPosition: positions.length > 0 ? Math.min(...positions) : null,
            sentiment: {
              positive: platResponses.filter(r => r.sentimentLabel === 'POSITIVE').length,
              neutral: platResponses.filter(r => r.sentimentLabel === 'NEUTRAL').length,
              negative: platResponses.filter(r => r.sentimentLabel === 'NEGATIVE').length,
            },
          };
        }
      }

      // 경쟁사 빈도
      const competitorCounts: Record<string, number> = {};
      for (const r of responses) {
        for (const c of r.competitorsMentioned) {
          competitorCounts[c] = (competitorCounts[c] || 0) + 1;
        }
      }
      const topCompetitors = Object.entries(competitorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return {
        promptId: prompt.id,
        promptText: prompt.promptText,
        category: prompt.specialtyCategory || '기타',
        totalQueries,
        mentionRate: Math.round(mentionRate),
        platformPerformance,
        topCompetitors,
        // 【성과 등급】
        grade: mentionRate >= 80 ? 'A' : mentionRate >= 60 ? 'B' : mentionRate >= 40 ? 'C' : mentionRate >= 20 ? 'D' : 'F',
      };
    }).sort((a, b) => b.mentionRate - a.mentionRate); // 언급률 높은 순
  }

  // ==================== 기존 분석 로직 (유지) ====================

  private generateHospitalNameVariants(hospitalName: string): string[] {
    const variants: Set<string> = new Set();
    
    variants.add(hospitalName);
    variants.add(hospitalName.toLowerCase());
    
    const noSpace = hospitalName.replace(/\s+/g, '');
    variants.add(noSpace);
    variants.add(noSpace.toLowerCase());
    
    const noParens = hospitalName.replace(/[()（）\[\]【】]/g, ' ').replace(/\s+/g, ' ').trim();
    variants.add(noParens);
    variants.add(noParens.replace(/\s+/g, ''));
    
    const branchPatterns = [
      /\s*[\(（\[【]?\s*(\S*(?:본점|지점|점|본원|분원))\s*[\)）\]】]?\s*/g,
      /(\S+(?:본점|지점|점|본원|분원))\s*/g,
    ];
    
    let withoutBranch = hospitalName;
    for (const pattern of branchPatterns) {
      withoutBranch = withoutBranch.replace(pattern, ' ').trim();
    }
    if (withoutBranch !== hospitalName && withoutBranch.length > 2) {
      variants.add(withoutBranch);
      variants.add(withoutBranch.replace(/\s+/g, ''));
    }
    
    const corePatterns = [
      /([가-힣a-zA-Z]+치과의원)/g,
      /([가-힣a-zA-Z]+치과병원)/g,
      /([가-힣a-zA-Z]+치과)/g,
      /([가-힣a-zA-Z]+병원)/g,
      /([가-힣a-zA-Z]+의원)/g,
      /([가-힣a-zA-Z]+클리닉)/g,
      /([가-힣a-zA-Z]+메디컬)/g,
      /([가-힣a-zA-Z]+덴탈)/g,
    ];
    
    for (const pattern of corePatterns) {
      const matches = hospitalName.match(pattern);
      if (matches) {
        for (const match of matches) {
          variants.add(match);
          variants.add(match.toLowerCase());
        }
      }
    }
    
    const suffixes = ['치과', '치과의원', '치과병원', '병원', '의원', '클리닉', '메디컬', '덴탈'];
    const regionPrefixes = ['서울', '강남', '분당', '판교', '일산', '천안', '수원', '부산', '대구', '인천', '불당', '역삼', '논현', '잠실', '송파', '마포', '영등포', '광주', '대전', '울산', '제주'];
    // 브랜드명 단독 매칭에서 제외할 일반 단어 (오탐 방지)
    const commonWords = new Set(['대학교', '대학', '종합', '연합', '센터', '메디', '종합병원']);
    
    // 1단계: coreName 추출 (공백/괄호/지점명/의료기관 접미사 제거)
    let coreName = hospitalName
      .replace(/\s+/g, '')
      .replace(/[()（）\[\]【】]/g, '')
      .replace(/(본점|지점|본원|분원)$/, '')   // 뒤쪽 지점 접미사 제거
      .replace(/^[가-힣]+(본점|지점)\s*/g, '') // 앞쪽 "불당본점" 제거
      .replace(/(치과의원|치과병원|치과|병원|의원|클리닉|메디컬|덴탈)([가-힣]{2,3}점)?$/, ''); // 의료기관 접미사 + 지역점 동시 제거
    
    // "이편한치과 역삼점" → corePatterns에서 "이편한치과"를 잡으므로 
    // coreName 앞에 지점prefix가 남았으면 한번 더 제거
    for (const rp of regionPrefixes) {
      const branchPattern = new RegExp(`^${rp}(본점|지점|점)?`);
      if (hospitalName.replace(/\s+/g, '').startsWith(rp) && coreName.startsWith(rp)) {
        break; // 지역명이 진짜 병원명 일부면 유지
      }
    }
    
    // 2단계: 지역 prefix 제거 → 브랜드명 추출
    let brandName = coreName;
    for (const prefix of regionPrefixes) {
      if (brandName.startsWith(prefix) && brandName.length > prefix.length) {
        brandName = brandName.slice(prefix.length);
        break;
      }
    }
    
    // 3단계: 브랜드명 기반 변형 생성
    if (brandName.length >= 1) {
      for (const suffix of suffixes) {
        // 1글자 브랜드도 "예치과", "미치과" 같은 suffix 조합은 생성
        variants.add(brandName + suffix);
      }
      // 브랜드명 단독 매칭 조건:
      // - 3글자 이상: 일반 단어(commonWords) 제외하고 허용
      // - 2글자: 일상 한국어 단어가 아닌 경우만 허용 (오탐 방지)
      const common2CharWords = new Set([
        '연세', '바른', '시드', '미래', '서울', '강남', '하나', '우리', '새벽', 
        '사랑', '행복', '건강', '희망', '자연', '한울', '세계', '평화', '소망',
        '청춘', '나눔', '보람', '아름', '참좋', '으뜸', '최고', '한빛', '새싹',
      ]);
      if (brandName.length >= 3 && !commonWords.has(brandName)) {
        variants.add(brandName);
      } else if (brandName.length === 2 && !common2CharWords.has(brandName) && !commonWords.has(brandName)) {
        variants.add(brandName);
      }
    }
    
    // coreName(지역+브랜드) + suffix 조합
    if (coreName.length >= 2 && coreName !== brandName) {
      for (const suffix of suffixes) {
        variants.add(coreName + suffix);
      }
      if (!commonWords.has(coreName)) {
        variants.add(coreName);
      }
    }
    
    // 4단계: 지점 키워드 조합은 핵심 변형에만 제한적으로 추가
    const branchKeywords: string[] = [];
    for (const bk of ['불당', '강남', '본점', '지점', '본원', '역삼']) {
      if (hospitalName.includes(bk)) branchKeywords.push(bk);
    }
    
    if (branchKeywords.length > 0) {
      const coreVariantsForBranch: string[] = [];
      if (brandName.length >= 1) {
        for (const suffix of suffixes.slice(0, 3)) {
          coreVariantsForBranch.push(brandName + suffix);
        }
      }
      if (coreName !== brandName && coreName.length >= 2) {
        for (const suffix of suffixes.slice(0, 3)) {
          coreVariantsForBranch.push(coreName + suffix);
        }
      }
      
      for (const base of coreVariantsForBranch) {
        for (const branch of branchKeywords) {
          variants.add(`${base} ${branch}`);
          variants.add(`${base}(${branch})`);
          variants.add(`${branch} ${base}`);
        }
      }
    }
    
    return Array.from(variants).filter(v => v.length >= 2);
  }

  // 【최적화】병원명 변형 캐시 (같은 병원에 대해 반복 생성 방지)
  private variantCache = new Map<string, string[]>();

  private getCachedVariants(hospitalName: string): string[] {
    if (!this.variantCache.has(hospitalName)) {
      this.variantCache.set(hospitalName, this.generateHospitalNameVariants(hospitalName));
      // 캐시 사이즈 제한 (100개 초과 시 오래된 것 제거)
      if (this.variantCache.size > 100) {
        const firstKey = this.variantCache.keys().next().value;
        if (firstKey) this.variantCache.delete(firstKey);
      }
    }
    return this.variantCache.get(hospitalName)!;
  }

  private checkMentionWithVariants(
    response: string,
    hospitalName: string,
  ): { isMentioned: boolean; matchedVariant: string | null; mentionCount: number } {
    const variants = this.getCachedVariants(hospitalName);
    
    let totalMentionCount = 0;
    let firstMatchedVariant: string | null = null;
    
    // 【최적화】긴 변형부터 매칭 (더 정확한 매칭 우선)
    const sortedVariants = [...variants].sort((a, b) => b.length - a.length);
    const lowerResponse = response.toLowerCase();
    
    for (const variant of sortedVariants) {
      const lowerVariant = variant.toLowerCase();
      // 【최적화】간단한 indexOf로 먼저 존재 여부 확인 (regex보다 10x 빠름)
      if (!lowerResponse.includes(lowerVariant)) continue;
      
      const regex = new RegExp(this.escapeRegex(lowerVariant), 'gi');
      const matches = response.match(regex);
      
      if (matches && matches.length > 0) {
        totalMentionCount += matches.length;
        if (!firstMatchedVariant) {
          firstMatchedVariant = variant;
        }
      }
    }
    
    return {
      isMentioned: totalMentionCount > 0,
      matchedVariant: firstMatchedVariant,
      mentionCount: totalMentionCount,
    };
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private analyzeResponse(
    response: string,
    hospitalName: string,
    platform: AIPlatform,
    model: string,
  ): AIQueryResult {
    const mentionResult = this.checkMentionWithVariants(response, hospitalName);
    const isMentioned = mentionResult.isMentioned;

    let mentionPosition: number | null = null;
    let totalRecommendations: number | null = null;
    
    // 1순위: 번호 리스트에서 추출
    const numberedPattern = /(\d+)[.\)\.]\s*\**([^\n]+)/g;
    const numberedMatches = [...response.matchAll(numberedPattern)];
    
    // 2순위: 볼드 패턴 (번호 리스트 없을 때)
    const boldPattern = /\*\*([^*]+(?:치과|병원|의원|클리닉|덴탈)[^*]*)\*\*/g;
    const boldMatches = [...response.matchAll(boldPattern)];
    
    // 【최적화】캐시된 변형 사용 (generateHospitalNameVariants 중복 호출 제거)
    const hospitalVariants = this.getCachedVariants(hospitalName);
    
    // 번호 리스트 우선 사용, 없으면 볼드 패턴
    const matches = numberedMatches.length > 0 ? numberedMatches : [];
    const matchTextIndex = numberedMatches.length > 0 ? 2 : 1;
    
    if (matches.length > 0) {
      totalRecommendations = matches.length;
      for (let i = 0; i < matches.length; i++) {
        const listItem = matches[i][matchTextIndex]?.toLowerCase() || '';
        const isMatch = hospitalVariants.some(variant => 
          listItem.includes(variant.toLowerCase())
        );
        if (isMatch) {
          mentionPosition = i + 1;
          break;
        }
      }
    } else if (boldMatches.length > 0) {
      // 볼드 패턴에서 순위 탐지
      totalRecommendations = boldMatches.length;
      for (let i = 0; i < boldMatches.length; i++) {
        const boldText = boldMatches[i][1]?.toLowerCase() || '';
        const isMatch = hospitalVariants.some(variant => 
          boldText.includes(variant.toLowerCase())
        );
        if (isMatch) {
          mentionPosition = i + 1;
          break;
        }
      }
    }
    
    // 언급은 됐는데 순위를 못 잡은 경우: 본문 위치 기반 순위 추정
    if (isMentioned && mentionPosition === null) {
      const responseLength = response.length;
      if (mentionResult.matchedVariant) {
        const idx = response.toLowerCase().indexOf(mentionResult.matchedVariant.toLowerCase());
        if (idx !== -1) {
          const relativePos = idx / responseLength;
          if (relativePos < 0.2) mentionPosition = 1;
          else if (relativePos < 0.4) mentionPosition = 2;
          else if (relativePos < 0.6) mentionPosition = 3;
          else if (relativePos < 0.8) mentionPosition = 4;
          else mentionPosition = 5;
        }
      }
    }

    // 경쟁사 추출 개선: 번호 리스트 + 볼드 + 본문 내 병원명 패턴
    const competitorsMentioned: string[] = [];
    const allListItems = [
      ...numberedMatches.map(m => m[2]?.trim() || ''),
      ...boldMatches.map(m => m[1]?.trim() || ''),
    ];
    
    for (const name of allListItems) {
      const isOurHospital = hospitalVariants.some(variant => 
        name.toLowerCase().includes(variant.toLowerCase())
      );
      if (!isOurHospital) {
        const hospitalNameMatch = name.match(/([가-힣a-zA-Z]+(?:치과의원|치과병원|치과|병원|의원|클리닉|덴탈|메디컬))/);
        if (hospitalNameMatch) {
          competitorsMentioned.push(hospitalNameMatch[1]);
        }
      }
    }
    
    // 본문에서 추가 병원명 탐지 (리스트에 없는 경우)
    const inlineHospitalPattern = /([가-힣]{2,10}(?:치과의원|치과병원|치과|병원|의원|클리닉|덴탈))/g;
    const inlineMatches = response.match(inlineHospitalPattern) || [];
    for (const name of inlineMatches) {
      const isOurHospital = hospitalVariants.some(variant => 
        name.toLowerCase().includes(variant.toLowerCase())
      );
      if (!isOurHospital && !competitorsMentioned.includes(name)) {
        competitorsMentioned.push(name);
      }
    }

    const sentimentResult = this.analyzeSentimentWithVariants(response, hospitalVariants);
    const citedSources = this.extractCitedSources(response);
    
    // 【최적화】중복 경쟁사 제거 + 자기 자신 제거 방어
    const uniqueCompetitors = [...new Set(competitorsMentioned)]
      .filter(name => !hospitalVariants.some(v => name.toLowerCase().includes(v.toLowerCase())))
      .slice(0, 10);

    return {
      platform,
      model,
      response,
      isMentioned,
      mentionPosition,
      totalRecommendations,
      competitorsMentioned: uniqueCompetitors,
      citedSources,
      sentimentScore: sentimentResult.score,
      sentimentLabel: sentimentResult.label,
      matchedVariant: mentionResult.matchedVariant || undefined,
      allMentionCount: mentionResult.mentionCount,
    };
  }

  private analyzeSentimentWithVariants(response: string, hospitalVariants: string[]): { score: number; label: SentimentLabel } {
    const lowerResponse = response.toLowerCase();
    
    let firstIndex = -1;
    let matchedVariant = '';
    
    for (const variant of hospitalVariants) {
      const index = lowerResponse.indexOf(variant.toLowerCase());
      if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
        firstIndex = index;
        matchedVariant = variant;
      }
    }
    
    if (firstIndex === -1) {
      return { score: 0, label: 'NEUTRAL' };
    }

    const start = Math.max(0, firstIndex - 100);
    const end = Math.min(response.length, firstIndex + matchedVariant.length + 100);
    const context = response.slice(start, end).toLowerCase();

    // 【개선7】개선된 키워드 목록 (부정어 패턴 추가)
    const positiveKeywords = ['추천', '좋은', '유명', '전문', '실력', '친절', '만족', '최고', '인기', '신뢰', '베스트', '인정', '검증', '우수', '탁월', '뛰어난', '정확한', '안전한', '깨끗한', '편안한'];
    const negativeKeywords = ['불만', '비추', '비싼', '불친절', '후회', '문제', '주의', '논란', '피해', '사기', '최악', '실망', '부작용', '위험', '비위생'];
    // 부정어 패턴: "추천하지 않는다", "좋지 않다" 등
    const negationPatterns = ['않', '못', '안 ', '없', '아닌'];

    let score = 0;
    for (const keyword of positiveKeywords) {
      if (context.includes(keyword)) {
        // 부정어 패턴 체크
        const keywordIdx = context.indexOf(keyword);
        const prefix = context.slice(Math.max(0, keywordIdx - 5), keywordIdx);
        const suffix = context.slice(keywordIdx, keywordIdx + keyword.length + 5);
        const hasNegation = negationPatterns.some(neg => prefix.includes(neg) || suffix.includes(neg));
        
        if (hasNegation) {
          score -= 0.15; // 부정어 + 긍정 키워드 = 부정
        } else {
          score += 0.15;
        }
      }
    }
    for (const keyword of negativeKeywords) {
      if (context.includes(keyword)) score -= 0.2;
    }

    score = Math.max(-1, Math.min(1, score));

    let label: SentimentLabel = 'NEUTRAL';
    if (score > 0.2) label = 'POSITIVE';
    else if (score < -0.2) label = 'NEGATIVE';

    return { score, label };
  }

  private extractCitedSources(response: string): string[] {
    const urlPattern = /https?:\/\/[^\s\)\]]+/g;
    const urls = response.match(urlPattern) || [];
    return [...new Set(urls)].slice(0, 10);
  }

  // ==================== 소스 트래킹 시스템 ====================

  /**
   * URL에서 도메인 추출
   */
  private extractDomain(url: string): string {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * 응답 텍스트에서 인라인 URL 추출 (ChatGPT/Claude용)
   */
  private extractInlineUrls(text: string, platform: string): SourceItem[] {
    const urlPattern = /https?:\/\/[^\s\)\]\>\"]+/g;
    const urls = text.match(urlPattern) || [];
    return [...new Set(urls)].slice(0, 10).map(url => ({
      url,
      type: 'inline_url' as const,
      platform,
      domain: this.extractDomain(url),
    }));
  }

  /**
   * 응답 텍스트에서 소스 힌트 키워드 추출
   * ChatGPT/Claude가 출처를 직접 안 주지만, 텍스트에서 단서를 찾을 수 있음
   * 예: "네이버 평점 4.8점" → 네이버 플레이스 참조 추정
   */
  private extractSourceHintsFromText(text: string): { hintKeywords: string[] } {
    const lowerText = text.toLowerCase();
    const hints: string[] = [];

    // 네이버 관련
    const naverPatterns: [RegExp, string][] = [
      [/네이버\s*(평점|별점|리뷰|후기|평가|스토어|지도|플레이스)/gi, '네이버 플레이스'],
      [/네이버\s*블로그/gi, '네이버 블로그'],
      [/네이버\s*카페/gi, '네이버 카페'],
      [/place\.naver|naver\.me/gi, '네이버 플레이스'],
      [/blog\.naver/gi, '네이버 블로그'],
    ];

    // 카카오맵/다음
    const kakaoPatterns: [RegExp, string][] = [
      [/카카오\s*맵|카카오맵|다음\s*지도/gi, '카카오맵'],
      [/카카오\s*(평점|별점|리뷰|후기)/gi, '카카오맵'],
    ];

    // 구글 관련
    const googlePatterns: [RegExp, string][] = [
      [/구글\s*(리뷰|평점|별점|후기|지도|맵|maps)/gi, '구글 리뷰'],
      [/google\s*(reviews?|maps?|rating)/gi, '구글 리뷰'],
    ];

    // 의료 정보 사이트
    const medicalPatterns: [RegExp, string][] = [
      [/굿닥|모두닥|닥톡|바비톡|강남언니/gi, '의료 플랫폼'],
      [/건강보험심사평가원|심평원|hira/gi, '심평원'],
      [/대한\w+학회|대한\w+협회/gi, '학회/협회'],
    ];

    // 블로그/커뮤니티
    const communityPatterns: [RegExp, string][] = [
      [/블로그\s*(후기|리뷰|포스팅|글)/gi, '블로그'],
      [/맘카페|맘스홀릭|육아\s*카페/gi, '맘카페'],
      [/지식인|지식\s*in/gi, '네이버 지식인'],
      [/에브리타임|대학\s*커뮤니티/gi, '커뮤니티'],
    ];

    // SNS
    const snsPatterns: [RegExp, string][] = [
      [/인스타그램|인스타|instagram/gi, '인스타그램'],
      [/유튜브|youtube/gi, '유튜브'],
    ];

    // 정량적 데이터 단서
    const dataPatterns: [RegExp, string][] = [
      [/평점\s*[\d.]+\s*(점|\/)/gi, '평점 데이터'],
      [/리뷰\s*[\d,]+\s*건/gi, '리뷰 데이터'],
      [/(공식|홈페이지|웹사이트|사이트)/gi, '공식 웹사이트'],
    ];

    const allPatterns = [
      ...naverPatterns, ...kakaoPatterns, ...googlePatterns,
      ...medicalPatterns, ...communityPatterns, ...snsPatterns, ...dataPatterns,
    ];

    for (const [pattern, label] of allPatterns) {
      if (pattern.test(text)) {
        if (!hints.includes(label)) {
          hints.push(label);
        }
      }
    }

    return { hintKeywords: hints };
  }

  /**
   * 소스 아이템 + 힌트 키워드를 기반으로 추정 소스 분류
   */
  private classifySources(sources: SourceItem[], hintKeywords: string[]): string[] {
    const estimated: Set<string> = new Set(hintKeywords);

    // URL 도메인 기반 분류
    const domainMap: Record<string, string> = {
      'naver.com': '네이버',
      'blog.naver.com': '네이버 블로그',
      'place.naver.com': '네이버 플레이스',
      'map.naver.com': '네이버 지도',
      'cafe.naver.com': '네이버 카페',
      'kin.naver.com': '네이버 지식인',
      'map.kakao.com': '카카오맵',
      'maps.google.com': '구글맵',
      'google.com': '구글',
      'youtube.com': '유튜브',
      'instagram.com': '인스타그램',
      'modoodoc.com': '모두닥',
      'goodoc.co.kr': '굿닥',
      'babitalk.com': '바비톡',
      'gangnamunni.com': '강남언니',
      'hira.or.kr': '심평원',
    };

    for (const source of sources) {
      const domain = source.domain || '';
      for (const [key, label] of Object.entries(domainMap)) {
        if (domain.includes(key)) {
          estimated.add(label);
          break;
        }
      }
    }

    return [...estimated];
  }

  // ==================== 할루시네이션 감소 3단계 시스템 ====================

  /**
   * 응답 신뢰도 점수 계산 (0.0 ~ 1.0)
   * 
   * 1단계: 불확실성 마커 탐지 (uncertainty markers)
   * 2단계: 출처 기반 신뢰도 (source grounding)
   * 3단계: 응답 구조적 일관성 (structural consistency)
   * 
   * @returns confidenceScore, confidenceFactors, isLowConfidence
   */
  calculateConfidenceScore(
    result: AIQueryResult,
    promptText: string,
  ): { confidenceScore: number; confidenceFactors: Record<string, number>; isLowConfidence: boolean } {
    const response = result.response;
    const factors: Record<string, number> = {};

    // ── 1단계: 불확실성 마커 탐지 (가중치 0.30) ──
    const uncertaintyScore = this.detectUncertaintyMarkers(response);
    factors.uncertaintyMarker = uncertaintyScore;

    // ── 2단계: 출처 기반 신뢰도 (가중치 0.30) ──
    const sourceScore = this.evaluateSourceGrounding(result);
    factors.sourceGrounding = sourceScore;

    // ── 3단계: 응답 구조적 일관성 (가중치 0.20) ──
    const structuralScore = this.evaluateStructuralConsistency(response, promptText);
    factors.structuralConsistency = structuralScore;

    // ── 4단계: 플랫폼 신뢰도 보정 (가중치 0.10) ──
    const platformScore = this.getPlatformReliability(result.platform, result.isWebSearch);
    factors.platformReliability = platformScore;

    // ── 5단계: 세부 정보 검증 (가중치 0.10) ──
    const specificityScore = this.evaluateSpecificity(response, result.isMentioned);
    factors.specificity = specificityScore;

    // 가중 평균 계산
    const confidenceScore = Math.min(1, Math.max(0,
      factors.uncertaintyMarker * 0.30 +
      factors.sourceGrounding * 0.30 +
      factors.structuralConsistency * 0.20 +
      factors.platformReliability * 0.10 +
      factors.specificity * 0.10
    ));

    const isLowConfidence = confidenceScore < 0.4;

    if (isLowConfidence) {
      this.logger.warn(
        `[신뢰도 경고] ${result.platform} 응답 신뢰도 ${(confidenceScore * 100).toFixed(0)}% - ` +
        `불확실성=${(factors.uncertaintyMarker * 100).toFixed(0)}%, 출처=${(factors.sourceGrounding * 100).toFixed(0)}%`
      );
    }

    return { confidenceScore: Math.round(confidenceScore * 100) / 100, confidenceFactors: factors, isLowConfidence };
  }

  /**
   * 1단계: 불확실성 마커 탐지
   * - AI가 확신이 없을 때 사용하는 헤지 표현 탐지
   * - 높은 불확실성 → 낮은 신뢰도
   */
  private detectUncertaintyMarkers(response: string): number {
    const lowerResponse = response.toLowerCase();
    
    // 강한 불확실성 마커 (-0.15 per hit, max 5개)
    const strongUncertainty = [
      '정확한 정보는 직접 확인', '실제 정보와 다를 수 있', '정확하지 않을 수 있',
      '확인이 필요합니다', '보장할 수 없', '정보가 부정확할 수',
      '최신 정보가 아닐 수', '실제와 다를 수', '검증되지 않은',
      '확실하지 않', '알 수 없', '파악되지 않',
    ];
    
    // 약한 불확실성 마커 (-0.08 per hit, max 8개)
    const mildUncertainty = [
      '일 수 있습니다', '것으로 보입니다', '것으로 알려져',
      '것으로 추정', '수도 있습니다', '가능성이 있',
      '정확한 정보는', '직접 문의', '전화로 확인',
      '홈페이지를 참고', '참고하시기 바랍', '변동될 수',
    ];
    
    // 확신 마커 (+0.10 per hit, 신뢰도 boost)
    const confidenceMarkers = [
      '공식 홈페이지에 따르면', '네이버 플레이스 기준', '실제 후기에 따르면',
      '건강보험심사평가원', '대한치과의사협회', '검색 결과에 따르면',
      '최신 정보에 의하면', '리뷰 분석 결과', '평점',
    ];

    let score = 1.0;
    let strongHits = 0;
    let mildHits = 0;
    let confidenceHits = 0;

    for (const marker of strongUncertainty) {
      if (lowerResponse.includes(marker)) {
        strongHits++;
        if (strongHits <= 5) score -= 0.15;
      }
    }

    for (const marker of mildUncertainty) {
      if (lowerResponse.includes(marker)) {
        mildHits++;
        if (mildHits <= 8) score -= 0.08;
      }
    }

    for (const marker of confidenceMarkers) {
      if (lowerResponse.includes(marker)) {
        confidenceHits++;
        if (confidenceHits <= 3) score += 0.10;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 2단계: 출처 기반 신뢰도
   * - URL 인용이 있으면 높은 신뢰도
   * - 웹검색 모드면 추가 보너스
   */
  private evaluateSourceGrounding(result: AIQueryResult): number {
    let score = 0.3; // 기본 베이스

    // 인용 URL 수에 따른 점수
    const sourceCount = result.citedSources?.length || 0;
    if (sourceCount >= 3) score += 0.5;
    else if (sourceCount >= 1) score += 0.3;
    else if (sourceCount === 0) score += 0.0;

    // 웹검색 모드 보너스
    if (result.isWebSearch) score += 0.2;

    // 인용 URL에 공신력 있는 도메인이 있으면 보너스
    const trustedDomains = [
      'naver.com', 'kakao.com', 'hira.or.kr', 'kda.or.kr',
      'nhis.or.kr', 'gangnam.go.kr', 'modoo.at',
    ];
    const hasTrustedSource = result.citedSources?.some(url =>
      trustedDomains.some(domain => url.includes(domain))
    );
    if (hasTrustedSource) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 3단계: 응답 구조적 일관성
   * - 번호 리스트가 있으면 구조화된 응답 → 높은 신뢰도
   * - 질문과 응답의 관련성
   */
  private evaluateStructuralConsistency(response: string, promptText: string): number {
    let score = 0.5; // 기본 베이스

    // 번호 리스트 존재 (+0.2)
    const hasNumberedList = /\d+[.\)]\s/.test(response);
    if (hasNumberedList) score += 0.15;

    // 볼드/헤딩 구조 (+0.1)
    const hasStructure = /\*\*[^*]+\*\*/.test(response) || /#{1,3}\s/.test(response);
    if (hasStructure) score += 0.1;

    // 응답 길이 적절성 (200~3000자가 이상적)
    const responseLength = response.length;
    if (responseLength >= 200 && responseLength <= 3000) score += 0.1;
    else if (responseLength < 50 || responseLength > 5000) score -= 0.15;

    // 질문 키워드가 응답에 반영되었는지
    const keywords = promptText.split(/\s+/).filter(w => w.length >= 2);
    const matchedKeywords = keywords.filter(kw => response.includes(kw));
    const relevanceRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0.5;
    score += relevanceRatio * 0.15;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 4단계: 플랫폼별 기본 신뢰도
   * - Perplexity(웹검색) > ChatGPT(search-preview) > Gemini > Claude
   */
  private getPlatformReliability(platform: AIPlatform, isWebSearch?: boolean): number {
    const baseReliability: Record<string, number> = {
      PERPLEXITY: 0.85,   // 항상 웹검색 + 출처 인용
      CHATGPT: 0.70,      // gpt-4o-search-preview 사용 시 높음
      GEMINI: 0.65,       // Google 검색 통합 가능
      CLAUDE: 0.55,       // 웹검색 없음, 학습 데이터 기반
    };

    let score = baseReliability[platform] || 0.5;
    
    // 웹검색 모드이면 보너스
    if (isWebSearch) score = Math.min(1, score + 0.15);

    return score;
  }

  /**
   * 5단계: 세부 정보(구체성) 평가
   * - 구체적 주소, 전화번호, 운영시간 등이 있으면 높은 신뢰도
   * - 일반적인 설명만 있으면 낮은 신뢰도
   */
  private evaluateSpecificity(response: string, isMentioned: boolean): number {
    if (!isMentioned) return 0.5; // 미언급은 중립

    let score = 0.3;

    // 주소 패턴
    if (/서울|강남|송파|마포|종로|부산|대구|인천/.test(response) && /[구동로길]/.test(response)) {
      score += 0.15;
    }

    // 전화번호 패턴
    if (/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/.test(response)) {
      score += 0.15;
    }

    // 운영시간 패턴
    if (/평일|월요일|화요일|오전|오후|시~|시\s*~|시\s*-|:00/.test(response)) {
      score += 0.1;
    }

    // 구체적 시술/서비스 언급
    const specificTerms = ['임플란트', '교정', '라미네이트', '충치', '스케일링', '사랑니', '보철', '미백', 'CT', '디지털'];
    const specificCount = specificTerms.filter(t => response.includes(t)).length;
    score += Math.min(0.2, specificCount * 0.05);

    // "일반적인" 내용만 있는 패턴 감점
    const genericPatterns = ['다양한 진료', '친절한 상담', '편안한 환경', '최신 장비', '풍부한 경험'];
    const genericCount = genericPatterns.filter(p => response.includes(p)).length;
    if (genericCount >= 3) score -= 0.15; // 너무 일반적이면 감점

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 교차 검증: 같은 질문에 대한 다중 플랫폼 응답 일관성 검증
   * - 여러 플랫폼이 동일 병원을 언급하면 높은 신뢰도
   * - 하나만 언급하면 낮은 신뢰도
   * 
   * @returns 각 플랫폼 결과에 crossValidation 팩터 추가
   */
  applyCrossValidation(
    results: AIQueryResult[],
  ): AIQueryResult[] {
    if (results.length < 2) return results;

    // 같은 promptId에 대한 결과들끼리 비교
    const mentionPlatforms = results.filter(r => r.isMentioned).map(r => r.platform);
    const totalPlatforms = results.length;
    const mentionRatio = mentionPlatforms.length / totalPlatforms;

    for (const result of results) {
      if (!result.confidenceFactors) result.confidenceFactors = {};
      
      if (result.isMentioned) {
        // 다수 플랫폼이 언급 → 높은 교차 신뢰도
        if (mentionRatio >= 0.75) {
          result.confidenceFactors.crossValidation = 1.0;
        } else if (mentionRatio >= 0.5) {
          result.confidenceFactors.crossValidation = 0.8;
        } else if (mentionRatio >= 0.25) {
          result.confidenceFactors.crossValidation = 0.5;
        } else {
          // 하나만 언급 → 할루시네이션 의심
          result.confidenceFactors.crossValidation = 0.3;
          this.logger.warn(
            `[교차검증 경고] ${result.platform}만 언급 (${mentionPlatforms.length}/${totalPlatforms}) - 할루시네이션 의심`
          );
        }
      } else {
        // 미언급은 교차검증 해당 없음
        result.confidenceFactors.crossValidation = 0.5;
      }

      // 교차 검증 결과를 confidenceScore에 반영 (10% 가중치)
      if (result.confidenceScore !== undefined) {
        const crossFactor = result.confidenceFactors.crossValidation;
        result.confidenceScore = Math.round(
          (result.confidenceScore * 0.85 + crossFactor * 0.15) * 100
        ) / 100;
        result.isLowConfidence = result.confidenceScore < 0.4;
      }
    }

    return results;
  }

  /**
   * 플랫폼별 가중치
   */
  private getPlatformWeight(platform: AIPlatform): number {
    const weights: Record<string, number> = {
      PERPLEXITY: 1.4,
      CHATGPT: 1.3,
      GEMINI: 1.2,
      CLAUDE: 1.0,
    };
    return weights[platform] || 1.0;
  }

  /**
   * 감성 V2 → ABHS 팩터 변환
   */
  private sentimentToFactor(sentV2: number): number {
    switch (sentV2) {
      case -2: return 0;
      case -1: return 0.25;
      case 0: return 0.5;
      case 1: return 1.0;
      case 2: return 1.5;
      default: return Math.max(0, (sentV2 + 2) / 4 * 1.5);
    }
  }

  /**
   * 추천 깊이 → 점수 변환
   */
  private getDepthScore(depth: string): number {
    const scores: Record<string, number> = {
      R3: 4.0,
      R2: 3.0,
      R1: 1.5,
      R0: 0.0,
    };
    return scores[depth] || 0;
  }

  /**
   * 질문 의도 → 배율 변환
   */
  private getIntentMultiplier(intent: string): number {
    const multipliers: Record<string, number> = {
      RESERVATION: 1.5,  // 예약 의도 (매출 직결)
      REVIEW: 1.3,        // 후기/리뷰 (신뢰도 핵심)
      FEAR: 1.2,          // 공포/걱정 (전환 기회)
      COMPARISON: 1.1,    // 비교 의도 (경쟁 분석)
      INFORMATION: 1.0,   // 정보 탐색 (기본값)
    };
    return multipliers[intent] || 1.0;
  }

  /**
   * 간단한 질문 의도 분류 (AI 호출 없이 키워드 기반)
   */
  private classifyQueryIntentSimple(promptText: string): string {
    const text = promptText.toLowerCase();
    
    const reservationKeywords = ['예약', '방문', '가고싶', '가려고', '추천해줘', '소개', '갈만한', '가볼만한', '좋은 병원', '어떤 병원'];
    if (reservationKeywords.some(k => text.includes(k))) return 'RESERVATION';
    
    const comparisonKeywords = ['비교', 'vs', '차이', '뭐가 나', '어디가 더', '비용 비교'];
    if (comparisonKeywords.some(k => text.includes(k))) return 'COMPARISON';
    
    const reviewKeywords = ['후기', '리뷰', '경험', '솔직', '실제', '다녀온'];
    if (reviewKeywords.some(k => text.includes(k))) return 'REVIEW';
    
    const fearKeywords = ['아프', '무섭', '두려', '걱정', '부작용', '위험', '실패', '통증'];
    if (fearKeywords.some(k => text.includes(k))) return 'FEAR';
    
    return 'INFORMATION';
  }

  // ==================== 일일 점수 계산 (개선된 버전) ====================

  /**
   * 일일 점수 계산 - 언급률 + 포지션 + 감성 + 플랫폼 가중치
   */
  async calculateDailyScore(hospitalId: string, date: Date = new Date()): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 【최적화 R2】select절로 필요한 필드만 가져오기 (responseText 제외 = 대용량 텍스트 절약)
    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        promptId: true,
        aiPlatform: true,
        isMentioned: true,
        mentionPosition: true,
        sentimentScore: true,
        citedSources: true,
        sentimentScoreV2: true,
        recommendationDepth: true,
        queryIntent: true,
        platformWeight: true,
        abhsContribution: true,
        prompt: { select: { specialtyCategory: true } },
      },
    });

    // 【고도화 #6】데이터 부족 시 처리 + 신뢰도 표시
    if (responses.length === 0) {
      // 데이터 없을 때: 이전 점수를 유지하거나 -1 반환
      const lastScore = await this.prisma.dailyScore.findFirst({
        where: { hospitalId, scoreDate: { lt: startOfDay } },
        orderBy: { scoreDate: 'desc' },
      });
      if (lastScore) {
        // 이전 점수 유지 (데이터 없는 날은 마지막 점수 그대로)
        await this.prisma.dailyScore.upsert({
          where: { hospitalId_scoreDate: { hospitalId, scoreDate: startOfDay } },
          update: { 
            overallScore: lastScore.overallScore,
            platformScores: lastScore.platformScores as any,
            specialtyScores: lastScore.specialtyScores as any,
            mentionCount: 0,
            positiveRatio: lastScore.positiveRatio,
          },
          create: {
            hospitalId,
            scoreDate: startOfDay,
            overallScore: lastScore.overallScore,
            platformScores: lastScore.platformScores as any,
            specialtyScores: lastScore.specialtyScores as any,
            mentionCount: 0,
            positiveRatio: lastScore.positiveRatio,
          },
        });
        return lastScore.overallScore;
      }
      return 0;
    }
    
    // 【고도화 #6】신뢰도 계산: 데이터가 적으면 점수에 패널티
    const minReliableCount = 8; // 최소 8개 응답 (4플랫폼 × 2프롬프트)
    const reliabilityFactor = Math.min(1, responses.length / minReliableCount);

    // 1. 언급률 (0~100) - 같은 프롬프트+플랫폼의 다수결 (REPEAT_COUNT > 1 시 활용)
    const promptPlatformGroups = new Map<string, boolean[]>();
    for (const r of responses) {
      const key = `${r.promptId}-${r.aiPlatform}`;
      if (!promptPlatformGroups.has(key)) promptPlatformGroups.set(key, []);
      promptPlatformGroups.get(key)!.push(r.isMentioned);
    }
    
    let mentionedGroups = 0;
    for (const [, mentions] of promptPlatformGroups) {
      // 다수결: 과반 이상 언급되면 "언급됨"으로 판정
      const trueCount = mentions.filter(Boolean).length;
      if (trueCount > mentions.length / 2) mentionedGroups++;
    }
    
    const totalGroups = promptPlatformGroups.size;
    const mentionRate = totalGroups > 0 ? (mentionedGroups / totalGroups) * 100 : 0;

    // 2. 포지션 점수 (0~100)
    const positionScores = responses
      .filter(r => r.mentionPosition !== null)
      .map(r => {
        const pos = r.mentionPosition!;
        if (pos === 1) return 100;
        if (pos === 2) return 80;
        if (pos === 3) return 60;
        if (pos === 4) return 40;
        if (pos === 5) return 20;
        return 10;
      });
    const avgPositionScore = positionScores.length > 0 
      ? positionScores.reduce((a, b) => a + b, 0) / positionScores.length 
      : 0;

    // 3. 감성 점수 (0~100)
    const sentimentScores = responses
      .filter(r => r.sentimentScore !== null)
      .map(r => ((r.sentimentScore! + 1) / 2) * 100);
    const avgSentimentScore = sentimentScores.length > 0
      ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
      : 50;

    // 4. 인용 점수 (0~100)
    const citationScores = responses.map(r => Math.min(100, (r.citedSources?.length || 0) * 20));
    const avgCitationScore = citationScores.reduce((a, b) => a + b, 0) / citationScores.length;

    // 【고도화 #2】가시성 점수 리밸런싱
    // 인용(citation)은 Perplexity만 유리하므로 가중치 축소
    // 대신 '플랫폼 커버리지'(몇 개 플랫폼에서 언급되는가) 추가
    const platformsCovered = new Set(responses.filter(r => r.isMentioned).map(r => r.aiPlatform)).size;
    const totalPlatformsUsed = new Set(responses.map(r => r.aiPlatform)).size;
    const coverageScore = totalPlatformsUsed > 0 ? (platformsCovered / totalPlatformsUsed) * 100 : 0;

    const overallScore = Math.round(
      mentionRate * 0.35 +         // 언급률 35% (기존 40% → 약간 축소)
      avgPositionScore * 0.25 +    // 포지션 25% (기존 30% → 약간 축소)
      avgSentimentScore * 0.15 +   // 감성 15% (기존 20% → 축소)
      coverageScore * 0.20 +       // 플랫폼 커버리지 20% (신규)
      avgCitationScore * 0.05      // 인용 5% (기존 10% → 절반 축소)
    );
    
    // 【할루시네이션 감소】저신뢰 응답이 많으면 점수에 할인 적용
    // Note: confidenceScore/isLowConfidence 컬럼이 DB에 아직 없을 수 있으므로 안전하게 처리
    const lowConfResponses = responses.filter(r => (r as any).isLowConfidence === true);
    const lowConfRatio = responses.length > 0 ? lowConfResponses.length / responses.length : 0;
    const confidencePenalty = lowConfRatio > 0.5 ? 0.85 : lowConfRatio > 0.3 ? 0.92 : 1.0;
    
    // 【고도화 #6】신뢰도 보정: 데이터가 적으면 점수를 보수적으로 조정
    // 8개 미만이면 실제 점수의 비율만 반영 (예: 4개면 50% 반영)
    const adjustedScore = Math.round(overallScore * reliabilityFactor * confidencePenalty);

    // 플랫폼별 점수 (다수결 기반)
    const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'] as const;
    const platformScores: Record<string, number> = {};
    
    for (const platform of platforms) {
      const platformResponses = responses.filter(r => r.aiPlatform === platform);
      if (platformResponses.length > 0) {
        // 프롬프트별 다수결
        const promptGroups = new Map<string, boolean[]>();
        platformResponses.forEach(r => {
          if (!promptGroups.has(r.promptId)) promptGroups.set(r.promptId, []);
          promptGroups.get(r.promptId)!.push(r.isMentioned);
        });
        
        let mentioned = 0;
        for (const [, mentions] of promptGroups) {
          const trueCount = mentions.filter(Boolean).length;
          if (trueCount > mentions.length / 2) mentioned++;
        }
        
        platformScores[platform.toLowerCase()] = Math.round((mentioned / promptGroups.size) * 100);
      }
    }

    // 【개선4】진료과목별 점수
    const specialtyScores: Record<string, number> = {};
    const categoryGroups = new Map<string, { mentioned: number; total: number }>();
    
    for (const r of responses) {
      const category = r.prompt?.specialtyCategory || '기타';
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, { mentioned: 0, total: 0 });
      }
      const group = categoryGroups.get(category)!;
      group.total++;
      if (r.isMentioned) group.mentioned++;
    }
    
    for (const [category, stats] of categoryGroups) {
      specialtyScores[category] = stats.total > 0 
        ? Math.round((stats.mentioned / stats.total) * 100) 
        : 0;
    }

    // 저장
    await this.prisma.dailyScore.upsert({
      where: {
        hospitalId_scoreDate: {
          hospitalId,
          scoreDate: startOfDay,
        },
      },
      update: {
        overallScore: adjustedScore,
        platformScores,
        specialtyScores,
        mentionCount: mentionedGroups,
        positiveRatio: sentimentScores.filter(s => s > 60).length / Math.max(responses.length, 1),
        // 초고도화 ABHS 데이터
        sovPercent: mentionRate,
        avgSentimentV2: this.calculateAvgSentimentV2(responses),
        platformContributions: this.calculatePlatformContributions(responses),
        intentScores: this.calculateIntentScores(responses),
        depthDistribution: this.calculateDepthDistribution(responses),
      },
      create: {
        hospitalId,
        scoreDate: startOfDay,
        overallScore: adjustedScore,
        platformScores,
        specialtyScores,
        mentionCount: mentionedGroups,
        positiveRatio: sentimentScores.filter(s => s > 60).length / Math.max(responses.length, 1),
        // 초고도화 ABHS 데이터
        sovPercent: mentionRate,
        avgSentimentV2: this.calculateAvgSentimentV2(responses),
        platformContributions: this.calculatePlatformContributions(responses),
        intentScores: this.calculateIntentScores(responses),
        depthDistribution: this.calculateDepthDistribution(responses),
      },
    });

    return adjustedScore;
  }

  // ==================== 초고도화: ABHS 집계 헬퍼 ====================

  private calculateAvgSentimentV2(responses: any[]): number {
    const v2Values = responses
      .filter(r => r.sentimentScoreV2 != null)
      .map(r => r.sentimentScoreV2);
    if (v2Values.length === 0) return 0;
    return v2Values.reduce((a: number, b: number) => a + b, 0) / v2Values.length;
  }

  private calculatePlatformContributions(responses: any[]): any {
    const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'] as const;
    const result: any = {};
    
    for (const platform of platforms) {
      const platResps = responses.filter(r => r.aiPlatform === platform);
      if (platResps.length === 0) continue;
      
      const weight = this.getPlatformWeight(platform as AIPlatform);
      const mentioned = platResps.filter(r => r.isMentioned).length;
      const avgContrib = platResps
        .filter(r => r.abhsContribution != null)
        .map(r => r.abhsContribution);
      
      result[platform.toLowerCase()] = {
        weight,
        responseCount: platResps.length,
        sovPercent: Math.round((mentioned / platResps.length) * 100),
        avgContribution: avgContrib.length > 0 
          ? avgContrib.reduce((a: number, b: number) => a + b, 0) / avgContrib.length 
          : 0,
      };
    }
    return result;
  }

  private calculateIntentScores(responses: any[]): any {
    const intents = ['RESERVATION', 'COMPARISON', 'INFORMATION', 'REVIEW', 'FEAR'] as const;
    const result: any = {};
    
    for (const intent of intents) {
      const intentResps = responses.filter(r => r.queryIntent === intent);
      if (intentResps.length === 0) {
        result[intent.toLowerCase()] = 0;
        continue;
      }
      const mentioned = intentResps.filter(r => r.isMentioned).length;
      result[intent.toLowerCase()] = Math.round((mentioned / intentResps.length) * 100);
    }
    return result;
  }

  private calculateDepthDistribution(responses: any[]): any {
    const dist: any = { R0: 0, R1: 0, R2: 0, R3: 0 };
    for (const r of responses) {
      const depth = r.recommendationDepth || 'R0';
      dist[depth] = (dist[depth] || 0) + 1;
    }
    return dist;
  }

  // ==================== 【Area 2】Answer Position 정밀 분류 ====================

  /**
   * Answer Position Taxonomy (5단계)
   * - PRIMARY_RECOMMEND: 단독 또는 1순위 강력 추천
   * - COMPARISON_WINNER: 비교 분석에서 우위 판정
   * - INFORMATION_CITE: 정보 제공 맥락에서 인용
   * - CONDITIONAL: 조건부 추천 ("~라면 괜찮다")
   * - NEGATIVE: 부정적 언급 또는 비추천
   */
  private classifyAnswerPosition(
    result: AIQueryResult,
    sentimentV2: number | null,
    recDepth: string | null,
  ): AnswerPositionType {
    // 부정적 감성 → NEGATIVE
    if (sentimentV2 !== null && sentimentV2 <= -1) {
      return 'NEGATIVE';
    }

    // 단독 추천 (R3) → PRIMARY_RECOMMEND
    if (recDepth === 'R3') {
      return 'PRIMARY_RECOMMEND';
    }

    // 1순위 + 긍정 감성 → PRIMARY_RECOMMEND
    if (result.mentionPosition === 1 && sentimentV2 !== null && sentimentV2 >= 1) {
      return 'PRIMARY_RECOMMEND';
    }

    // 비교 의도 + 상위 순위 → COMPARISON_WINNER
    const promptLower = (result.response || '').toLowerCase();
    const isComparisonContext = /비교|vs|차이|장단점|top\s*\d/.test(promptLower);
    if (isComparisonContext && result.mentionPosition !== null && result.mentionPosition <= 2) {
      return 'COMPARISON_WINNER';
    }

    // 조건부 추천 패턴 탐지
    const conditionalPatterns = ['경우에', '라면', '다면', '할 때', '조건으로', '편이', '나쁘지 않'];
    const mentionContext = result.matchedVariant 
      ? this.extractMentionContext(result.response, result.matchedVariant, 100)
      : '';
    const isConditional = conditionalPatterns.some(p => mentionContext.includes(p));
    if (isConditional && recDepth !== 'R3') {
      return 'CONDITIONAL';
    }

    // R2 (상위 복수 추천) → 비교 맥락이면 COMPARISON_WINNER, 아니면 INFORMATION_CITE
    if (recDepth === 'R2') {
      return isComparisonContext ? 'COMPARISON_WINNER' : 'INFORMATION_CITE';
    }

    // R1 (단순 언급) → INFORMATION_CITE
    return 'INFORMATION_CITE';
  }

  /**
   * 언급 주변 텍스트 추출 (Answer Position 분석용)
   */
  private extractMentionContext(response: string, variant: string, radius: number): string {
    const idx = response.toLowerCase().indexOf(variant.toLowerCase());
    if (idx === -1) return '';
    const start = Math.max(0, idx - radius);
    const end = Math.min(response.length, idx + variant.length + radius);
    return response.slice(start, end).toLowerCase();
  }

  // ==================== 【Area 4】Answer Quality Score ====================

  /**
   * Answer Quality Score (AQS)
   * 정확한 주소/시술 매칭/오류/최신 정보에 가점/감점
   * 범위: -50 ~ +100
   */
  private calculateAnswerQualityScore(
    result: AIQueryResult,
    hospitalName: string,
    promptText: string,
  ): { score: number; factors: Record<string, number> } {
    const response = result.response;
    const factors: Record<string, number> = {};
    let score = 0;

    // 1. 주소 정확도 (+20): 구체적 주소 정보가 있으면 가점
    const hasAddress = /서울|경기|부산|대구|인천|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주/.test(response)
      && /[구동로길]\s?\d/.test(response);
    const hasPhoneNumber = /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/.test(response);
    factors.addressAccuracy = (hasAddress ? 15 : 0) + (hasPhoneNumber ? 5 : 0);
    score += factors.addressAccuracy;

    // 2. 시술 매칭 (+15): 질문의 시술이 응답에도 등장하면 가점
    const promptKeywords = promptText.split(/\s+/).filter(w => w.length >= 2);
    const matchedProcedures = promptKeywords.filter(kw => response.includes(kw));
    const procedureMatchRatio = promptKeywords.length > 0 ? matchedProcedures.length / promptKeywords.length : 0;
    factors.procedureMatch = Math.round(procedureMatchRatio * 15);
    score += factors.procedureMatch;

    // 3. 오류 정보 감점 (-30): 불확실성·부정확성 마커
    const errorMarkers = ['정확하지 않을 수', '폐업', '이전', '정보가 없', '찾을 수 없', '존재하지 않'];
    const errorCount = errorMarkers.filter(m => response.includes(m)).length;
    factors.errorPenalty = -Math.min(30, errorCount * 10);
    score += factors.errorPenalty;

    // 4. 최신 정보 가점 (+10): 최근 날짜·연도 언급
    const currentYear = new Date().getFullYear();
    const hasRecentDate = response.includes(String(currentYear)) || response.includes(String(currentYear - 1));
    factors.recencyBonus = hasRecentDate ? 10 : 0;
    score += factors.recencyBonus;

    // 5. 웹검색 기반 가점 (+10)
    factors.webSearchBonus = result.isWebSearch ? 10 : 0;
    score += factors.webSearchBonus;

    // 6. 인용 출처 가점 (+10)
    const sourceCount = result.citedSources?.length || 0;
    factors.citationBonus = Math.min(10, sourceCount * 3);
    score += factors.citationBonus;

    // 7. 구체적 시술/서비스 언급 (+15)
    const specificTerms = ['임플란트', '교정', '라미네이트', '충치', '스케일링', '사랑니', '보철', '미백', 'CT', '디지털', '보톡스', '필러', '리프팅', 'MRI', '내시경'];
    const specificCount = specificTerms.filter(t => response.includes(t)).length;
    factors.specificityBonus = Math.min(15, specificCount * 3);
    score += factors.specificityBonus;

    // 범위 제한
    score = Math.max(-50, Math.min(100, score));

    return { score: Math.round(score), factors };
  }

  // ==================== 【Area 2】플랫폼별 맞춤 프롬프트 트윅 ====================

  /**
   * 플랫폼별 프롬프트 최적화
   * - Perplexity: 출처 포함 요청
   * - ChatGPT: 지역명 강화
   * - Claude: 리스트형 응답 유도
   * - Gemini: Google grounding 활용 유도
   */
  tweakPromptForPlatform(promptText: string, platform: AIPlatform): string {
    switch (platform) {
      case 'PERPLEXITY':
        return `${promptText} 가능하면 출처(URL)도 함께 알려줘.`;
      case 'CHATGPT':
        // 지역명이 이미 포함되어 있으면 그대로, 없으면 구체적 답변 유도
        return `${promptText} 구체적인 병원 이름과 위치를 포함해서 알려줘.`;
      case 'CLAUDE':
        return `${promptText} 번호 리스트 형식으로 각 병원의 장단점과 함께 알려줘.`;
      case 'GEMINI':
        return `${promptText} 최신 정보를 기반으로 알려줘.`;
      default:
        return promptText;
    }
  }

  // ==================== 【Area 3】AEO→GEO Closed-Loop 파이프라인 ====================

  /**
   * AEO→GEO 자동 파이프라인 실행
   * 1. Content Gap 감지 (미언급 + 경쟁사 언급)
   * 2. GEO Content 자동 초안 생성
   * 3. 파이프라인 레코드 생성
   */
  async runAeoPipeline(hospitalId: string): Promise<{
    pipelinesCreated: number;
    details: any[];
  }> {
    this.logger.log(`=== AEO→GEO Pipeline 시작: ${hospitalId} ===`);

    const last14Days = new Date();
    last14Days.setDate(last14Days.getDate() - 14);

    // 1. 미언급 + 경쟁사 언급 응답 찾기
    const missedResponses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        isMentioned: false,
        responseDate: { gte: last14Days },
        competitorsMentioned: { isEmpty: false },
      },
      select: {
        promptId: true,
        aiPlatform: true,
        competitorsMentioned: true,
        prompt: { select: { promptText: true, specialtyCategory: true } },
      },
      orderBy: { responseDate: 'desc' },
    });

    if (missedResponses.length === 0) {
      return { pipelinesCreated: 0, details: [] };
    }

    // 2. 프롬프트별 그룹핑
    const gapMap = new Map<string, {
      promptText: string;
      platforms: Set<string>;
      competitors: Set<string>;
      category: string;
    }>();

    for (const r of missedResponses) {
      const key = r.promptId;
      if (!gapMap.has(key)) {
        gapMap.set(key, {
          promptText: r.prompt?.promptText || '',
          platforms: new Set(),
          competitors: new Set(),
          category: r.prompt?.specialtyCategory || '',
        });
      }
      const gap = gapMap.get(key)!;
      gap.platforms.add(r.aiPlatform);
      r.competitorsMentioned.forEach(c => gap.competitors.add(c));
    }

    // 3. 기존 파이프라인과 중복 방지
    const existingPipelines = await this.prisma.aeoPipeline.findMany({
      where: { hospitalId, status: { in: ['GAP_DETECTED', 'CONTENT_DRAFTED'] } },
      select: { gapPromptText: true },
    });
    const existingGapTexts = new Set(existingPipelines.map(p => p.gapPromptText));

    // 4. 현재 SoV 측정 (파이프라인의 preSovPercent 기록용)
    const latestScore = await this.prisma.dailyScore.findFirst({
      where: { hospitalId },
      orderBy: { scoreDate: 'desc' },
      select: { sovPercent: true },
    });

    const details: any[] = [];
    let created = 0;

    for (const [, gap] of gapMap) {
      if (existingGapTexts.has(gap.promptText)) continue;
      if (gap.platforms.size < 2) continue; // 2개 이상 플랫폼에서 미언급인 경우만

      try {
        const pipeline = await this.prisma.aeoPipeline.create({
          data: {
            hospitalId,
            gapDetectedAt: new Date(),
            gapPromptText: gap.promptText,
            gapPlatforms: Array.from(gap.platforms),
            competitorsInGap: Array.from(gap.competitors),
            preSovPercent: latestScore?.sovPercent ?? null,
            status: 'GAP_DETECTED',
          },
        });

        details.push({
          pipelineId: pipeline.id,
          promptText: gap.promptText,
          platforms: Array.from(gap.platforms),
          competitors: Array.from(gap.competitors),
        });
        created++;
      } catch (err) {
        this.logger.warn(`[AEO Pipeline] 생성 실패: ${err.message}`);
      }
    }

    this.logger.log(`=== AEO→GEO Pipeline 완료: ${created}개 파이프라인 생성 ===`);
    return { pipelinesCreated: created, details };
  }

  /**
   * 【Area 3】AEO Impact Score 계산
   * 발행 후 2주 경과된 파이프라인의 SoV 변화 측정
   */
  async calculateAeoImpact(hospitalId: string): Promise<{
    measured: number;
    results: Array<{ pipelineId: string; sovLift: number; impactScore: number }>;
  }> {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // 발행된 지 2주 이상 된 파이프라인 중 아직 재측정 안 된 것
    const pipelines = await this.prisma.aeoPipeline.findMany({
      where: {
        hospitalId,
        status: 'PUBLISHED',
        publishedAt: { lte: twoWeeksAgo },
        remeasuredAt: null,
      },
    });

    if (pipelines.length === 0) {
      return { measured: 0, results: [] };
    }

    // 현재 SoV
    const latestScore = await this.prisma.dailyScore.findFirst({
      where: { hospitalId },
      orderBy: { scoreDate: 'desc' },
      select: { sovPercent: true },
    });
    const currentSov = latestScore?.sovPercent ?? 0;

    const results: Array<{ pipelineId: string; sovLift: number; impactScore: number }> = [];

    for (const pipeline of pipelines) {
      const preSov = pipeline.preSovPercent ?? 0;
      const sovLift = currentSov - preSov;

      // Impact Score 계산
      const platformCoverage = pipeline.gapPlatforms.length / 4; // 4개 플랫폼 기준
      const competitorCount = pipeline.competitorsInGap.length;
      const impactScore = Math.round(
        (sovLift > 0 ? sovLift * 2 : sovLift) * 0.5 + // SoV 변화 50%
        platformCoverage * 30 +                        // 플랫폼 커버리지 30%
        Math.min(20, competitorCount * 5)              // 경쟁사 임팩트 20%
      );

      await this.prisma.aeoPipeline.update({
        where: { id: pipeline.id },
        data: {
          remeasuredAt: new Date(),
          postSovPercent: currentSov,
          sovLift,
          impactScore,
          impactFactors: { sovLift, platformCoverage, competitorCount, preSov, currentSov },
          status: 'IMPACT_CALCULATED',
        },
      });

      results.push({ pipelineId: pipeline.id, sovLift, impactScore });
    }

    return { measured: results.length, results };
  }

  // ==================== 【Area 4】Weighted Intent SoV ====================

  /**
   * 의도별 전환 가치를 반영한 Weighted Intent SoV 계산
   */
  calculateWeightedIntentSov(intentScores: Record<string, number>): Record<string, { sov: number; valueScore: number; weightedSov: number }> {
    const intentValues: Record<string, number> = {
      reservation: 5,   // 예약 의도 → 매출 직결
      review: 4,         // 후기 → 신뢰도 핵심
      fear: 3,           // 공포/걱정 → 전환 기회
      comparison: 2,     // 비교 → 경쟁 분석
      information: 1,    // 정보 탐색 → 기본
    };

    const result: Record<string, { sov: number; valueScore: number; weightedSov: number }> = {};

    for (const [intent, sov] of Object.entries(intentScores)) {
      const value = intentValues[intent] || 1;
      result[intent] = {
        sov,
        valueScore: value,
        weightedSov: Math.round(sov * value / 5 * 100) / 100, // 정규화
      };
    }

    return result;
  }

  // ==================== 【Area 5】1-Click Improve API ====================

  /**
   * 1-Click 개선 액션 처리
   * type: 'generate_geo' | 'create_prompt_variants' | 'add_competitor'
   */
  async handleOneClickImprove(hospitalId: string, action: {
    type: string;
    relatedId?: string;
    params?: Record<string, any>;
  }): Promise<{ success: boolean; result: any }> {
    switch (action.type) {
      case 'generate_geo': {
        // Content Gap → GEO 콘텐츠 초안 생성 트리거
        if (!action.relatedId) return { success: false, result: { error: 'relatedId (contentGapId) 필요' } };
        const blogDraft = await this.generateBlogDraft(hospitalId, action.relatedId);
        return { success: true, result: blogDraft };
      }
      case 'create_prompt_variants': {
        // Golden Prompt → 변형 생성 트리거
        if (!action.relatedId) return { success: false, result: { error: 'relatedId (promptId) 필요' } };
        const prompt = await this.prisma.prompt.findUnique({ where: { id: action.relatedId } });
        if (!prompt || prompt.hospitalId !== hospitalId) return { success: false, result: { error: '프롬프트 미발견' } };
        // 변형 3개 생성 (톤/지역 변형)
        const variants = this.generatePromptVariants(prompt.promptText, 3);
        const created = await this.prisma.prompt.createMany({
          data: variants.map(v => ({
            hospitalId,
            promptText: v,
            promptType: 'AUTO_GENERATED' as const,
            specialtyCategory: prompt.specialtyCategory,
            regionKeywords: prompt.regionKeywords,
            isActive: true,
            experimentGroup: 'EXPERIMENT_TONE' as const,
            experimentParentId: prompt.id,
          })),
        });
        return { success: true, result: { created: created.count, variants } };
      }
      case 'add_competitor': {
        // 경쟁사 자동 등록
        const name = action.params?.competitorName;
        if (!name) return { success: false, result: { error: 'competitorName 필요' } };
        const competitor = await this.prisma.competitor.create({
          data: {
            hospitalId,
            competitorName: name,
            isAutoDetected: true,
            isActive: true,
          },
        });
        return { success: true, result: competitor };
      }
      default:
        return { success: false, result: { error: `알 수 없는 액션 타입: ${action.type}` } };
    }
  }

  /**
   * 프롬프트 변형 생성 (톤 변형)
   */
  private generatePromptVariants(originalText: string, count: number): string[] {
    const toneVariants = [
      (t: string) => t.replace(/추천해줘/, '알려줘').replace(/어디야\?/, '어디가 좋을까?'),
      (t: string) => t.replace(/알려줘/, '소개해줘').replace(/좋아\?/, '좋을까요?'),
      (t: string) => t + ' 실제 후기 기반으로.',
      (t: string) => t + ' 가격 정보도 포함해서.',
      (t: string) => t.replace(/추천해줘/, '비교해줘'),
    ];

    const variants: string[] = [];
    for (let i = 0; i < Math.min(count, toneVariants.length); i++) {
      const variant = toneVariants[i](originalText);
      if (variant !== originalText) variants.push(variant);
    }
    return variants;
  }

  // ==================== 【Area 5】SoV 시뮬레이터 ====================

  /**
   * 프롬프트 추가 시 예상 SoV 상승 예측
   */
  async simulateSovLift(hospitalId: string, newPromptTexts: string[]): Promise<{
    currentSov: number;
    estimatedNewSov: number;
    estimatedLift: number;
    breakdown: Array<{ prompt: string; estimatedMentionProbability: number }>;
  }> {
    // 현재 SoV
    const latestScore = await this.prisma.dailyScore.findFirst({
      where: { hospitalId },
      orderBy: { scoreDate: 'desc' },
      select: { sovPercent: true, mentionCount: true },
    });

    const currentSov = latestScore?.sovPercent ?? 0;

    // 기존 프롬프트 성과 기반 예측
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const existingResponses = await this.prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: thirtyDaysAgo } },
      select: { isMentioned: true, prompt: { select: { promptText: true } } },
    });

    // 기존 평균 언급률
    const avgMentionRate = existingResponses.length > 0
      ? existingResponses.filter(r => r.isMentioned).length / existingResponses.length
      : 0.3; // 데이터 없으면 30% 가정

    // 새 프롬프트 예측 (기존 평균의 80% 보수적 추정)
    const breakdown = newPromptTexts.map(prompt => ({
      prompt: prompt.substring(0, 60),
      estimatedMentionProbability: Math.round(avgMentionRate * 0.8 * 100),
    }));

    // 예상 SoV 계산
    const totalPrompts = existingResponses.length / 4 + newPromptTexts.length; // 4 = 플랫폼 수
    const currentMentioned = existingResponses.filter(r => r.isMentioned).length / 4;
    const expectedNewMentioned = newPromptTexts.length * avgMentionRate * 0.8;
    const estimatedNewSov = totalPrompts > 0
      ? Math.round(((currentMentioned + expectedNewMentioned) / totalPrompts) * 100)
      : currentSov;
    const estimatedLift = Math.round((estimatedNewSov - currentSov) * 10) / 10;

    return { currentSov, estimatedNewSov, estimatedLift, breakdown };
  }
}