import { detectMention, extractClinicNames, extractDomains } from './mention';
import { aggregateResults } from './analysis';

describe('intl-check mention detection', () => {
  const clinic = 'Bright Smile Dental Clinic';

  it('matches the full name case-insensitively', () => {
    const r = detectMention(
      'I recommend BRIGHT SMILE dental clinic on George St.',
      clinic,
    );
    expect(r.mentioned).toBe(true);
    expect(r.matchedBy).toBe('full');
    expect(r.count).toBe(1);
  });

  it('ignores punctuation and spacing differences', () => {
    expect(
      detectMention('Try Bright-Smile Dental Clinic!', clinic).mentioned,
    ).toBe(true);
    expect(
      detectMention('Try BrightSmile Dental Clinic', clinic).mentioned,
    ).toBe(true);
    expect(
      detectMention('**Bright Smile Dental Clinic** – 4.9★', clinic).mentioned,
    ).toBe(true);
  });

  it('accepts a partial match of >= 2 distinctive tokens', () => {
    const r = detectMention(
      'Locals often mention Bright Smile for implants.',
      clinic,
    );
    expect(r.mentioned).toBe(true);
    expect(r.matchedBy).toBe('partial');
    expect(r.matchedText).toBe('bright smile');
  });

  it('does not match on a single generic or distinctive token', () => {
    expect(
      detectMention(
        'Smile Studio is a good dental clinic.',
        'Smile Dental Clinic',
      ).mentioned,
    ).toBe(false);
    expect(
      detectMention('Harbour Bridge Dental is popular.', 'Harbour Dental')
        .mentioned,
    ).toBe(false);
    expect(
      detectMention(
        'The brightest smiles come from regular care.',
        'Bright Smile Dental',
      ).mentioned,
    ).toBe(false);
    expect(detectMention('', clinic).mentioned).toBe(false);
  });

  it('handles Japanese clinic names with generic suffixes', () => {
    expect(
      detectMention(
        '横浜ならさくら歯科クリニックがおすすめです。',
        'さくら歯科クリニック',
      ).mentioned,
    ).toBe(true);
    const partial = detectMention(
      'さくら歯科は評判が良いです。',
      'さくら歯科クリニック',
    );
    expect(partial.mentioned).toBe(true);
    expect(partial.matchedBy).toBe('partial');
    expect(
      detectMention('春は桜がきれいです。', 'さくら歯科クリニック').mentioned,
    ).toBe(false);
    expect(
      detectMention('田中歯科医院がおすすめ', 'さくら歯科クリニック').mentioned,
    ).toBe(false);
  });
});

describe('intl-check clinic-name extraction', () => {
  it('extracts English clinic names from lists and prose, excluding the target', () => {
    const text = [
      'Here are some top-rated options in Sydney:',
      '1. **Harbour City Dental** – highly rated for implants.',
      '2. **Bright Smile Dental Clinic** – gentle with nervous patients.',
      "3. Dr. Smith's Family Dentistry – open Saturdays.",
      'Many dental clinics in Sydney offer free consultations, and Sydney Orthodontics is known for Invisalign.',
      'The best dental clinics usually list prices online.',
    ].join('\n');
    const names = extractClinicNames(text, 'Bright Smile Dental Clinic', 'en');
    expect(names).toContain('Harbour City Dental');
    expect(names).toContain('Sydney Orthodontics');
    expect(names.some((n) => n.includes('Smith'))).toBe(true);
    expect(names).not.toContain('Bright Smile Dental Clinic');
    expect(names.some((n) => /^(Many|The best)/i.test(n))).toBe(false);
    expect(names.some((n) => /^dental clinics$/i.test(n))).toBe(false);
  });

  it('extracts Japanese clinic names and cuts leading particles', () => {
    const text =
      '横浜なら田中歯科医院やさくら歯科クリニックがおすすめです。おすすめのみなと歯科も人気。さとう歯科は駅前にあります。小児歯科なら青葉デンタルクリニック。';
    const names = extractClinicNames(text, 'さくら歯科クリニック', 'ja');
    expect(names).toContain('田中歯科医院');
    expect(names).toContain('さとう歯科');
    expect(names).toContain('青葉デンタルクリニック');
    expect(names).not.toContain('さくら歯科クリニック');
    expect(names.some((n) => n.startsWith('横浜なら'))).toBe(false);
    expect(names.some((n) => n.startsWith('おすすめの'))).toBe(false);
    expect(names).not.toContain('小児歯科');
  });
});

