-- 【2026-09-26】수백 곳 확장 대비 인덱스 (patient-signal)
-- 실행하지 않은 상태로 커밋 대기. 적용 방법(크롤 09:00·14:00 KST 피해서):
--   Supabase SQL Editor 에서 아래 문장을 "한 줄씩" 실행 (CONCURRENTLY 는 트랜잭션 안에서 안 됨 — 풀러 트랜잭션 모드도 불가, 직접 연결/에디터 사용).
--   daily_scores 는 1.2만 행 규모라 일반 CREATE INDEX 로 해도 1초 미만.
-- 이름은 Prisma 기본 규칙과 같게 맞춰 schema.prisma 의 @@index([scoreDate]) 와 충돌하지 않게 했다.

-- 크롤 정렬의 '오늘 점수 난 병원'(score_date >= 오늘) · 전국 순위류가 날짜 단독으로 daily_scores 를 읽는다.
-- 기존 유니크 인덱스(hospital_id, score_date)는 병원이 앞이라 날짜 단독 조건에 못 쓴다 → 병원 수×일수만큼 전체 스캔.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "daily_scores_score_date_idx" ON "daily_scores"("score_date");
