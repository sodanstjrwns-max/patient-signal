/**
 * International AI Visibility Check — question generation.
 *
 * Pure function (no Nest / DB): builds exactly 20 questions in the requested
 * language for a clinic, filling the language-specific templates with the
 * specialty vocabulary. 3 questions are "branded" (contain the clinic name).
 */
import {
  EN_COUNTRY_NAMES,
  EN_SPECIALTY_VOCAB,
  EN_TEMPLATES,
} from './templates.en';
import {
  JA_COUNTRY_NAMES,
  JA_SPECIALTY_VOCAB,
  JA_TEMPLATES,
} from './templates.ja';
import type {
  IntlLanguage,
  IntlQuestion,
  IntlQuestionTemplate,
  IntlSpecialtyVocab,
} from './templates.types';

export interface QuestionGenInput {
  clinicName: string;
  city: string;
  country: string;
  language: IntlLanguage;
  specialty?: string;
}

const LANG_PACK: Record<
  IntlLanguage,
  {
    templates: IntlQuestionTemplate[];
    vocab: Record<string, IntlSpecialtyVocab>;
    countries: Record<string, string>;
  }
> = {
  en: {
    templates: EN_TEMPLATES,
    vocab: EN_SPECIALTY_VOCAB,
    countries: EN_COUNTRY_NAMES,
  },
  ja: {
    templates: JA_TEMPLATES,
    vocab: JA_SPECIALTY_VOCAB,
    countries: JA_COUNTRY_NAMES,
  },
};

export function normalizeSpecialty(specialty?: string): string {
  const s = (specialty || 'dental')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (s in EN_SPECIALTY_VOCAB) return s;
  return 'general';
}

export function countryDisplayName(
  country: string,
  language: IntlLanguage,
): string {
  const code = (country || '').trim().toUpperCase();
  return LANG_PACK[language].countries[code] || code || '';
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in values ? values[key] : m,
  );
}

export function generateQuestions(input: QuestionGenInput): IntlQuestion[] {
  const language: IntlLanguage = input.language === 'ja' ? 'ja' : 'en';
  const pack = LANG_PACK[language];
  const specialty = normalizeSpecialty(input.specialty);
  const vocab = pack.vocab[specialty] || pack.vocab.general;
  const city = input.city.trim();
  const clinicName = input.clinicName.trim();
  const countryName = countryDisplayName(input.country, language);

  const values: Record<string, string> = {
    ...vocab,
    city,
    clinicName,
    // If the country is unknown, avoid a dangling ", " in English templates.
    country: countryName || city,
  };

  return pack.templates.map((t) => ({
    key: t.key,
    intent: t.intent,
    branded: !!t.branded,
    text: fill(t.text, values)
      .replace(/\s{2,}/g, ' ')
      .trim(),
  }));
}
