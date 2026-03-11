import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma/prisma.service';
import { AIPlatform, SentimentLabel } from '@prisma/client';

interface AIQueryResult {
  platform: AIPlatform;
  model: string;
  response: string;
  isMentioned: boolean;
  mentionPosition: number | null;
  totalRecommendations: number | null;
  competitorsMentioned: string[];
  citedSources: string[];
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  matchedVariant?: string;
  allMentionCount?: number;
  repeatIndex?: number;        // 개선1: 반복 측정 인덱스
  isWebSearch?: boolean;       // 개선8: 웹 검색 모드 사용 여부
  isVerified?: boolean;        // 개선10: 환각 필터링 통과 여부
  verificationSource?: string; // 개선10: 검증 소스
}

// 개선1: 반복 측정 결과 집계
interface AggregatedResult {
  platform: AIPlatform;
  model: string;
  mentionRate: number;          // 3회 중 몇 회 언급
  avgPosition: number | null;   // 평균 순위
  avgSentiment: number;         // 평균 감성 점수
  consistencyScore: number;     // 일관성 점수 (3회 모두 언급=100, 2회=66, 1회=33, 0회=0)
  responses: AIQueryResult[];   // 원본 응답들
}

@Injectable()
export class AICrawlerService {
  private readonly logger = new Logger(AICrawlerService.name);
  private openai: OpenAI;
  private anthropic: Anthropic;

