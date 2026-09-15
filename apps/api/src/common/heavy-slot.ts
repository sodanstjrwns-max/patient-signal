/**
 * 【2026-09-15】무거운 조회 동시 실행 제한 — 512MB 인스턴스에서 대시보드가 무거운 API 3개를 동시에 부르면
 * 행 수만 행을 한꺼번에 메모리에 올려 OOM(Render "Ran out of memory") → 재시작 → 502 가 났다.
 * 같은 프로세스 안에서 무거운 핸들러를 최대 N개까지만 동시에 돌린다(나머지는 대기).
 */
const MAX = Math.max(1, parseInt(process.env.HEAVY_QUERY_CONCURRENCY || '1', 10) || 1);
let running = 0;
const waiters: Array<() => void> = [];

export async function withHeavySlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  running++;
  try {
    return await fn();
  } finally {
    running--;
    const next = waiters.shift();
    if (next) next();
  }
}
