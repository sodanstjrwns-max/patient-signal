import type { PrismaService } from '../common/prisma/prisma.service';

type Log = { log(message: string): void; warn(message: string): void };
const MAX_AGE_MS = 71 * 60 * 60 * 1000;

/** HTTP acceptance is not proof of GA4 processing; validate/reconcile separately. */
export async function flushBookAnalytics(
  db: PrismaService,
  logger: Log,
): Promise<void> {
  const secret = process.env.GA4_API_SECRET?.trim();
  const mid = process.env.GA4_MEASUREMENT_ID?.trim() || 'G-JKY5HYYKTB';
  if (!secret) return; // Retain pending rows while configuration is unavailable.
  const now = new Date();
  const pending = await db.bookAnalyticsEvent.findMany({
    where: { sentAt: null, stoppedAt: null, nextAttemptAt: { lte: now } },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });
  for (const row of pending) {
    // Atomic lease prevents concurrent workers from sending the same row.
    const claim = await db.bookAnalyticsEvent.updateMany({
      where: {
        id: row.id,
        sentAt: null,
        stoppedAt: null,
        nextAttemptAt: { lte: now },
      },
      data: {
        nextAttemptAt: new Date(Date.now() + 120_000),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    if (Date.now() - row.createdAt.getTime() > MAX_AGE_MS) {
      await db.bookAnalyticsEvent.update({
        where: { id: row.id },
        data: { stoppedAt: new Date(), lastError: 'EXPIRED_REQUIRES_REVIEW' },
      });
      logger.warn(
        `[book-analytics] ${row.id}: delivery expired; review required`,
      );
      continue;
    }
    let failure: string | null = null;
    try {
      const response = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(mid)}&api_secret=${encodeURIComponent(secret)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row.payload),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) failure = `HTTP_${response.status}`;
    } catch {
      // Never log fetch errors/URLs: they can contain the API secret.
      failure = 'NETWORK_OR_TIMEOUT';
    }
    if (failure) {
      const delay = Math.min(
        60_000 * 2 ** Math.min(row.attempts, 10),
        3_600_000,
      );
      await db.bookAnalyticsEvent.update({
        where: { id: row.id },
        data: {
          lastError: failure,
          nextAttemptAt: new Date(Date.now() + delay),
        },
      });
      logger.warn(`[book-analytics] ${row.id}: ${failure}; queued for retry`);
    } else {
      await db.bookAnalyticsEvent.update({
        where: { id: row.id },
        data: { sentAt: new Date(), lastError: null },
      });
      logger.log(`[book-analytics] ${row.id}: HTTP accepted`);
    }
  }
}
