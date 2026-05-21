/**
 * Source Analyzer — 크롤된 페이지 본문 + 우리 병원 정보를 받아서
 * 우리 병원이 어떻게 묘사되는지 분석하고 인용 가능한 quote/tone/claim 추출
 *
 * gpt-4o-mini 사용 (JSON 응답 모드)
 */
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export interface HospitalAnalysis {
  mentionsUs: boolean;                   // 본문에 우리 병원 언급 여부
  ourContext: string | null;             // 우리 병원 언급 ±200자 발췌
  ourTone: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'COMPARATIVE' | 'NOT_MENTIONED';
  extractedQuote: string | null;         // 1줄 핵심 quote
  claimType: 'FACT' | 'OPINION' | 'COMPARISON' | 'COMPLAINT' | 'RECOMMENDATION' | 'NONE';
  claimAccuracy: 'ACCURATE' | 'OUTDATED' | 'INCORRECT' | 'UNVERIFIABLE' | null; // 사실 정확성
  mentionedCompetitors: string[];        // 본문에서 언급된 경쟁 치과명
  topicSummary: string | null;           // 페이지가 무엇에 대한지 (한 문장)
  signalKeywords: string[];              // "임플란트 전문", "강남", "야간진료" 등
  recommendedAction: string | null;      // "정정 요청 필요" / "PR 협업 가능" / "콘텐츠 벤치마크" 등
  confidence: number;                    // 0~1
  // raw — debugging용
  rawResponse?: string;
}

const SYSTEM_PROMPT = `당신은 의료 마케팅 전문가이자 데이터 분석가입니다.
주어진 웹페이지 본문을 분석하여, 특정 치과 병원이 이 페이지에서 어떻게 묘사되는지 정확히 평가합니다.

규칙:
1. 본문에 해당 병원 이름(또는 약칭/대표원장/주소)이 명시적으로 언급되지 않으면 mentionsUs=false 로 표기.
2. ourTone:
   - POSITIVE: 추천/긍정 묘사
   - NEGATIVE: 비판/불만/부정적 언급
   - NEUTRAL: 사실 나열 (주소, 진료시간 등)
   - COMPARATIVE: 다른 병원과 비교 맥락
   - NOT_MENTIONED: 언급 없음
3. claimType:
   - FACT: 사실 정보 (주소, 진료과목, 원장)
   - OPINION: 주관적 평가 ("좋다", "친절하다")
   - COMPARISON: 다른 병원과 비교
   - COMPLAINT: 불만 사항
   - RECOMMENDATION: 명시적 추천 ("OOO 병원 추천")
   - NONE: 해당 없음
4. claimAccuracy: 본문 정보가 hospital_info와 일치하는지
   - ACCURATE: 정확
   - OUTDATED: 옛 정보 (이전 주소, 옛 원장 등)
   - INCORRECT: 잘못된 정보
   - UNVERIFIABLE: 검증 불가
5. extractedQuote: 우리 병원에 대한 가장 인상적인 본문 1문장 (50~150자, 본문에서 직접 발췌)
6. signalKeywords: 본문에서 우리 병원과 함께 나타난 의료 키워드 (최대 8개)
7. mentionedCompetitors: 본문에 함께 언급된 다른 치과 이름 (최대 10개, 진짜 병원명만)
8. recommendedAction: 이 페이지에 대한 우리 병원의 액션 추천 (한국어, 30자 내외)
9. confidence: 분석 신뢰도 (본문 길이/명확성 기반, 0~1)

응답은 반드시 valid JSON 형식.`;

@Injectable()
export class SourceAnalyzerService {
  private readonly logger = new Logger(SourceAnalyzerService.name);
  private openai: OpenAI | null = null;

  constructor() {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (key && key.length > 20) {
      this.openai = new OpenAI({ apiKey: key });
    } else {
      this.logger.warn('OPENAI_API_KEY not set — SourceAnalyzer will return null');
    }
  }

