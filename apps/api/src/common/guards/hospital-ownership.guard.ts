import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * HospitalOwnershipGuard — IDOR(Insecure Direct Object Reference) 차단 가드
 *
 * 문제: JwtAuthGuard만으로는 "로그인한 유저"인지만 확인할 뿐,
 *       URL의 :hospitalId가 그 유저의 병원인지 검증하지 않음.
 *       → 아무 유저나 경쟁 병원의 SoV/감성분석/매출 데이터 열람 가능했음.
 *
 * 동작:
 *  1. 라우트 파라미터에서 hospitalId(기본) 또는 @HospitalParam()으로 지정한 키를 읽음
 *  2. 파라미터가 없는 라우트는 통과 (병원 단위 리소스가 아님)
 *  3. JWT 유저의 hospitalId와 불일치하면 403 Forbidden
 *  4. ADMIN_EMAILS 환경변수(콤마 구분)에 등록된 운영자 계정은 전체 접근 허용
 *
 * 사용법:
 *   @UseGuards(JwtAuthGuard, HospitalOwnershipGuard)  // :hospitalId 라우트
 *
 *   @HospitalParam('id')                               // 파라미터 키가 :id인 경우
 *   @UseGuards(JwtAuthGuard, HospitalOwnershipGuard)
 *
 * 주의: 반드시 JwtAuthGuard 뒤에 배치해야 함 (request.user 필요)
 */

export const HOSPITAL_PARAM_KEY = 'hospitalOwnership:paramKey';

/** 병원 ID 라우트 파라미터 키를 지정하는 데코레이터 (기본값: 'hospitalId') */
export const HospitalParam = (paramKey: string) =>
  SetMetadata(HOSPITAL_PARAM_KEY, paramKey);

@Injectable()
export class HospitalOwnershipGuard implements CanActivate {
  private readonly logger = new Logger(HospitalOwnershipGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const paramKey =
      this.reflector.getAllAndOverride<string>(HOSPITAL_PARAM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'hospitalId';

    const targetHospitalId: string | undefined = request.params?.[paramKey];

    // 병원 단위 리소스가 아닌 라우트는 통과
    if (!targetHospitalId) return true;

    const user = request.user;
    if (!user) {
      // JwtAuthGuard 없이 단독 사용된 경우 방어
      throw new UnauthorizedException('인증이 필요합니다.');
    }

    // 운영자(서비스 어드민) 화이트리스트 — ADMIN_EMAILS=a@x.com,b@y.com
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (user.email && adminEmails.includes(String(user.email).toLowerCase())) {
      return true;
    }

    if (user.hospitalId !== targetHospitalId) {
      this.logger.warn(
        `IDOR 차단: user=${user.email}(hospital=${user.hospitalId}) → 요청 hospital=${targetHospitalId}`,
      );
      throw new ForbiddenException('해당 병원에 대한 접근 권한이 없습니다.');
    }

    return true;
  }
}
