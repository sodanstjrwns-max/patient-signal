import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PromptsService } from './prompts.service';
import { CreatePromptDto, BulkCreatePromptsDto } from './dto/create-prompt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('질문 관리')
@Controller('prompts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PromptsController {
  constructor(private promptsService: PromptsService) {}

  @Post(':hospitalId')
  @ApiOperation({ summary: '질문 추가', description: '새로운 모니터링 질문을 추가합니다' })
  @ApiResponse({ status: 201, description: '질문 생성 성공' })
  async create(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: CreatePromptDto,
  ) {
    return this.promptsService.create(hospitalId, dto);
  }

  @Post(':hospitalId/bulk')
  @ApiOperation({ summary: '질문 대량 추가' })
  async bulkCreate(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: BulkCreatePromptsDto,
  ) {
    return this.promptsService.bulkCreate(hospitalId, dto);
  }

  @Get(':hospitalId')
  @ApiOperation({ summary: '질문 목록 조회' })
  async findAll(
    @Param('hospitalId') hospitalId: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.promptsService.findAll(hospitalId, onlyActive !== 'false');
  }

  @Get('detail/:id')
  @ApiOperation({ summary: '질문 상세 조회' })
  async findOne(@Param('id') id: string) {
    return this.promptsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '질문 수정' })
  async update(
    @Param('id') id: string,
    @CurrentUser('hospitalId') hospitalId: string,
    @Body() dto: Partial<CreatePromptDto>,
  ) {
    return this.promptsService.update(id, hospitalId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '질문 삭제' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('hospitalId') hospitalId: string,
  ) {
    return this.promptsService.delete(id, hospitalId);
  }

  @Post(':id/toggle')
  @ApiOperation({ summary: '질문 활성화/비활성화 토글' })
  async toggleActive(
    @Param('id') id: string,
    @CurrentUser('hospitalId') hospitalId: string,
  ) {
    return this.promptsService.toggleActive(id, hospitalId);
  }

  @Post(':hospitalId/generate-presets')
  @ApiOperation({ summary: '프리셋 질문 생성' })
  async generateFromPresets(
    @Param('hospitalId') hospitalId: string,
    @Body() body: { specialtyType: string; region: string },
  ) {
    return this.promptsService.generateFromPresets(
      hospitalId,
      body.specialtyType,
      body.region,
    );
  }

  @Post(':id/fanouts')
  @ApiOperation({ summary: '질문 변형 생성 (Query Fanouts)' })
  async generateFanouts(@Param('id') id: string) {
    return this.promptsService.generateFanouts(id);
  }
}
