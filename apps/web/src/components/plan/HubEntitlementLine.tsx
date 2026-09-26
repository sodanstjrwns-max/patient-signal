// 【2026-09-26】허브 올패스 권한 한 줄 — API(/hospitals/:id·/subscriptions/me)가 내려주는 hubEntitlement.label 을 그대로 표시.
// 허브 권한이 없거나 로컬 플랜이 더 높아 적용되지 않으면(applied=false) 아무것도 그리지 않는다.
import type { HubEntitlement } from '@/types';

export function HubEntitlementLine({ entitlement, className }: { entitlement?: HubEntitlement | null; className?: string }) {
  if (!entitlement?.applied || !entitlement.label) return null;
  return <p className={className ?? 'mt-1 text-xs text-[#ff9565]'}>{entitlement.label}</p>;
}
