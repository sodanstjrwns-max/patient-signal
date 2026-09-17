import { flushBookAnalytics } from './book-analytics';
import { LeadMagnetService } from './lead-magnet.service';

describe('durable book analytics', () => {
  const originalEnv = { ...process.env };
  const logger = { log: jest.fn(), warn: jest.fn() };
  const ping = {
    seller_id: 'seller',
    sale_id: 'transaction-1',
    email: 'reader@example.com',
    product_permalink: 'patientfunnel-ja',
    price: '30123',
    currency: 'jpy',
    url_params: {
      cid: '123.456',
      sid: '1790000000',
      email: 'private@example.com',
    },
  };
  let db: any;
  let events: any[];
  let fetchMock: jest.SpyInstance;
  let service: LeadMagnetService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-17T03:00:00Z'));
    process.env.GUMROAD_SELLER_ID = 'seller';
    process.env.GA4_API_SECRET = 'test-only-key';
    events = [];
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 204 } as Response);
    const purchases: any[] = [];
    db = {
      leadMagnet: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
      },
      bookPurchase: {
        findUnique: jest.fn(({ where }) =>
          purchases.find((p) => p.saleId === where.saleId),
        ),
        create: jest.fn(({ data }) => {
          purchases.push(data);
          return data;
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      bookAnalyticsEvent: {
        create: jest.fn(({ data }) => {
          events.push({
            ...data,
            createdAt: new Date(),
            attempts: 0,
            nextAttemptAt: new Date(),
            sentAt: null,
            stoppedAt: null,
          });
        }),
        findMany: jest.fn(() =>
          structuredClone(
            events.filter(
              (e) => !e.sentAt && !e.stoppedAt && e.nextAttemptAt <= new Date(),
            ),
          ),
        ),
        updateMany: jest.fn(({ where, data }) => {
          const row = events.find(
            (e) =>
              e.id === where.id &&
              !e.sentAt &&
              !e.stoppedAt &&
              e.nextAttemptAt <= where.nextAttemptAt.lte,
          );
          if (!row) return { count: 0 };
          Object.assign(row, {
            nextAttemptAt: data.nextAttemptAt,
            attempts: row.attempts + 1,
          });
          return { count: 1 };
        }),
        update: jest.fn(({ where, data }) =>
          Object.assign(
            events.find((e) => e.id === where.id),
            data,
          ),
        ),
      },
    };
    db.$transaction = jest.fn(async (run) => {
      const previous = purchases.length;
      try {
        return await run(db);
      } catch (error) {
        purchases.splice(previous);
        throw error;
      }
    });
    service = new LeadMagnetService(db, {
      sendHtmlEmail: jest.fn().mockResolvedValue({ ok: true }),
    } as any);
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('queues USD revenue and numeric session, without personal fields or a network request in the webhook', async () => {
    await service.recordSale(ping);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0].payload.events[0].params).toMatchObject({
      value: 301.23,
      currency: 'USD',
      session_id: 1790000000,
    });
    expect(JSON.stringify(events)).not.toMatch(
      /reader@|private@|test-only-key/,
    );
    await service.recordSale(ping);
    expect(events).toHaveLength(1);
  });
  it('does not acknowledge a purchase when durable enqueue fails; the retry can recover', async () => {
    db.bookAnalyticsEvent.create.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(service.recordSale(ping)).rejects.toThrow(
      'database unavailable',
    );
    await expect(service.recordSale(ping)).resolves.toEqual({ ok: true });
    expect(events).toHaveLength(1);
  });
  it('retains events through missing credentials and delivers once after configuration', async () => {
    delete process.env.GA4_API_SECRET;
    await service.recordSale(ping);
    await flushBookAnalytics(db, logger);
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.GA4_API_SECRET = 'test-only-key';
    await flushBookAnalytics(db, logger);
    await flushBookAnalytics(db, logger);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events[0].sentAt).toEqual(new Date());
  });
  it.each(['network', 'http'])(
    'retries after %s failure without changing original event time',
    async (mode) => {
      await service.recordSale(ping);
      const timestamp = events[0].payload.timestamp_micros;
      if (mode === 'network')
        fetchMock.mockRejectedValueOnce(new Error('contains-secret'));
      else fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
      await flushBookAnalytics(db, logger);
      expect(events[0].sentAt).toBeNull();
      expect(events[0].lastError).toBe(
        mode === 'network' ? 'NETWORK_OR_TIMEOUT' : 'HTTP_503',
      );
      await flushBookAnalytics(db, logger);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(60_001);
      await flushBookAnalytics(db, logger);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(events[0].sentAt).not.toBeNull();
      expect(events[0].payload.timestamp_micros).toBe(timestamp);
    },
  );
  it('does not send a row claimed by another worker', async () => {
    await service.recordSale(ping);
    db.bookAnalyticsEvent.updateMany.mockResolvedValue({ count: 0 });
    await flushBookAnalytics(db, logger);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('stops stale events for review instead of reporting old purchases as new', async () => {
    await service.recordSale(ping);
    jest.advanceTimersByTime(72 * 3600_000);
    await flushBookAnalytics(db, logger);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events[0].lastError).toBe('EXPIRED_REQUIRES_REVIEW');
    expect(events[0].stoppedAt).not.toBeNull();
  });
  it('never creates analytics or purchases for Gumroad test pings', async () => {
    await expect(
      service.recordSale({ ...ping, test: 'true' }),
    ).resolves.toMatchObject({ ignored: 'test' });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });
});
