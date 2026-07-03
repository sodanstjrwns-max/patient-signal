/**
 * BenchmarkService 핵심 유닛 테스트 — 실측 벤치마크 percentile/포지션
 */
import { BenchmarkService, DEFAULT_BENCHMARKS } from './benchmark.service';

function createService(benchmarkRows: any[] = []) {
  const prisma: any = {
    funnelBenchmark: {
      findMany: jest.fn().mockResolvedValue(benchmarkRows),
      upsert: jest.fn(),
    },
    hospital: { findMany: jest.fn().mockResolvedValue([]) },
    aIResponse: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { service: new BenchmarkService(prisma), prisma };
}

describe('BenchmarkService — 실측 벤치마크 핵심 로직', () => {
  describe('DEFAULT_BENCHMARKS (fallback 기준값)', () => {
    it('4단계 기본 벤치마크 값 고정 (15/30/25/40)', () => {
      expect(DEFAULT_BENCHMARKS.AWARENESS).toBe(15);
      expect(DEFAULT_BENCHMARKS.COMPARISON).toBe(30);
      expect(DEFAULT_BENCHMARKS.TRUST).toBe(25);
      expect(DEFAULT_BENCHMARKS.DECISION).toBe(40);
    });
  });

  describe('positionInPeers (동료 그룹 내 위치)', () => {
    const { service } = createService();
    const bm = (over: any = {}) =>
      ({ stage: 'DECISION', benchmark: 40, source: 'MEASURED', p25: 10, p50: 20, p75: 35, ...over } as any);

    it('p75 이상 → 상위 25%', () => {
      expect(service.positionInPeers(40, bm())).toBe('상위 25%');
      expect(service.positionInPeers(35, bm())).toBe('상위 25%'); // 경계 포함
    });

    it('p50~p75 → 상위 50%', () => {
      expect(service.positionInPeers(25, bm())).toBe('상위 50%');
    });

    it('p25~p50 → 하위 50%', () => {
      expect(service.positionInPeers(15, bm())).toBe('하위 50%');
    });

    it('p25 미만 → 하위 25%', () => {
      expect(service.positionInPeers(5, bm())).toBe('하위 25%');
    });

    it('DEFAULT 소스이거나 percentile 없으면 null (문구 미표시)', () => {
      expect(service.positionInPeers(50, bm({ source: 'DEFAULT' }))).toBeNull();
      expect(service.positionInPeers(50, bm({ p50: undefined }))).toBeNull();
    });
  });
});
