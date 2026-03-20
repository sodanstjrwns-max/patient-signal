import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AICrawlerService } from '../ai-crawler/ai-crawler.service';
import { PlanGuard } from '../common/guards/plan.guard';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private aiCrawlerService: AICrawlerService,
  ) {}

  /**
   * 모든 활성 병원에 대해 크롤링 실행
   * 하루 1회 실행: 오전 9시 (KST)
   * Render Cron Job에서 호출됨
   */
  async runDailyCrawling(options?: {
    session?: 'morning' | 'afternoon' | 'evening';
    includeCompetitors?: boolean;
    includeContentGap?: boolean;
  }): Promise<{
    totalHospitals: number;
    successCount: number;
    failCount: number;
    session: string;
    results: any[];
  }> {
    const session = options?.session || this.getCurrentSession();
    const includeCompetitors = options?.includeCompetitors ?? (session === 'evening');
    const includeContentGap = options?.includeContentGap ?? (session === 'evening');
    
    this.logger.log(`=== 자동 크롤링 시작 (세션: ${session}) ===`);
    this.logger.log(`옵션: 경쟁사분석=${includeCompetitors}, ContentGap=${includeContentGap}`);
    
    // 활성 구독 상태인 병원들 조회 (TRIAL 포함)
    const hospitals = await this.prisma.hospital.findMany({
      where: {
        subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] },
      },
      include: {
        prompts: {
          where: { isActive: true },
        },
        competitors: {
          where: { isActive: true },
        },
      },
    });

    this.logger.log(`크롤링 대상 병원: ${hospitals.length}개`);

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const hospital of hospitals) {
      if (hospital.prompts.length === 0) {
        this.logger.log(`[${hospital.name}] 활성 프롬프트 없음 - 스킵`);
        continue;
      }

      try {
        this.logger.log(`[${hospital.name}] 크롤링 시작 (프롬프트 ${hospital.prompts.length}개)`);
        
        // 크롤링 작업 생성
        const crawlJob = await this.prisma.crawlJob.create({
          data: {
            hospitalId: hospital.id,
            status: 'RUNNING',
            totalPrompts: hospital.prompts.length,
            startedAt: new Date(),
          },
        });

        let completed = 0;
        let failed = 0;

        // 플랜별 플랫폼 제한 적용
        const planLimits = PlanGuard.PLAN_LIMITS[hospital.planType] || PlanGuard.PLAN_LIMITS.FREE;
        const sessionPlatforms = this.getPlatformsForSession(session);
        // 플랜 허용 플랫폼과 세션 플랫폼의 교집합
        const platforms = sessionPlatforms.filter((p: string) => planLimits.platforms.includes(p));
        
        this.logger.log(`[${hospital.name}] 플랜: ${hospital.planType}, 플랫폼: ${platforms.join(', ')}`);

        // 월간 크롤링 횟수 체크
        if (planLimits.crawlsPerMonth !== -1) {
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const crawlCount = await this.prisma.crawlJob.count({
            where: {
              hospitalId: hospital.id,
              startedAt: { gte: monthStart },
              status: { in: ['COMPLETED', 'RUNNING'] },
            },
          });
          if (crawlCount >= planLimits.crawlsPerMonth) {
            this.logger.log(`[${hospital.name}] 월간 크롤링 한도 초과 (${crawlCount}/${planLimits.crawlsPerMonth}) - 스킵`);
            continue;
          }
        }

        for (const prompt of hospital.prompts) {
          try {
            const crawlResults = await this.aiCrawlerService.queryAllPlatforms(
              prompt.id,
              hospital.id,
              hospital.name,
              prompt.promptText,
              platforms,
            );
            
            if (crawlResults.length > 0) {
              completed++;
            } else {
              failed++;
            }
          } catch (error) {
            failed++;
            this.logger.error(`[${hospital.name}] 프롬프트 실패: ${error.message}`);
          }
        }

        // 【최적화 R3】crawlJob 업데이트를 루프 밖에서 1회만 실행 (기존 매 프롬프트마다 → 1회)
        await this.prisma.crawlJob.update({
          where: { id: crawlJob.id },
          data: { completed, failed },
        });

        // 작업 완료 처리
        await this.prisma.crawlJob.update({
          where: { id: crawlJob.id },
          data: {
            status: failed === hospital.prompts.length ? 'FAILED' : 'COMPLETED',
            completedAt: new Date(),
          },
        });

        // 점수 계산
        const score = await this.aiCrawlerService.calculateDailyScore(hospital.id);

        const hospitalResult: any = {
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          promptCount: hospital.prompts.length,
          completed,
          failed,
          score,
          session,
        };

        // 저녁 세션에서 경쟁사 AEO 측정 (플랜 체크)
        if (includeCompetitors && hospital.competitors.length > 0 && planLimits.competitorAEO) {
          const maxCompetitors = planLimits.maxCompetitors === -1 ? 5 : Math.min(planLimits.maxCompetitors, 5);
          this.logger.log(`[${hospital.name}] 경쟁사 AEO 측정 시작 (${hospital.competitors.length}개)`);
          const competitorResults = [];
          
          for (const competitor of hospital.competitors.slice(0, maxCompetitors)) {
            try {
              const competitorScore = await this.aiCrawlerService.measureCompetitorAEO(
                hospital.id,
                competitor.id,
                competitor.competitorName,
              );
              competitorResults.push({
                name: competitor.competitorName,
                ...competitorScore,
              });
            } catch (error) {
              this.logger.error(`[경쟁사] ${competitor.competitorName} 측정 실패: ${error.message}`);
            }
            
            // 경쟁사 간 딜레이
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          
          hospitalResult.competitorScores = competitorResults;
        }

        // 저녁 세션에서 Content Gap 분석 (플랜 체크)
        if (includeContentGap && planLimits.contentGap) {
          try {
            const gaps = await this.aiCrawlerService.generateContentGapGuide(hospital.id);
            hospitalResult.contentGaps = gaps.length;
            this.logger.log(`[${hospital.name}] Content Gap ${gaps.length}개 발견`);
          } catch (error) {
            this.logger.error(`[Content Gap] 분석 실패: ${error.message}`);
          }
        }

        results.push(hospitalResult);
        successCount++;
        this.logger.log(`[${hospital.name}] 크롤링 완료 - 점수: ${score}`);

      } catch (error) {
        failCount++;
        this.logger.error(`[${hospital.name}] 크롤링 실패: ${error.message}`);
        results.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          error: error.message,
        });
      }

      // API 레이트 리밋 방지를 위한 딜레이 (10초)
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    this.logger.log(`=== 크롤링 완료 (${session}): 성공 ${successCount}, 실패 ${failCount} ===`);

    return {
      totalHospitals: hospitals.length,
      successCount,
      failCount,
      session,
      results,
    };
  }

  /**
   * 현재 시간 기반 세션 판별 (KST)
   */
  private getCurrentSession(): 'morning' | 'afternoon' | 'evening' {
    const kstHour = new Date().getUTCHours() + 9;
    const adjustedHour = kstHour >= 24 ? kstHour - 24 : kstHour;
    
    if (adjustedHour < 12) return 'morning';
    if (adjustedHour < 17) return 'afternoon';
    return 'evening';
  }

  /**
   * 세션별 플랫폼 분배 (찐 AI 4개만)
   * - morning: 전체 플랫폼 (기본 크롤링)
   * - afternoon: ChatGPT + Gemini (주요 2개만 - 비용 절감)
   * - evening: 전체 + 경쟁사 분석
   */
  private getPlatformsForSession(session: string): any[] {
    const basePlatforms: any[] = ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'];
    
    switch (session) {
      case 'morning':
        return basePlatforms;
      case 'afternoon':
        return ['CHATGPT', 'GEMINI'];
      case 'evening':
        return basePlatforms;
      default:
        return basePlatforms;
    }
  }
}
