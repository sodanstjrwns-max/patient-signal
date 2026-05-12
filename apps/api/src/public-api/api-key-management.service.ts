import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class ApiKeyManagementService {
  private readonly logger = new Logger(ApiKeyManagementService.name);
  private readonly MAX_KEYS_PER_HOSPITAL = 3;

  constructor(private prisma: PrismaService) {}

  // ==================== API Key 발급 ====================

  async createApiKey(params: {
    userId: string;
    hospitalId: string;
    name: string;
  }) {
    // 발급 개수 제한 체크
    const existingCount = await this.prisma.apiKey.count({
      where: {
        hospitalId: params.hospitalId,
        isActive: true,
      },
    });

    if (existingCount >= this.MAX_KEYS_PER_HOSPITAL) {
      throw new BadRequestException(
        `API Key는 병원당 최대 ${this.MAX_KEYS_PER_HOSPITAL}개까지 발급 가능합니다. 기존 키를 삭제 후 재발급해주세요.`,
      );
    }

    // 랜덤 키 생성: ps_live_ + 48바이트 hex
    const rawKey = `ps_live_${randomBytes(48).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 16); // "ps_live_xxxxxxxx"

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: params.name,
        keyHash,
        keyPrefix,
        hospitalId: params.hospitalId,
        userId: params.userId,
        scopes: ['read:aeo'],
        rateLimitPerMin: 60,
      },
    });

    this.logger.log(
      `[API Key] 발급 완료: ${keyPrefix}... (hospital: ${params.hospitalId})`,
    );

    // ⚠️ 원본 키는 이 응답에서만 1회 노출. 이후 조회 불가.
    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,  // 🔑 최초 1회만 노출
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      rateLimitPerMin: apiKey.rateLimitPerMin,
      createdAt: apiKey.createdAt,
      message: '⚠️ API Key는 이 화면에서만 확인 가능합니다. 안전한 곳에 복사해두세요.',
    };
  }

  // ==================== API Key 목록 조회 ====================

  async listApiKeys(hospitalId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { hospitalId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerMin: true,
        isActive: true,
        lastUsedAt: true,
        usageCount: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeCount = keys.filter(k => k.isActive).length;

    return {
      keys,
      meta: {
        total: keys.length,
        active: activeCount,
        maxAllowed: this.MAX_KEYS_PER_HOSPITAL,
        remaining: this.MAX_KEYS_PER_HOSPITAL - activeCount,
      },
    };
  }

  // ==================== API Key 비활성화 ====================

  async revokeApiKey(keyId: string, hospitalId: string) {
    const key = await this.prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!key) {
      throw new NotFoundException('API Key를 찾을 수 없습니다');
    }

    // 다른 병원의 키를 삭제하려는 시도 차단
    if (key.hospitalId !== hospitalId) {
      throw new ForbiddenException('권한이 없습니다');
    }

    if (!key.isActive) {
      throw new BadRequestException('이미 비활성화된 API Key입니다');
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    this.logger.log(
      `[API Key] 비활성화: ${key.keyPrefix}... (hospital: ${hospitalId})`,
    );

    return {
      success: true,
      message: `API Key (${key.keyPrefix}...)가 비활성화되었습니다. 이 키로는 더 이상 데이터 조회가 불가합니다.`,
    };
  }
}
