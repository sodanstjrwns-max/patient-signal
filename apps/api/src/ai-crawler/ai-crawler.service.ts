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
}

@Injectable()
export class AICrawlerService {
  private readonly logger = new Logger(AICrawlerService.name);
  private openai: OpenAI;
  private anthropic: Anthropic;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // 즉시 초기화
    this.initializeApis();
  }

  private initializeApis() {
    this.logger.log('=== AI API 초기화 시작 ===');
    
    // OpenAI 초기화
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    this.logger.log(`[OpenAI] 키 존재: ${!!openaiKey}, 길이: ${openaiKey?.length || 0}`);
    if (openaiKey) {
      this.logger.log(`[OpenAI] 키 시작: ${openaiKey.substring(0, 10)}...`);
    }
    
    if (openaiKey && openaiKey.length > 20) {
      try {
        this.openai = new OpenAI({ apiKey: openaiKey });
        this.logger.log('✅ OpenAI 초기화 완료');
      } catch (e) {
        this.logger.error(`❌ OpenAI 초기화 실패: ${e.message}`);
      }
    } else {
      this.logger.warn('⚠️ OpenAI API 키 없음 또는 너무 짧음');
    }

    // Anthropic 초기화
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

  /**
   * OpenAI 클라이언트 가져오기
   */
  private getOpenAI(): OpenAI | null {
    return this.openai || null;
  }

  /**
   * Anthropic 클라이언트 가져오기
   */
  private getAnthropic(): Anthropic | null {
    return this.anthropic || null;
  }

  /**
   * OpenAI API 테스트 (디버깅용)
   */
  async testOpenAICall(): Promise<any> {
    this.logger.log('=== OpenAI 테스트 호출 ===');
    this.logger.log(`this.openai 존재: ${!!this.openai}`);
    
    if (!this.openai) {
      throw new Error('OpenAI 클라이언트가 초기화되지 않았습니다');
    }
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: '안녕하세요. 테스트입니다. 간단히 답변해주세요.' }
        ],
        max_tokens: 50,
      });
      
      const response = completion.choices[0]?.message?.content || '';
      this.logger.log(`OpenAI 응답: ${response}`);
      return { response, model: 'gpt-4o-mini' };
    } catch (error) {
      this.logger.error(`OpenAI 호출 에러: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gemini API 테스트 (디버깅용)
   */
  async testGeminiCall(): Promise<any> {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    this.logger.log(`=== Gemini 테스트 호출 === 키 존재: ${!!geminiKey}`);
    
    if (!geminiKey) {
      throw new Error('Gemini API 키가 없습니다');
    }
    
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
    
    if (data.error) {
      throw new Error(`Gemini 에러: ${data.error.message}`);
    }
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    this.logger.log(`Gemini 응답: ${text}`);
    return { response: text, model: 'gemini-2.0-flash' };
  }

  /**
   * Claude API 테스트 (디버깅용)
   */
  async testClaudeCall(): Promise<any> {
    this.logger.log('=== Claude 테스트 호출 ===');
    
    if (!this.anthropic) {
      throw new Error('Anthropic 클라이언트가 초기화되지 않았습니다');
    }
    
    const message = await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // 가장 저렴한 모델
      max_tokens: 50,
      messages: [{ role: 'user', content: '안녕하세요. 테스트입니다. 간단히 답변해주세요.' }],
    });
    
    const response = message.content[0].type === 'text' ? message.content[0].text : '';
    return { response, model: 'claude-3-haiku-20240307' };
  }

  /**
   * Perplexity API 테스트 (디버깅용)
   */
  async testPerplexityCall(): Promise<any> {
    const perplexityKey = process.env.PERPLEXITY_API_KEY?.trim();
    this.logger.log(`=== Perplexity 테스트 호출 === 키 존재: ${!!perplexityKey}`);
    
    if (!perplexityKey) {
      throw new Error('Perplexity API 키가 없습니다');
    }
    
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
    
    if (data.error) {
      throw new Error(`Perplexity 에러: ${JSON.stringify(data.error)}`);
    }
    
    const text = data.choices?.[0]?.message?.content || '';
    return { response: text, model: 'sonar' };
  }

  /**
   * API 상태 확인 (디버깅용)
   */
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
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 특정 프롬프트에 대해 모든 AI 플랫폼에 질의
   */
  async queryAllPlatforms(
    promptId: string,
    hospitalId: string,
    hospitalName: string,
    promptText: string,
    platforms: AIPlatform[] = ['PERPLEXITY'], // 기본값: Perplexity (유일하게 작동하는 API)
  ): Promise<AIQueryResult[]> {
    const results: AIQueryResult[] = [];
    
    // API 상태 로깅
    this.logger.log(`=== queryAllPlatforms 시작 ===`);
    this.logger.log(`프롬프트: "${promptText.substring(0, 50)}..."`);
    this.logger.log(`병원: ${hospitalName}`);
    
    // OpenAI 강제 초기화 시도
    const openai = this.getOpenAI();
    this.logger.log(`OpenAI 클라이언트: ${openai ? '✅ 사용 가능' : '❌ 사용 불가'}`);

    // 사용 가능한 플랫폼만 필터링
    const availablePlatforms = platforms.filter(p => this.isPlatformAvailable(p));
    this.logger.log(`요청된 플랫폼: ${platforms.join(', ')}`);
    this.logger.log(`사용 가능한 플랫폼: ${availablePlatforms.join(', ') || '없음'}`);
    this.logger.log(`this.openai: ${!!this.openai}`);
    
    if (availablePlatforms.length === 0) {
      this.logger.warn('사용 가능한 AI 플랫폼이 없습니다. API 키를 확인하세요.');
    }

    for (const platform of availablePlatforms) {
      try {
        this.logger.log(`🔄 ${platform} 질의 시작: "${promptText.substring(0, 30)}..."`);
        const result = await this.queryPlatform(platform, promptText, hospitalName);
        this.logger.log(`✅ ${platform} 응답 받음: ${result.response.substring(0, 100)}...`);
        results.push(result);

        // DB에 저장
        this.logger.log(`💾 DB 저장 시작...`);
        const saved = await this.prisma.aIResponse.create({
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
          },
        });

        this.logger.log(`✅ ${platform} 저장 완료: ID=${saved.id}`);
      } catch (error) {
        this.logger.error(`❌ ${platform} 실패: ${error.message}`);
        this.logger.error(`Stack: ${error.stack}`);
      }
    }

    return results;
  }

  /**
   * 플랫폼 사용 가능 여부 확인
   */
  private isPlatformAvailable(platform: AIPlatform): boolean {
    this.logger.log(`[isPlatformAvailable] 체크: ${platform}, openai=${!!this.openai}`);
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

  /**
   * ChatGPT (OpenAI) 질의 - gpt-4o-mini 사용 (비용 효율적)
   */
  private async queryChatGPT(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    if (!this.openai) {
      throw new Error('OpenAI API가 초기화되지 않았습니다');
    }
    this.logger.log(`[ChatGPT] API 호출 시작: ${promptText.substring(0, 30)}...`);
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini', // 비용 효율적인 모델
      messages: [
        {
          role: 'system',
          content: '당신은 한국의 병원 및 의료 서비스에 대해 정확하고 도움이 되는 정보를 제공하는 어시스턴트입니다. 구체적인 병원 이름과 특징을 포함하여 답변해주세요. 추천 병원은 번호 목록으로 작성해주세요.',
        },
        {
          role: 'user',
          content: promptText,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const response = completion.choices[0]?.message?.content || '';
    return this.analyzeResponse(response, hospitalName, 'CHATGPT', 'gpt-4o-mini');
  }

  /**
   * Claude (Anthropic) 질의
   */
  private async queryClaude(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    if (!this.anthropic) {
      throw new Error('Anthropic API가 초기화되지 않았습니다');
    }
    const message = await this.anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: promptText,
        },
      ],
    });

    const response = message.content[0].type === 'text' ? message.content[0].text : '';
    return this.analyzeResponse(response, hospitalName, 'CLAUDE', 'claude-3-opus-20240229');
  }

  /**
   * Perplexity 질의 (OpenAI 호환 API)
   */
  private async queryPerplexity(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY?.trim();
    
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
            content: promptText,
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return this.analyzeResponse(text, hospitalName, 'PERPLEXITY', 'sonar');
  }

  /**
   * Gemini (Google AI) 질의 - gemini-2.0-flash 사용 (무료)
   */
  private async queryGemini(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
    
    const systemPrompt = '당신은 한국의 병원 및 의료 서비스에 대해 정확하고 도움이 되는 정보를 제공하는 어시스턴트입니다. 구체적인 병원 이름과 특징을 포함하여 답변해주세요. 추천 병원은 번호 목록으로 작성해주세요.';
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${systemPrompt}\n\n질문: ${promptText}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500,
          },
        }),
      },
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Gemini API 에러: ${data.error.message}`);
    }
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return this.analyzeResponse(text, hospitalName, 'GEMINI', 'gemini-2.0-flash');
  }

  /**
   * AI 응답 분석 - 언급 여부, 위치, 감성 분석
   */
  private analyzeResponse(
    response: string,
    hospitalName: string,
    platform: AIPlatform,
    model: string,
  ): AIQueryResult {
    // 병원 언급 여부 확인
    const isMentioned = response.toLowerCase().includes(hospitalName.toLowerCase());

    // 추천 목록에서 위치 확인
    let mentionPosition: number | null = null;
    let totalRecommendations: number | null = null;
    
    // 숫자로 시작하는 목록 패턴 찾기 (1. 병원명, 2. 병원명 등)
    const listPattern = /(\d+)[.\)]\s*([^\n]+)/g;
    const matches = [...response.matchAll(listPattern)];
    
    if (matches.length > 0) {
      totalRecommendations = matches.length;
      for (let i = 0; i < matches.length; i++) {
        if (matches[i][2].toLowerCase().includes(hospitalName.toLowerCase())) {
          mentionPosition = i + 1;
          break;
        }
      }
    }

    // 경쟁사 추출 (목록에서 다른 병원들)
    const competitorsMentioned: string[] = [];
    for (const match of matches) {
      const name = match[2].trim();
      if (!name.toLowerCase().includes(hospitalName.toLowerCase())) {
        // 병원/치과/의원으로 끝나는 이름 추출
        const hospitalNameMatch = name.match(/([가-힣]+(?:치과|병원|의원|클리닉))/);
        if (hospitalNameMatch) {
          competitorsMentioned.push(hospitalNameMatch[1]);
        }
      }
    }

    // 감성 분석 (단순 키워드 기반)
    const sentimentResult = this.analyzeSentiment(response, hospitalName);

    // 인용 소스 추출
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
    };
  }

  /**
   * 감성 분석 (키워드 기반 간단 분석)
   */
  private analyzeSentiment(response: string, hospitalName: string): { score: number; label: SentimentLabel } {
    // 병원명 주변 텍스트 추출
    const lowerResponse = response.toLowerCase();
    const lowerHospitalName = hospitalName.toLowerCase();
    const index = lowerResponse.indexOf(lowerHospitalName);
    
    if (index === -1) {
      return { score: 0, label: 'NEUTRAL' };
    }

    // 병원명 앞뒤 100자 추출
    const start = Math.max(0, index - 100);
    const end = Math.min(response.length, index + hospitalName.length + 100);
    const context = response.slice(start, end).toLowerCase();

    // 긍정/부정 키워드
    const positiveKeywords = ['추천', '좋은', '유명', '전문', '실력', '친절', '만족', '최고', '인기', '신뢰'];
    const negativeKeywords = ['불만', '비추', '비싼', '불친절', '후회', '문제', '주의', '논란', '피해'];

    let score = 0;
    for (const keyword of positiveKeywords) {
      if (context.includes(keyword)) score += 0.15;
    }
    for (const keyword of negativeKeywords) {
      if (context.includes(keyword)) score -= 0.2;
    }

    // -1 ~ 1 범위로 제한
    score = Math.max(-1, Math.min(1, score));

    let label: SentimentLabel = 'NEUTRAL';
    if (score > 0.2) label = 'POSITIVE';
    else if (score < -0.2) label = 'NEGATIVE';

    return { score, label };
  }

  /**
   * 인용 소스 URL 추출
   */
  private extractCitedSources(response: string): string[] {
    const urlPattern = /https?:\/\/[^\s\)\]]+/g;
    const urls = response.match(urlPattern) || [];
    return [...new Set(urls)].slice(0, 10);
  }

  /**
   * 일일 점수 계산 (기획서의 공식 적용)
   * 점수 = 언급률 × 0.4 + 포지션 점수 × 0.3 + 감성 점수 × 0.2 + 인용 점수 × 0.1
   */
  async calculateDailyScore(hospitalId: string, date: Date = new Date()): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 해당 날짜의 모든 응답 조회
    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (responses.length === 0) {
      return 0;
    }

    // 1. 언급률 (0~100)
    const mentionedCount = responses.filter(r => r.isMentioned).length;
    const mentionRate = (mentionedCount / responses.length) * 100;

    // 2. 포지션 점수 (0~100) - 1위=100, 2위=80, 3위=60, 4위=40, 5위=20, 6위이하=10
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

    // 3. 감성 점수 (0~100) - -1~1을 0~100으로 변환
    const sentimentScores = responses
      .filter(r => r.sentimentScore !== null)
      .map(r => ((r.sentimentScore! + 1) / 2) * 100);
    const avgSentimentScore = sentimentScores.length > 0
      ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
      : 50;

    // 4. 인용 점수 (0~100) - 인용 소스가 있으면 +20점씩
    const citationScores = responses.map(r => Math.min(100, (r.citedSources?.length || 0) * 20));
    const avgCitationScore = citationScores.reduce((a, b) => a + b, 0) / citationScores.length;

    // 종합 점수 계산
    const overallScore = Math.round(
      mentionRate * 0.4 +
      avgPositionScore * 0.3 +
      avgSentimentScore * 0.2 +
      avgCitationScore * 0.1
    );

    // 플랫폼별 점수 계산
    const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI', 'NAVER_CUE'] as const;
    const platformScores: Record<string, number> = {};
    
    for (const platform of platforms) {
      const platformResponses = responses.filter(r => r.aiPlatform === platform);
      if (platformResponses.length > 0) {
        const mentioned = platformResponses.filter(r => r.isMentioned).length;
        platformScores[platform.toLowerCase()] = Math.round((mentioned / platformResponses.length) * 100);
      }
    }

    // 진료과목별 점수 (프롬프트의 카테고리 기반)
    const specialtyScores: Record<string, number> = {};

    // 일일 점수 저장
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
        mentionCount: mentionedCount,
        positiveRatio: sentimentScores.filter(s => s > 60).length / responses.length,
      },
      create: {
        hospitalId,
        scoreDate: startOfDay,
        overallScore,
        platformScores,
        specialtyScores,
        mentionCount: mentionedCount,
        positiveRatio: sentimentScores.filter(s => s > 60).length / responses.length,
      },
    });

    return overallScore;
  }
}
