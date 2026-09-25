import { AIPlatform } from '@prisma/client';
import { AICrawlerService } from './ai-crawler.service';

describe('AI 답변의 경쟁 병원 추출', () => {
  it('L 플랜의 20번째 경쟁 병원이 답변 뒤쪽에 있어도 보존한다', () => {
    const crawler = Object.create(AICrawlerService.prototype) as {
      analyzeResponse: (
        response: string,
        hospitalName: string,
        platform: AIPlatform,
        model: string,
      ) => { competitorsMentioned: string[] };
      checkMentionWithVariants: jest.Mock;
      getCachedVariants: jest.Mock;
      analyzeSentimentWithVariants: jest.Mock;
      extractCitedSources: jest.Mock;
    };
    crawler.checkMentionWithVariants = jest.fn().mockReturnValue({
      isMentioned: false,
      matchedVariant: null,
      mentionCount: 0,
    });
    crawler.getCachedVariants = jest.fn().mockReturnValue(['우리치과']);
    crawler.analyzeSentimentWithVariants = jest.fn().mockReturnValue({
      score: 0,
      label: 'NEUTRAL',
    });
    crawler.extractCitedSources = jest.fn().mockReturnValue([]);

    const names = [
      '가나',
      '다라',
      '마바',
      '사아',
      '자차',
      '카타',
      '파하',
      '거너',
      '더러',
      '머버',
      '서어',
      '저처',
      '커터',
      '퍼허',
      '고노',
      '도로',
      '모보',
      '소오',
      '조초',
      '코토',
      '포호',
    ].map((stem) => `${stem}치과`);
    const response = names
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');

    const result = crawler.analyzeResponse(
      response,
      '우리치과',
      AIPlatform.CHATGPT,
      'test-model',
    );

    expect(result.competitorsMentioned).toHaveLength(names.length);
    expect(result.competitorsMentioned).toContain(names[19]);
  });
});
