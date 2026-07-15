-- Add NAVER_AI_BRIEFING to AIPlatform enum
-- 네이버 모바일 검색 AI 브리핑: HyperCLOVA X + 네이버 검색 그라운딩
-- API 미제공 → m.search.naver.com 직접 수집 (2026-07-14 파일럿 검증: 200쿼리 노출률 8%, 차단 0)

ALTER TYPE "AIPlatform" ADD VALUE IF NOT EXISTS 'NAVER_AI_BRIEFING';
