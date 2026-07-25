import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { SpecialtyType } from '@prisma/client';

/**
 * 【P1-2】 프리셋 질문 생성 DTO
 *
 * 기존에는 `@Body() body: { specialtyType: string; region: string }` 인라인 타입이라
 * region이 없으면 서비스의 `region.split(' ')`에서 터져 500이 반환됐음.
 * specialtyType도 임의 문자열이 Prisma enum 컬럼까지 흘러가 500을 유발.
 */
export class GeneratePresetsDto {
  @ApiProperty({
    enum: SpecialtyType,
    example: 'DENTAL',
    description: '진료과목 (프리셋 질문 템플릿 조회 기준)',
  })
  @IsEnum(SpecialtyType, { message: '지원하지 않는 진료과목입니다.' })
  specialtyType: SpecialtyType;

  @ApiProperty({
    example: '서울 강남구',
    description: '지역 (질문 템플릿의 {지역} 자리에 치환됩니다)',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({ message: '지역을 입력해 주세요.' })
  @Length(2, 60, { message: '지역은 2~60자여야 합니다.' })
  region: string;
}
