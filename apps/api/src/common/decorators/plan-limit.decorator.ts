import { SetMetadata } from '@nestjs/common';
import { PlanType } from '@prisma/client';

export const PLAN_LIMITS_KEY = 'plan_limits';

export interface PlanLimitOptions {
  /**
   * 체크할 기능명 (PLAN_LIMITS의 키)
   * - 'maxPrompts' | 'maxCompetitors' | 'crawlsPerMonth' | 'exportEnabled' 등
   */
  feature?: string;

  /**
   * 수량 체크 시 Prisma _count 필드명
   * - 'prompts' | 'competitors'
   */
  countField?: string;

  /**
   * 최소 필요 플랜
   */
  minPlan?: PlanType;

  /**
   * 플랫폼 제한 체크 여부
   */
  requiredPlatform?: boolean;
}

/**
 * PlanLimit 데코레이터 - API 엔드포인트에 플랜 제한을 적용
 * 
 * @example
 * // 질문 추가 시 maxPrompts 체크
 * @PlanLimit({ feature: 'maxPrompts', countField: 'prompts' })
 * 
 * // 경쟁사 추가 시 maxCompetitors 체크
 * @PlanLimit({ feature: 'maxCompetitors', countField: 'competitors' })
 * 
 * // 크롤링 시 월간 횟수 체크
 * @PlanLimit({ feature: 'crawlsPerMonth' })
 * 
 * // 특정 플랜 이상만 허용
 * @PlanLimit({ minPlan: 'PRO' })
 * 
 * // Boolean 기능 체크
 * @PlanLimit({ feature: 'contentGap' })
 */
export const PlanLimit = (options: PlanLimitOptions) =>
  SetMetadata(PLAN_LIMITS_KEY, options);
