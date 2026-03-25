-- CreateTable
CREATE TABLE "live_query_usages" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "query_text" TEXT NOT NULL,
    "platforms" TEXT[],
    "platform_count" INTEGER NOT NULL DEFAULT 4,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_query_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "live_query_usages_hospital_id_used_at_idx" ON "live_query_usages"("hospital_id", "used_at");
