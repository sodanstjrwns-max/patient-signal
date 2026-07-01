import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Bull from 'bull';

/**
 * 【P1-4】BullMQ(bull) 기반 크롤 작업 큐
 *
 * 동작 모드:
 *  - REDIS_URL 설정됨  → Bull 큐 활성화. runDailyCrawling은 병원별 잡을 큐에 넣고 즉시 반환.
 *                        워커(이 프로세스)가 concurrency만큼 병렬로 처리.
 *  - REDIS_URL 미설정  → 큐 비활성. 기존 인라인(fire-and-forget) 방식 그대로 동작.
 *
 * 큐 모드 장점:
 *  - Render 재시작/배포 중에도 잡이 Redis에 남아 유실 없음
 *  - 잡 단위 재시도(2회) + 타임아웃(15분) → 좀비 잡 원천 감소
 *  - jobId = "{session}:{yyyymmdd}:{hospitalId}" 로 같은 세션 중복 실행 방지
 *  - 여러 워커 인스턴스로 수평 확장 가능 (200병원+ 대비)
 */

export interface CrawlJobData {
  hospitalId: string;
  hospitalName: string;
  session: 'morning' | 'afternoon' | 'evening';
  includeCompetitors: boolean;
  includeContentGap: boolean;
}

type CrawlProcessor = (data: CrawlJobData) => Promise<any>;

@Injectable()
export class CrawlQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(CrawlQueueService.name);
  private queue: Bull.Queue<CrawlJobData> | null = null;
  private processorRegistered = false;

  /** 동시 처리 병원 수 (기존 HOSPITAL_CONCURRENCY=4와 동일 기본값) */
  private readonly CONCURRENCY = parseInt(process.env.CRAWL_QUEUE_CONCURRENCY || '4', 10);

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.log('REDIS_URL 미설정 → 크롤 큐 비활성 (인라인 모드로 동작)');
      return;
    }

    try {
      this.queue = new Bull<CrawlJobData>('patient-signal-crawl', redisUrl, {
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'fixed', delay: 60_000 }, // 실패 시 1분 후 1회 재시도
          timeout: 15 * 60 * 1000, // 병원 1곳당 최대 15분 (좀비 방지)
          removeOnComplete: 200, // 최근 200건만 보관 (완료 이력 = 세션 내 중복 방지 역할)
          removeOnFail: 500,
        },
        settings: {
          stalledInterval: 60_000, // 죽은 워커의 잡 감지 주기
          maxStalledCount: 1, // stall 1회까지만 재처리 허용
        },
      });

      this.queue.on('error', (err) => {
        this.logger.error(`[CrawlQueue] Redis 연결 오류: ${err.message}`);
      });
      this.queue.on('failed', (job, err) => {
        this.logger.error(
          `[CrawlQueue] 잡 최종 실패: ${job?.data?.hospitalName ?? job?.id} — ${err.message}`,
        );
      });
      this.queue.on('stalled', (job) => {
        this.logger.warn(`[CrawlQueue] 잡 stalled 감지: ${job?.data?.hospitalName ?? job?.id}`);
      });

      this.logger.log(`✅ Bull 크롤 큐 활성화 (concurrency=${this.CONCURRENCY})`);
    } catch (err: any) {
      this.logger.error(`크롤 큐 초기화 실패 → 인라인 모드 fallback: ${err.message}`);
      this.queue = null;
    }
  }

  /** 큐 사용 가능 여부 (REDIS_URL 존재 + 초기화 성공) */
  isEnabled(): boolean {
    return this.queue !== null;
  }

  /**
   * 잡 처리 핸들러 등록 (SchedulerService.onModuleInit에서 1회 호출)
   * — CrawlQueueService는 SchedulerService에 의존하지 않으므로 순환 DI 없음
   */
  setProcessor(fn: CrawlProcessor): void {
    if (!this.queue || this.processorRegistered) return;
    this.processorRegistered = true;

    this.queue.process(this.CONCURRENCY, async (job) => {
      this.logger.log(`[CrawlQueue] 잡 시작: ${job.data.hospitalName} (${job.data.session})`);
      const result = await fn(job.data);
      this.logger.log(`[CrawlQueue] 잡 완료: ${job.data.hospitalName}`);
      return result;
    });
  }

  /**
   * 병원별 크롤 잡 일괄 등록
   * jobId를 "{session}:{yyyymmdd}:{hospitalId}"로 고정 → 같은 세션 재트리거 시 중복 스킵
   * @returns 실제로 새로 등록된 잡 수
   */
  async enqueueHospitalCrawls(jobs: CrawlJobData[]): Promise<number> {
    if (!this.queue) return 0;

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let queued = 0;

    for (const data of jobs) {
      const jobId = `${data.session}:${today}:${data.hospitalId}`;
      try {
        const existing = await this.queue.getJob(jobId);
        if (existing) {
          continue; // 같은 세션에서 이미 등록됨 → 스킵
        }
        await this.queue.add(data, { jobId });
        queued++;
      } catch (err: any) {
        this.logger.error(`[CrawlQueue] 잡 등록 실패 (${data.hospitalName}): ${err.message}`);
      }
    }

    this.logger.log(`[CrawlQueue] ${queued}/${jobs.length}개 잡 등록 완료`);
    return queued;
  }

  /** 큐 상태 조회 (운영 모니터링용) */
  async getStats(): Promise<{
    enabled: boolean;
    waiting?: number;
    active?: number;
    completed?: number;
    failed?: number;
    delayed?: number;
  }> {
    if (!this.queue) return { enabled: false };
    const counts = await this.queue.getJobCounts();
    return { enabled: true, ...counts };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) {
      await this.queue.close().catch(() => undefined);
    }
  }
}
