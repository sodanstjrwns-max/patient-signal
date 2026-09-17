import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsObject,
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

  /** Exact version of the unchecked-by-default consent the reader accepted. */
  @ApiPropertyOptional({ enum: ['2026-09-17'] })
  @IsOptional()
  @IsIn(['2026-09-17'])
  consentVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attribution?: Record<string, unknown>;
}
