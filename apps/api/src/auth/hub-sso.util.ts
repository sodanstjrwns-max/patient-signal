// 허브 SSO 토큰 검증 — Patient Hub(hub.patientfunnel.kr)가 발급한
// HMAC-SHA256(HS256) 서명 단기 토큰을 검증한다. 공유 시크릿: PS_SSO_SECRET.
// 레퍼런스: patient-touch/src/lib/hub-sso.ts (WebCrypto) — 여기서는 node:crypto의
// createHmac + timingSafeEqual로 동등하게 구현 (형제 서비스 공통 계약).

import { createHmac, timingSafeEqual } from 'crypto';

export type HubSsoClaims = {
  iss: string;
  aud: string;
  sub: number;
  email: string;
  name: string;
  role: string; // director | manager | staff (허브 기준)
  hid: string; // ps_hospital_id (전역 병원 ID)
  hname: string;
  iat: number;
  exp: number;
  jti: string;
};

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * 허브 발급 SSO 토큰(JWT, HS256)을 검증한다.
 * 실패 사유와 무관하게 null 반환 (검증 실패 상세는 호출자에게 노출하지 않음).
 */
export function verifyHubSsoToken(
  secret: string,
  token: string,
  expectedAud: string,
): HubSsoClaims | null {
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  try {
    const expected = createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest();
    const actual = b64urlDecode(sig);
    if (actual.length !== expected.length) return null;
    if (!timingSafeEqual(actual, expected)) return null;

    const claims = JSON.parse(b64urlDecode(body).toString('utf8')) as HubSsoClaims;
    if (claims.iss !== 'patient-hub') return null;
    if (claims.aud !== expectedAud) return null;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null;
    if (!claims.email || !claims.hid) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * PS_HOSPITAL_MAP 파싱: "전역id=로컬id,전역id2=로컬id2" (파일럿 고정 매핑)
 * ps-open-api/guards/ps-service-key.guard.ts와 동일 포맷.
 */
export function parsePsHospitalMap(): Array<{ globalId: string; localId: string }> {
  const map = process.env.PS_HOSPITAL_MAP || '';
  const entries: Array<{ globalId: string; localId: string }> = [];
  for (const pair of map.split(',')) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const globalId = pair.slice(0, idx).trim();
    const localId = pair.slice(idx + 1).trim();
    if (globalId && localId) entries.push({ globalId, localId });
  }
  return entries;
}

/** 전역 병원 ID(hid) → 로컬 hospitalId (env 고정 매핑 기준) */
export function resolveLocalIdFromMap(hid: string): string | null {
  const entry = parsePsHospitalMap().find((e) => e.globalId === hid);
  return entry ? entry.localId : null;
}

/** 로컬 hospitalId → env 고정 매핑에 등록된 전역 병원 ID (없으면 null) */
export function findGlobalIdFromMap(localHospitalId: string): string | null {
  const entry = parsePsHospitalMap().find((e) => e.localId === localHospitalId);
  return entry ? entry.globalId : null;
}
