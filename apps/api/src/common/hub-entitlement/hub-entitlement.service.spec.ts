import { HubEntitlementService, pickHubEntitlement, hubEntitlementLabel } from './hub-entitlement.service';

// Synthetic values only — no production keys or hospital records.
const future = new Date(Date.now() + 30 * 86400_000).toISOString();
const past = new Date(Date.now() - 86400_000).toISOString();

describe('HubEntitlement', () => {
  const origFetch = global.fetch;
  const origKey = process.env.HUB_API_KEY;
  afterEach(() => {
    global.fetch = origFetch;
    if (origKey === undefined) delete process.env.HUB_API_KEY;
    else process.env.HUB_API_KEY = origKey;
  });

  it('picks valid allpass, ignores expired/past_due, services.signal overrides allpass', () => {
    expect(pickHubEntitlement({ allpass: { tier: 'S', status: 'active', ends_at: future } })?.planType).toBe('STARTER');
    expect(pickHubEntitlement({ allpass: { tier: 'M', status: 'cancel_at_period_end', ends_at: future } })?.planType).toBe('STANDARD');
    expect(pickHubEntitlement({ allpass: { tier: 'L', status: 'active', ends_at: past } })).toBeNull();
    expect(pickHubEntitlement({ allpass: { tier: 'L', status: 'past_due', ends_at: future } })).toBeNull();
    expect(pickHubEntitlement({ allpass: null, services: {} })).toBeNull();
    const svc = pickHubEntitlement({
      allpass: { tier: 'L', status: 'active', ends_at: future },
      services: { signal: { tier: 'M', status: 'active', ends_at: future } },
    });
    expect(svc?.planType).toBe('STANDARD');
    expect(svc?.via).toBe('service');
  });

  it('label mentions grant', () => {
    const ent = pickHubEntitlement({ allpass: { tier: 'S', status: 'active', source: 'grant', ends_at: '2027-09-26T00:00:00.000Z' } })!;
    expect(hubEntitlementLabel(ent)).toBe('허브 올패스 S 적용 중 · 2027-09-26까지 · 올인원 수강생 무료 제공');
  });

  it('upgrades only, never downgrades, and keeps local plan on hub failure', async () => {
    process.env.HUB_API_KEY = 'synthetic-unit-test-key';
    const svc = new HubEntitlementService({} as any);
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ allpass: { tier: 'M', status: 'active', source: 'grant', ends_at: future }, services: {} }), { status: 200 })) as any;
    const up = await svc.apply({ id: 'h1', psHospitalId: 'hid-1', planType: 'FREE', subscriptionStatus: 'EXPIRED' });
    expect(up.planType).toBe('STANDARD');
    expect(up.subscriptionStatus).toBe('ACTIVE');
    expect(up.localPlanType).toBe('FREE');
    expect(up.hubEntitlement?.applied).toBe(true);

    const keep = await svc.apply({ id: 'h1', psHospitalId: 'hid-1', planType: 'PRO', subscriptionStatus: 'ACTIVE' });
    expect(keep.planType).toBe('PRO');
    expect(keep.hubEntitlement?.applied).toBe(false);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1); // 두 번째는 캐시

    svc.invalidate('hid-1');
    global.fetch = jest.fn(async () => { throw new Error('down'); }) as any;
    const fail = await svc.apply({ id: 'h1', psHospitalId: 'hid-1', planType: 'STARTER', subscriptionStatus: 'TRIAL' });
    expect(fail.planType).toBe('STARTER');
    expect(fail.subscriptionStatus).toBe('TRIAL');
    expect(fail.hubEntitlement).toBeNull();
  });

  it('no key or no hospital id = no hub call', async () => {
    delete process.env.HUB_API_KEY;
    const svc = new HubEntitlementService({} as any);
    global.fetch = jest.fn() as any;
    const r = await svc.apply({ id: 'h2', psHospitalId: 'hid-2', planType: 'FREE' });
    expect(r.planType).toBe('FREE');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
