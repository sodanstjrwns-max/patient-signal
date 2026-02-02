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
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });

    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  /**
   * 특정 프롬프트에 대해 모든 AI 플랫폼에 질의
   */
  async queryAllPlatforms(
    promptId: string,
    hospitalId: string,
    hospitalName: string,
    promptText: string,
    platforms: AIPlatform[] = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'],
  ): Promise<AIQueryResult[]> {
    const results: AIQueryResult[] = [];

    for (const platform of platforms) {
      try {
        const result = await this.queryPlatform(platform, promptText, hospitalName);
        results.push(result);

        // DB에 저장
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
          },
        });

        this.logger.log(`${platform} 질의 완료: ${hospitalName}`);
      } catch (error) {
        this.logger.error(`${platform} 질의 실패: ${error.message}`);
      }
    }

    return results;
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
   * ChatGPT (OpenAI) 질의
   */
  private async queryChatGPT(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: '당신은 한국의 병원 및 의료 서비스에 대해 정확하고 도움이 되는 정보를 제공하는 어시스턴트입니다. 구체적인 병원 이름과 특징을 포함하여 답변해주세요.',
        },
        {
          role: 'user',
          content: promptText,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content || '';
    return this.analyzeResponse(response, hospitalName, 'CHATGPT', 'gpt-4-turbo-preview');
  }

  /**
   * Claude (Anthropic) 질의
   */
  private async queryClaude(promptText: string, hospitalName: string): Promise<AIQueryResult> {
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
    const perplexityApiKey = this.configService.get<string>('PERPLEXITY_API_KEY');
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
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
    return this.analyzeResponse(text, hospitalName, 'PERPLEXITY', 'sonar-pro');
  }

  /**
   * Gemini (Google AI) 질의
   */
  private async queryGemini(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
        }),
      },
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return this.analyzeResponse(text, hospitalName, 'GEMINI', 'gemini-pro');
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
