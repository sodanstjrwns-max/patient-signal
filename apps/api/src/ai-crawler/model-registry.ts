/**
 * 【모델 사다리】플랫폼별 "최저가 우선" 모델 후보와 가용성 상태.
 *
 * 배경(2026-09-08): OpenAI가 gpt-4o-mini-search-preview 를 폐기해 ChatGPT 측정이 검색 없는 폴백으로
 * 조용히 열화됐고, Gemini 2.5-flash-lite 도 신규 사용자 폐기로 비싼 폴백만 돌던 전례가 있다.
 * 원칙: 각 플랫폼은 가격순 후보 목록(사다리)을 두고,
 *   1) 공급사 모델 목록(/models)을 6시간마다 조회해 사라진 후보는 건너뛴다.
 *   2) 호출 중 "모델 없음/폐기" 오류가 나면 그 후보를 24시간 비가용으로 표시하고 즉시 다음 후보로 넘어간다.
 *   3) 전환이 일어나면 운영 메일을 보낸다(플랫폼당 하루 1회) — 더 싼 신모델이 나왔을 때 사다리를 갱신하라는 신호.
 * 새 최저가 모델이 출시되면 사다리 맨 앞에 추가하면 된다(단가는 llm-pricing.ts 에도 함께).
 */

export type RegistryPlatform = 'CHATGPT' | 'CLAUDE' | 'GEMINI' | 'GROK' | 'PERPLEXITY' | 'CLOVA_X';

export interface ModelCandidate {
  model: string;
  /** USD per 1M tokens (참고용 — 실제 과금 단가는 llm-pricing.ts) */
  input: number;
  output: number;
  note?: string;
}

/** 가격순(싼 것부터). 검색 능력이 있는 후보만 (측정은 "실제 검색 결과에 병원이 언급되는가"라 검색이 핵심) */
export const MODEL_LADDERS: Record<RegistryPlatform, ModelCandidate[]> = {
  CHATGPT: [
    { model: 'gpt-5-nano', input: 0.05, output: 0.4, note: 'Responses+web_search' },
    { model: 'gpt-5-mini', input: 0.25, output: 2, note: 'Responses+web_search' },
    { model: 'gpt-5.4-mini', input: 0.4, output: 2, note: 'Responses+web_search (단가 추정)' },
  ],
  CLAUDE: [
    { model: 'claude-haiku-4-5', input: 1, output: 5, note: 'web_search max_uses:1' },
    { model: 'claude-sonnet-5', input: 2, output: 10 },
    { model: 'claude-sonnet-4-6', input: 3, output: 15 },
  ],
  GEMINI: [
    { model: 'gemini-3.1-flash-lite', input: 0.25, output: 1.5, note: 'google_search grounding' },
    { model: 'gemini-3.5-flash-lite', input: 0.3, output: 2.5 },
    { model: 'gemini-flash-lite-latest', input: 0.3, output: 2.5, note: '별칭(현재 3.5-lite)' },
    { model: 'gemini-2.5-flash', input: 0.3, output: 2.5 },
    { model: 'gemini-3.8-flash', input: 0.75, output: 3.75 },
  ],
  GROK: [
    { model: 'grok-4.3', input: 1.25, output: 2.5, note: 'Responses+web_search (build-0.1은 명목가만 쌀 뿐 실비용 2.9배)' },
    { model: 'grok-4.20-0309-non-reasoning', input: 1.25, output: 2.5 },
    { model: 'grok-4.5', input: 2, output: 6 },
  ],
  PERPLEXITY: [
    { model: 'sonar', input: 1, output: 1, note: '요청비 $5/1k' },
    { model: 'sonar-pro', input: 3, output: 15 },
  ],
  CLOVA_X: [
    { model: 'HCX-005', input: 1.5, output: 1.5 },
    { model: 'HCX-007', input: 1.5, output: 1.5, note: '단가 미확인' },
    { model: 'HCX-DASH-002', input: 0.5, output: 0.5, note: '경량 모델(단가 미확인)' },
  ],
};

const UNAVAILABLE_TTL_MS = 24 * 60 * 60 * 1000;
const ALERT_THROTTLE_MS = 24 * 60 * 60 * 1000;

type Unavail = { until: number; reason: string; at: string };

