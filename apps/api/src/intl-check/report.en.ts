/**
 * International AI Visibility Check — English e-mail report.
 */
import type { IntlCheckResult } from './analysis';
import { renderReport, type ReportStrings } from './report.layout';

export const EN_SITE_URL = 'https://thepatientfunnel.com/en/';
export const EN_GUMROAD_URL =
  'https://sodanstjrwns.gumroad.com/l/patientfunnel-en';

export function subjectEn(clinicName: string): string {
  return `Your AI Visibility Check: ${clinicName}`;
}

const rateText = (r: IntlCheckResult) =>
  r.overall.rate === null ? 'n/a' : `${r.overall.rate}%`;

export const EN_STRINGS: ReportStrings = {
  lang: 'en',
  htmlLang: 'en',
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  preheader: (r) =>
    `${r.clinicName} appeared in ${rateText(r)} of AI answers about ${r.city}.`,
  title: 'Your AI Visibility Check',
  subtitle: (r) =>
    `${r.clinicName} · ${r.city}${r.country ? `, ${r.country}` : ''} · ${r.questions.length} patient questions × ${r.platformsUsed.length} AI platforms`,
  scoreLabel: 'AI appearance rate',
  scoreCaption: (r) =>
    `AI mentioned ${r.clinicName} in ${r.overall.mentioned} of ${r.overall.answered} answers`,
  noAnswers: 'No answers were received from the AI platforms this time.',
  platformsHeading: 'By platform',
  platformCols: {
    platform: 'Platform',
    asked: 'Asked',
    answered: 'Answered',
    mentioned: 'Mentioned',
    rate: 'Rate',
  },
  brandedHeading: 'Branded questions (★, your clinic named in the question):',
  brandedLine: (r) =>
    r.branded.answered === 0
      ? 'no answers received.'
      : `mentioned in ${r.branded.mentioned} of ${r.branded.answered} (${r.branded.rate}%). Unbranded questions: ${r.unbranded.mentioned} of ${r.unbranded.answered} (${r.unbranded.rate ?? 'n/a'}%).`,
  competitorsHeading: 'Clinics AI recommended instead (top 10)',
  competitorsEmpty: 'AI did not name specific clinics in its answers.',
  countUnit: ' mentions',
  sourcesHeading: 'Sources AI relied on (top 10 domains)',
  sourcesEmpty: 'AI did not cite sources for these answers.',
  websiteCited: 'Your website was cited at least once — good.',
  websiteNotCited: 'Your website was never cited by AI in these answers.',
  findingsHeading: 'What this means',
  questionsHeading: 'All 20 questions',
  questionsNote:
    '✓ mentioned · ✗ not mentioned · – no answer. ★ = your clinic was named in the question.',
  ctaHeading: 'Track this every week',
  ctaBody:
    'This was a one-time snapshot. AI answers change weekly as reviews, listings and competitors change. Weekly automatic tracking is coming ($99/mo): the same 20 questions, every platform, with alerts when you gain or lose a mention.',
  ctaReply: 'Reply YES to this email to join the waitlist.',
  siteLinkLabel: 'thepatientfunnel.com/en — how clinics get recommended by AI',
  siteUrl: EN_SITE_URL,
  gumroadLinkLabel: 'The Patient Funnel playbook (English edition)',
  gumroadUrl: EN_GUMROAD_URL,
  auditHeading: 'Before the book: score your own practice',
  auditBody:
    'This report covers stage one, Awareness. The free audit covers all ten: thirty yes-or-no lines about your practice, scored out of thirty, so you finish knowing which stage is leaking. It comes with two of the ten stages in full. No cost.',
  auditButton: 'Get the free audit',
  auditUrl: 'https://thepatientfunnel.com/en/preview/',
  signatureIntro: 'Questions? Just reply to this email.',
  signatureName: 'Suokjoon Moon',
  signatureRole: 'The Patient Funnel · Patient Signal',
  footer:
    'You received this report because you requested an AI Visibility Check at thepatientfunnel.com. This is a one-time email; we will not send anything else unless you reply.',
  mentionedMark: '✓',
  notMentionedMark: '✗',
  failedMark: '–',
};

export function renderReportEn(result: IntlCheckResult): string {
  return renderReport(result, EN_STRINGS);
}
