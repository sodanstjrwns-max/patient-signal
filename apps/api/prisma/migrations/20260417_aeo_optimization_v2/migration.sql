-- CreateEnum
CREATE TYPE "AnswerPositionType" AS ENUM ('PRIMARY_RECOMMEND', 'COMPARISON_WINNER', 'INFORMATION_CITE', 'CONDITIONAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "ExperimentGroup" AS ENUM ('CONTROL', 'EXPERIMENT_TONE', 'EXPERIMENT_REGION', 'EXPERIMENT_INTENT');

-- CreateEnum
CREATE TYPE "AeoPipelineStatus" AS ENUM ('GAP_DETECTED', 'CONTENT_DRAFTED', 'PUBLISHED', 'REMEASURED', 'IMPACT_CALCULATED');

-- CreateEnum
CREATE TYPE "GeoContentStatus" AS ENUM ('DRAFT', 'GENERATING', 'REVIEW', 'PUBLISHED', 'SCHEDULED', 'FAILED');

-- CreateEnum
CREATE TYPE "ContentTone" AS ENUM ('FORMAL', 'POLITE', 'CASUAL', 'FRIENDLY', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "FunnelStage" AS ENUM ('AWARENESS', 'CONSIDERATION', 'DECISION', 'RETENTION', 'ADVOCACY');

-- CreateEnum
CREATE TYPE "PublishPlatform" AS ENUM ('NAVER_BLOG', 'TISTORY', 'BRUNCH', 'WORDPRESS', 'HOSPITAL_SITE', 'SLIDESHARE', 'INSTAGRAM', 'KAKAO');

-- AlterTable
ALTER TABLE "ai_responses" ADD COLUMN     "answer_position_type" "AnswerPositionType",
ADD COLUMN     "answer_quality_factors" JSONB,
ADD COLUMN     "answer_quality_score" DOUBLE PRECISION,
ADD COLUMN     "crawl_session" TEXT;

-- AlterTable
ALTER TABLE "daily_scores" ADD COLUMN     "avg_answer_quality" DOUBLE PRECISION,
ADD COLUMN     "position_type_distribution" JSONB,
ADD COLUMN     "session_distribution" JSONB,
ADD COLUMN     "weighted_intent_sov" JSONB;

-- AlterTable
ALTER TABLE "prompts" ADD COLUMN     "experiment_group" "ExperimentGroup",
ADD COLUMN     "experiment_parent_id" TEXT,
ADD COLUMN     "golden_detected_at" TIMESTAMP(3),
ADD COLUMN     "is_golden_prompt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platform_specific" TEXT;

-- CreateTable
CREATE TABLE "geo_contents" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body_html" TEXT NOT NULL,
    "body_markdown" TEXT,
    "excerpt" TEXT,
    "funnel_stage" "FunnelStage" NOT NULL,
    "content_tone" "ContentTone" NOT NULL,
    "target_keywords" TEXT[],
    "related_prompt_ids" TEXT[],
    "procedure" TEXT,
    "geo_elements" JSONB,
    "ai_model" TEXT,
    "generation_prompt" TEXT,
    "generation_params" JSONB,
    "status" "GeoContentStatus" NOT NULL DEFAULT 'DRAFT',
    "card_news_slides" JSONB,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "slug" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geo_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aeo_pipelines" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "content_gap_id" TEXT,
    "gap_detected_at" TIMESTAMP(3) NOT NULL,
    "gap_prompt_text" TEXT,
    "gap_platforms" TEXT[],
    "competitors_in_gap" TEXT[],
    "geo_content_id" TEXT,
    "content_drafted_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "published_url" TEXT,
    "publish_platform" TEXT,
    "remeasured_at" TIMESTAMP(3),
    "pre_sov_percent" DOUBLE PRECISION,
    "post_sov_percent" DOUBLE PRECISION,
    "sov_lift" DOUBLE PRECISION,
    "impact_score" DOUBLE PRECISION,
    "impact_factors" JSONB,
    "status" "AeoPipelineStatus" NOT NULL DEFAULT 'GAP_DETECTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aeo_pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_coach_actions" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "week_start_date" DATE NOT NULL,
    "actions" JSONB NOT NULL,
    "sent_via_email" BOOLEAN NOT NULL DEFAULT false,
    "sent_via_kakao" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "clicked_actions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_coach_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_publications" (
    "id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "platform" "PublishPlatform" NOT NULL,
    "published_url" TEXT,
    "published_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "geo_contents_hospital_id_status_idx" ON "geo_contents"("hospital_id", "status");

-- CreateIndex
CREATE INDEX "geo_contents_hospital_id_funnel_stage_idx" ON "geo_contents"("hospital_id", "funnel_stage");

-- CreateIndex
CREATE INDEX "geo_contents_hospital_id_created_at_idx" ON "geo_contents"("hospital_id", "created_at");

-- CreateIndex
CREATE INDEX "aeo_pipelines_hospital_id_status_idx" ON "aeo_pipelines"("hospital_id", "status");

-- CreateIndex
CREATE INDEX "aeo_pipelines_hospital_id_gap_detected_at_idx" ON "aeo_pipelines"("hospital_id", "gap_detected_at");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_coach_actions_hospital_id_week_start_date_key" ON "weekly_coach_actions"("hospital_id", "week_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "geo_publications_content_id_platform_key" ON "geo_publications"("content_id", "platform");

-- CreateIndex
CREATE INDEX "ai_responses_answer_position_type_hospital_id_idx" ON "ai_responses"("answer_position_type", "hospital_id");

-- CreateIndex
CREATE INDEX "prompts_hospital_id_is_golden_prompt_idx" ON "prompts"("hospital_id", "is_golden_prompt");

-- CreateIndex
CREATE INDEX "prompts_experiment_group_idx" ON "prompts"("experiment_group");

-- AddForeignKey
ALTER TABLE "geo_contents" ADD CONSTRAINT "geo_contents_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeo_pipelines" ADD CONSTRAINT "aeo_pipelines_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_publications" ADD CONSTRAINT "geo_publications_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "geo_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

