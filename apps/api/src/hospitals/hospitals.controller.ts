import { Controller, Get, Post, Put, Body, Param, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HospitalsService } from './hospitals.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('병원')
@Controller('hospitals')
export class HospitalsController {
  constructor(private hospitalsService: HospitalsService) {}

  @Public()
  @Get('active')
  @ApiOperation({ summary: '활성 병원 목록 (Cron용)', description: '자동 크롤링을 위한 활성 병원 목록' })
  async getActiveHospitals(@Headers('x-cron-secret') cronSecret: string) {
    // Cron Secret 검증
    const validSecret = process.env.CRON_SECRET || 'patient-signal-cron-secret-2024';
    if (cronSecret !== validSecret) {
      return [];
    }
    return this.hospitalsService.getActiveHospitals();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: '병원 등록', description: '새로운 병원을 등록합니다' })
  @ApiResponse({ status: 201, description: '병원 등록 성공' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateHospitalDto,
  ) {
    return this.hospitalsService.create(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: '병원 상세 조회', description: '병원 정보를 조회합니다' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findOne(@Param('id') id: string) {
    return this.hospitalsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: '병원 정보 수정', description: '병원 정보를 수정합니다' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateHospitalDto,
  ) {
    return this.hospitalsService.update(id, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/dashboard')
  @ApiOperation({ summary: '대시보드 데이터', description: '병원 대시보드 데이터를 조회합니다' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getDashboard(@Param('id') id: string) {
    return this.hospitalsService.getDashboard(id);
  }
}
