import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * 【PS-통합】Patient Series Open API v1 인증 가드
 *
 * - Authorization: Bearer {PS_SERVICE_KEY} 검증
 * - X-PS-Hospital-Id: 병원 전역 ID(ps_hospital_id) → 로컬 hospitalId 매핑
 *   파일럿 기간: 환경변수 PS_HOSPITAL_MAP="bdd-001=로컬uuid,bdd-002=로컬uuid2" 고정 매핑
 *   (마스터는 추후 Patient Hub가 담당)
 *
 * PS_SERVICE_KEY 미설정 시 503 — 기능 자체가 비활성 상태임을 명시 (거짓 200 금지)
 */
@Injectable()
export class PsServiceKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const serviceKey = process.env.PS_SERVICE_KEY;
    if (!serviceKey) {
      throw new ServiceUnavailableException({
        error: { code: 'PS_NOT_CONFIGURED', message: 'PS_SERVICE_KEY가 설정되지 않았습니다' },
      });
    }

    // 1. Bearer 토큰 검증
    const authHeader: string = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token || token !== serviceKey) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_SERVICE_KEY', message: '유효하지 않은 서비스 키입니다' },
      });
    }

    // 2. 병원 전역 ID → 로컬 hospitalId 매핑
    const psHospitalId: string = (req.headers['x-ps-hospital-id'] || '').toString().trim();
    if (!psHospitalId) {
      throw new UnauthorizedException({
        error: { code: 'MISSING_HOSPITAL_ID', message: 'X-PS-Hospital-Id 헤더가 필요합니다' },
      });
    }

    const localHospitalId = resolveHospitalId(psHospitalId);
    if (!localHospitalId) {
      throw new NotFoundException({
        error: { code: 'HOSPITAL_NOT_MAPPED', message: `매핑되지 않은 병원 ID: ${psHospitalId}` },
      });
    }

    // 컨트롤러에서 req.psHospital로 접근
    req.psHospital = { psHospitalId, localHospitalId };
    return true;
  }
}

/**
 * PS_HOSPITAL_MAP 파싱: "전역id=로컬id,전역id2=로컬id2"
 */
function resolveHospitalId(psHospitalId: string): string | null {
  const map = process.env.PS_HOSPITAL_MAP || '';
  for (const pair of map.split(',')) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key === psHospitalId && value) return value;
  }
  return null;
}
