/**
 * CacheService — 분산 크론 락 + 캐시 무효화 패턴 테스트 (인메모리 모드)
 *
 * 배경: 수평 확장 시 @Cron이 모든 인스턴스에서 발화 → acquireLock으로
 * 첫 인스턴스만 실행되는지, TTL 만료 후 재획득 가능한지 검증.
 */
import { CacheService } from './cache.service';

describe('CacheService — 분산 락 & 무효화 (인메모리 모드)', () => {
  let cache: CacheService;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    cache = new CacheService();
  });

  afterEach(async () => {
    await cache.onModuleDestroy();
  });

  describe('acquireLock (크론 중복 실행 방지)', () => {
    it('첫 획득은 true, 같은 락 재획득은 false', async () => {
      expect(await cache.acquireLock('cron:test', 60)).toBe(true);
      expect(await cache.acquireLock('cron:test', 60)).toBe(false);
    });

    it('다른 이름의 락은 서로 독립', async () => {
      expect(await cache.acquireLock('cron:a', 60)).toBe(true);
      expect(await cache.acquireLock('cron:b', 60)).toBe(true);
    });

    it('TTL 만료 후에는 재획득 가능 (데드락 자동 해제)', async () => {
      jest.useFakeTimers();
      try {
        expect(await cache.acquireLock('cron:ttl', 1)).toBe(true);
        expect(await cache.acquireLock('cron:ttl', 1)).toBe(false);
        jest.advanceTimersByTime(1100);
        expect(await cache.acquireLock('cron:ttl', 1)).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('invalidateHospital (HTTP 캐시 키 매칭)', () => {
    it('URL 경로 형태 키(ps:http:/api/scores/<id>/latest)도 무효화됨', async () => {
      const hid = 'hosp-uuid-123';
      await cache.set(`ps:http:/api/scores/${hid}/latest`, { score: 88 }, 600);
      await cache.set(`ps:http:/api/ai-crawler/insights/trend/${hid}`, { t: 1 }, 600);
      await cache.set('ps:http:/api/scores/other-hosp/latest', { score: 10 }, 600);

      await cache.invalidateHospital(hid);

      expect(await cache.get(`ps:http:/api/scores/${hid}/latest`)).toBeNull();
      expect(await cache.get(`ps:http:/api/ai-crawler/insights/trend/${hid}`)).toBeNull();
      // 다른 병원 캐시는 보존
      expect(await cache.get('ps:http:/api/scores/other-hosp/latest')).toEqual({ score: 10 });
    });
  });

  describe('getOrSet (전역 랭킹 캐시 패턴)', () => {
    it('첫 호출은 loader 실행, 두 번째는 캐시 반환 (loader 1회만)', async () => {
      const loader = jest.fn().mockResolvedValue([{ hospitalId: 'h1', score: 90 }]);

      const first = await cache.getOrSet('ps:global:ranking-base', 600, loader);
      const second = await cache.getOrSet('ps:global:ranking-base', 600, loader);

      expect(first).toEqual(second);
      expect(loader).toHaveBeenCalledTimes(1);
    });
  });
});
