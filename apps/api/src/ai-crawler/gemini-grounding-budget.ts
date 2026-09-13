/**
 * 【2026.09.13 비용】Gemini 검색 그라운딩 무료 한도 예산
 *
 * 배경: 9/1~9/11 Google Cloud 청구 ₩387,473 중 ₩373,201(96%)이 SKU "search query gemini 3 paid"
 *  — 모델 토큰이 아니라 검색 그라운딩 쿼리(Gemini 3.x: $14/1k) 과금이었다.
 * 공식 요금(ai.google.dev/gemini-api/docs/pricing, 2026-09-13 확인):
 *  - Gemini 2.5 Flash/Flash-Lite: 그라운딩 하루 1,500 요청 무료(둘이 공유), 초과 $35/1k
 *  - Gemini 3.x: 월 5,000 요청 무료(모든 모델 공유), 초과 $14/1k
 * 전략: 하루 상한(기본 1,400)까지는 gemini-2.5-flash 로 그라운딩(무료), 넘으면 3.x flash-lite(유료 $14/1k)로.
 *  2.5 는 초과분이 3.x 보다 2.5배 비싸므로 상한을 넘기면 절대 2.5 로 보내지 않는다.
 *
 * 카운터는 프로세스 메모리(KST 날짜 기준) — Render 단일 인스턴스 전제. 재배포/재시작 시 0 부터 다시 세므로
 *  상한을 공식 한도(1,500)보다 낮게 잡아 여유를 둔다. GEMINI_25_FREE_DAILY_CAP=0 이면 2.5 경로 비활성화.
 */

export const GEMINI_FREE_TIER_MODEL = 'gemini-2.5-flash';

const state = { kstDate: '', used: 0, overflow: 0 };

function kstDateKey(now = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function rollover(now = Date.now()): void {
  const key = kstDateKey(now);
  if (state.kstDate !== key) {
    state.kstDate = key;
    state.used = 0;
    state.overflow = 0;
  }
}

export function geminiFreeDailyCap(): number {
  const raw = parseInt(process.env.GEMINI_25_FREE_DAILY_CAP ?? '1400', 10);
  if (!Number.isFinite(raw) || raw < 0) return 1400;
  return Math.min(raw, 1500); // 공식 무료 한도 초과 설정 방지
}

/** 오늘(KST) 무료 경로 예산이 남았으면 1건 예약하고 true. 실패한 호출도 과금될 수 있어 호출 전에 차감한다 */
export function reserveFreeGrounding(now = Date.now()): boolean {
  rollover(now);
  const cap = geminiFreeDailyCap();
  if (cap === 0 || state.used >= cap) {
    state.overflow++;
    return false;
  }
  state.used++;
  return true;
}

/** 모델 자체가 없어(404 등) 실제 호출이 성립하지 않은 경우 예약 반환 */
export function releaseFreeGrounding(now = Date.now()): void {
  rollover(now);
  if (state.used > 0) state.used--;
}

export function geminiGroundingBudgetSnapshot(now = Date.now()) {
  rollover(now);
  return {
    model: GEMINI_FREE_TIER_MODEL,
    kstDate: state.kstDate,
    dailyCap: geminiFreeDailyCap(),
    usedToday: state.used,
    paidOverflowToday: state.overflow,
  };
}

/** 테스트용 */
export function _resetGeminiGroundingBudget(): void {
  state.kstDate = '';
  state.used = 0;
  state.overflow = 0;
}
