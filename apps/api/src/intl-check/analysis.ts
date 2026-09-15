/**
 * International AI Visibility Check — aggregation + plain-language findings.
 * Pure functions (no Nest / DB).
 */
import type { IntlIntent, IntlLanguage } from './templates.types';

export type IntlPlatform = 'CHATGPT' | 'CLAUDE' | 'PERPLEXITY' | 'GEMINI';

export const INTL_PLATFORMS: IntlPlatform[] = [
  'CHATGPT',
  'GEMINI',
  'PERPLEXITY',
  'CLAUDE',
];

export const PLATFORM_LABELS: Record<IntlPlatform, string> = {
  CHATGPT: 'ChatGPT',
  GEMINI: 'Gemini',
  PERPLEXITY: 'Perplexity',
  CLAUDE: 'Claude',
};

/** One (question × platform) observation */
export interface IntlObservation {
  platform: IntlPlatform;
  /** true when the provider returned an answer */
  ok: boolean;
  /** 'skipped' when the run deadline was hit before the call started */
  error?: string;
  mentioned: boolean;
  matchedBy?: 'full' | 'partial' | null;
  isWebSearch?: boolean;
  model?: string;
  competitors: string[];
  domains: string[];
  /** first ~300 chars of the answer, for the report */
  excerpt?: string;
}

export interface IntlQuestionResult {
  key: string;
  intent: IntlIntent;
  branded: boolean;
  text: string;
  observations: IntlObservation[];
}

export interface IntlPlatformStat {
  platform: IntlPlatform;
  label: string;
  asked: number;
  answered: number;
  mentioned: number;
  /** mentioned / answered, 0–100 (null when nothing answered) */
  rate: number | null;
  failed: number;
}

export interface IntlCheckResult {
  version: 1;
  clinicName: string;
  city: string;
  country: string;
  language: IntlLanguage;
  specialty: string;
  website?: string | null;
  generatedAt: string;
  durationMs: number;
  platformsUsed: IntlPlatform[];
  platformsUnavailable: string[];
  overall: {
    asked: number;
    answered: number;
    mentioned: number;
    rate: number | null;
  };
  branded: {
    asked: number;
    answered: number;
    mentioned: number;
    rate: number | null;
  };
  unbranded: {
    asked: number;
    answered: number;
    mentioned: number;
    rate: number | null;
  };
  platforms: IntlPlatformStat[];
  competitors: Array<{ name: string; count: number }>;
  sources: Array<{ domain: string; count: number }>;
  websiteCited: boolean;
  findings: string[];
  questions: IntlQuestionResult[];
}

function pct(mentioned: number, answered: number): number | null {
  if (answered <= 0) return null;
  return Math.round((mentioned / answered) * 1000) / 10;
}

function tally(obs: IntlObservation[]) {
  const answered = obs.filter((o) => o.ok);
  const mentioned = answered.filter((o) => o.mentioned);
  return {
    asked: obs.length,
    answered: answered.length,
    mentioned: mentioned.length,
    rate: pct(mentioned.length, answered.length),
  };
}