const unavailable = new Map<string, Unavail>(); // `${platform}:${model}`
const listed = new Map<RegistryPlatform, string[] | null>(); // 공급사 목록 (null = 조회 불가 플랫폼)
const lastAlertAt = new Map<RegistryPlatform, number>();
let lastRefreshAt: string | null = null;
let alertHook: ((subject: string, text: string) => Promise<unknown>) | null = null;
let logHook: ((msg: string, level?: 'log' | 'warn') => void) | null = null;

export function setRegistryHooks(hooks: {
  alert?: (subject: string, text: string) => Promise<unknown>;
  log?: (msg: string, level?: 'log' | 'warn') => void;
}): void {
  if (hooks.alert) alertHook = hooks.alert;
  if (hooks.log) logHook = hooks.log;
}

function log(msg: string, level: 'log' | 'warn' = 'log'): void {
  if (logHook) logHook(msg, level);
  else if (level === 'warn') console.warn(msg);
  else console.log(msg);
}

/** 공급사 오류 메시지가 "모델 자체가 없음/폐기/미지원"인지 (키·한도·네트워크 오류와 구분) */
export function isModelIssue(err: unknown): boolean {
  const s = typeof err === 'string' ? err : (err as any)?.message || JSON.stringify(err ?? '');
  return /deprecated|no longer available|not found|does not exist|model_not_found|unknown model|unsupported model|invalid model|is not supported|has been (retired|removed)|NOT_FOUND|40400|404/i.test(
    String(s),
  );
}

function isListed(platform: RegistryPlatform, model: string): boolean {
  const ids = listed.get(platform);
  if (ids === undefined || ids === null) return true; // 목록 미조회/조회 불가 → 호출로 판정
  // 별칭·날짜 접미 대응: 'claude-haiku-4-5' ↔ 'claude-haiku-4-5-20251001'
  return ids.some((id) => id === model || id.startsWith(model + '-') || model.startsWith(id + '-'));
}

/** 현재 시점 사용 가능한 후보(가격순). 전부 걸러지면 안전하게 원본 사다리 전체를 돌려준다 */
export function pickModels(platform: RegistryPlatform): string[] {
  const now = Date.now();
  const out: string[] = [];
  for (const c of MODEL_LADDERS[platform]) {
    const u = unavailable.get(`${platform}:${c.model}`);
    if (u && u.until > now) continue;
    if (!isListed(platform, c.model)) continue;
    out.push(c.model);
  }
  return out.length > 0 ? out : MODEL_LADDERS[platform].map((c) => c.model);
}

/** 첫 번째 사용 가능 후보 */
export function primaryModel(platform: RegistryPlatform): string {
  return pickModels(platform)[0];
}

/** 모델 호출이 "모델 없음"으로 실패했을 때 — 24시간 비가용 처리 + 전환 알림 */
export async function markUnavailable(platform: RegistryPlatform, model: string, reason: string): Promise<string | null> {
  unavailable.set(`${platform}:${model}`, { until: Date.now() + UNAVAILABLE_TTL_MS, reason: reason.slice(0, 300), at: new Date().toISOString() });
  const next = pickModels(platform)[0] ?? null;
  log(`[모델사다리] ${platform} ${model} 비가용 처리 → 다음 후보 ${next ?? '없음'} (${reason.slice(0, 160)})`, 'warn');
  const last = lastAlertAt.get(platform) || 0;
  if (alertHook && Date.now() - last > ALERT_THROTTLE_MS) {
    lastAlertAt.set(platform, Date.now());
    try {
      await alertHook(
        `🔁 [시그널] ${platform} 모델 자동 전환: ${model} → ${next ?? '후보 없음'}`,
        `${new Date().toISOString()}\n플랫폼: ${platform}\n실패 모델: ${model}\n사유: ${reason.slice(0, 500)}\n다음 후보: ${next ?? '없음 — 사다리(model-registry.ts) 갱신 필요'}\n\n` +
          `측정은 다음 후보로 계속됩니다. 더 싼 신모델이 있으면 model-registry.ts 사다리와 llm-pricing.ts 단가를 갱신하세요.`,
      );
    } catch (e: any) {
      log(`[모델사다리] 전환 알림 발송 실패: ${e?.message || e}`, 'warn');
    }
  }
  return next;
}

