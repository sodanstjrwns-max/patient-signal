import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthService } from './auth.service';
import {
  HubSsoClaims,
  findGlobalIdFromMap,
  resolveLocalIdFromMap,
  verifyHubSsoToken,
} from './hub-sso.util';

export const HUB_SSO_SERVICE_SLUG = 'signal';
export const HUB_AUTHORIZE_URL = 'https://hub.patientfunnel.kr/sso/authorize';

// 허브 발급부에 등록된 콜백 origin 화이트리스트 — 이 외 값(FRONTEND_URL이
// Vercel 프리뷰 등)이면 기본 origin으로 강제한다.
const ALLOWED_CALLBACK_ORIGINS = ['https://patientsignal.kr', 'https://www.patientsignal.kr'];
const DEFAULT_CALLBACK_ORIGIN = 'https://patientsignal.kr';

/**
 * Patient Hub SSO 로그인 처리 (형제 서비스 공통 콜백 정책)
 * 1. 토큰 검증 실패 → 로그인 화면 error 리다이렉트 (컨트롤러/프론트 담당)
 * 2. email(소문자)로 기존 유저 있으면 그 계정 로그인 + 병원 psHospitalId 가드된 채움
 * 3. 없으면 hid로 병원 찾아 합류 후 유저 생성. 병원이 없으면 유저만 생성하고
 *    hid를 pendingPsHospitalId로 보관 → 온보딩(병원 생성) 시 연결
 * 4. 정상 로그인과 동일한 세션/토큰 발급
 *
 * PS_SSO_SECRET 미설정 시 503 — 기능 자체가 비활성 상태임을 명시 (거짓 200 금지,
 * ps-open-api의 PS_SERVICE_KEY 게이트와 동일한 패턴).
 */
@Injectable()
export class HubSsoService {
  private readonly logger = new Logger(HubSsoService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  isConfigured(): boolean {
    return !!process.env.PS_SSO_SECRET?.trim();
  }

  assertConfigured(): string {
    const secret = process.env.PS_SSO_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException({
        error: {
          code: 'HUB_SSO_NOT_CONFIGURED',
          message: 'Patient Hub SSO가 아직 활성화되지 않았습니다 (PS_SSO_SECRET 미설정)',
        },
      });
    }
    return secret;
  }

