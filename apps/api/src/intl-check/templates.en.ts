/**
 * International AI Visibility Check — English question templates.
 *
 * Modeled on the Korean query-template intents (query-templates.service.ts):
 *   RESERVATION (recommend / near me / book), COMPARISON (top 3, price comparison),
 *   INFORMATION (price, consultation, how to choose), REVIEW (trust, ratings),
 *   FEAR (anxious patient, sedation, gentle).
 * Exactly 20 templates. 3 are "branded" (contain {clinicName}).
 *
 * Placeholders: {city} {country} {clinicName} {practitioner} {place} {places}
 *               {proc1} {proc2} {proc3} {emergency} {sedation} {kids} {tech}
 */
import type {
  IntlQuestionTemplate,
  IntlSpecialtyVocab,
} from './templates.types';

export const EN_SPECIALTY_VOCAB: Record<string, IntlSpecialtyVocab> = {
  dental: {
    practitioner: 'dentist',
    place: 'dental clinic',
    places: 'dental clinics',
    proc1: 'dental implants',
    proc2: 'Invisalign or braces',
    proc3: 'a root canal',
    emergency: 'emergency dentist',
    sedation: 'sedation dentistry',
    kids: 'pediatric dentist',
    tech: '3D scanning or same-day crowns',
  },
  dermatology: {
    practitioner: 'dermatologist',
    place: 'dermatology clinic',
    places: 'dermatology clinics',
    proc1: 'acne scar treatment',
    proc2: 'Botox or fillers',
    proc3: 'laser skin treatment',
    emergency: 'same-day dermatologist',
    sedation: 'gentle, low-pain treatment',
    kids: 'pediatric dermatologist',
    tech: 'the latest laser devices',
  },
  orthopedics: {
    practitioner: 'orthopedic doctor',
    place: 'orthopedic clinic',
    places: 'orthopedic clinics',
    proc1: 'knee replacement',
    proc2: 'spine or back pain treatment',
    proc3: 'shoulder surgery',
    emergency: 'urgent orthopedic care',
    sedation: 'minimally invasive treatment',
    kids: 'pediatric orthopedic specialist',
    tech: 'robotic-assisted surgery',
  },
  ophthalmology: {
    practitioner: 'eye doctor',
    place: 'eye clinic',
    places: 'eye clinics',
    proc1: 'LASIK',
    proc2: 'cataract surgery',
    proc3: 'eye surgery',
    emergency: 'emergency eye care',
    sedation: 'comfortable, low-anxiety procedures',
    kids: 'pediatric ophthalmologist',
    tech: 'the newest laser platforms',
  },
  plastic_surgery: {
    practitioner: 'plastic surgeon',
    place: 'cosmetic surgery clinic',
    places: 'cosmetic surgery clinics',
    proc1: 'rhinoplasty',
    proc2: 'a facelift or eyelid surgery',
    proc3: 'liposuction',
    emergency: 'revision surgery consultation',
    sedation: 'safe anesthesia and monitoring',
    kids: 'plastic surgeon for teenagers',
    tech: '3D simulation imaging',
  },
  general: {
    practitioner: 'doctor',
    place: 'medical clinic',
    places: 'medical clinics',
    proc1: 'a full health checkup',
    proc2: 'chronic condition management',
    proc3: 'a minor procedure',
    emergency: 'urgent care clinic',
    sedation: 'a calm, patient-friendly experience',
    kids: 'family doctor for children',
    tech: 'online booking and modern equipment',
  },
};

export const EN_COUNTRY_NAMES: Record<string, string> = {
  US: 'the United States',
  UK: 'the United Kingdom',
  GB: 'the United Kingdom',
  AU: 'Australia',
  CA: 'Canada',
  JP: 'Japan',
  NZ: 'New Zealand',
  SG: 'Singapore',
  IE: 'Ireland',
  DE: 'Germany',
  FR: 'France',
  KR: 'South Korea',
};

export const EN_TEMPLATES: IntlQuestionTemplate[] = [
  // ── RESERVATION (recommend / near me / book) ──
  {
    key: 'recommend_near',
    intent: 'RESERVATION',
    text: 'Can you recommend a good {practitioner} in {city}?',
  },
  {
    key: 'best_for_proc1',
    intent: 'RESERVATION',
    text: 'What is the best {place} for {proc1} in {city}?',
  },
  {
    key: 'best_for_proc2',
    intent: 'RESERVATION',
    text: 'Who are the top-rated providers for {proc2} in {city}?',
  },
  {
    key: 'emergency',
    intent: 'RESERVATION',
    text: 'I need an {emergency} in {city} today. Where should I go?',
  },
  {
    key: 'kids',
    intent: 'RESERVATION',
    text: 'What is the best {kids} in {city} for a nervous 6-year-old?',
  },
  {
    key: 'new_patients',
    intent: 'RESERVATION',
    text: 'Which {places} in {city} are accepting new patients and can book me within a week?',
  },
  {
    key: 'weekend',
    intent: 'RESERVATION',
    text: 'Which {places} in {city} are open on Saturdays or in the evening?',
  },

  // ── COMPARISON (top N, price / feature comparison) ──
  {
    key: 'best_overall',
    intent: 'COMPARISON',
    text: 'What are the best {places} in {city}, {country}?',
  },
  {
    key: 'top3_compare',
    intent: 'COMPARISON',
    text: 'Compare the top 3 {places} in {city} — pros and cons of each.',
  },
  {
    key: 'modern_tech',
    intent: 'COMPARISON',
    text: 'Which {place} in {city} has the most modern technology, such as {tech}?',
  },

  // ── INFORMATION (price, consultation, how to choose) ──
  {
    key: 'price',
    intent: 'INFORMATION',
    text: 'How much does {proc1} cost in {city}, and which clinics are reasonably priced?',
  },
  {
    key: 'consultation',
    intent: 'INFORMATION',
    text: 'Where can I get a free or low-cost consultation for {proc2} in {city}?',
  },
  {
    key: 'how_to_choose',
    intent: 'INFORMATION',
    text: 'How should I choose a {practitioner} in {city}? Please give specific recommendations.',
  },

  // ── REVIEW (trust, ratings) ──
  {
    key: 'trustworthy',
    intent: 'REVIEW',
    text: 'Which {practitioner}s in {city} are the most trustworthy, based on patient reviews?',
  },
  {
    key: 'google_ratings',
    intent: 'REVIEW',
    text: 'Which {places} in {city} have the highest Google ratings?',
  },

  // ── FEAR (anxious patient, gentle, sedation) ──
  {
    key: 'sedation',
    intent: 'FEAR',
    text: 'Which {place} in {city} offers {sedation} for anxious patients?',
  },
  {
    key: 'gentle',
    intent: 'FEAR',
    text: "I'm scared of {proc3}. Which {practitioner} in {city} is gentle and experienced?",
  },

  // ── Branded (clinic name in the question) ──
  {
    key: 'branded_good',
    intent: 'REVIEW',
    branded: true,
    text: 'Is {clinicName} in {city} a good {place}? What do patients say about it?',
  },
  {
    key: 'branded_should_i_go',
    intent: 'COMPARISON',
    branded: true,
    text: 'Should I go to {clinicName} for {proc1}, or is there a better option in {city}?',
  },
  {
    key: 'branded_reviews',
    intent: 'REVIEW',
    branded: true,
    text: 'What are the reviews like for {clinicName} in {city}?',
  },
];
