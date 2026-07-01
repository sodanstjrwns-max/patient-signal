import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs/operators';

/**
 * 【보안】StripInternalFieldsInterceptor — 운영자 전용 필드 전역 차단
 *
 * 배경: AIResponse의 LLM 원가 필드(inputTokens/outputTokens/estimatedCostUsd)는
 *       운영자만 봐야 하는 내부 데이터. 현재 유저 대면 API는 전부 select로
 *       필드를 명시하고 있어 안전하지만, 미래에 select 없이 row를 통째로
 *       반환하는 엔드포인트가 추가되면 그대로 노출된다.
 *
 * 해결: 전역 인터셉터로 모든 응답에서 내부 필드를 재귀 제거.
 *       단, /api/admin/* 경로(ADMIN_SECRET 검증)는 제외 — 운영자 대시보드는 봐야 하므로.
 *
 * → 이제 실수로 노출 코드를 짜도 응답에서 자동 제거됨 (defense-in-depth)
 */

/** 유저 응답에서 무조건 제거할 운영자 전용 필드 */
const INTERNAL_FIELDS = new Set(['inputTokens', 'outputTokens', 'estimatedCostUsd']);

/** 재귀 깊이 제한 (순환 참조/거대 페이로드 방어) */
const MAX_DEPTH = 12;

function stripInternalFields(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) stripInternalFields(item, depth + 1);
    return value;
  }
  // Date, Buffer 등 특수 객체는 건드리지 않음
  if (value instanceof Date) return value;

  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (INTERNAL_FIELDS.has(key)) {
      delete obj[key];
    } else {
      stripInternalFields(obj[key], depth + 1);
    }
  }
  return value;
}

@Injectable()
export class StripInternalFieldsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): any {
    const request = context.switchToHttp().getRequest();
    const url: string = request.originalUrl || request.url || '';

    // 운영자 라우트는 제외 (ADMIN_SECRET으로 이미 보호됨)
    if (url.startsWith('/api/admin')) {
      return next.handle();
    }

    // 모노레포 rxjs 이중 인스턴스 타입 충돌 회피용 any 캐스팅
    return (next.handle() as any).pipe(map((data: unknown) => stripInternalFields(data)));
  }
}
