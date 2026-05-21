-- CitedSourceSnapshot table
CREATE TABLE IF NOT EXISTS "cited_source_snapshots" (
  "id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "normalized_url" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "source_type" TEXT,
  "category" TEXT,
  "authority_score" INTEGER,
  "title" TEXT,
  "description" TEXT,
  "og_image" TEXT,
  "author" TEXT,
  "publisher" TEXT,
  "published_at" TIMESTAMP(3),
  "language" TEXT,
  "body_text" TEXT,
  "body_length" INTEGER,
  "word_count" INTEGER,
  "ig_handle" TEXT,
  "ig_media_type" TEXT,
  "ig_caption" TEXT,
  "ig_like_count" INTEGER,
  "hospital_analysis" JSONB,
  "fetch_status" TEXT NOT NULL,
  "fetched_at" TIMESTAMP(3) NOT NULL,
  "http_status" INTEGER,
  "fetch_error_message" TEXT,
  "fetch_duration_ms" INTEGER,
  "freshness_score" DOUBLE PRECISION,
  "total_citations" INTEGER NOT NULL DEFAULT 0,
  "citing_ai_platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "influence_score" DOUBLE PRECISION,
  "last_cited_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cited_source_snapshots_pkey" PRIMARY KEY ("id")
);

-- Unique index on url
CREATE UNIQUE INDEX IF NOT EXISTS "cited_source_snapshots_url_key" ON "cited_source_snapshots"("url");

-- Indexes
CREATE INDEX IF NOT EXISTS "cited_source_snapshots_domain_idx" ON "cited_source_snapshots"("domain");
CREATE INDEX IF NOT EXISTS "cited_source_snapshots_category_idx" ON "cited_source_snapshots"("category");
CREATE INDEX IF NOT EXISTS "cited_source_snapshots_source_type_idx" ON "cited_source_snapshots"("source_type");
CREATE INDEX IF NOT EXISTS "cited_source_snapshots_influence_score_idx" ON "cited_source_snapshots"("influence_score");
CREATE INDEX IF NOT EXISTS "cited_source_snapshots_last_cited_at_idx" ON "cited_source_snapshots"("last_cited_at");
