/**
 * QueryKeys 일관성 검증 테스트
 * - 대시보드/인사이트/분석 페이지 간 queryKey 동일성 보장
 * - staleTime 설정 검증
 */

import { queryKeys, STALE_TIMES } from '../lib/queryKeys';

describe('queryKeys 일관성 테스트', () => {
  const testHospitalId = 'test-hospital-123';

  describe('queryKey 구조', () => {
    it('hospital 키가 올바른 구조', () => {
      expect(queryKeys.hospital(testHospitalId)).toEqual(['hospital', testHospitalId]);
    });

    it('dashboard 키가 올바른 구조', () => {
      expect(queryKeys.dashboard(testHospitalId)).toEqual(['dashboard', testHospitalId]);
    });

    it('insights.mention 키가 대시보드와 인사이트 페이지에서 동일', () => {
      const key1 = queryKeys.insights.mention(testHospitalId);
      const key2 = queryKeys.insights.mention(testHospitalId);
      expect(key1).toEqual(key2);
      expect(key1).toEqual(['insights-mention', testHospitalId]);
    });

    it('insights.sources 키가 대시보드와 인사이트 페이지에서 동일', () => {
      const key1 = queryKeys.insights.sources(testHospitalId);
      const key2 = queryKeys.insights.sources(testHospitalId);
      expect(key1).toEqual(key2);
      expect(key1).toEqual(['insights-sources', testHospitalId]);
    });

    it('scores.weekly 키가 대시보드와 분석 페이지에서 동일', () => {
      const key1 = queryKeys.scores.weekly(testHospitalId);
      const key2 = queryKeys.scores.weekly(testHospitalId);
      expect(key1).toEqual(key2);
      expect(key1).toEqual(['weekly', testHospitalId]);
    });

    it('scores.platforms 키가 대시보드와 분석 페이지에서 동일', () => {
      const key1 = queryKeys.scores.platforms(testHospitalId);
      const key2 = queryKeys.scores.platforms(testHospitalId);
      expect(key1).toEqual(key2);
      expect(key1).toEqual(['platforms', testHospitalId]);
    });
  });

  describe('queryKey 고유성', () => {
    it('각 키가 서로 다름', () => {
      const keys = [
        queryKeys.hospital(testHospitalId),
        queryKeys.dashboard(testHospitalId),
        queryKeys.scores.weekly(testHospitalId),
        queryKeys.scores.platforms(testHospitalId),
        queryKeys.scores.abhs(testHospitalId),
        queryKeys.insights.mention(testHospitalId),
        queryKeys.insights.sources(testHospitalId),
        queryKeys.insights.trend(testHospitalId),
        queryKeys.insights.positioning(testHospitalId),
        queryKeys.insights.sourceQuality(testHospitalId),
        queryKeys.insights.actions(testHospitalId),
        queryKeys.competitors.comparison(testHospitalId),
      ];

      const keyStrings = keys.map(k => JSON.stringify(k));
      const uniqueKeys = new Set(keyStrings);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('STALE_TIMES 검증', () => {
    it('REALTIME < DASHBOARD < INSIGHTS < STATIC < CONFIG', () => {
      expect(STALE_TIMES.REALTIME).toBeLessThan(STALE_TIMES.DASHBOARD);
      expect(STALE_TIMES.DASHBOARD).toBeLessThan(STALE_TIMES.INSIGHTS);
      expect(STALE_TIMES.INSIGHTS).toBeLessThan(STALE_TIMES.STATIC);
      expect(STALE_TIMES.STATIC).toBeLessThan(STALE_TIMES.CONFIG);
    });

    it('모든 staleTime이 양수', () => {
      Object.values(STALE_TIMES).forEach(time => {
        expect(time).toBeGreaterThan(0);
      });
    });

    it('최대 staleTime이 30분 이하', () => {
      Object.values(STALE_TIMES).forEach(time => {
        expect(time).toBeLessThanOrEqual(30 * 60 * 1000);
      });
    });
  });

  describe('hospitalId별 키 분리', () => {
    it('다른 hospitalId는 다른 키 생성', () => {
      const key1 = queryKeys.dashboard('hospital-1');
      const key2 = queryKeys.dashboard('hospital-2');
      expect(key1).not.toEqual(key2);
    });

    it('같은 hospitalId는 같은 키 생성', () => {
      const key1 = queryKeys.dashboard('hospital-1');
      const key2 = queryKeys.dashboard('hospital-1');
      expect(key1).toEqual(key2);
    });
  });
});
