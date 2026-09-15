import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateLeadDto {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail({}, { message: 'A valid e-mail address is required.' })
  @MaxLength(200)
  email!: string;

  @ApiProperty({ enum: ['en', 'ja'], example: 'en' })
  @IsIn(['en', 'ja'])
  language!: 'en' | 'ja';

  /** Where the form lived, for attribution (e.g. "en-preview"). */
  @ApiPropertyOptional({ example: 'en-preview' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  source?: string;
}