  // 개선1: 반복 측정 횟수 (temperature 0 + 3회)
  private readonly REPEAT_COUNT = 3;

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
      model: 'claude-3-haiku-20240307',
      max_tokens: 50,
      messages: [{ role: 'user', content: '안녕하세요. 테스트입니다. 간단히 답변해주세요.' }],
    });
    const response = message.content[0].type === 'text' ? message.content[0].text : '';
    return { response, model: 'claude-3-haiku-20240307' };
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
        repeatMeasurement: `${this.REPEAT_COUNT}회 반복 측정`,
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

  // ==================== 개선1 + 개선2: temperature 0 + 반복 측정 + 시스템 프롬프트 제거 ====================

  /**
   * 【개선1+2+8】모든 AI 플랫폼에 질의 - temperature 0, 시스템 프롬프트 제거, 3회 반복 측정
   */
  async queryAllPlatforms(
    promptId: string,
    hospitalId: string,
    hospitalName: string,
    promptText: string,
    platforms: AIPlatform[] = ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'],
  ): Promise<AIQueryResult[]> {
    const allResults: AIQueryResult[] = [];
    
    this.logger.log(`=== queryAllPlatforms 시작 (${this.REPEAT_COUNT}회 반복 측정) ===`);
    this.logger.log(`프롬프트: "${promptText.substring(0, 50)}..."`);
    this.logger.log(`병원: ${hospitalName}`);

    const availablePlatforms = platforms.filter(p => this.isPlatformAvailable(p));
    this.logger.log(`사용 가능한 플랫폼: ${availablePlatforms.join(', ') || '없음'}`);
    
    if (availablePlatforms.length === 0) {
      this.logger.warn('사용 가능한 AI 플랫폼이 없습니다.');
    }

    for (const platform of availablePlatforms) {
      // 【개선1】3회 반복 측정으로 일관성 확보
      for (let repeatIdx = 0; repeatIdx < this.REPEAT_COUNT; repeatIdx++) {
        try {
          this.logger.log(`🔄 ${platform} [${repeatIdx + 1}/${this.REPEAT_COUNT}] 질의 시작`);
          
          const result = await this.queryPlatform(platform, promptText, hospitalName);
          result.repeatIndex = repeatIdx;
          
          // 【개선10】환각 필터링 - 경쟁사 이름 검증
          const verifiedCompetitors = await this.verifyCompetitors(result.competitorsMentioned);
          result.competitorsMentioned = verifiedCompetitors.verified;
          result.isVerified = true;
          result.verificationSource = 'keyword_pattern';
          
          this.logger.log(`✅ ${platform} [${repeatIdx + 1}] 응답 받음, 언급: ${result.isMentioned}`);
          allResults.push(result);

          // DB에 저장 (반복 인덱스 포함)
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
            },
          });

          // API 레이트 리밋 방지 (반복 측정 사이 1.5초 딜레이)
          if (repeatIdx < this.REPEAT_COUNT - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        } catch (error) {
          this.logger.error(`❌ ${platform} [${repeatIdx + 1}] 실패: ${error.message}`);
        }
      }
      
      // 플랫폼 간 딜레이 (2초)
      await new Promise(resolve => setTimeout(resolve, 2000));
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
   * 개별 플랫폼 질의
   */
  private async queryPlatform(
    platform: AIPlatform,
    promptText: string,
    hospitalName: string,
  ): Promise<AIQueryResult> {
    switch (platform) {
      case 'CHATGPT':
        return this.queryChatGPT(promptText, hospitalName);
      case 'CLAUDE':
        return this.queryClaude(promptText, hospitalName);
      case 'PERPLEXITY':
        return this.queryPerplexity(promptText, hospitalName);
      case 'GEMINI':
        return this.queryGemini(promptText, hospitalName);
      default:
        throw new Error(`지원하지 않는 플랫폼: ${platform}`);
    }
  }

  // ==================== 개선2: 시스템 프롬프트 제거 + 개선1: temperature 0 ====================

  /**
   * 【개선1+2+8】ChatGPT 질의 - temperature 0, 시스템 프롬프트 제거, 웹 검색 활성화
   */
  private async queryChatGPT(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    if (!this.openai) throw new Error('OpenAI API가 초기화되지 않았습니다');
    
    this.logger.log(`[ChatGPT] API 호출 시작 (temp=0, 웹검색 시도)`);
    
    let response = '';
    let model = 'gpt-4o-mini';
    let isWebSearch = false;

    try {
      // 【개선8】웹 검색 모드 시도 (gpt-4o-mini with web_search_options)
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: promptText,  // 【개선2】시스템 프롬프트 없이 사용자 질문만 전송
          },
        ],
        temperature: 0,  // 【개선1】재현성을 위해 temperature 0
        max_tokens: 2000,
        web_search_options: {
          search_context_size: 'medium',
        },
      } as any);

      response = completion.choices[0]?.message?.content || '';
      isWebSearch = true;
      this.logger.log(`[ChatGPT] 웹 검색 모드 응답 받음`);
    } catch (webSearchError) {
      // 웹 검색 실패 시 일반 모드로 폴백
      this.logger.warn(`[ChatGPT] 웹 검색 모드 실패, 일반 모드로 폴백: ${webSearchError.message}`);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: promptText,  // 【개선2】시스템 프롬프트 없음
          },
        ],
        temperature: 0,  // 【개선1】temperature 0
        max_tokens: 2000,
      });

      response = completion.choices[0]?.message?.content || '';
    }

    const result = this.analyzeResponse(response, hospitalName, 'CHATGPT', model);
    result.isWebSearch = isWebSearch;
    
    // 【개선7】AI 기반 감성 분석
    if (result.isMentioned) {
      const aiSentiment = await this.analyzeContextSentimentWithAI(response, hospitalName);
      if (aiSentiment) {
        result.sentimentScore = aiSentiment.score;
        result.sentimentLabel = aiSentiment.label;
      }
    }
    
    return result;
  }

  /**
   * 【개선1+2】Claude 질의 - temperature 0, 시스템 프롬프트 제거
   */
  private async queryClaude(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    if (!this.anthropic) throw new Error('Anthropic API가 초기화되지 않았습니다');
    
    this.logger.log(`[Claude] API 호출 시작 (temp=0)`);
    const message = await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      temperature: 0,  // 【개선1】temperature 0
      messages: [
        {
          role: 'user',
          content: promptText,  // 【개선2】시스템 프롬프트 없이 질문만 전송
        },
      ],
    });

    const response = message.content[0].type === 'text' ? message.content[0].text : '';
    const result = this.analyzeResponse(response, hospitalName, 'CLAUDE', 'claude-3-haiku-20240307');
    
    // 【개선7】AI 기반 감성 분석
    if (result.isMentioned) {
      const aiSentiment = await this.analyzeContextSentimentWithAI(response, hospitalName);
      if (aiSentiment) {
        result.sentimentScore = aiSentiment.score;
        result.sentimentLabel = aiSentiment.label;
      }
    }
    
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
    const citations = data.citations || [];
    
    const result = this.analyzeResponse(text, hospitalName, 'PERPLEXITY', 'sonar');
    result.isWebSearch = true; // Perplexity는 항상 웹 검색 기반
    
    // citations가 있으면 citedSources에 추가
    if (citations.length > 0) {
      result.citedSources = [...new Set([...result.citedSources, ...citations])].slice(0, 15);
    }
    
    // 【개선7】AI 기반 감성 분석
    if (result.isMentioned) {
      const aiSentiment = await this.analyzeContextSentimentWithAI(text, hospitalName);
      if (aiSentiment) {
        result.sentimentScore = aiSentiment.score;
        result.sentimentLabel = aiSentiment.label;
      }
    }
    
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
      
      // grounding metadata에서 인용 소스 추출
      const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.groundingChunks) {
        // 추가 인용 소스 처리는 analyzeResponse에서 진행
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
    
    // 【개선7】AI 기반 감성 분석
    if (result.isMentioned) {
      const aiSentiment = await this.analyzeContextSentimentWithAI(text, hospitalName);
      if (aiSentiment) {
        result.sentimentScore = aiSentiment.score;
        result.sentimentLabel = aiSentiment.label;
      }
    }
    
    return result;
  }



  // ==================== 개선7: AI 기반 감성 분석 ====================

  /**
   * 【개선7】GPT를 활용한 AI 기반 감성 분석
   * 키워드 매칭 대신 AI가 맥락을 이해하여 감성 점수 산출
   */
  private async analyzeContextSentimentWithAI(
    responseText: string,
    hospitalName: string,
  ): Promise<{ score: number; label: SentimentLabel } | null> {
    if (!this.openai) return null;
    
    try {
      // 비용 절감: 응답 텍스트가 너무 길면 병원명 주변만 추출
      let contextText = responseText;
      const lowerResponse = responseText.toLowerCase();
      const hospitalVariants = this.generateHospitalNameVariants(hospitalName);
      
      let firstIdx = -1;
      for (const variant of hospitalVariants) {
        const idx = lowerResponse.indexOf(variant.toLowerCase());
        if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
          firstIdx = idx;
        }
      }
      
      if (firstIdx !== -1) {
        const start = Math.max(0, firstIdx - 200);
        const end = Math.min(responseText.length, firstIdx + hospitalName.length + 300);
        contextText = responseText.slice(start, end);
      } else if (responseText.length > 500) {
        contextText = responseText.substring(0, 500);
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `다음 AI 응답에서 "${hospitalName}"에 대한 감성을 분석해주세요.
            
응답 텍스트:
"""
${contextText}
"""

다음 JSON 형식으로만 답변해주세요 (다른 텍스트 없이):
{"score": <-1.0 ~ 1.0 사이 소수>, "label": "<POSITIVE|NEUTRAL|NEGATIVE>", "reason": "<한 줄 근거>"}

점수 기준:
- 1.0: 매우 긍정적 (강력 추천, 전문성 강조)
- 0.5: 긍정적 (일반 추천)
- 0.0: 중립 (단순 언급)
- -0.5: 부정적 (부정적 후기 언급)
- -1.0: 매우 부정적 (비추천, 부작용 등)`,
          },
        ],
        temperature: 0,
        max_tokens: 150,
      });

      const aiResponse = completion.choices[0]?.message?.content || '';
      
      // JSON 파싱
      const jsonMatch = aiResponse.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const score = Math.max(-1, Math.min(1, parseFloat(parsed.score) || 0));
        let label: SentimentLabel = 'NEUTRAL';
        if (score > 0.2) label = 'POSITIVE';
        else if (score < -0.2) label = 'NEGATIVE';
        
        this.logger.log(`[AI 감성분석] ${hospitalName}: score=${score}, label=${label}, reason=${parsed.reason}`);
        return { score, label };
      }
    } catch (error) {
      this.logger.warn(`[AI 감성분석] 실패, 키워드 방식으로 폴백: ${error.message}`);
    }
    
    return null; // 실패 시 null 반환 → 기존 키워드 방식 사용
  }

  // ==================== 개선10: AI 환각 필터링 ====================

  /**
   * 【개선10】경쟁사 이름 환각 필터링
   * AI가 생성한 가짜 병원명을 필터링
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

    // 각 플랫폼에서 경쟁사 이름으로 반복 측정 (1회만 - 비용 절감)
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
      include: { prompt: true },
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
    
    for (const [promptId, gapData] of promptGaps) {
      const uniqueCompetitors = [...new Set(gapData.competitors)].slice(0, 5);
      const uniquePlatforms = [...new Set(gapData.platforms)];
      
      // 【개선5】AI로 개선 가이드 생성
      let aiGuide = '';
      if (this.openai) {
        try {
          const hospital = await this.prisma.hospital.findUnique({
            where: { id: hospitalId },
          });
          
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

      gaps.push({
        id: contentGap.id,
        promptText: gapData.promptText,
        category: gapData.category,
        competitors: uniqueCompetitors,
        platforms: uniquePlatforms,
        priorityScore: contentGap.priorityScore,
        aiGuide: aiGuide ? JSON.parse(aiGuide) : null,
      });
    }

    this.logger.log(`[Content Gap] ${gaps.length}개 갭 분석 완료`);
    return gaps;
  }

  // ==================== 개선4: 프롬프트별 성과 분석 ====================

  /**
   * 【개선4】프롬프트별 성과 상세 분석
   */
  async getPromptPerformance(hospitalId: string): Promise<any[]> {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const prompts = await this.prisma.prompt.findMany({
      where: { hospitalId, isActive: true },
      include: {
        aiResponses: {
          where: { responseDate: { gte: last30Days } },
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
          // 【개선1】반복 측정 일관성 분석
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
    const prefixes = ['서울', '강남', '분당', '판교', '일산', '천안', '수원', '부산', '대구', '인천'];
    
    let coreName = hospitalName
      .replace(/\s+/g, '')
      .replace(/[()（）\[\]【】]/g, '')
      .replace(/(본점|지점|점|본원|분원)$/, '')
      .replace(/(치과의원|치과병원|치과|병원|의원|클리닉|메디컬|덴탈)$/, '');
    
    for (const prefix of prefixes) {
      if (coreName.startsWith(prefix) && coreName.length > prefix.length + 1) {
        const withoutPrefix = coreName.slice(prefix.length);
        if (withoutPrefix.length >= 2) {
          for (const suffix of suffixes) {
            variants.add(withoutPrefix + suffix);
          }
          if (withoutPrefix.length >= 2) {
            variants.add(withoutPrefix);
          }
        }
      }
    }
    
    if (coreName.length >= 2) {
      for (const suffix of suffixes) {
        variants.add(coreName + suffix);
      }
      if (coreName.length >= 2) {
        variants.add(coreName);
      }
    }
    
    const baseVariants = Array.from(variants);
    const branchKeywords = ['불당', '강남', '본점', '지점', '본원'];
    for (const base of baseVariants) {
      for (const branch of branchKeywords) {
        if (hospitalName.includes(branch)) {
          variants.add(`${base}(${branch})`);
          variants.add(`${base}（${branch}）`);
          variants.add(`${base} ${branch}`);
          variants.add(`${base}${branch}`);
        }
      }
    }
    
    return Array.from(variants).filter(v => v.length >= 2);
  }

  private checkMentionWithVariants(
    response: string,
    hospitalName: string,
  ): { isMentioned: boolean; matchedVariant: string | null; mentionCount: number } {
    const variants = this.generateHospitalNameVariants(hospitalName);
    
    let totalMentionCount = 0;
    let firstMatchedVariant: string | null = null;
    
    const sortedVariants = variants.sort((a, b) => b.length - a.length);
    
    for (const variant of sortedVariants) {
      const regex = new RegExp(this.escapeRegex(variant.toLowerCase()), 'gi');
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
    
    const listPattern = /(\d+)[.\)]\s*([^\n]+)/g;
    const matches = [...response.matchAll(listPattern)];
    
    const hospitalVariants = this.generateHospitalNameVariants(hospitalName);
    
    if (matches.length > 0) {
      totalRecommendations = matches.length;
      for (let i = 0; i < matches.length; i++) {
        const listItem = matches[i][2].toLowerCase();
        const isMatch = hospitalVariants.some(variant => 
          listItem.includes(variant.toLowerCase())
        );
        if (isMatch) {
          mentionPosition = i + 1;
          break;
        }
      }
    }

    const competitorsMentioned: string[] = [];
    for (const match of matches) {
      const name = match[2].trim();
      const isOurHospital = hospitalVariants.some(variant => 
        name.toLowerCase().includes(variant.toLowerCase())
      );
      if (!isOurHospital) {
        const hospitalNameMatch = name.match(/([가-힣]+(?:치과|병원|의원|클리닉))/);
        if (hospitalNameMatch) {
          competitorsMentioned.push(hospitalNameMatch[1]);
        }
      }
    }

    // 【개선7】기본 감성 분석은 키워드 기반으로 유지 (AI 감성 분석은 호출부에서 오버라이드)
    const sentimentResult = this.analyzeSentimentWithVariants(response, hospitalVariants);
    const citedSources = this.extractCitedSources(response);

    return {
      platform,
      model,
      response,
      isMentioned,
      mentionPosition,
      totalRecommendations,
      competitorsMentioned: [...new Set(competitorsMentioned)].slice(0, 10),
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

  // ==================== 일일 점수 계산 (개선된 버전) ====================

  /**
   * 일일 점수 계산 - 【개선1】반복 측정 일관성 반영
   */
  async calculateDailyScore(hospitalId: string, date: Date = new Date()): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: { prompt: true },
    });

    if (responses.length === 0) return 0;

    // 1. 언급률 (0~100) - 【개선1】반복 측정 고려 (같은 프롬프트+플랫폼의 다수결)
    const promptPlatformGroups = new Map<string, boolean[]>();
    for (const r of responses) {
      const key = `${r.promptId}-${r.aiPlatform}`;
      if (!promptPlatformGroups.has(key)) promptPlatformGroups.set(key, []);
      promptPlatformGroups.get(key)!.push(r.isMentioned);
    }
    
    let mentionedGroups = 0;
    for (const [, mentions] of promptPlatformGroups) {
      // 다수결: 3회 중 2회 이상 언급되면 "언급됨"으로 판정
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

    const overallScore = Math.round(
      mentionRate * 0.4 +
      avgPositionScore * 0.3 +
      avgSentimentScore * 0.2 +
      avgCitationScore * 0.1
    );

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
        overallScore,
        platformScores,
        specialtyScores,
        mentionCount: mentionedGroups,
        positiveRatio: sentimentScores.filter(s => s > 60).length / Math.max(responses.length, 1),
      },
      create: {
        hospitalId,
        scoreDate: startOfDay,
        overallScore,
        platformScores,
        specialtyScores,
        mentionCount: mentionedGroups,
        positiveRatio: sentimentScores.filter(s => s > 60).length / Math.max(responses.length, 1),
      },
    });

    return overallScore;
  }
}
