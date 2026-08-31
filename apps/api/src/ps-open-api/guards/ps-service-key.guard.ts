import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

// 상수시간 문자열 비교 (서비스 키 타이밍 사이드채널 완화)
function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * 【PS-통합】Patient Series Open API v1 인증 가드
 *
 * - Authorization: Bearer {PS_SERVICE_KEY} 검증
 * - X-PS-Hospital-Id: 병원 전역 ID(ps_hospital_id) → 로컬 hospitalId 매핑
 *   ① hospital.psHospitalId 컬럼 조회 (허브 SSO 자동 연결분)
 *   ② 환경변수 PS_HOSPITAL_MAP="bdd-001=로컬uuid,bdd-002=로컬uuid2" 폴백
 *
 * PS_SERVICE_KEY 미설정 시 503 — 기능 자체가 비활성 상태임을 명시 (거짓 200 금지)
 */
@Injectable()
export class PsServiceKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    if (!token || !constantTimeEqual(token, serviceKey)) {
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

    const localHospitalId = await this.resolveHospitalId(psHospitalId);
    if (!localHospitalId) {
      throw new NotFoundException({
        error: { code: 'HOSPITAL_NOT_MAPPED', message: `매핑되지 않은 병원 ID: ${psHospitalId}` },
      });
    }

    // 컨트롤러에서 req.psHospital로 접근
    req.psHospital = { psHospitalId, localHospitalId };
    return true;
  }

  /**
   * 전역 ID → 로컬 hospitalId 해석
   * ① hospital.psHospitalId 컬럼 (허브 SSO 자동 연결) → ② PS_HOSPITAL_MAP env 폴백
   */
  private async resolveHospitalId(psHospitalId: string): Promise<string | null> {
    try {
      const hospital = await this.prisma.hospital.findUnique({
        where: { psHospitalId },
        select: { id: true },
      });
      if (hospital) return hospital.id;
    } catch {
      // DB 조회 실패 시 env 폴백으로 진행 (공급 API 가용성 우선)
    }
    return resolveHospitalIdFromEnv(psHospitalId);
  }
}

/**
 * PS_HOSPITAL_MAP 파싱: "전역id=로컬id,전역id2=로컬id2"
 */
function resolveHospitalIdFromEnv(psHospitalId: string): string | null {
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