  async analyze(params: {
    hospitalName: string;
    hospitalAliases?: string[];
    hospitalWebsite?: string | null;
    pageTitle?: string | null;
    pageDescription?: string | null;
    pageBody: string;
    pagePublisher?: string | null;
    pageUrl: string;
  }): Promise<HospitalAnalysis | null> {
    if (!this.openai) return null;
    if (!params.pageBody || params.pageBody.length < 30) {
      return this.emptyResult('Body too short');
    }

    // 길이 제한: 본문 4000자 + 메타
    const body = params.pageBody.length > 4000
      ? params.pageBody.substring(0, 4000) + '...[truncated]'
      : params.pageBody;

    const userPrompt = `[병원 정보]
이름: ${params.hospitalName}
별칭: ${(params.hospitalAliases || []).join(', ') || '(없음)'}
공식 사이트: ${params.hospitalWebsite || '(없음)'}

[분석 대상 페이지]
URL: ${params.pageUrl}
매체: ${params.pagePublisher || '(미확인)'}
제목: ${params.pageTitle || '(없음)'}
설명: ${params.pageDescription || '(없음)'}

본문:
"""
${body}
"""

위 본문을 분석하여 아래 JSON 스키마에 맞춰 응답하세요:

{
  "mentionsUs": boolean,
  "ourContext": "본문에서 우리 병원이 언급된 부분 ±200자 발췌, 언급 없으면 null",
  "ourTone": "POSITIVE | NEGATIVE | NEUTRAL | COMPARATIVE | NOT_MENTIONED",
  "extractedQuote": "우리 병원에 대한 핵심 1문장 발췌 (50~150자), 없으면 null",
  "claimType": "FACT | OPINION | COMPARISON | COMPLAINT | RECOMMENDATION | NONE",
  "claimAccuracy": "ACCURATE | OUTDATED | INCORRECT | UNVERIFIABLE | null (언급 없으면 null)",
  "mentionedCompetitors": ["함께 언급된 다른 치과명 배열"],
  "topicSummary": "이 페이지가 무엇에 대한 글인지 한 문장",
  "signalKeywords": ["임플란트", "야간진료", "강남" 등 최대 8개],
  "recommendedAction": "이 페이지에 대한 액션 추천 (정정요청/PR접촉/콘텐츠벤치마크/평판관리 등)",
  "confidence": 0.0~1.0
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1500,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return this.emptyResult('Empty response');

      const parsed = JSON.parse(content);

      return {
        mentionsUs: !!parsed.mentionsUs,
        ourContext: parsed.ourContext || null,
        ourTone: parsed.ourTone || 'NOT_MENTIONED',
        extractedQuote: parsed.extractedQuote || null,
        claimType: parsed.claimType || 'NONE',
        claimAccuracy: parsed.claimAccuracy || null,
        mentionedCompetitors: Array.isArray(parsed.mentionedCompetitors) ? parsed.mentionedCompetitors.slice(0, 10) : [],
        topicSummary: parsed.topicSummary || null,
        signalKeywords: Array.isArray(parsed.signalKeywords) ? parsed.signalKeywords.slice(0, 8) : [],
        recommendedAction: parsed.recommendedAction || null,
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      };
    } catch (e: any) {
      this.logger.warn(`Analyzer failed for ${params.pageUrl}: ${e.message}`);
      return this.emptyResult(`Error: ${e.message}`);
    }
  }

  private emptyResult(reason: string): HospitalAnalysis {
    return {
      mentionsUs: false,
      ourContext: null,
      ourTone: 'NOT_MENTIONED',
      extractedQuote: null,
      claimType: 'NONE',
      claimAccuracy: null,
      mentionedCompetitors: [],
      topicSummary: null,
      signalKeywords: [],
      recommendedAction: null,
      confidence: 0,
      rawResponse: reason,
    };
  }
}
