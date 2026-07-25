import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CouponType, PlanType } from '@prisma/client';

/**
 * 【P0-2】 쿠폰 생성 DTO
 * 기존에는 `@Body() body: any` → Prisma로 그대로 흘려보내
 * 임의 필드 주입 / 타입 오류 500 / 무제한 무료개월 발급이 가능했음.
 */
export class CreateCouponDto {
  @ApiProperty({ example: 'PF2026', description: '쿠폰 코드 (영문 대문자/숫자/하이픈)' })
  @IsString()
  @Length(3, 32)
  @Matches(/^[A-Z0-9-]+$/, {
    message: '쿠폰 코드는 영문 대문자, 숫자, 하이픈만 사용할 수 있습니다.',
  })
  code: string;

  @ApiProperty({ example: '패션퍼널 멤버 전용' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ example: '기수 수료생 대상 3개월 무료' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiProperty({ enum: CouponType, example: 'FREE_PERIOD' })
  @IsEnum(CouponType, { message: '유효한 쿠폰 타입이 아닙니다.' })
  couponType: CouponType;

  @ApiPropertyOptional({ example: 30, description: '할인율 (%)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ example: 50000, description: '할인 금액 (원)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 3, description: '무료 제공 개월 수 (최대 24)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  freeMonths?: number;

  @ApiPropertyOptional({ enum: PlanType, isArray: true, example: ['STARTER', 'STANDARD'] })
  @IsOptional()
  @IsArray()
  @IsEnum(PlanType, { each: true, message: '유효한 플랜 타입이 아닙니다.' })
  applicablePlans?: PlanType[];

  @ApiPropertyOptional({ example: 100, description: '전체 사용 한도 (0=무제한)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  maxUses?: number;

  @ApiPropertyOptional({ example: 1, description: '병원당 사용 한도' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxUsesPerUser?: number;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
