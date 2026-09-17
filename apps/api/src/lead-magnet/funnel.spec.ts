import { LeadMagnetService } from './lead-magnet.service';
import {
  sanitizeAttribution,
  sequenceLimit,
  taggedStoreLinks,
} from './attribution';

describe('overseas funnel boundaries', () => {
  const address = 'reader@sample-clinic.dental';
  let prisma: any;
  let service: any;
  let sender: any;
  const lead = (extra = {}) => ({
    id: 'lead',
    email: address,
    language: 'en',
    token: 'token',
    step: 0,
    createdAt: new Date(0),
    consentVersion: null,
    unsubscribedAt: null,
    attribution: {
      gaClientId: '123.456',
      utm_source: 'google',
      utm_campaign: 'US-search',
    },
    ...extra,
  });
  beforeEach(() => {
    prisma = {
      leadMagnet: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'lead', token: 'token' }),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      bookPurchase: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn((run) => run(prisma));
    sender = { sendHtmlEmail: jest.fn().mockResolvedValue({ ok: true }) };
    service = new LeadMagnetService(prisma, sender);
    jest.spyOn(service, 'notifyOwner').mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps only bounded campaign fields, not personal fields or arbitrary keys', () => {
    expect(
      sanitizeAttribution({
        email: address,
        utm_source: 'google',
        utm_campaign: 'x'.repeat(130),
        referrer: 'search.example.org',
        gaClientId: '123.456',
        utm_term: address,
        password: 'secret',
      }),
    ).toEqual({
      utm_source: 'google',
      utm_campaign: 'x'.repeat(100),
      referrer: 'search.example.org',
      gaClientId: '123.456',
    });
    expect(sanitizeAttribution(['bad'])).toEqual({});
  });
  it('honors the old 5-note scope; only the new version allows 11', () => {
    expect(sequenceLimit(null)).toBe(5);
    expect(sequenceLimit('unknown')).toBe(5);
    expect(sequenceLimit('2026-09-17')).toBe(11);
  });
  it('keeps the coupon in the path when tagging email links', () => {
    const tagged = taggedStoreLinks(
      '[Buy](https://sodanstjrwns.gumroad.com/l/patientfunnel-ja/READERJP)',
      'ja',
      6,
    );
    expect(tagged).toContain('/READERJP?');
    expect(tagged).toContain('utm_content=day-15');
    expect(tagged).not.toContain(address);
  });
  it('stores consent evidence and first acquisition on signup', async () => {
    await service.submit({
      email: address,
      language: 'en',
      consentVersion: '2026-09-17',
      attribution: { utm_source: 'google' },
    });
    expect(prisma.leadMagnet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consentVersion: '2026-09-17',
          consentAt: expect.any(Date),
          attribution: { utm_source: 'google' },
        }),
      }),
    );
    expect(sender.sendHtmlEmail.mock.calls[0][0].html).toContain(
      'Up to 11 emails',
    );
  });
  it('a repeat download neither overwrites acquisition nor restarts the series', async () => {
    prisma.leadMagnet.findFirst.mockResolvedValue(lead({ step: 3 }));
    await service.submit({
      email: address,
      language: 'en',
      attribution: { utm_source: 'direct' },
    });
    expect(prisma.leadMagnet.update).not.toHaveBeenCalled();
    expect(sender.sendHtmlEmail.mock.calls[0][0].html).toContain('Five emails');
  });
  it('never reactivates an unsubscribed reader on a repeat request', async () => {
    prisma.leadMagnet.findFirst.mockResolvedValue(
      lead({ unsubscribedAt: new Date() }),
    );
    await service.submit({
      email: address,
      language: 'en',
      consentVersion: '2026-09-17',
    });
    expect(sender.sendHtmlEmail).not.toHaveBeenCalled();
    expect(prisma.leadMagnet.update).not.toHaveBeenCalled();
  });
  it('a failed immediate delivery stays retryable and does not report success', async () => {
    sender.sendHtmlEmail.mockResolvedValue({
      ok: false,
      error: 'provider down',
    });
    await expect(
      service.submit({ email: address, language: 'en' }),
    ).rejects.toThrow();
    expect(prisma.leadMagnet.update).not.toHaveBeenCalled();
  });
  it('cron retries unsent first emails and skips legacy extension steps', async () => {
    prisma.leadMagnet.findMany.mockResolvedValue([
      lead(),
      lead({ id: 'old', step: 5 }),
      lead({ id: 'new', step: 6, consentVersion: '2026-09-17' }),
    ]);
    const result = await service.runSequence();
    expect(result.sent).toBe(2);
    expect(
      prisma.leadMagnet.update.mock.calls.map((c: any) => c[0].where.id),
    ).toEqual(['lead', 'new']);
  });
  it('same-email purchases retain acquisition when the PDF/email link has no browser id', async () => {
    process.env.GUMROAD_SELLER_ID = 'test-seller';
    prisma.leadMagnet.findFirst
      .mockResolvedValueOnce(lead())
      .mockResolvedValueOnce(null);
    const ga = jest.spyOn(service, 'ga4Event').mockResolvedValue(undefined);
    await service.recordSale({
      seller_id: 'test-seller',
      sale_id: 'sale',
      email: address,
      product_permalink: 'patientfunnel-en',
      price: '29700',
      url_params: { utm_source: 'free-edition', utm_medium: 'pdf' },
    });
    expect(
      prisma.bookPurchase.create.mock.calls[0][0].data.attribution,
    ).toEqual(
      expect.objectContaining({
        gaClientId: '123.456',
        utm_source: 'google',
        checkout_source: 'free-edition',
      }),
    );
    expect(ga.mock.calls[0][6]).toEqual(
      expect.objectContaining({ gaClientId: '123.456' }),
    );
    expect(prisma.leadMagnet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: address, purchasedAt: null } }),
    );
  });
  it('ignores duplicate sales and cannot undo a refund on a retried sale', async () => {
    process.env.GUMROAD_SELLER_ID = 'test-seller';
    prisma.bookPurchase.findUnique.mockResolvedValue({
      refunded: true,
      priceCents: 29700,
      currency: 'usd',
    });
    const ga = jest.spyOn(service, 'ga4Event').mockResolvedValue(undefined);
    expect(
      await service.recordSale({
        seller_id: 'test-seller',
        sale_id: 'sale',
        email: address,
        product_permalink: 'patientfunnel-en',
      }),
    ).toEqual({ ok: true, ignored: 'duplicate' });
    expect(prisma.bookPurchase.updateMany).not.toHaveBeenCalled();
    expect(ga).not.toHaveBeenCalled();
  });
  it('records one refund transition and ignores repeated refund pings', async () => {
    process.env.GUMROAD_SELLER_ID = 'test-seller';
    prisma.bookPurchase.findUnique.mockResolvedValue({
      refunded: false,
      priceCents: 29700,
      currency: 'usd',
    });
    prisma.bookPurchase.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const ga = jest.spyOn(service, 'ga4Event').mockResolvedValue(undefined);
    const ping = {
      seller_id: 'test-seller',
      sale_id: 'sale',
      email: address,
      product_permalink: 'patientfunnel-en',
      refunded: 'true',
    };
    await service.recordSale(ping);
    await service.recordSale(ping);
    expect(ga).toHaveBeenCalledTimes(1);
    expect(ga.mock.calls[0][0]).toBe('refund');
  });
  it('renders every EN/JA lead template with no unresolved placeholders', async () => {
    process.env.GUMROAD_OFFER_CODE = 'READER';
    process.env.GUMROAD_OFFER_CODE_JA = 'READERJP';
    process.env.GUMROAD_OFFER_EXPIRES = '2099-10-31';
    process.env.GUMROAD_OFFER_PRICE_EN = '$247';
    process.env.GUMROAD_OFFER_PRICE_JA = '37,800円';
    for (const lang of ['en', 'ja'])
      for (let step = 1; step <= 11; step++) {
        await service.sendStep(
          'id',
          address,
          lang,
          'token',
          step,
          false,
          '2026-09-17',
        );
      }
    expect(sender.sendHtmlEmail).toHaveBeenCalledTimes(22);
    for (const [mail] of sender.sendHtmlEmail.mock.calls) {
      expect(mail.html).not.toContain('{{');
      expect(mail.html).toContain('/unsubscribe?t=token');
    }
  });
});
