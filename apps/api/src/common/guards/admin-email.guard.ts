import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * AdminEmailGuard — 서비스 운영자 전용 엔드포인트 보호
 *
 * 문제: JwtAuthGuard만으로는 "로그인한 아무 유저"나 접근 가능.
 *       전체 구독 목록, DB 시드 같은 운영자 기능이 일반 클라이언트에 노출됨.
 *
 * 동작: ADMIN_EMAILS 환경변수(콤마 구분 화이트리스트)에 등록된
 *       이메일의 JWT 유저만 통과. 그 외 403.
 *
 * 사용법: @UseGuards(JwtAuthGuard, AdminEmailGuard)
 * 주의: 반드시 JwtAuthGuard 뒤에 배치 (request.user 필요)
 */
@Injectable()
export class AdminEmailGuard implements CanActivate {
  private readonly logger = new Logger(AdminEmailGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('인증이 필요합니다.');
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (
      user.email &&
      adminEmails.includes(String(user.email).toLowerCase())
    ) {
      return true;
    }

    this.logger.warn(
      `관리자 엔드포인트 접근 차단: user=${user.email || user.id}`,
    );
    throw new ForbiddenException('관리자 권한이 필요합니다.');
  }
}
