/**
 * International AI Visibility Check — text analysis helpers.
 *
 * Pure functions (no Nest / DB):
 *  - detectMention:        clinic-name mention detection (EN / JA)
 *  - extractClinicNames:   other clinic names mentioned in a response
 *  - extractDomains:       cited source domains from an AI query result
 *
 * The Korean crawler's matcher / competitor extractor are tuned to Korean
 * suffixes (치과/병원/의원 …) and cannot be reused for Latin or Japanese text.
 */

export interface MentionResult {
  mentioned: boolean;
  /** how the match was made */
  matchedBy: 'full' | 'partial' | null;
  /** the (normalized) text that matched */
  matchedText: string | null;
  /** number of full-name occurrences (0 when only a partial match) */
  count: number;
}

const CJK_RE = /[぀-ヿ㐀-䶿一-鿿]/;

/** lower-case, unicode-normalized, punctuation → space, collapsed */
export function normalizeSpaced(text: string): string {
  return (text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** lower-case, unicode-normalized, everything but letters/digits removed */
export function normalizeCompact(text: string): string {
  return (text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Structural words ignored when building the partial-match n-grams (EN).
 * Deliberately narrow: brand-ish words such as "smile", "family", "bright"
 * stay distinctive so "Bright Smile" still matches "Bright Smile Dental Clinic".
 */
const EN_STRUCTURAL_TOKENS = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'at',
  'in',
  'on',
  'for',
  'by',
  'to',
  '&',
  'dental',
  'dentistry',
  'dentist',
  'dentists',
  'dentalcare',
  'clinic',
  'clinics',
  'center',
  'centre',
  'group',
  'practice',
  'associates',
  'office',
  'studio',
  'care',
  'health',
  'healthcare',
  'medical',
  'hospital',
  'surgery',
  'dr',
  'doctor',
  'doctors',
  'md',
  'dds',
  'dmd',
  'ltd',
  'llc',
  'inc',
  'pc',
  'pllc',
  'orthodontics',
  'dermatology',
  'ophthalmology',
  'orthopedics',
  'orthopaedics',
]);

/** Generic words that do not identify a clinic on their own (EN, extraction filter). */
const EN_GENERIC_TOKENS = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'at',
  'in',
  'on',
  'for',
  'by',
  'to',
  '&',
  'dental',
  'dentistry',
  'dentist',
  'dentists',
  'dentalcare',
  'clinic',
  'clinics',
  'center',
  'centre',
  'group',
  'practice',
  'associates',
  'office',
  'studio',
  'care',
  'health',
  'healthcare',
  'medical',
  'hospital',
  'family',
  'cosmetic',
  'general',
  'pediatric',
  'paediatric',
  'orthodontics',
  'orthodontic',
  'implant',
  'implants',
  'smile',
  'smiles',
  'oral',
  'surgery',
  'surgeons',
  'dr',
  'doctor',
  'doctors',
  'md',
  'dds',
  'dmd',
  'ltd',
  'llc',
  'inc',
  'pc',
  'pllc',
  'dermatology',
  'skin',
  'eye',
  'vision',
  'orthopedic',
  'orthopaedic',
  'plastic',
  'aesthetic',
  'aesthetics',
  'wellness',
  'spa',
]);

/** Generic suffixes that do not identify a clinic on their own (JA). */
const JA_GENERIC_SUFFIXES = [
  '歯科医院',
  '歯科クリニック',
  'デンタルクリニック',
  'デンタルオフィス',
  'デンタル',
  '矯正歯科',
  '小児歯科',
  '審美歯科',
  '歯科',
  'クリニック',
  '医院',
  '病院',
  '皮膚科',
  '眼科',
  '整形外科',
  '美容外科',
  '美容皮膚科',
  '内科',
  '外科',
  '診療所',
  'メディカル',
  'オフィス',
];

