import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadMagnetService, type StorePing } from './lead-magnet.service';

/**
 * Public, anonymous endpoints for the free-preview lead magnet on
 * thepatientfunnel.com/en|jp/preview. No auth, throttled per IP.
 */
@ApiTags('Free preview lead magnet (public)')
@Controller('public/lead-magnet')
export class LeadMagnetController {
  constructor(private readonly service: LeadMagnetService) {}

  @Post()
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Request the free preview (202; the first e-mail goes out at once)',
  })
  async submit(
    @Body() dto: CreateLeadDto,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    return this.service.submit(dto, req.ip);
  }

  /**
   * Store ping (webhook) for book sales. Form-encoded, unsigned; the service
   * checks the seller id. Always answers quickly so the store does not retry.
   */
  @Post('gumroad-ping')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Store sale ping → post-purchase sequence' })
  async storePing(
    @Body() body: Record<string, string>,
  ): Promise<{ ok: boolean; ignored?: string }> {
    return this.service.recordSale(body as StorePing);
  }

  @Get('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'One-click unsubscribe from the sequence' })
  async unsubscribe(@Query('t') token: string): Promise<string> {
    return this.service.unsubscribe(token);
  }
}
