import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'doctor@clinic.com', description: '이메일 주소' })
  @IsEmail({}, { message: '올바른 이메일 형식을 입력해주세요' })
  email: string;

  @ApiProperty({ example: 'SecurePass123!', description: '비밀번호' })
  @IsString()
  password: string;
}
