import { IsString, IsEnum, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromptType } from '@prisma/client';

export class CreatePromptDto {
  @ApiProperty({ example: '강남구 임플란트 잘하는 치과 추천해줘', description: '질문 내용' })
  @IsString()
  promptText: string;

  @ApiPropertyOptional({ 
    enum: PromptType, 
    example: 'CUSTOM', 
    description: '질문 유형 (PRESET/CUSTOM/AUTO_GENERATED)' 
  })
  @IsOptional()
  @IsEnum(PromptType)
  promptType?: PromptType;

  @ApiPropertyOptional({ example: '임플란트', description: '진료과목 카테고리' })
  @IsOptional()
  @IsString()
  specialtyCategory?: string;

  @ApiPropertyOptional({ example: ['서울', '강남구'], description: '지역 키워드' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regionKeywords?: string[];

  @ApiPropertyOptional({ example: true, description: '활성화 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkCreatePromptsDto {
  @ApiProperty({ type: [CreatePromptDto], description: '질문 목록' })
  @IsArray()
  prompts: CreatePromptDto[];
}
