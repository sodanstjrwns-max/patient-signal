// 병렬화 전/후 세션당·하루 처리량 시뮬레이션
const AVG = 45;          // 병원당 평균 크롤 시간(초), 실측
const BUDGET = 50 * 60;  // 세션 예산(초)
const SESSIONS = 3;      // 하루 세션 수

// --- 병렬화 전 (순차 + 병원당 10초 딜레이) ---
const beforePer = AVG + 10;             // 병원 1곳 = 크롤45 + 딜레이10
const beforeSession = Math.floor(BUDGET / beforePer);
const beforeDay = beforeSession * SESSIONS;

// --- 병렬화 후 (4병원 동시 + 배치간 2초) ---
const CONC = 4;
// 배치 1개 = 가장 느린 병원 시간(=AVG로 근사) + 배치간 2초
const afterBatch = AVG + 2;
const afterBatchesPerSession = Math.floor(BUDGET / afterBatch);
const afterSession = afterBatchesPerSession * CONC;
const afterDay = afterSession * SESSIONS;

console.log('=== 병렬화 전 (순차+10초딜레이) ===');
console.log(`  세션당: ${beforeSession}곳 / 하루(3세션): ${beforeDay}곳`);
console.log('=== 병렬화 후 (4병원 동시+2초) ===');
console.log(`  세션당: ${afterSession}곳 / 하루(3세션): ${afterDay}곳`);
console.log('=== 결론 ===');
console.log(`  세션당 ${beforeSession}→${afterSession}곳 (${(afterSession/beforeSession).toFixed(1)}배)`);
console.log(`  하루   ${beforeDay}→${afterDay}곳 (${(afterDay/beforeDay).toFixed(1)}배)`);
console.log(`  200곳 매일 1회 커버? ${afterDay >= 200 ? 'YES ✅ (여유 '+(afterDay-200)+'곳)' : 'NO ❌'}`);
console.log(`  ※ 단일 세션만으로 200곳? ${afterSession >= 200 ? 'YES ✅' : 'NO — 하지만 3세션 합산이면 충분'}`);
