import { IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SpecialtyType } from '@prisma/client';

export class CreateHospitalDto {
  @ApiProperty({ example: '서울비디치과', description: '병원명' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '123-45-67890', description: '사업자등록번호' })
  @IsOptional()
  @IsString()
  businessNumber?: string;

  @ApiProperty({ 
    enum: SpecialtyType, 
    example: 'DENTAL', 
    description: '진료과목 유형' 
  })
  @IsEnum(SpecialtyType)
  specialtyType: SpecialtyType;

  @ApiPropertyOptional({ 
    example: ['임플란트', '교정', '미백'], 
    description: '세부 진료과목' 
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subSpecialties?: string[];

  @ApiProperty({ example: '서울특별시', description: '시/도' })
  @IsString()
  regionSido: string;

  @ApiProperty({ example: '강남구', description: '시/군/구' })
  @IsString()
  regionSigungu: string;

  @ApiPropertyOptional({ example: '역삼동', description: '동/읍/면' })
  @IsOptional()
  @IsString()
  regionDong?: string;

  @ApiPropertyOptional({ example: '서울시 강남구 역삼동 123-45', description: '전체 주소' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'https://www.hospital.com', description: '웹사이트 URL' })
  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @ApiPropertyOptional({ example: '12345678', description: '네이버 플레이스 ID' })
  @IsOptional()
  @IsString()
  naverPlaceId?: string;

  // ── 신규 온보딩 필드 ──

  @ApiPropertyOptional({ 
    example: ['임플란트', '치아교정', '라미네이트'], 
    description: '주력 진료/시술 (환자 유입 핵심 키워드)' 
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coreTreatments?: string[];

  @ApiPropertyOptional({ 
    example: ['강남역', '선릉역', '역삼동', '논현동'], 
    description: '주요 내원 지역 (환자가 많이 오는 지역/역세권)' 
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRegions?: string[];

  @ApiPropertyOptional({ 
    example: ['ABC치과', 'XYZ치과의원'], 
    description: '경쟁 병원명 (온보딩 시 직접 입력)' 
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competitorNames?: string[];
}
