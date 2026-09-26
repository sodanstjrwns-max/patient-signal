import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { findGlobalIdFromMap } from '../../auth/hub-sso.util';

// 【2026-09-26】허브 올패스 → 시그널 권한 연동 (규약: pflive/허브_올패스_권한연동_규약_2026-09-26.md)
// - GET https://hub.patientfunnel.kr/api/v1/entitlements (Bearer HUB_API_KEY + X-PS-Hospital-Id)
// - 유효 권한 = services.signal 이 있으면 그것, 없으면 allpass. status active|cancel_at_period_end 이고 ends_at 이 미래일 때만.
// - 올려주기만: 판정 시점에 합성(hospital.planType/subscriptionStatus 컬럼은 절대 덮어쓰지 않음 — 원복 쉬움).
// - 허브 실패·키 없음·미연동 = 지금 동작 그대로. 캐시 병원별 30분(메모리), 타임아웃 3초.
// - 허브 hub-events 'subscription_updated' → invalidate(psHospitalId).
//
// 티어 매핑(PlanGuard.PLAN_DISPLAY 기준): S → STARTER, M → STANDARD, L → PRO. ENTERPRISE 는 허브 티어로 만들지 않는다.

const HUB_BASE_URL = 'https://hub.patientfunnel.kr';
const SLUG = 'signal';
const CACHE_TTL_MS = 30 * 60 * 1000;
const FAIL_TTL_MS = 2 * 60 * 1000; // 허브 장애 시 재호출 폭주 방지(그동안은 권한 없음 = 지금 동작)
const TIMEOUT_MS = 3000;

export type SignalPlan = 'FREE' | 'STARTER' | 'STANDARD' | 'PRO' | 'ENTERPRISE';
export const HUB_TIER_TO_PLAN: Record<'S' | 'M' | 'L', SignalPlan> = { S: 'STARTER', M: 'STANDARD', L: 'PRO' };
export const PLAN_ORDER: Record<string, number> = { FREE: 0, STARTER: 1, STANDARD: 2, PRO: 3, ENTERPRISE: 4 };

export interface HubEntitlement {
  tier: 'S' | 'M' | 'L';
  planType: SignalPlan;
  status: string;
  source: string;
  endsAt: string;
  trial: boolean;
  via: 'service' | 'allpass';
}

/** 응답에 실어 보내는 형태(설정/요금 화면 한 줄용). applied=false 면 로컬 플랜이 더 높아 허브 권한이 쓰이지 않음 */
export interface HubEntitlementView extends HubEntitlement {
  applied: boolean;
  label: string;
}

type RawEnt = { tier?: unknown; status?: unknown; source?: unknown; ends_at?: unknown; trial?: unknown } | null | undefined;

function validEnt(e: RawEnt, via: HubEntitlement['via'], now: number): HubEntitlement | null {
  if (!e || typeof e !== 'object') return null;
  const tier = e.tier === 'S' || e.tier === 'M' || e.tier === 'L' ? e.tier : null;
  const status = String(e.status || '');
  const endsAt = typeof e.ends_at === 'string' ? e.ends_at : '';
  const ends = Date.parse(endsAt);
  if (!tier || (status !== 'active' && status !== 'cancel_at_period_end') || !Number.isFinite(ends) || ends <= now) return null;
  return { tier, planType: HUB_TIER_TO_PLAN[tier], status, source: String(e.source || 'card'), endsAt, trial: e.trial === true, via };
}

/** 허브 응답 → 유효 권한. services.signal 이 있으면 그것만 본다(없을 때만 allpass) */
export function pickHubEntitlement(
  body: { allpass?: RawEnt; services?: Record<string, RawEnt> } | null | undefined,
  now = Date.now(),
): HubEntitlement | null {
  if (!body || typeof body !== 'object') return null;
  const svc = body.services?.[SLUG];
  if (svc) return validEnt(svc, 'service', now);
  return validEnt(body.allpass, 'allpass', now);
}

/** "허브 올패스 S 적용 중 · 2027-09-26까지 · 올인원 수강생 무료 제공" (날짜는 KST) */
export function hubEntitlementLabel(ent: HubEntitlement): string {
  const d = new Date(Date.parse(ent.endsAt) + 9 * 3600_000).toISOString().slice(0, 10);
  const who = ent.via === 'allpass' ? `허브 올패스 ${ent.tier}` : `허브 시그널 ${ent.tier}`;
  return `${who} 적용 중 · ${d}까지${ent.source === 'grant' ? ' · 올인원 수강생 무료 제공' : ''}`;
}

type PlanFields = { id?: string; planType?: any; subscriptionStatus?: any; psHospitalId?: string | null };
export type WithHub<T> = T & { localPlanType?: string; hubEntitlement: HubEntitlementView | null };

@Injectable()
export class HubEntitlementService {
  private readonly logger = new Logger(HubEntitlementService.name);
  private readonly cache = new Map<string, { ent: HubEntitlement | null; ts: number; ttl: number }>();

  constructor(private readonly prisma: PrismaService) {}

  isEnabled(): boolean {
    return !!process.env.HUB_API_KEY?.trim();
  }

  invalidate(psHospitalId: string): void {
    if (psHospitalId && this.cache.delete(psHospitalId)) {
      this.logger.log(`Hub entitlement cache invalidated: ${psHospitalId}`);
    }
  }

