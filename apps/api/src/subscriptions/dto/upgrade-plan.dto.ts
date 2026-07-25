import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PlanType } from '@prisma/client';

/**
 * 【P0-1】 플랜 업그레이드 요청 DTO
 * 기존에는 inline 타입이라 런타임 검증이 전혀 없었음 (아무 문자열이나 통과 → Prisma 500)
 */
export class UpgradePlanDto {
  @ApiProperty({
    enum: PlanType,
    example: 'STANDARD',
    description: '업그레이드할 플랜',
  })
  @IsEnum(PlanType, { message: '유효한 플랜 타입이 아닙니다.' })
  planType: PlanType;
}