function stripJaGenericSuffixes(name: string): string {
  let core = name;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of JA_GENERIC_SUFFIXES) {
      if (core.length > suf.length && core.endsWith(suf)) {
        core = core.slice(0, -suf.length);
        changed = true;
      }
    }
  }
  return core.replace(/[\s・･·]+$/g, '');
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect whether `clinicName` is mentioned in `response`.
 *
 * Rules:
 *  1. Case- and punctuation-insensitive full-name match (spaces ignored, so
 *     "Bright-Smile Dental" also matches "BrightSmile Dental").
 *  2. Partial match: a run of >= 2 consecutive *distinctive* tokens of the
 *     clinic name (generic words such as "dental", "clinic", "the" excluded)
 *     appearing as whole words in the response — e.g. "Bright Smile" for
 *     "Bright Smile Dental Clinic".
 *  3. Japanese names: the name with generic suffixes stripped
 *     ("さくら歯科クリニック" → "さくら") followed by any generic suffix, or the
 *     bare core when it is >= 3 characters.
 */
export function detectMention(
  response: string,
  clinicName: string,
): MentionResult {
  const none: MentionResult = {
    mentioned: false,
    matchedBy: null,
    matchedText: null,
    count: 0,
  };
  if (!response || !clinicName) return none;

  const compactResp = normalizeCompact(response);
  const compactName = normalizeCompact(clinicName);
  if (compactName.length >= 3) {
    const count = countOccurrences(compactResp, compactName);
    if (count > 0) {
      return {
        mentioned: true,
        matchedBy: 'full',
        matchedText: compactName,
        count,
      };
    }
  }

  if (CJK_RE.test(clinicName)) {
    const core = normalizeCompact(
      stripJaGenericSuffixes(clinicName.normalize('NFKC').trim()),
    );
    if (core.length >= 2 && core !== compactName) {
      for (const suf of JA_GENERIC_SUFFIXES) {
        const candidate = core + normalizeCompact(suf);
        if (compactResp.includes(candidate)) {
          return {
            mentioned: true,
            matchedBy: 'partial',
            matchedText: candidate,
            count: 0,
          };
        }
      }
      if (core.length >= 3 && compactResp.includes(core)) {
        return {
          mentioned: true,
          matchedBy: 'partial',
          matchedText: core,
          count: 0,
        };
      }
    }
    return none;
  }

  // Latin: consecutive distinctive-token n-grams (n >= 2), whole-word match
  const spacedResp = ` ${normalizeSpaced(response)} `;
  const tokens = normalizeSpaced(clinicName)
    .split(' ')
    .filter((t) => t.length >= 2 && !EN_STRUCTURAL_TOKENS.has(t));
  if (tokens.length < 2) return none;

  for (let n = tokens.length; n >= 2; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const gram = tokens.slice(i, i + n).join(' ');
      const re = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegex(gram)}(?![\\p{L}\\p{N}])`,
        'u',
      );
      if (re.test(spacedResp)) {
        return {
          mentioned: true,
          matchedBy: 'partial',
          matchedText: gram,
          count: 0,
        };
      }
    }
  }
  return none;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clinic-name extraction (competitors)
// ─────────────────────────────────────────────────────────────────────────────

const EN_SUFFIX =
  '(?:Dental(?:\\s+(?:Care|Clinic|Group|Center|Centre|Studio|Associates|Practice|Arts|Office|Spa|Health|Surgery|Works|Hub|House|Lounge|Partners))?' +
  '|Dentistry|Dentists?|Orthodontics|Orthodontists?|Smiles?|Oral\\s+(?:Surgery|Health|Care)' +
  '|Periodontics|Endodontics|Prosthodontics|Clinic|Medical\\s+(?:Center|Centre|Group|Clinic)' +
  '|Hospital|Dermatology|Skin\\s+(?:Clinic|Centre|Center|Institute|Care)' +
  '|Eye\\s+(?:Center|Centre|Care|Clinic|Institute|Surgeons?)|Vision(?:\\s+(?:Center|Centre|Care|Clinic))?' +
  '|Orthopedics|Orthopaedics|Plastic\\s+Surgery|Aesthetics|Health(?:\\s+(?:Centre|Center|Clinic))?)';

// 1–5 capitalised words (optionally joined by of/and/&/the/for) followed by a suffix
const EN_NAME_RE = new RegExp(
  `\\b((?:[A-Z][\\w'’&.\\-]*(?:\\s+(?:of|and|&|the|for))?\\s+){1,5}${EN_SUFFIX})(?![\\w'’])`,
  'g',
);

const EN_LEADIN_WORDS = new Set([
  'the',
  'a',
  'an',
  'best',
  'top',
  'many',
  'some',
  'several',
  'local',
  'other',
  'another',
  'popular',
  'reputable',
  'trusted',
  'leading',
  'highly',
  'rated',
  'emergency',
  'pediatric',
  'paediatric',
  'cosmetic',
  'family',
  'general',
  'affordable',
  'modern',
  'nearby',
  'good',
  'great',
  'recommended',
  'choose',
  'consider',
  'visit',
  'try',
  'contact',
  'check',
  'look',
  'search',
  'most',
  'your',
  'our',
  'at',
  'in',
  'on',
  'for',
  'with',
  'also',
  'however',
  'additionally',
  'finally',
  'overall',
  'note',
  'since',
  'while',
  'if',
  'although',
  'whether',
  'both',
  'each',
  'every',
  'any',
  'all',
  'these',
  'those',
  'this',
  'that',
  'here',
  'there',
  'private',
  'nhs',
  'public',
  'new',
  'independent',
  'well',
  'known',
  'established',
  'experienced',
  'award',
  'winning',
  'friendly',
  'gentle',
  'reliable',
  'compare',
  'comparing',
  'like',
  'such',
  'as',
  'including',
  'include',
  'includes',
  'e',
  'g',
  'eg',
  'ie',
  'sedation',
  'implant',
  'implants',
  'invisalign',
  'orthodontic',
  'children',
  'kids',
  'urgent',
  'same',
  'day',
  'walk',
  'weekend',
  'saturday',
  'evening',
  'late',
  'holistic',
  'boutique',
  'premium',
  'luxury',
  'budget',
  'cheap',
  'low',
  'cost',
  'high',
  'quality',
  'many',
  'more',
  'few',
  'multiple',
  'various',
  'numerous',
  'certain',
  'specific',
]);

function cleanEnCandidate(raw: string): string | null {
  let words = raw.replace(/\s+/g, ' ').trim().split(' ');
  // strip lead-in words from the front
  while (
    words.length > 0 &&
    EN_LEADIN_WORDS.has(words[0].toLowerCase().replace(/[^a-z]/g, ''))
  ) {
    words = words.slice(1);
  }
  if (words.length < 2 || words.length > 7) return null;
  const name = words.join(' ').replace(/[.,;:]+$/g, '');
  // must have at least one distinctive token
  const distinctive = normalizeSpaced(name)
    .split(' ')
    .filter(
      (t) =>
        t.length >= 2 && !EN_GENERIC_TOKENS.has(t) && !EN_LEADIN_WORDS.has(t),
    );
  if (distinctive.length === 0) return null;
  if (name.length > 60) return null;
  return name;
}

const JA_SUFFIX_ALT =
  '(?:歯科医院|歯科クリニック|デンタルクリニック|デンタルオフィス|矯正歯科|小児歯科|審美歯科|歯科|クリニック|医院|病院|皮膚科|眼科|整形外科|美容外科|美容皮膚科|内科)';
const JA_NAME_RE = new RegExp(
  `([一-龠々〆ぁ-んァ-ヶーa-zA-Z0-9・＆&]{1,25}?${JA_SUFFIX_ALT})`,
  'g',
);
// delimiters always end a preceding phrase; particles only when the character
// on either side is not hiragana (so "さとう歯科" / "もみじ歯科" stay intact but
// "おすすめの田中歯科" and "東京なら田中歯科" are cut before the name).
const JA_DELIM_RE = /[、。，．「」『』（）()【】・:：\s]/g;
// Longer forms first so 「として千賀デンタルクリニック」 cuts at として, not at と.
const JA_PARTICLE_RE =
  /(?:としては|としても|として|といった|という|ならば|なら|からは|から|までは|まで|よりも|より|では|には|とは|でも|にも|の|は|が|で|を|に|と|や|へ|も)/g;
const HIRAGANA_RE = /[ぁ-ん]/;
const JA_GENERIC_CORE_TAIL_RE = /(?:向け|専門|対応|可能|希望|系|的|など|等)$/;
/**
 * Descriptive phrases the suffix regex swallows as if they were names:
 * 「具体的な医院」(a specific clinic), 「対応している歯科医院」(clinics that offer …),
 * 「紹介できる医院」. A real clinic name never ends in a verb or na-adjective tail.
 */
const JA_DESCRIPTIVE_CORE_TAIL_RE =
  /(?:な|している| している|ている|してる|する|できる|された|された|した|しない|られる|くれる|ある|多い|近い)$/;
/**
 * Words that turn a suffix match into part of a larger institution name:
 * 「日本歯科」 inside 「日本歯科医師会」 or 「日本歯科大学」 is not a clinic.
 */
const JA_INSTITUTION_FOLLOWERS = [
  '医師会',
  '大学',
  '学会',
  '学校',
  '協会',
  '連盟',
  '衛生士',
  '技工士',
  '助手',
  '学院',
  '専門学校',
];

// modifiers that precede a name with の ("おすすめの田中歯科", "近くのみなと歯科")
const JA_LEADIN_BEFORE_NO_RE =
  /(?:おすすめ|お勧め|オススメ|近く|近所|人気|評判|有名|地元|駅前|市内|周辺|最寄り|老舗|大手|信頼できる|安い|良い|よい|いい|新しい|話題|定評|実績|口コミ|高評価|評価の高い|質の高い|腕の良い|腕のいい)の$/;

function jaCutIndex(core: string): number {
  let cut = 0;
  for (const m of core.matchAll(/の/g)) {
    const i = m.index ?? 0;
    if (JA_LEADIN_BEFORE_NO_RE.test(core.slice(0, i + 1)))
      cut = Math.max(cut, i + 1);
  }
  for (const m of core.matchAll(JA_DELIM_RE))
    cut = Math.max(cut, (m.index ?? 0) + m[0].length);
  for (const m of core.matchAll(JA_PARTICLE_RE)) {
    const i = m.index ?? 0;
    const before = core[i - 1];
    const after = core[i + m[0].length];
    const qualifies =
      (before && !HIRAGANA_RE.test(before)) ||
      (after && !HIRAGANA_RE.test(after));
    if (qualifies) cut = Math.max(cut, i + m[0].length);
  }
  return cut;
}
const JA_GENERIC_CORES = new Set([
  '小児',
  '矯正',
  '審美',
  'インプラント',
  '一般',
  '地域',
  '近く',
  '駅前',
  '大手',
  '各',
  '他',
  '他の',
  '多く',
  '複数',
  'ほとんど',
  'これら',
  'その',
  'この',
  '有名',
  '人気',
  'おすすめ',
  '評判',
  '最寄り',
  '近所',
  '大学',
  '総合',
  '市立',
  '県立',
  '都立',
  '国立',
  '公立',
  '私立',
  '救急',
  '夜間',
  '休日',
  'デンタル',
  'メディカル',
  '専門',
  '名医',
  '良い',
  'よい',
  'いい',
  '安い',
  '高い',
]);

function cleanJaCandidate(raw: string): string | null {
  const m = raw.match(new RegExp(`^(.*?)(${JA_SUFFIX_ALT})$`));
  if (!m) return null;
  let core = m[1];
  const suffix = m[2];
  // cut at the last delimiter / qualifying particle
  core = core
    .slice(jaCutIndex(core))
    .replace(/^[・･·\s]+/, '')
    .trim();
  if (!core) return null;
  // hiragana-only remnants of 1–2 chars are particles/adjective tails, not names
  if (/^[ぁ-ん]{1,2}$/.test(core)) return null;
  if (JA_GENERIC_CORES.has(core)) return null;
  if (JA_GENERIC_CORE_TAIL_RE.test(core)) return null;
  if (JA_DESCRIPTIVE_CORE_TAIL_RE.test(core)) return null;
  const name = `${core}${suffix}`;
  if (name.length > 30) return null;
  return name;
}

/**
 * Extract clinic names mentioned in a response, excluding the target clinic.
 * Returns unique names in first-seen order, capped at `max`.
 */
export function extractClinicNames(
  response: string,
  targetClinicName: string,
  language: 'en' | 'ja',
  max = 30,
): string[] {
  if (!response) return [];
  const text = response.normalize('NFKC');
  const seen = new Map<string, string>();

  const push = (name: string | null) => {
    if (!name) return;
    if (detectMention(name, targetClinicName).mentioned) return; // it's us
    if (targetClinicName && detectMention(targetClinicName, name).mentioned)
      return; // we contain it
    const key = normalizeCompact(name);
    if (!key || seen.has(key)) return;
    seen.set(key, name);
  };

  if (language === 'ja' || CJK_RE.test(text)) {
    for (const m of text.matchAll(JA_NAME_RE)) {
      const after = text.slice(
        (m.index ?? 0) + m[0].length,
        (m.index ?? 0) + m[0].length + 6,
      );
      if (JA_INSTITUTION_FOLLOWERS.some((w) => after.startsWith(w))) continue;
      push(cleanJaCandidate(m[1]));
    }
  }
  if (language === 'en' || !CJK_RE.test(text)) {
    for (const m of text.matchAll(EN_NAME_RE)) push(cleanEnCandidate(m[1]));
  }
  return [...seen.values()].slice(0, max);
}

// ─────────────────────────────────────────────────────────────────────────────
// Source domains
// ─────────────────────────────────────────────────────────────────────────────

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Domains that are the AI platforms' own redirect/wrapper hosts, not sources. */
const NON_SOURCE_DOMAINS = new Set([
  'vertexaisearch.cloud.google.com',
  'google.com',
  'chatgpt.com',
  'openai.com',
  'perplexity.ai',
  'anthropic.com',
  'claude.ai',
]);

export interface SourceLike {
  url?: string;
  domain?: string;
  title?: string;
}

/**
 * Collect unique source domains from structured sources + raw URLs + inline
 * URLs in the response text. Gemini grounding URLs are opaque redirects on
 * vertexaisearch.cloud.google.com whose `title` is the real domain — handled.
 */
export function extractDomains(
  sources: SourceLike[] | undefined,
  citedUrls: string[] | undefined,
  responseText: string | undefined,
): string[] {
  const out = new Set<string>();
  const add = (d: string) => {
    const dom = (d || '')
      .trim()
      .toLowerCase()
      .replace(/^www\./, '');
    if (dom && dom.includes('.') && !NON_SOURCE_DOMAINS.has(dom)) out.add(dom);
  };
  for (const s of sources || []) {
    let dom = s.domain || (s.url ? extractDomain(s.url) : '');
    if (
      dom === 'vertexaisearch.cloud.google.com' &&
      s.title &&
      /^[\w.-]+\.[a-z]{2,}$/i.test(s.title.trim())
    ) {
      dom = s.title.trim();
    }
    add(dom);
  }
  for (const u of citedUrls || []) add(extractDomain(u));
  const inline = (responseText || '').match(/https?:\/\/[^\s)\]>"']+/g) || [];
  for (const u of inline) add(extractDomain(u));
  return [...out];
}
