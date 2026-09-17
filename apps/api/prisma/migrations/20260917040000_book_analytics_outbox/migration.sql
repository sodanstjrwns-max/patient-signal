CREATE TABLE IF NOT EXISTS "book_analytics_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  "stopped_at" TIMESTAMP(3),
  "last_error" TEXT
);
CREATE INDEX IF NOT EXISTS "book_analytics_events_sent_at_stopped_at_next_attempt_at_idx"
  ON "book_analytics_events"("sent_at", "stopped_at", "next_attempt_at");
