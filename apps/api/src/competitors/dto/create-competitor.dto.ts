import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 【P1-2】 경쟁사 추가 DTO
 *
 * 기존에는 컨트롤러가 `@Body() dto: { competitorName: string; ... }` 인라인 타입이라
 * 런타임 검증이 전혀 없었음. competitorName 누락 시
 * `isSameDentalClinic()` 내부의 `.trim()`에서 터져 500이 반환됐음.
 */
export class CreateCompetitorDto {
  @ApiProperty({ example: '강남우리치과', description: '경쟁 병원 이름' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '경쟁사 이름을 입력해 주세요.' })
  @Length(2, 100, { message: '경쟁사 이름은 2~100자여야 합니다.' })
  competitorName: string;

  @ApiPropertyOptional({ example: '서울 강남구', description: '경쟁 병원 지역' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(0, 100)
  competitorRegion?: string;
}
