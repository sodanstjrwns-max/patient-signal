import { selectCompetitorsForAeo } from './competitor-rotation';

const competitors = Array.from({ length: 20 }, (_, index) => ({
  id: `competitor-${index + 1}`,
  createdAt: new Date(`2026-09-${String(index + 1).padStart(2, '0')}T00:00:00Z`),
}));

describe('competitor AEO rotation', () => {
  it('20개를 하루 5개씩 4일에 걸쳐 모두 선택한다', () => {
    const days = Array.from({ length: 4 }, (_, index) =>
      selectCompetitorsForAeo(competitors, 20, new Date(`2026-10-${String(index + 1).padStart(2, '0')}T12:00:00Z`)),
    );
    expect(days.every((day) => day.length === 5)).toBe(true);
    expect(new Set(days.flat().map((c) => c.id)).size).toBe(20);
  });

  it('플랜 한도 밖 병원은 측정 대상으로 고르지 않는다', () => {
    const selected = selectCompetitorsForAeo(competitors, 3, new Date('2026-10-01T12:00:00Z'));
    expect(selected.map((c) => c.id)).toEqual(['competitor-1', 'competitor-2', 'competitor-3']);
  });
});
