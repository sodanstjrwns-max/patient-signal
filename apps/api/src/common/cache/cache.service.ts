import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * 【P1-7】CacheService — 대시보드 조회 API용 TTL 캐시
 *
 * 동작:
 *  - REDIS_URL 환경변수가 있으면 Redis 사용 (다중 인스턴스 안전)
 *  - 없으면 인메모리 Map fallback (단일 인스턴스 Render 환경에서 충분)
 *
 * 사용 대상: scores/ABHS/funnel 등 "하루 1회 크롤링 후 갱신"되는 읽기 전용 데이터
 *  → 짧은 TTL(기본 10분)로 stale 위험 최소화하면서 DB 부하 대폭 감소
 *
 * 무효화: 크롤링 완료 시 invalidateHospital(hospitalId) 호출
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private memory = new Map<string, { value: string; expiresAt: number }>();
  private readonly MEMORY_MAX_KEYS = 5000;

  constructor() {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 2,
          lazyConnect: true,
          enableOfflineQueue: false,
        });
        this.redis.on('error', (err) => {
          this.logger.warn(`Redis 오류 (인메모리 fallback 동작): ${err.message}`);
        });
        this.redis.connect().catch(() => {
          this.logger.warn('Redis 연결 실패 — 인메모리 캐시로 동작');
          this.redis = null;
        });
        this.logger.log('CacheService: Redis 모드');
      } catch {
        this.redis = null;
        this.logger.warn('CacheService: Redis 초기화 실패 — 인메모리 모드');
      }
    } else {
      this.logger.log('CacheService: 인메모리 모드 (REDIS_URL 미설정)');
    }
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redis && this.redis.status === 'ready') {
        const raw = await this.redis.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
      }
    } catch {
      /* Redis 실패 시 인메모리로 */
    }
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    try {
      if (this.redis && this.redis.status === 'ready') {
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
        return;
      }
    } catch {
      /* Redis 실패 시 인메모리로 */
    }
    // 인메모리 용량 제한 (가장 오래된 키부터 제거)
    if (this.memory.size >= this.MEMORY_MAX_KEYS) {
      const firstKey = this.memory.keys().next().value;
      if (firstKey) this.memory.delete(firstKey);
    }
    this.memory.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  /**
   * 캐시 조회 + 미스 시 loader 실행 후 저장 (표준 read-through 패턴)
   */
  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await loader();
    // null/undefined는 캐시하지 않음 (부재 상태가 곧 바뀔 수 있음)
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttlSeconds);
    }
    return value;
  }

  /** 특정 병원의 모든 캐시 무효화 (크롤링 완료 후 호출) */
  async invalidateHospital(hospitalId: string): Promise<void> {
    const pattern = `ps:*:${hospitalId}*`;
    try {
      if (this.redis && this.redis.status === 'ready') {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) await this.redis.del(...keys);
        return;
      }
    } catch {
      /* fall through */
    }
    for (const key of this.memory.keys()) {
      if (key.includes(hospitalId)) this.memory.delete(key);
    }
  }
}