describe('intl-check source domains', () => {
  it('collects unique domains from structured sources, urls and inline text', () => {
    const domains = extractDomains(
      [
        { url: 'https://www.yelp.com/biz/x', domain: 'yelp.com' },
        {
          url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc',
          title: 'healthgrades.com',
        },
        {
          url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/def',
          title: 'Some page title',
        },
      ],
      [
        'https://www.google.com/maps/place/x',
        'https://brightsmile.com.au/about',
      ],
      'See https://www.zocdoc.com/dentist/1 and yelp.com',
    );
    expect(domains).toEqual(
      expect.arrayContaining([
        'yelp.com',
        'healthgrades.com',
        'brightsmile.com.au',
        'zocdoc.com',
      ]),
    );
    expect(domains).not.toContain('vertexaisearch.cloud.google.com');
    expect(domains).not.toContain('google.com');
    expect(new Set(domains).size).toBe(domains.length);
  });
});

describe('intl-check aggregation', () => {
  it('computes rates per platform, top competitors/sources and findings', () => {
    const obs = (
      platform: 'CHATGPT' | 'GEMINI',
      ok: boolean,
      mentioned: boolean,
      competitors: string[] = [],
      domains: string[] = [],
    ) => ({
      platform,
      ok,
      mentioned,
      competitors,
      domains,
    });
    const result = aggregateResults({
      clinicName: 'Bright Smile Dental Clinic',
      city: 'Sydney',
      country: 'AU',
      language: 'en',
      specialty: 'dental',
      website: 'https://www.brightsmile.com.au',
      platformsUsed: ['CHATGPT', 'GEMINI'],
      platformsUnavailable: ['CLAUDE (ANTHROPIC_API_KEY 미설정)'],
      durationMs: 1234,
      questions: [
        {
          key: 'a',
          intent: 'RESERVATION',
          branded: false,
          text: 'q1',
          observations: [
            obs('CHATGPT', true, true, ['Harbour City Dental'], ['yelp.com']),
            obs(
              'GEMINI',
              true,
              false,
              ['Harbour City Dental'],
              ['healthgrades.com'],
            ),
          ],
        },
        {
          key: 'b',
          intent: 'REVIEW',
          branded: true,
          text: 'q2',
          observations: [
            obs('CHATGPT', true, false, ['Sydney Orthodontics'], ['yelp.com']),
            obs('GEMINI', false, false),
          ],
        },
      ],
    });
    expect(result.overall).toEqual({
      asked: 4,
      answered: 3,
      mentioned: 1,
      rate: 33.3,
    });
    expect(result.platforms.find((p) => p.platform === 'CHATGPT')?.rate).toBe(
      50,
    );
    expect(result.platforms.find((p) => p.platform === 'GEMINI')).toMatchObject(
      { answered: 1, mentioned: 0, rate: 0, failed: 1 },
    );
    expect(result.branded).toMatchObject({
      asked: 2,
      answered: 1,
      mentioned: 0,
      rate: 0,
    });
    expect(result.competitors[0]).toEqual({
      name: 'Harbour City Dental',
      count: 2,
    });
    expect(result.sources[0]).toEqual({ domain: 'yelp.com', count: 2 });
    expect(result.websiteCited).toBe(false);
    expect(result.findings.length).toBeGreaterThanOrEqual(3);
    expect(result.findings.length).toBeLessThanOrEqual(5);
    expect(result.findings.join(' ')).toContain('Harbour City Dental');
  });
});