async function fetchJson(url: string, headers: Record<string, string>, timeoutMs = 15000): Promise<any> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * 공급사 모델 목록 갱신 (6시간 주기 + 부팅 시). 목록 API가 없는 플랫폼(Perplexity·CLOVA)은 호출 결과로만 판정.
 * 조회 실패는 조용히 무시(이전 목록 유지) — 목록 조회가 측정을 막아서는 안 된다.
 */
export async function refreshAvailability(): Promise<void> {
  const env = process.env;
  const tasks: Array<Promise<void>> = [];

  if (env.OPENAI_API_KEY) {
    tasks.push(
      fetchJson('https://api.openai.com/v1/models', { authorization: `Bearer ${env.OPENAI_API_KEY.trim()}` })
        .then((j) => { listed.set('CHATGPT', (j?.data || []).map((m: any) => String(m.id))); })
        .catch((e) => log(`[모델사다리] OpenAI 목록 조회 실패: ${e?.message}`, 'warn')),
    );
  }
  if (env.ANTHROPIC_API_KEY) {
    tasks.push(
      fetchJson('https://api.anthropic.com/v1/models?limit=100', { 'x-api-key': env.ANTHROPIC_API_KEY.trim(), 'anthropic-version': '2023-06-01' })
        .then((j) => { listed.set('CLAUDE', (j?.data || []).map((m: any) => String(m.id))); })
        .catch((e) => log(`[모델사다리] Anthropic 목록 조회 실패: ${e?.message}`, 'warn')),
    );
  }
  if (env.GEMINI_API_KEY) {
    tasks.push(
      fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${env.GEMINI_API_KEY.trim()}`, {})
        .then((j) => { listed.set('GEMINI', (j?.models || []).map((m: any) => String(m.name).replace(/^models\//, ''))); })
        .catch((e) => log(`[모델사다리] Gemini 목록 조회 실패: ${e?.message}`, 'warn')),
    );
  }
  if (env.XAI_API_KEY) {
    tasks.push(
      fetchJson('https://api.x.ai/v1/models', { authorization: `Bearer ${env.XAI_API_KEY.trim()}` })
        .then((j) => { listed.set('GROK', (j?.data || []).map((m: any) => String(m.id))); })
        .catch((e) => log(`[모델사다리] xAI 목록 조회 실패: ${e?.message}`, 'warn')),
    );
  }
  listed.set('PERPLEXITY', null);
  listed.set('CLOVA_X', null);

  await Promise.all(tasks);
  lastRefreshAt = new Date().toISOString();

  const summary = (Object.keys(MODEL_LADDERS) as RegistryPlatform[])
    .map((p) => {
      const picks = pickModels(p);
      const skipped = MODEL_LADDERS[p].map((c) => c.model).filter((m) => !picks.includes(m));
      return `${p}=${picks[0]}${skipped.length ? ` (제외: ${skipped.join(',')})` : ''}`;
    })
    .join(' · ');
  log(`[모델사다리] 가용성 갱신 — ${summary}`);
}

/** 관리자 진단용 스냅샷 */
export function registrySnapshot() {
  const now = Date.now();
  return {
    lastRefreshAt,
    platforms: (Object.keys(MODEL_LADDERS) as RegistryPlatform[]).map((p) => ({
      platform: p,
      inUse: primaryModel(p),
      ladder: MODEL_LADDERS[p].map((c) => {
        const u = unavailable.get(`${p}:${c.model}`);
        return {
          ...c,
          listed: listed.get(p) === undefined ? 'unknown' : listed.get(p) === null ? 'n/a' : isListed(p, c.model),
          unavailable: u && u.until > now ? { reason: u.reason, since: u.at, until: new Date(u.until).toISOString() } : null,
        };
      }),
    })),
  };
}

let refreshTimer: NodeJS.Timeout | null = null;
/** 부팅 시 1회 + 6시간 주기 갱신 시작 (중복 호출 안전) */
export function startRegistryRefresh(intervalMs = 6 * 60 * 60 * 1000): void {
  void refreshAvailability();
  if (refreshTimer) return;
  refreshTimer = setInterval(() => void refreshAvailability(), intervalMs);
  if (typeof refreshTimer.unref === 'function') refreshTimer.unref();
}
