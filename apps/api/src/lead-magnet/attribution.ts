/** Campaign labels only: never persist arbitrary query parameters or email. */
export const EXTENDED_CONSENT = '2026-09-17';
export type Attribution = Record<string, string>;
export function sanitizeAttribution(value: unknown): Attribution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const out: Attribution = {};
  for (const key of [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
  ]) {
    const v = input[key];
    if (typeof v === 'string' && !/[@<>\r\n]/.test(v))
      out[key] = v.trim().slice(0, 100);
  }
  if (
    typeof input.referrer === 'string' &&
    /^[a-z0-9.-]{1,253}$/i.test(input.referrer)
  )
    out.referrer = input.referrer;
  if (
    typeof input.gaClientId === 'string' &&
    /^[\w.-]{4,64}$/.test(input.gaClientId)
  )
    out.gaClientId = input.gaClientId;
  return out;
}
export function sequenceLimit(consentVersion?: string | null): number {
  return consentVersion === EXTENDED_CONSENT ? 11 : 5;
}
export function taggedStoreLinks(
  text: string,
  language: string,
  step: number,
): string {
  return text.replace(
    /https:\/\/sodanstjrwns\.gumroad\.com\/l\/patientfunnel-(?:en|ja)(?:\/[^\s)]+)?/g,
    (href) => {
      const u = new URL(href);
      u.searchParams.set('utm_source', 'reader-sequence');
      u.searchParams.set('utm_medium', 'email');
      u.searchParams.set('utm_campaign', `patientfunnel-${language}`);
      u.searchParams.set(
        'utm_content',
        `day-${[0, 2, 4, 6, 8, 15, 29, 43, 57, 71, 85][step - 1]}`,
      );
      return u.toString();
    },
  );
}