  /** 허브 authorize URL 생성 (시작 라우트에서 302) */
  buildAuthorizeUrl(): string {
    const frontendUrl = (process.env.FRONTEND_URL || DEFAULT_CALLBACK_ORIGIN).replace(/\/+$/, '');
    const origin = ALLOWED_CALLBACK_ORIGINS.includes(frontendUrl)
      ? frontendUrl
      : DEFAULT_CALLBACK_ORIGIN;
    const redirectUri = `${origin}/auth/hub/callback`;
    return `${HUB_AUTHORIZE_URL}?service=${HUB_SSO_SERVICE_SLUG}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  /** 콜백: sso_token 검증 → 로그인/합류/생성 → 시그널 정상 토큰 발급 */
  async loginWithToken(ssoToken: string) {
    const secret = this.assertConfigured();

    const claims = verifyHubSsoToken(secret, ssoToken, HUB_SSO_SERVICE_SLUG);
    if (!claims) {
      throw new UnauthorizedException('유효하지 않은 Patient Hub SSO 토큰입니다');
    }
    return this.loginWithClaims(claims);
  }

  private async loginWithClaims(claims: HubSsoClaims) {
    const email = claims.email.trim().toLowerCase();

    // 1) 기존 유저 (이메일 대소문자 무시 매칭)
    let user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { hospital: true },
    });

    if (user) {
      await this.fillHospitalGlobalIdGuarded(user.hospitalId, claims.hid);
    } else {
      // 2) 신규 유저 — hid로 병원 합류 (psHospitalId 컬럼 → PS_HOSPITAL_MAP env 순)
      let hospital = await this.prisma.hospital.findUnique({
        where: { psHospitalId: claims.hid },
      });
      if (!hospital) {
        const mappedLocalId = resolveLocalIdFromMap(claims.hid);
        if (mappedLocalId) {
          hospital = await this.prisma.hospital.findUnique({ where: { id: mappedLocalId } });
        }
      }

      this.logger.log(
        `Hub SSO: creating user ${email} (hid=${claims.hid}, hospital=${hospital ? hospital.id : 'none → onboarding'})`,
      );

      user = await this.prisma.user.create({
        data: {
          email,
          name: claims.name || claims.email.split('@')[0],
          passwordHash: '', // SSO 유저는 비밀번호 없음 (Google 로그인과 동일 정책)
          role: this.mapHubRole(claims.role),
          isPfMember: false,
          emailVerified: true, // 허브에서 이미 인증된 계정
          hospitalId: hospital?.id ?? null,
          // 병원이 없으면 hid를 보관 → 온보딩 병원 생성 시 psHospitalId로 이전
          pendingPsHospitalId: hospital ? null : claims.hid,
        },
        include: { hospital: true },
      });

      if (hospital) {
        await this.fillHospitalGlobalIdGuarded(hospital.id, claims.hid);
      }
    }

    // 3) 로그인 활동 기록
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });

    // 4) 정상 로그인과 동일한 토큰 발급
    const tokens = await this.authService.generateTokens(
      user.id,
      user.email,
      user.role,
      user.hospitalId,
    );

    this.logger.log(`Hub SSO: login success for ${email} (hid=${claims.hid})`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hospitalId: user.hospitalId,
        hospital: user.hospital,
        isPfMember: user.isPfMember,
      },
      ...tokens,
      redirect: user.hospitalId ? '/dashboard' : '/onboarding',
      // 병원 미보유 유저(→온보딩행)에게 허브 병원명을 전달 → 온보딩 병원명 프리필
      pendingHospitalName: user.hospitalId ? undefined : claims.hname || undefined,
    };
  }

  /**
   * 허브 role → 시그널 UserRole 매핑
   * director(원장)→OWNER, manager(실장/관리자)→ADMIN, staff→VIEWER
   */
  private mapHubRole(hubRole: string): UserRole {
    switch (hubRole) {
      case 'director':
        return UserRole.OWNER;
      case 'manager':
        return UserRole.ADMIN;
      default:
        return UserRole.VIEWER;
    }
  }

  /**
   * 가드된 psHospitalId 채움:
   * - 이미 값이 있으면 건드리지 않음 (덮어쓰기 금지)
   * - PS_HOSPITAL_MAP(파일럿 고정 매핑)이 이 병원을 다른 전역 ID로 가리키면 스킵 (충돌 방지)
   * - unique 충돌(같은 hid를 이미 다른 병원이 보유) 시 스킵 + 경고 로그
   */
  private async fillHospitalGlobalIdGuarded(
    hospitalId: string | null,
    hid: string,
  ): Promise<void> {
    if (!hospitalId || !hid) return;

    const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital) return;

    if (hospital.psHospitalId) {
      if (hospital.psHospitalId !== hid) {
        this.logger.warn(
          `Hub SSO: hospital ${hospitalId} already mapped to ${hospital.psHospitalId}, token hid=${hid} — keeping existing`,
        );
      }
      return;
    }

    const mappedGlobalId = findGlobalIdFromMap(hospitalId);
    if (mappedGlobalId && mappedGlobalId !== hid) {
      this.logger.warn(
        `Hub SSO: PS_HOSPITAL_MAP maps hospital ${hospitalId} to ${mappedGlobalId}, token hid=${hid} — skip fill`,
      );
      return;
    }

    try {
      await this.prisma.hospital.update({
        where: { id: hospitalId },
        data: { psHospitalId: hid },
      });
      this.logger.log(`Hub SSO: hospital ${hospitalId} linked to ps_hospital_id=${hid}`);
    } catch (err) {
      // P2002 unique 충돌 등 — 다른 병원이 이미 이 hid를 보유
      this.logger.warn(
        `Hub SSO: failed to link hospital ${hospitalId} to hid=${hid}: ${err?.message}`,
      );
    }
  }
}
