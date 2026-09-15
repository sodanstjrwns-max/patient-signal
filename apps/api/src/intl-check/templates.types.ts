/**
 * International AI Visibility Check — shared template types.
 */
export type IntlLanguage = 'en' | 'ja';

export type IntlIntent =
  | 'RESERVATION'
  | 'COMPARISON'
  | 'INFORMATION'
  | 'REVIEW'
  | 'FEAR';

export interface IntlQuestionTemplate {
  /** stable key, unique within a language */
  key: string;
  intent: IntlIntent;
  /** template text with {placeholders} */
  text: string;
  /** true when the template contains {clinicName} */
  branded?: boolean;
}

/** Specialty vocabulary used to fill template placeholders. */
export interface IntlSpecialtyVocab {
  practitioner: string;
  place: string;
  places: string;
  proc1: string;
  proc2: string;
  proc3: string;
  emergency: string;
  sedation: string;
  kids: string;
  tech: string;
}

export interface IntlQuestion {
  key: string;
  intent: IntlIntent;
  text: string;
  branded: boolean;
}

export const INTL_SPECIALTIES = [
  'dental',
  'dermatology',
  'orthopedics',
  'ophthalmology',
  'plastic_surgery',
  'general',
] as const;

export type IntlSpecialty = (typeof INTL_SPECIALTIES)[number];
