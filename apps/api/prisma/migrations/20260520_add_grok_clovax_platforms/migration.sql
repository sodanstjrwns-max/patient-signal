-- Add GROK and CLOVA_X to AIPlatform enum
-- xAI Grok: 실시간 검색 + X(Twitter) 통합 강점
-- Naver HyperCLOVA X: 한국 토종 LLM 1위 후보, 한국어 쿼리 최적화

ALTER TYPE "AIPlatform" ADD VALUE IF NOT EXISTS 'GROK';
ALTER TYPE "AIPlatform" ADD VALUE IF NOT EXISTS 'CLOVA_X';
