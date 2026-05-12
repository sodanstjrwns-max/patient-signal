import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyManagementService } from './api-key-management.service';

@ApiTags('API Key 관리 (대시보드)')
@Controller('api-keys')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApiKeyManagementController {
  constructor(private apiKeyService: ApiKeyManagementService) {}

  // ==================== API Key 발급 ====================

  @Post()
  @ApiOperation({
    summary: 'API Key 발급',
    description: '내 병원용 API Key를 발급합니다. 최대 3개까지 발급 가능.',
  })
  async createApiKey(
    @Req() req: any,
    @Body() body: { name?: string },
  ) {
    const userId = req.user?.id || req.user?.sub;
    const hospitalId = req.user?.hospitalId;

    if (!hospitalId) {
      throw new BadRequestException('병원이 등록되지 않은 계정입니다');
    }

    return this.apiKeyService.createApiKey({
      userId,
      hospitalId,
      name: body.name || '내 API Key',
    });
  }

  // ==================== API Key 목록 조회 ====================

  @Get()
  @ApiOperation({
    summary: 'API Key 목록',
    description: '내 병원에 발급된 API Key 목록을 조회합니다.',
  })
  async listApiKeys(@Req() req: any) {
    const hospitalId = req.user?.hospitalId;

    if (!hospitalId) {
      throw new BadRequestException('병원이 등록되지 않은 계정입니다');
    }

    return this.apiKeyService.listApiKeys(hospitalId);
  }

  // ==================== API Key 삭제 (비활성화) ====================

  @Delete(':keyId')
  @ApiOperation({
    summary: 'API Key 삭제',
    description: 'API Key를 비활성화합니다. 해당 키로는 더 이상 데이터 조회가 불가합니다.',
  })
  async revokeApiKey(
    @Req() req: any,
    @Param('keyId') keyId: string,
  ) {
    const hospitalId = req.user?.hospitalId;

    if (!hospitalId) {
      throw new BadRequestException('병원이 등록되지 않은 계정입니다');
    }

    return this.apiKeyService.revokeApiKey(keyId, hospitalId);
  }
}
