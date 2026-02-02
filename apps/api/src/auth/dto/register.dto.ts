import { IsEmail, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'doctor@clinic.com', description: '이메일 주소' })
  @IsEmail({}, { message: '올바른 이메일 형식을 입력해주세요' })
  email: string;

  @ApiProperty({ example: 'SecurePass123!', description: '비밀번호 (최소 8자)' })
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다' })
  password: string;

  @ApiProperty({ example: '홍길동', description: '이름' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '010-1234-5678', description: '전화번호' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: true, description: '페이션트퍼널 수강생 여부' })
  @IsOptional()
  @IsBoolean()
  isPfMember?: boolean;
}
