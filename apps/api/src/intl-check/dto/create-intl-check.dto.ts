import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { INTL_SPECIALTIES } from '../templates.types';

type Tx = { value: unknown };
const trim = ({ value }: Tx): unknown =>
  typeof value === 'string' ? value.trim() : value;
const upper = ({ value }: Tx): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const lower = ({ value }: Tx): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const snake = ({ value }: Tx): unknown =>
  typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
    : value;

export class CreateIntlCheckDto {
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  clinicName!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 80)
  city!: string;

  /** ISO-3166 alpha-2 (US/UK/AU/CA/JP …); other codes accepted */
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z]{2,3}$/, {
    message: 'country must be a 2–3 letter country code',
  })
  country!: string;

  @Transform(lower)
  @IsIn(['en', 'ja'])
  language!: 'en' | 'ja';

  @Transform(lower)
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @Transform(snake)
  @IsIn([...INTL_SPECIALTIES])
  specialty?: string;
}