function topCounts(
  values: string[],
  max: number,
): Array<{ name: string; count: number }> {
  const counts = new Map<string, { name: string; count: number }>();
  for (const v of values) {
    const key = v.toLowerCase();
    const cur = counts.get(key);
    if (cur) cur.count++;
    else counts.set(key, { name: v, count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, max);
}

export interface AggregateInput {
  clinicName: string;
  city: string;
  country: string;
  language: IntlLanguage;
  specialty: string;
  website?: string | null;
  platformsUsed: IntlPlatform[];
  platformsUnavailable: string[];
  questions: IntlQuestionResult[];
  durationMs: number;
}

export function aggregateResults(input: AggregateInput): IntlCheckResult {
  const all = input.questions.flatMap((q) => q.observations);
  const brandedObs = input.questions
    .filter((q) => q.branded)
    .flatMap((q) => q.observations);
  const unbrandedObs = input.questions
    .filter((q) => !q.branded)
    .flatMap((q) => q.observations);

  const platforms: IntlPlatformStat[] = input.platformsUsed.map((p) => {
    const obs = all.filter((o) => o.platform === p);
    const t = tally(obs);
    return {
      platform: p,
      label: PLATFORM_LABELS[p],
      ...t,
      failed: obs.filter((o) => !o.ok).length,
    };
  });

  // competitors: count per distinct (question × platform) observation
  const competitorMentions = all
    .filter((o) => o.ok)
    .flatMap((o) => [...new Set(o.competitors)]);
  const sourceMentions = all
    .filter((o) => o.ok)
    .flatMap((o) => [...new Set(o.domains)]);

  const websiteDomain = input.website ? domainOf(input.website) : '';
  const websiteCited =
    !!websiteDomain &&
    sourceMentions.some(
      (d) => d === websiteDomain || d.endsWith(`.${websiteDomain}`),
    );

  const result: IntlCheckResult = {
    version: 1,
    clinicName: input.clinicName,
    city: input.city,
    country: input.country,
    language: input.language,
    specialty: input.specialty,
    website: input.website ?? null,
    generatedAt: new Date().toISOString(),
    durationMs: input.durationMs,
    platformsUsed: input.platformsUsed,
    platformsUnavailable: input.platformsUnavailable,
    overall: tally(all),
    branded: tally(brandedObs),
    unbranded: tally(unbrandedObs),
    platforms,
    competitors: topCounts(competitorMentions, 10),
    sources: topCounts(sourceMentions, 10).map((s) => ({
      domain: s.name,
      count: s.count,
    })),
    websiteCited,
    findings: [],
    questions: input.questions,
  };
  result.findings = buildFindings(result);
  return result;
}

function domainOf(website: string): string {
  const raw = website.trim();
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProto).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** 3–5 plain-language findings in the report language. */
export function buildFindings(r: IntlCheckResult): string[] {
  const ja = r.language === 'ja';
  const f: string[] = [];
  const name = r.clinicName;
  const rate = r.overall.rate;
  const answeredPlatforms = r.platforms.filter((p) => p.answered > 0);

  if (r.overall.answered === 0) {
    f.push(
      ja
        ? 'AIプラットフォームから回答を取得できませんでした（一時的な障害の可能性があります）。しばらくしてから再度お試しください。'
        : 'We could not get answers from the AI platforms this time (likely a temporary provider issue). Please try again later.',
    );
    return f;
  }

  // 1. overall
  if (rate === 0) {
    f.push(
      ja
        ? `${r.city}の患者が尋ねる${r.overall.answered}件の質問のうち、AIは${name}を一度も挙げませんでした。現時点でAI検索上は「存在しない」状態です。`
        : `Across ${r.overall.answered} answers to questions patients in ${r.city} actually ask, AI never mentioned ${name}. Right now you are invisible in AI search.`,
    );
  } else if (rate !== null && rate < 20) {
    f.push(
      ja
        ? `AIは${r.overall.answered}件中${r.overall.mentioned}件（${rate}%）でしか${name}を挙げませんでした。競合に比べて露出が非常に低い状態です。`
        : `AI mentioned ${name} in only ${r.overall.mentioned} of ${r.overall.answered} answers (${rate}%). Your visibility is low compared with the clinics AI does recommend.`,
    );
  } else if (rate !== null && rate < 50) {
    f.push(
      ja
        ? `AIは${r.overall.answered}件中${r.overall.mentioned}件（${rate}%）で${name}を挙げました。一定の認知はありますが、まだ「定番のおすすめ」ではありません。`
        : `AI mentioned ${name} in ${r.overall.mentioned} of ${r.overall.answered} answers (${rate}%). You are on AI's radar, but not yet a default recommendation.`,
    );
  } else if (rate !== null) {
    f.push(
      ja
        ? `AIは${r.overall.answered}件中${r.overall.mentioned}件（${rate}%）で${name}を挙げました。${r.city}ではAI上の存在感が強い部類です。`
        : `AI mentioned ${name} in ${r.overall.mentioned} of ${r.overall.answered} answers (${rate}%). That is a strong AI presence for ${r.city}.`,
    );
  }

  // 2. branded vs unbranded
  if (r.branded.answered > 0) {
    if (r.branded.mentioned === 0) {
      f.push(
        ja
          ? `医院名を直接尋ねた質問（${r.branded.answered}件）でもAIは${name}を認識できませんでした。Googleビジネスプロフィールや公式サイトの情報がAIに届いていない可能性が高いです。`
          : `Even when asked about ${name} by name (${r.branded.answered} answers), AI did not recognise the clinic. Your Google Business Profile and website content are probably not reaching AI yet.`,
      );
    } else if (r.unbranded.answered > 0 && (r.unbranded.rate ?? 0) === 0) {
      f.push(
        ja
          ? `医院名を出せばAIは${name}を認識しますが、「${r.city}でおすすめは？」のような医院名なしの質問（${r.unbranded.answered}件）では一度も推薦されませんでした。新患を生むのは後者の質問です。`
          : `AI recognises ${name} when asked by name, but never recommended it in the ${r.unbranded.answered} unbranded questions ("best clinic in ${r.city}…") — and those are the questions that bring new patients.`,
      );
    }
  }

  // 3. best / worst platform
  if (answeredPlatforms.length >= 2) {
    const sorted = [...answeredPlatforms].sort(
      (a, b) => (b.rate ?? 0) - (a.rate ?? 0),
    );
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if ((best.rate ?? 0) > (worst.rate ?? 0)) {
      f.push(
        ja
          ? `プラットフォーム別では${best.label}（${best.rate}%）が最も高く、${worst.label}（${worst.rate}%）が最も低い結果でした。プラットフォームごとに参照する情報源が異なります。`
          : `${best.label} mentioned you most often (${best.rate}%), ${worst.label} the least (${worst.rate}%). Each platform relies on different sources, so they see you differently.`,
      );
    }
  }

  // 4. competitors
  if (r.competitors.length > 0) {
    const top = r.competitors.slice(0, 3);
    const list = top
      .map((c) => `${c.name} (${c.count})`)
      .join(ja ? '、' : ', ');
    f.push(
      ja
        ? `AIが代わりに挙げた医院の上位は ${list} でした。これらがAI検索上の実質的な競合です。`
        : `The clinics AI recommended instead were led by ${list}. These are your real competitors in AI search.`,
    );
  }

  // 5. sources
  if (r.sources.length > 0) {
    const top = r.sources
      .slice(0, 3)
      .map((s) => s.domain)
      .join(ja ? '、' : ', ');
    if (r.website && !r.websiteCited) {
      f.push(
        ja
          ? `AIが根拠にした情報源の上位は ${top} でした。貴院の公式サイトは一度も引用されていません。まずこれらの媒体での情報を整えることが近道です。`
          : `AI's answers were grounded mainly in ${top}. Your own website was never cited — getting listed and reviewed on those sources is the fastest lever.`,
      );
    } else {
      f.push(
        ja
          ? `AIが根拠にした情報源の上位は ${top} でした。AIに選ばれるにはこれらの媒体での存在感が鍵になります。`
          : `AI's answers were grounded mainly in ${top}. Being present and well-reviewed on those sources is what gets a clinic recommended.`,
      );
    }
  }

  return f.slice(0, 5);
}
