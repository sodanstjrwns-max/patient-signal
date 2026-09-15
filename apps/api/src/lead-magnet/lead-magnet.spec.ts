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
