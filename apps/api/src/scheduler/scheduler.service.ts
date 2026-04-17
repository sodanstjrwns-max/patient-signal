import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AICrawlerService } from '../ai-crawler/ai-crawler.service';
import { PlanGuard } from '../common/guards/plan.guard';
import { SPECIALTY_PROCEDURES, SPECIALTY_NAMES, WEEKLY_QUERY_TEMPLATES } from '../query-templates/query-templates.service';

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

  // ==================== V2: Daily Prompt Refresh (리텐션 드라이버) ====================

  /**
   * 매일 자동 프롬프트 10개 생성
   * 
   * 전략:
   * 1. 기존 질문 성과 분석 (언급률 높은 패턴 우선)
   * 2. 시즌/트렌드 반영 질문 추가
   * 3. Golden Prompt 패턴 적용 (ABHS 5축 최적화)
   * 4. 기존 질문과 중복 제거
   * 
   * @returns 각 병원별 생성 결과
   */
  async runDailyPromptRefresh(): Promise<{
    totalHospitals: number;
    refreshed: number;
    results: Array<{ hospitalId: string; hospitalName: string; added: number; replaced: number }>;
  }> {
    this.logger.log('=== Daily Prompt Refresh 시작 ===');

    const hospitals = await this.prisma.hospital.findMany({
      where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
      include: {
        prompts: { where: { isActive: true }, select: { id: true, promptText: true, promptType: true } },
      },
    });

    const results: Array<{ hospitalId: string; hospitalName: string; added: number; replaced: number }> = [];
    let refreshed = 0;

    for (const hospital of hospitals) {
      try {
        const result = await this.generateDailyPrompts(hospital);
        if (result.added > 0 || result.replaced > 0) {
          refreshed++;
        }
        results.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          ...result,
        });
      } catch (error) {
        this.logger.error(`[${hospital.name}] Daily Prompt 생성 실패: ${error.message}`);
        results.push({ hospitalId: hospital.id, hospitalName: hospital.name, added: 0, replaced: 0 });
      }
    }

    this.logger.log(`=== Daily Prompt Refresh 완료: ${refreshed}/${hospitals.length} 병원 갱신 ===`);

    return { totalHospitals: hospitals.length, refreshed, results };
  }

  /**
   * 개별 병원의 Daily Prompt 생성
   */
  private async generateDailyPrompts(hospital: any): Promise<{ added: number; replaced: number }> {
    const planLimits = (PlanGuard.PLAN_LIMITS as Record<string, any>)[hospital.planType] || PlanGuard.PLAN_LIMITS.FREE;
    const maxPrompts = planLimits.maxPrompts === -1 ? 100 : planLimits.maxPrompts;

    // 기존 질문 텍스트 세트
    const existingTexts = new Set<string>(hospital.prompts.map((p: any) => p.promptText));
    const currentCount = hospital.prompts.length;

    // 남은 슬롯 확인
    const availableSlots = Math.max(0, maxPrompts - currentCount);
    // 일일 새 질문은 최대 10개 (또는 남은 슬롯)
    const dailyTarget = Math.min(10, availableSlots);

    if (dailyTarget <= 0) {
      this.logger.log(`[${hospital.name}] 슬롯 없음 (${currentCount}/${maxPrompts})`);
      return { added: 0, replaced: 0 };
    }

    // ── 질문 후보 생성 ──
    const candidates: string[] = [];
    const region = `${hospital.regionSido} ${hospital.regionSigungu}`;
    const shortRegion = hospital.regionSigungu?.replace(/[시군구]$/, '') || '';
    const specialty = SPECIALTY_NAMES[hospital.specialtyType] || '병원';
    const treatments = hospital.coreTreatments?.length > 0
      ? hospital.coreTreatments
      : (hospital.keyProcedures?.length > 0
        ? hospital.keyProcedures
        : (SPECIALTY_PROCEDURES[hospital.specialtyType] || [])
            .filter((p: any) => p.isPopular)
            .slice(0, 3)
            .map((p: any) => p.name));

    const strengths = hospital.hospitalStrengths || [];
    const targetRegions = hospital.targetRegions || [];

    // 1. 시즌/트렌드 질문 (날짜 기반)
    const month = new Date().getMonth() + 1;
    const seasonalQuestions = this.getSeasonalQuestions(month, shortRegion, specialty, treatments);
    candidates.push(...seasonalQuestions);

    // 2. 다양한 말투 변형
    const toneVariations = [
      `${shortRegion} ${specialty} 좀 알아보는데 괜찮은 데 있어?`,
      `${shortRegion}에서 믿고 갈 수 있는 ${specialty} 추천 좀`,
      `${specialty} 가야 하는데 ${shortRegion} 쪽에 어디가 좋을까?`,
      `${shortRegion} 근처 ${specialty} 진짜 잘하는 곳 알려줘`,
    ];
    candidates.push(...toneVariations);

    // 3. 진료과 + 시술 조합 (아직 없는 것)
    for (const t of treatments) {
      const variations = [
        `${shortRegion} ${t} 맛집 ${specialty} 어디야?`,
        `${t} 고민인데 ${shortRegion}에서 상담 잘 해주는 ${specialty} 있나?`,
        `${shortRegion} ${t} 실력파 ${specialty} 추천`,
        `${t} 최신 기술 쓰는 ${shortRegion} ${specialty} 알려줘`,
      ];
      candidates.push(...variations);
    }

    // 4. 강점 기반 질문 변형
    for (const s of strengths.slice(0, 3)) {
      candidates.push(`${s} 잘하는 ${shortRegion} ${specialty} 추천해줘`);
    }

    // 5. 지역 특화 변형
    for (const r of targetRegions.slice(0, 2)) {
      if (treatments.length > 0) {
        candidates.push(`${r} 주변 ${treatments[0]} 잘하는 ${specialty} 있어?`);
      }
    }

    // 6. 경쟁사 관련 비교 질문
    const competitors = await this.prisma.competitor.findMany({
      where: { hospitalId: hospital.id, isActive: true },
      select: { competitorName: true },
      take: 3,
    });
    if (competitors.length > 0 && treatments.length > 0) {
      candidates.push(`${shortRegion} ${treatments[0]} ${specialty} 비교해서 알려줘. 장단점 포함해서`);
    }

    // ── 중복 제거 & 기존 질문과 비교 ──
    const uniqueCandidates = [...new Set(candidates)]
      .filter(q => !existingTexts.has(q))
      .filter(q => !Array.from(existingTexts).some(existing => 
        this.textSimilarity(q, existing) > 0.85
      ));

    // 랜덤 셔플 후 상위 N개 선택
    const shuffled = uniqueCandidates.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, dailyTarget);

    if (selected.length === 0) {
      return { added: 0, replaced: 0 };
    }

    // ── DB 저장 ──
    await this.prisma.prompt.createMany({
      data: selected.map(text => ({
        hospitalId: hospital.id,
        promptText: text,
        promptType: 'AUTO_GENERATED' as const,
        specialtyCategory: hospital.specialtyType,
        regionKeywords: [hospital.regionSido, hospital.regionSigungu].filter(Boolean),
        isActive: true,
      })),
    });

    this.logger.log(`[${hospital.name}] Daily Prompt: ${selected.length}개 추가`);

    return { added: selected.length, replaced: 0 };
  }

  /**
   * 시즌별 트렌드 질문 생성
   */
  private getSeasonalQuestions(month: number, region: string, specialty: string, treatments: string[]): string[] {
    const q: string[] = [];
    const t0 = treatments[0] || '';

    // 계절별 질문
    if (month >= 3 && month <= 5) {
      // 봄
      q.push(`봄에 ${t0 || specialty} 받기 좋은 시기야? ${region} 추천해줘`);
      q.push(`${region} ${specialty} 봄 시즌 이벤트 하는 곳 있어?`);
    } else if (month >= 6 && month <= 8) {
      // 여름
      q.push(`여름에 ${t0 || specialty} 받아도 괜찮을까? ${region} 추천해줘`);
      q.push(`여름 방학 때 ${t0 || '진료'} 받으려면 ${region} 어디가 좋아?`);
    } else if (month >= 9 && month <= 11) {
      // 가을
      q.push(`${region} ${specialty} 가을에 받기 좋은 ${t0 || '시술'} 추천해줘`);
    } else {
      // 겨울
      q.push(`연말 전에 ${t0 || '진료'} 받으려면 ${region} 어디가 좋을까?`);
      q.push(`새해 첫 ${specialty} 진료, ${region}에서 추천`);
    }

    // 시간대 기반
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      q.push(`주말에 갈 수 있는 ${region} ${specialty} 알려줘`);
    }

    return q;
  }

  /**
   * 텍스트 유사도 계산 (Jaccard)
   */
  private textSimilarity(a: string, b: string): number {
    const setA = new Set(a.replace(/\s+/g, '').split(''));
    const setB = new Set(b.replace(/\s+/g, '').split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}
