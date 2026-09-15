import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CreateIntlCheckDto } from './dto/create-intl-check.dto';
import { IntlCheckService } from './intl-check.service';

/**
 * Public, anonymous endpoints for the international AI Visibility Check.
 * Mounted at /api/public/intl-check (global prefix "api").
 * No auth. Throttled per IP here + 3/day per e-mail and per IP in the service.
 */
@ApiTags('Intl AI Visibility Check (public)')
@Controller('public/intl-check')
export class IntlCheckController {
  constructor(private readonly service: IntlCheckService) {}

  @Post()
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Submit an anonymous AI Visibility Check (202 + id, runs in background)',
  })
  async submit(
    @Body() dto: CreateIntlCheckDto,
    @Req() req: Request,
  ): Promise<{ id: string }> {
    return this.service.submit(dto, req.ip);
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Check status + result (result is present when status=DONE)',
  })
  async status(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getStatus(id);
  }
}
