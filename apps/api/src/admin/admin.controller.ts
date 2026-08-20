import { Controller, Get, Post, Query, Headers, Logger, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminService } from './admin.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('관리자')
@Controller('admin')
@Throttle({ default: { limit: 30, ttl: 60000 } }) // 관리자 API: 1분에 30회
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private adminService: AdminService) {}

  /**
   * 관리자 대시보드 통계
   * GET /api/admin/dashboard?secret=xxx
   */
  @Public()
  @Get('dashboard')
  async getDashboard(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    return this.adminService.getDashboard();
  }

  /**
   * 【P1-6】LLM 비용 대시보드 — 병원별/플랫폼별 크롤링 원가
   * GET /api/admin/llm-costs?secret=xxx&days=30
   */
  @Public()
  @Get('llm-costs')
  async getLlmCosts(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('days') days?: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    return this.adminService.getLlmCosts(parseInt(days || '30'));
  }

  /**
   * 전체 유저 목록
   * GET /api/admin/users?secret=xxx
   */
  @Public()
  @Get('users')
  async getUsers(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    return this.adminService.getUsers();
  }

  /**
   * 전체 병원 목록
   * GET /api/admin/hospitals?secret=xxx
   */
  @Public()
  @Get('hospitals')
  async getHospitals(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    return this.adminService.getHospitals();
  }

  /**
   * 쿠폰 사용 현황
   * GET /api/admin/coupons?secret=xxx
   */
  @Public()
  @Get('coupons')
  async getCoupons(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    return this.adminService.getCoupons();
  }

  /**
   * 회원 활동 현황 (로그인 추적)
   * GET /api/admin/activity?secret=xxx&sort=lastLogin|loginCount|responses
   */
  @Public()
  @Get('activity')
  async getActivity(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('sort') sort: string = 'lastLogin',
  ) {
    this.validateSecret(headerSecret || querySecret);
    return this.adminService.getUserActivity(sort);
  }

  /**
   * 기존 FREE 유저들에게 STARTER 7일 트라이얼 소급 적용
   * POST /api/admin/grant-trials?secret=xxx
   */
  @Public()
  @Post('grant-trials')
  async grantTrialsToFreeUsers(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    return this.adminService.grantStarterTrialToFreeUsers();
  }

  // ==================== 실시간 질문 인사이트 ====================

  /**
   * 전체 실시간 질문 인사이트 대시보드
   * GET /api/admin/live-query/insights?secret=xxx&days=30
   *
   * 전체 통계, 카테고리 분포, 인기 질문, 트렌드, 병원별 랭킹,
   * 플랫폼별 성과, 경쟁사 빈출 랭킹, 시간대별 패턴 등
   */
  @Public()
  @Get('live-query/insights')
  async getLiveQueryInsights(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('days') days?: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    const daysNum = parseInt(days || '30', 10);
    this.logger.log(`[Admin] 실시간 질문 인사이트 조회 (최근 ${daysNum}일)`);
    return this.adminService.getLiveQueryInsights(daysNum);
  }

  /**
   * 전체 실시간 질문 로그 조회 (페이지네이션 + 필터)
   * GET /api/admin/live-query/logs?secret=xxx&page=1&limit=50&category=PROCEDURE&hospitalId=xxx&search=임플란트&days=30
   */
  @Public()
  @Get('live-query/logs')
  async getLiveQueryLogs(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('category') category?: string,
    @Query('days') days?: string,
    @Query('search') search?: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    this.logger.log(`[Admin] 실시간 질문 로그 조회`);
    return this.adminService.getLiveQueryLogs({
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '50', 10),
      hospitalId: hospitalId || undefined,
      category: category || undefined,
      days: parseInt(days || '30', 10),
      search: search || undefined,
    });
  }

  /**
   * 무결제 구독을 TRIAL로 마이그레이션 (체험→과금 전환)
   * POST /api/admin/migrate-to-trial?secret=xxx&days=7
   * 
   * 대상: ACTIVE + 빌링키 없음 + STARTER/STANDARD (ENTERPRISE/PRO 제외)
   * 결과: TRIAL 7일(기본)로 전환 → Cron이 D-3,D-1,D-day 이메일 + 만료 시 FREE 다운그레이드
   */
  @Public()
  @Post('migrate-to-trial')
  async migrateUnpaidToTrial(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('days') days?: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    const trialDays = parseInt(days || '7', 10);
    this.logger.log(`[Admin] 무결제 구독 → TRIAL ${trialDays}일 마이그레이션 시작`);
    return this.adminService.migrateUnpaidSubscriptionsToTrial(trialDays);
  }

  /**
   * 【어드민】전체 고객 병원 SoV 랭킹
   * GET /api/admin/sov-ranking?secret=xxx&days=30
   *
   * 각 병원의 최근 N일 언급률(SoV %)을 내림차순 정렬.
   * 응답 8건 미만 병원은 lowConfidence=true 표시.
   */
  @Public()
  @Get('sov-ranking')
  async getSovRanking(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('days') days?: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    const daysNum = Math.min(Math.max(parseInt(days || '30', 10) || 30, 1), 365);
    return this.adminService.getSovRanking(daysNum);
  }

  /**
   * 【어드민】날짜별 SoV 순위 추이
   * GET /api/admin/sov-daily?secret=xxx&days=30&hospitalId=xxx(선택)
   *
   * hospitalId 없으면: 날짜별 전체 순위표 배열
   * hospitalId 있으면: 그 병원의 일별 순위/SoV 시계열 (그래프용)
   */
  @Public()
  @Get('sov-daily')
  async getSovDaily(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('days') days?: string,
    @Query('hospitalId') hospitalId?: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    const daysNum = Math.min(Math.max(parseInt(days || '30', 10) || 30, 1), 90);
    return this.adminService.getSovDaily(daysNum, hospitalId || undefined);
  }

  /**
   * 【외국인 GEO 실험】영어 질문 세트 + 영문 별칭 시딩
   * POST /api/admin/seed-foreigner-prompts?secret=xxx&hospitalId=xxx
   *
   * Quora/Medium → AI 인용 전환 추적을 위한 영어 트래킹 질문 6종 추가.
   * 중복 실행 안전 (동일 질문 존재 시 스킵).
   */
  @Public()
  @Post('seed-foreigner-prompts')
  async seedForeignerPrompts(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('hospitalId') hospitalId: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    if (!hospitalId) {
      return { success: false, error: 'hospitalId 쿼리 파라미터가 필요합니다' };
    }
    this.logger.log(`[Admin] 외국인 GEO 질문 세트 시딩 시작: ${hospitalId}`);
    return this.adminService.seedForeignerGeoPrompts(hospitalId);
  }

  /**
   * 【어드민】인용 출처 도메인 집계 + 신규 등장 탐지
   * GET /api/admin/citation-domains?secret=xxx&days=30
   */
  @Public()
  @Get('citation-domains')
  async getCitationDomains(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('days') days?: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    const daysNum = Math.min(Math.max(parseInt(days || '30', 10) || 30, 1), 365);
    return this.adminService.getCitationDomains(daysNum);
  }

  /**
   * 【어드민】신뢰검증 단계(REVIEW+FEAR) 심층 진단
   * GET /api/admin/trust-diagnosis?secret=xxx&hospitalId=xxx&days=30
   */
  @Public()
  @Get('trust-diagnosis')
  async getTrustDiagnosis(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    if (!hospitalId) {
      return { success: false, error: 'hospitalId 쿼리 파라미터가 필요합니다' };
    }
    const daysNum = Math.min(Math.max(parseInt(days || '30', 10) || 30, 1), 365);
    return this.adminService.getTrustDiagnosis(hospitalId, daysNum);
  }

  /**
   * 【원장용 보드】병원 스코프 대시보드 — 병원별 접근코드로 열람
   * GET /api/admin/hospital-board?hospitalId=xxx&code=xxx&days=30
   *
   * code = HMAC(ADMIN_SECRET, hospitalId) 앞 12자 — 병원마다 고유.
   * 이 코드로는 해당 병원 데이터만 열림 (타 병원 실명 비노출, 경쟁은 익명 라벨).
   */
  @Public()
  @Get('hospital-board')
  async getHospitalBoard(
    @Headers('x-board-code') headerCode: string,
    @Query('code') queryCode: string,
    @Query('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    const expected = this.adminService.boardCodeFor(hospitalId);
    const provided = headerCode || queryCode;
    if (!hospitalId || !expected || !provided || provided !== expected) {
      throw new UnauthorizedException('Unauthorized');
    }
    const daysNum = Math.min(Math.max(parseInt(days || '30', 10) || 30, 7), 90);
    return this.adminService.getHospitalBoard(hospitalId, daysNum);
  }

  /**
   * 【어드민】병원별 보드 접근코드 조회 — 원장님께 전달할 코드 발급용
   * GET /api/admin/board-code?secret=xxx&hospitalId=xxx
   */
  @Public()
  @Get('board-code')
  async getBoardCode(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('hospitalId') hospitalId: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    if (!hospitalId) {
      return { success: false, error: 'hospitalId 쿼리 파라미터가 필요합니다' };
    }
    return {
      success: true,
      hospitalId,
      code: this.adminService.boardCodeFor(hospitalId),
      boardUrl: `https://patientsignal.kr/board/${hospitalId}`,
    };
  }

  /**
   * 【크롤 전수 점검】크롤 헬스 체크
   * GET /api/admin/crawl-health?secret=xxx&days=7
   */
  @Public()
  @Get('crawl-health')
  async getCrawlHealth(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('days') days?: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    return this.adminService.getCrawlHealth(days ? parseInt(days, 10) : 7);
  }

  /**
   * 【어드민·디버그】Gemini flash-lite grounding 단건 호출 진단
   * GET /api/admin/debug-gemini?secret=xxx&model=gemini-2.5-flash-lite
   *
   * 배경: 크롤에서 flash-lite STEP1이 전멸하고 2.5-flash 폴백만 도는 원인 규명용.
   * 프로덕션 환경(실제 GEMINI_API_KEY)에서 flash-lite + google_search를 1회 호출해
   * 에러 원문을 그대로 반환한다.
   */
  @Public()
  @Get('debug-gemini')
  async debugGemini(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('model') model?: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiApiKey) return { success: false, error: 'GEMINI_API_KEY 미설정' };

    const modelName = (model || 'gemini-2.5-flash-lite').replace(/[^a-z0-9.\-]/gi, '');
    const started = Date.now();
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: '천안 임플란트 잘하는 치과 추천해줘' }] }],
            generationConfig: { maxOutputTokens: 500 },
            tools: [{ google_search: {} }],
          }),
        },
      );
      const data: any = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.filter((p: any) => p.text).map((p: any) => p.text).join('');
      return {
        success: !data?.error,
        model: modelName,
        httpStatus: response.status,
        elapsedMs: Date.now() - started,
        error: data?.error || null,
        textPreview: text.slice(0, 300),
        finishReason: data?.candidates?.[0]?.finishReason || null,
        groundingChunks: data?.candidates?.[0]?.groundingMetadata?.groundingChunks?.length ?? 0,
        usage: data?.usageMetadata || null,
      };
    } catch (e: any) {
      return { success: false, model: modelName, elapsedMs: Date.now() - started, thrownError: e?.message };
    }
  }

  /**
   * 【어드민·디버그】xAI 서빙 모델 목록 + Grok 단건 호출 진단
   * GET /api/admin/debug-grok?secret=xxx            → xAI /v1/models 목록 (실제 서빙명 확인)
   * GET /api/admin/debug-grok?secret=xxx&model=grok-4.1-fast → 해당 모델 1회 호출 테스트
   *
   * 배경: GROK_MODEL env가 없는데도 크롤 770건 전부 grok-4.3으로 기록됨
   * → grok-4.1-fast가 미서빙명이라 코드가 4.3으로 자동 폴백 중인 것으로 추정.
   * 실제 서빙 모델명을 실측해 최저가 모델명을 확정한다.
   */
  @Public()
  @Get('debug-grok')
  async debugGrok(
    @Headers('x-admin-secret') headerSecret: string,
    @Query('secret') querySecret: string,
    @Query('model') model?: string,
  ) {
    this.validateSecret(headerSecret || querySecret);
    const xaiApiKey = process.env.XAI_API_KEY?.trim();
    if (!xaiApiKey) return { success: false, error: 'XAI_API_KEY 미설정' };

    const started = Date.now();

    // 모델 미지정 → 서빙 중인 모델 목록 반환
    if (!model) {
      try {
        const res = await fetch('https://api.x.ai/v1/models', {
          headers: { Authorization: `Bearer ${xaiApiKey}` },
        });
        const data: any = await res.json();
        const models = (data?.data || []).map((m: any) => m.id).sort();
        return { success: res.ok, httpStatus: res.status, elapsedMs: Date.now() - started, models, error: data?.error || null };
      } catch (e: any) {
        return { success: false, elapsedMs: Date.now() - started, thrownError: e?.message };
      }
    }

    // 모델 지정 → Responses API 단건 호출 테스트 (크롤과 동일 경로)
    const modelName = model.replace(/[^a-z0-9.\-]/gi, '');
    try {
      const res = await fetch('https://api.x.ai/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${xaiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          input: [{ role: 'user', content: '천안 임플란트 잘하는 치과 추천해줘' }],
          tools: [{ type: 'web_search' }],
        }),
      });
      const data: any = await res.json();
      // Responses API output에서 텍스트 추출
      let text = '';
      for (const item of data?.output || []) {
        for (const c of item?.content || []) {
          if (typeof c?.text === 'string') text += c.text;
        }
      }
      return {
        success: !data?.error && res.ok,
        model: modelName,
        httpStatus: res.status,
        elapsedMs: Date.now() - started,
        error: data?.error || null,
        actualModel: data?.model || null,
        textPreview: text.slice(0, 300),
        usage: data?.usage || null,
      };
    } catch (e: any) {
      return { success: false, model: modelName, elapsedMs: Date.now() - started, thrownError: e?.message };
    }
  }

  private validateSecret(secret: string) {
    // 보안: 하드코딩 fallback 제거 — ADMIN_SECRET 미설정 시 무조건 차단
    // 권장: x-admin-secret 헤더 사용 (쿼리파라미터는 액세스 로그 유출 위험 — 하위호환용)
    const validSecret = process.env.ADMIN_SECRET;
    if (!validSecret || !secret || secret !== validSecret) {
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
