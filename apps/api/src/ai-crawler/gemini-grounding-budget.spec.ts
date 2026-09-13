import {
  reserveFreeGrounding,
  releaseFreeGrounding,
  geminiGroundingBudgetSnapshot,
  geminiFreeDailyCap,
  _resetGeminiGroundingBudget,
} from './gemini-grounding-budget';

describe('gemini-grounding-budget (2.5-flash 무료 그라운딩 일일 예산)', () => {
  const origCap = process.env.GEMINI_25_FREE_DAILY_CAP;
  afterEach(() => {
    if (origCap === undefined) delete process.env.GEMINI_25_FREE_DAILY_CAP;
    else process.env.GEMINI_25_FREE_DAILY_CAP = origCap;
    _resetGeminiGroundingBudget();
  });

  it('기본 상한은 1,400이고 공식 한도 1,500을 넘길 수 없다', () => {
    delete process.env.GEMINI_25_FREE_DAILY_CAP;
    expect(geminiFreeDailyCap()).toBe(1400);
    process.env.GEMINI_25_FREE_DAILY_CAP = '9999';
    expect(geminiFreeDailyCap()).toBe(1500);
    process.env.GEMINI_25_FREE_DAILY_CAP = 'abc';
    expect(geminiFreeDailyCap()).toBe(1400);
  });

  it('상한까지만 예약되고 초과분은 유료 경로로 센다', () => {
    process.env.GEMINI_25_FREE_DAILY_CAP = '2';
    const t = Date.UTC(2026, 8, 13, 3, 0, 0); // KST 09-13 12:00
    expect(reserveFreeGrounding(t)).toBe(true);
    expect(reserveFreeGrounding(t)).toBe(true);
    expect(reserveFreeGrounding(t)).toBe(false);
    expect(geminiGroundingBudgetSnapshot(t)).toMatchObject({ usedToday: 2, paidOverflowToday: 1, dailyCap: 2 });
    releaseFreeGrounding(t);
    expect(reserveFreeGrounding(t)).toBe(true);
  });

  it('KST 날짜가 바뀌면 0부터 다시 센다', () => {
    process.env.GEMINI_25_FREE_DAILY_CAP = '1';
    const before = Date.UTC(2026, 8, 13, 14, 30, 0); // KST 09-13 23:30
    const after = Date.UTC(2026, 8, 13, 15, 30, 0);  // KST 09-14 00:30
    expect(reserveFreeGrounding(before)).toBe(true);
    expect(reserveFreeGrounding(before)).toBe(false);
    expect(reserveFreeGrounding(after)).toBe(true);
    expect(geminiGroundingBudgetSnapshot(after).kstDate).toBe('2026-09-14');
  });

  it('상한 0이면 무료 경로를 쓰지 않는다', () => {
    process.env.GEMINI_25_FREE_DAILY_CAP = '0';
    expect(reserveFreeGrounding()).toBe(false);
  });
});
