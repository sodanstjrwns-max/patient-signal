import { Injectable, Logger } from '@nestjs/common';
import { SpecialtyType } from '@prisma/client';

// 허브(Patient Hub) 병원 프로필 조회 + 온보딩 프리필 매핑
// - GET https://hub.patientfunnel.kr/api/v1/hospital-profile
//   헤더: Authorization: Bearer {HUB_API_KEY} + X-PS-Hospital-Id: {전역 병원 ID}
// - 메모리 캐시 15분 (404 = 미등록 병원도 정상 케이스로 캐시)
// - HUB_API_KEY env 미설정 시 프리필 기능 자체가 비활성 (우아한 저하 — 기존 동작 100%)
// - 형제 서비스 공통 패턴 (patient-inside/src/lib/hub-profile.ts 참고)

const HUB_BASE_URL = 'https://hub.patientfunnel.kr';
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface HubHospitalProfile {
  basic?: {
    clinic_type?: string | null;
    staff_count?: number | null;
    region?: string | null;
    opened_year?: number | null;
    key_treatments?: string[];
  };
  updated_at?: string;
}

export interface HubPrefill {
  specialtyType: SpecialtyType | null;
  regionSido: string | null;
  regionSigungu: string | null;
  regionDong: string | null;
  coreTreatments: string[];
  staffCount: number | null;
  openedYear: number | null;
}

// 허브 clinic_type(자유 문자열) → 시그널 SpecialtyType 키워드 매핑
const SPECIALTY_KEYWORDS: Array<[string, SpecialtyType]> = [
  ['치과', SpecialtyType.DENTAL],
  ['피부', SpecialtyType.DERMATOLOGY],
  ['성형', SpecialtyType.PLASTIC_SURGERY],
  ['정형', SpecialtyType.ORTHOPEDICS],
  ['한의', SpecialtyType.KOREAN_MEDICINE],
  ['한방', SpecialtyType.KOREAN_MEDICINE],
  ['안과', SpecialtyType.OPHTHALMOLOGY],
  ['내과', SpecialtyType.INTERNAL_MEDICINE],
  ['비뇨', SpecialtyType.UROLOGY],
  ['이비인후', SpecialtyType.ENT],
  ['정신', SpecialtyType.PSYCHIATRY],
  ['산부인과', SpecialtyType.OBSTETRICS],
  ['소아', SpecialtyType.PEDIATRICS],
];

// 축약 시/도명 → 정식 명칭 (온보딩 SIDO_LIST와 동일 표기)
const SIDO_FULL_NAMES: Record<string, string> = {
  서울: '서울특별시', 부산: '부산광역시', 대구: '대구광역시', 인천: '인천광역시',
  광주: '광주광역시', 대전: '대전광역시', 울산: '울산광역시', 세종: '세종특별자치시',
  경기: '경기도', 강원: '강원특별자치도', 충북: '충청북도', 충남: '충청남도',
  전북: '전북특별자치도', 전남: '전라남도', 경북: '경상북도', 경남: '경상남도',
  제주: '제주특별자치도',
};
const SIDO_LIST = Object.values(SIDO_FULL_NAMES);

@Injectable()
export class HubProfileService {
  private readonly logger = new Logger(HubProfileService.name);
  private readonly cache = new Map<string, { profile: HubHospitalProfile | null; ts: number }>();

  isEnabled(): boolean {
    return !!process.env.HUB_API_KEY?.trim();
  }

  /** 허브 push 무효화 (POST /api/v1/hub-events) — 해당 병원 캐시를 지워 다음 조회 때 신선한 프로필을 pull */
  invalidate(psHospitalId: string): void {
    if (!psHospitalId) return;
    if (this.cache.delete(psHospitalId)) {
      this.logger.log(`Hub profile cache invalidated: ${psHospitalId}`);
    }
  }

  /** 허브 병원 프로필 조회 (실패 시 null — 호출부 기능 저하 없음) */
  async fetchProfile(psHospitalId: string): Promise<HubHospitalProfile | null> {
    const key = process.env.HUB_API_KEY?.trim();
    if (!key || !psHospitalId) return null;

    const cached = this.cache.get(psHospitalId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.profile;

    try {
      const res = await fetch(`${HUB_BASE_URL}/api/v1/hospital-profile`, {
        headers: {
          Authorization: `Bearer ${key}`,
          'X-PS-Hospital-Id': psHospitalId,
        },
      });
      if (res.status === 404) {
        // 미등록 병원: 정상 케이스로 캐시해 재호출 방지
        this.cache.set(psHospitalId, { profile: null, ts: Date.now() });
        return null;
      }
      if (!res.ok) {
        // 일시 장애: 만료된 캐시라도 있으면 사용
        return cached?.profile ?? null;
      }
      const data: any = await res.json();
      const profile = data?.hospital_profile;
      if (!profile || typeof profile !== 'object') return null;
      this.cache.set(psHospitalId, { profile, ts: Date.now() });
      return profile as HubHospitalProfile;
    } catch (err: any) {
      this.logger.warn(`Hub profile fetch failed (${psHospitalId}): ${err?.message}`);
      return cached?.profile ?? null;
    }
  }

  /** 허브 프로필 → 온보딩 프리필 필드 매핑 (매핑 불가 필드는 null — 강제하지 않음) */
  buildPrefill(profile: HubHospitalProfile): HubPrefill {
    const basic = profile.basic || {};

    // 진료과: clinic_type 키워드 매칭
    let specialtyType: SpecialtyType | null = null;
    const clinicType = (basic.clinic_type || '').trim();
    if (clinicType) {
      const hit = SPECIALTY_KEYWORDS.find(([kw]) => clinicType.includes(kw));
      specialtyType = hit ? hit[1] : null;
    }

    // 지역: "서울 강남구", "경기도 성남시 분당구" 등 자유 문자열 파싱 (best-effort)
    let regionSido: string | null = null;
    let regionSigungu: string | null = null;
    let regionDong: string | null = null;
    const region = (basic.region || '').trim();
    if (region) {
      const tokens = region.split(/\s+/).filter(Boolean);
      if (tokens.length) {
        const first = tokens[0];
        regionSido =
          SIDO_LIST.find((s) => s === first) ||
          SIDO_FULL_NAMES[first.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '')] ||
          null;
        const rest = regionSido ? tokens.slice(1) : tokens;
        if (rest.length) {
          const dongIdx = rest.findIndex((t) => /(동|읍|면)$/.test(t) && !/[시군구]$/.test(t));
          if (dongIdx >= 0) {
            regionDong = rest[dongIdx];
            regionSigungu = rest.slice(0, dongIdx).join(' ') || null;
          } else {
            regionSigungu = rest.join(' ') || null;
          }
        }
      }
    }

    return {
      specialtyType,
      regionSido,
      regionSigungu,
      regionDong,
      coreTreatments: Array.isArray(basic.key_treatments)
        ? basic.key_treatments.filter((t) => typeof t === 'string' && t.trim()).slice(0, 10)
        : [],
      staffCount: typeof basic.staff_count === 'number' ? basic.staff_count : null,
      openedYear: typeof basic.opened_year === 'number' ? basic.opened_year : null,
    };
  }
}
