import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('X-API-Key 헤더가 필요합니다');
    }

    // API Key → SHA-256 해시
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const keyRecord = await this.prisma.apiKey.findUnique({
      where: { keyHash },
    });

    if (!keyRecord) {
      this.logger.warn(`[API Key] 유효하지 않은 키 시도: ${apiKey.substring(0, 8)}...`);
      throw new UnauthorizedException('유효하지 않은 API Key입니다');
    }

    if (!keyRecord.isActive) {
      throw new UnauthorizedException('비활성화된 API Key입니다');
    }

    // 만료 체크
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('만료된 API Key입니다');
    }

    // 사용 통계 업데이트 (비동기 — 응답 지연 방지)
    this.prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    }).catch(err => this.logger.warn(`[API Key] 사용 통계 업데이트 실패: ${err.message}`));

    // request에 스코프 정보 첨부 (컨트롤러에서 참조 가능)
    request.apiKeyScopes = keyRecord.scopes;
    request.apiKeyId = keyRecord.id;

    return true;
  }
}