  /** 병원의 전역 ID: psHospitalId 컬럼 → PS_HOSPITAL_MAP env(파일럿 고정 매핑) */
  resolvePsId(h: { id?: string; psHospitalId?: string | null }): string | null {
    if (h.psHospitalId) return h.psHospitalId;
    return h.id ? findGlobalIdFromMap(h.id) : null;
  }

  /** 유효 허브 권한. 없음·실패 = null (지금 동작 그대로) */
  async getEntitlement(psHospitalId: string | null | undefined): Promise<HubEntitlement | null> {
    const key = process.env.HUB_API_KEY?.trim();
    const hid = (psHospitalId || '').trim();
    if (!key || !hid) return null;
    const now = Date.now();
    const cached = this.cache.get(hid);
    if (cached && now - cached.ts < cached.ttl) {
      // 캐시 안에서 기간이 끝났을 수 있으니 다시 확인
      return cached.ent && Date.parse(cached.ent.endsAt) > now ? cached.ent : null;
    }
    try {
      const res = await fetch(`${HUB_BASE_URL}/api/v1/entitlements`, {
        headers: { Authorization: `Bearer ${key}`, 'X-PS-Hospital-Id': hid },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 404) {
        this.cache.set(hid, { ent: null, ts: now, ttl: CACHE_TTL_MS }); // 허브에 없는 병원 = 권한 없음
        return null;
      }
      if (!res.ok) {
        this.logger.warn(`Hub entitlements HTTP ${res.status} (${hid})`);
        this.cache.set(hid, { ent: null, ts: now, ttl: FAIL_TTL_MS });
        return null;
      }
      const ent = pickHubEntitlement((await res.json()) as any, now);
      this.cache.set(hid, { ent, ts: now, ttl: CACHE_TTL_MS });
      return ent;
    } catch (err: any) {
      this.logger.warn(`Hub entitlements fetch failed (${hid}): ${err?.message}`);
      this.cache.set(hid, { ent: null, ts: now, ttl: FAIL_TTL_MS });
      return null;
    }
  }

  /**
   * 병원 객체에 허브 권한을 합성한 사본을 돌려준다(원본·DB 불변).
   * 허브 티어(매핑 플랜)가 로컬 planType 이상이면 planType=매핑 플랜, subscriptionStatus='ACTIVE'(유료 취급 → 체험 만료 해제).
   * 로컬이 더 높으면 그대로(내리지 않음). 실패하면 원본 + hubEntitlement:null.
   */
  async apply<T extends PlanFields>(hospital: T): Promise<WithHub<T>> {
    let ent: HubEntitlement | null = null;
    try {
      ent = await this.getEntitlement(this.resolvePsId(hospital));
    } catch {
      ent = null;
    }
    if (!ent) return { ...hospital, hubEntitlement: null };
    const local = String(hospital.planType || 'FREE');
    const applied = PLAN_ORDER[ent.planType] >= (PLAN_ORDER[local] ?? 0);
    const view: HubEntitlementView = { ...ent, applied, label: hubEntitlementLabel(ent) };
    if (!applied) return { ...hospital, hubEntitlement: view };
    const out: any = { ...hospital, localPlanType: local, planType: ent.planType, hubEntitlement: view };
    if ('subscriptionStatus' in hospital) out.subscriptionStatus = 'ACTIVE';
    return out;
  }

  /** hospitalId 만 있을 때: 유효 planType (로컬 planType 을 이미 알면 넘겨서 조회 1회 절약) */
  async effectivePlanType(hospitalId: string, localPlanType?: string | null): Promise<string> {
    const h = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, planType: true, psHospitalId: true },
    });
    if (!h) return localPlanType || 'FREE';
    const eff = await this.apply({ ...h, planType: localPlanType || h.planType });
    return String(eff.planType || 'FREE');
  }

  /**
   * 크론 대상 보강: 기존 목록(excludeIds)에 없지만 허브 권한으로 열리는 병원 id.
   * minPlan 이상(유효 플랜)인 병원만. 허브 실패·키 없음 = [] (기존 목록 그대로).
   */
  async hubActivatedHospitalIds(excludeIds: string[], minPlan: SignalPlan = 'FREE'): Promise<string[]> {
    if (!this.isEnabled()) return [];
    const exclude = new Set(excludeIds);
    const candidates = (
      await this.prisma.hospital.findMany({
        select: { id: true, planType: true, subscriptionStatus: true, psHospitalId: true },
      })
    ).filter((h) => !exclude.has(h.id) && this.resolvePsId(h));
    const out: string[] = [];
    for (let i = 0; i < candidates.length; i += 20) {
      const chunk = await Promise.all(candidates.slice(i, i + 20).map((h) => this.apply(h)));
      for (const h of chunk) {
        if (h.hubEntitlement?.applied && (PLAN_ORDER[String(h.planType)] ?? 0) >= PLAN_ORDER[minPlan]) out.push(h.id);
      }
    }
    if (out.length) this.logger.log(`허브 권한으로 열린 병원 ${out.length}곳 (min ${minPlan})`);
    return out;
  }
}

@Global()
@Module({
  providers: [HubEntitlementService],
  exports: [HubEntitlementService],
})
export class HubEntitlementModule {}
