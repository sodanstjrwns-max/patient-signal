import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AICrawlerService } from '../ai-crawler/ai-crawler.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private aiCrawlerService: AICrawlerService,
  ) {}

  /**
   * 모든 활성 병원에 대해 크롤링 실행
   * Cron Job에서 호출됨 (매일 오전 9시)
   */
  async runDailyCrawling(): Promise<{
    totalHospitals: number;
    successCount: number;
    failCount: number;
    results: any[];
  }> {
    this.logger.log('=== 일일 자동 크롤링 시작 ===');
    
    // 활성 구독 상태인 병원들 조회
    const hospitals = await this.prisma.hospital.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
      },
      include: {
        prompts: {
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

        // 각 프롬프트에 대해 크롤링 실행
        let completed = 0;
        let failed = 0;

        for (const prompt of hospital.prompts) {
          try {
            const crawlResults = await this.aiCrawlerService.queryAllPlatforms(
              prompt.id,
              hospital.id,
              hospital.name,
              prompt.promptText,
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

          // 진행 상황 업데이트
          await this.prisma.crawlJob.update({
            where: { id: crawlJob.id },
            data: { completed, failed },
          });
        }

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

        results.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          promptCount: hospital.prompts.length,
          completed,
          failed,
          score,
        });

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

    this.logger.log(`=== 일일 크롤링 완료: 성공 ${successCount}, 실패 ${failCount} ===`);

    return {
      totalHospitals: hospitals.length,
      successCount,
      failCount,
      results,
    };
  }
}
