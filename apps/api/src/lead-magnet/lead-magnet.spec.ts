import { LeadMagnetService } from './lead-magnet.service';

describe('LeadMagnetService.isSendable', () => {
  it('accepts ordinary addresses', () => {
    for (const e of [
      'owner@brightsmile.com',
      'a.b+tag@clinic.co.jp',
      'dr@my-practice.dental',
    ]) {
      expect(LeadMagnetService.isSendable(e)).toBe(true);
    }
  });

  it('rejects reserved domains that only ever bounce', () => {
    for (const e of [
      'x@example.com',
      'x@example.net',
      'x@foo.test',
      'x@foo.invalid',
      'x@localhost',
      'x@sub.example',
    ]) {
      expect(LeadMagnetService.isSendable(e)).toBe(false);
    }
  });

  it('rejects malformed input', () => {
    expect(LeadMagnetService.isSendable('nope')).toBe(false);
    expect(LeadMagnetService.isSendable('@nope.com')).toBe(false);
  });
});

describe('LeadMagnetService.languageFromPermalink', () => {
  it('maps the two editions and ignores anything else', () => {
    expect(
      LeadMagnetService.languageFromPermalink(
        'https://sodanstjrwns.gumroad.com/l/patientfunnel-en',
      ),
    ).toBe('en');
    expect(
      LeadMagnetService.languageFromPermalink(undefined, 'patientfunnel-ja'),
    ).toBe('ja');
    expect(LeadMagnetService.languageFromPermalink('other-thing')).toBeNull();
  });
});

describe('LeadMagnetService.offerFrom', () => {
  const env = {
    GUMROAD_OFFER_CODE: 'READER',
    GUMROAD_OFFER_EXPIRES: '2026-10-31',
    GUMROAD_OFFER_PRICE_EN: '$247',
    GUMROAD_OFFER_PRICE_JA: '37,800円',
  };
  it('is live through the end of the expiry day', () => {
    expect(
      LeadMagnetService.offerFrom(env, new Date('2026-10-31T20:00:00Z')),
    ).not.toBeNull();
    expect(
      LeadMagnetService.offerFrom(env, new Date('2026-11-01T00:00:01Z')),
    ).toBeNull();
  });
  it('is off when any part is missing', () => {
    expect(
      LeadMagnetService.offerFrom(
        { ...env, GUMROAD_OFFER_CODE: '' },
        new Date('2026-10-01T00:00:00Z'),
      ),
    ).toBeNull();
    expect(LeadMagnetService.offerFrom({}, new Date())).toBeNull();
  });
});
