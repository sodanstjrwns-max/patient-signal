import {
  countryDisplayName,
  generateQuestions,
  normalizeSpecialty,
} from './question-generator';
import { EN_TEMPLATES } from './templates.en';
import { JA_TEMPLATES } from './templates.ja';

describe('intl-check question generation', () => {
  const base = {
    clinicName: 'Bright Smile Dental Clinic',
    city: 'Sydney',
    country: 'AU',
  };

  it('template sets have exactly 20 entries with unique keys and 3 branded templates', () => {
    for (const set of [EN_TEMPLATES, JA_TEMPLATES]) {
      expect(set).toHaveLength(20);
      expect(new Set(set.map((t) => t.key)).size).toBe(20);
      expect(set.filter((t) => t.branded).length).toBe(3);
      for (const t of set) {
        expect(!!t.branded).toBe(t.text.includes('{clinicName}'));
      }
    }
    // same intents / keys across languages
    expect(JA_TEMPLATES.map((t) => t.key)).toEqual(
      EN_TEMPLATES.map((t) => t.key),
    );
  });

  it('generates 20 English questions with placeholders filled', () => {
    const qs = generateQuestions({ ...base, language: 'en' });
    expect(qs).toHaveLength(20);
    expect(new Set(qs.map((q) => q.text)).size).toBe(20);
    for (const q of qs) {
      expect(q.text).not.toMatch(/\{\w+\}/);
      expect(q.text).toContain('Sydney');
      expect(q.branded).toBe(q.text.includes('Bright Smile Dental Clinic'));
    }
    expect(qs.filter((q) => q.branded)).toHaveLength(3);
    // dental is the default specialty
    expect(qs.some((q) => /dentist/i.test(q.text))).toBe(true);
    expect(qs.some((q) => /implant/i.test(q.text))).toBe(true);
    // country name spelled out
    expect(qs.find((q) => q.key === 'best_overall')?.text).toContain(
      'Australia',
    );
    // intents cover the Korean template families
    const intents = new Set(qs.map((q) => q.intent));
    expect(intents).toEqual(
      new Set(['RESERVATION', 'COMPARISON', 'INFORMATION', 'REVIEW', 'FEAR']),
    );
  });

  it('generates 20 Japanese questions', () => {
    const qs = generateQuestions({
      clinicName: 'さくら歯科クリニック',
      city: '横浜',
      country: 'JP',
      language: 'ja',
    });
    expect(qs).toHaveLength(20);
    for (const q of qs) {
      expect(q.text).not.toMatch(/\{\w+\}/);
      expect(q.text).toContain('横浜');
      expect(/[぀-ヿ㐀-䶿一-鿿]/.test(q.text)).toBe(true);
    }
    expect(
      qs.filter((q) => q.text.includes('さくら歯科クリニック')),
    ).toHaveLength(3);
    expect(qs.some((q) => q.text.includes('インプラント'))).toBe(true);
    expect(qs.find((q) => q.key === 'best_overall')?.text).toContain('日本');
  });

  it('honours specialty and falls back to general for unknown specialties', () => {
    expect(normalizeSpecialty('Plastic Surgery')).toBe('plastic_surgery');
    expect(normalizeSpecialty('veterinary')).toBe('general');
    expect(normalizeSpecialty(undefined)).toBe('dental');

    const derm = generateQuestions({
      ...base,
      language: 'en',
      specialty: 'dermatology',
    });
    expect(derm.some((q) => /dermatolog/i.test(q.text))).toBe(true);
    expect(derm.some((q) => /dentist/i.test(q.text))).toBe(false);
  });

  it('handles unknown country codes without dangling separators', () => {
    expect(countryDisplayName('UK', 'en')).toBe('the United Kingdom');
    expect(countryDisplayName('zz', 'en')).toBe('ZZ');
    const qs = generateQuestions({ ...base, country: 'ZZ', language: 'en' });
    for (const q of qs) {
      expect(q.text).not.toMatch(/,\s*[?.]/);
      expect(q.text).not.toMatch(/\s{2,}/);
    }
  });
});
