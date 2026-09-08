import { isModelIssue, markUnavailable, pickModels, primaryModel, MODEL_LADDERS, setRegistryHooks, registrySnapshot } from './model-registry';

describe('model-registry (모델 사다리)', () => {
  it('플랫폼별 첫 후보가 최저가 모델이다', () => {
    expect(primaryModel('CHATGPT')).toBe('gpt-5-nano');
    expect(primaryModel('GEMINI')).toBe('gemini-3.1-flash-lite');
    expect(primaryModel('CLAUDE')).toBe('claude-haiku-4-5');
    expect(primaryModel('GROK')).toBe('grok-4.3');
    expect(primaryModel('PERPLEXITY')).toBe('sonar');
    expect(primaryModel('CLOVA_X')).toBe('HCX-005');
  });

  it('모델 폐기/미존재 오류만 모델 이슈로 판정한다', () => {
    expect(isModelIssue(new Error('404 The model `gpt-4o-mini-search-preview` has been deprecated'))).toBe(true);
    expect(isModelIssue('[404] models/gemini-2.5-flash-lite is no longer available to new users')).toBe(true);
    expect(isModelIssue({ message: 'model_not_found' })).toBe(true);
    expect(isModelIssue(new Error('429 rate limit exceeded'))).toBe(false);
    expect(isModelIssue(new Error('401 invalid api key'))).toBe(false);
    expect(isModelIssue(new Error('fetch failed: ECONNRESET'))).toBe(false);
  });

  it('비가용 처리하면 다음 후보로 넘어가고 알림 훅이 1회 호출된다', async () => {
    const alerts: string[] = [];
    setRegistryHooks({ alert: async (s) => { alerts.push(s); }, log: () => {} });
    const next = await markUnavailable('CHATGPT', 'gpt-5-nano', '404 deprecated');
    expect(next).toBe('gpt-5-mini');
    expect(primaryModel('CHATGPT')).toBe('gpt-5-mini');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('gpt-5-nano → gpt-5-mini');
    // 같은 플랫폼 24시간 내 재알림 없음
    await markUnavailable('CHATGPT', 'gpt-5-mini', '404 deprecated');
    expect(alerts).toHaveLength(1);
    expect(primaryModel('CHATGPT')).toBe('gpt-5.4-mini');
  });

  it('후보가 전부 비가용이어도 사다리 전체를 돌려줘 측정이 멈추지 않는다', async () => {
    setRegistryHooks({ alert: async () => {}, log: () => {} });
    for (const c of MODEL_LADDERS.PERPLEXITY) await markUnavailable('PERPLEXITY', c.model, 'x');
    expect(pickModels('PERPLEXITY')).toEqual(MODEL_LADDERS.PERPLEXITY.map((c) => c.model));
  });

  it('스냅샷에 현재 사용 모델과 비가용 사유가 담긴다', () => {
    const snap = registrySnapshot();
    const chat = snap.platforms.find((p) => p.platform === 'CHATGPT')!;
    expect(chat.inUse).toBe('gpt-5.4-mini');
    expect(chat.ladder[0].unavailable?.reason).toContain('deprecated');
  });
});
