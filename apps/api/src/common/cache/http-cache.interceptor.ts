import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, from, switchMap, tap } from 'rxjs';

/* 모노레포 rxjs 이중 인스턴스 타입 충돌 회피용 any 반환 */
import { CacheService } from './cache.service';

/**
 * 【P1-7】HttpCacheInterceptor — GET 응답 TTL 캐시 인터셉터
 *
 * @CacheTTL(초)를 붙인 GET 핸들러의 응답을 URL 단위로 캐시.
 * 키에 hospitalId가 포함된 URL이므로 CacheService.invalidateHospital()로 무효화 가능.
 *
 * 사용법:
 *   @UseInterceptors(HttpCacheInterceptor)  // 컨트롤러 또는 핸들러
 *   @CacheTTL(600)                          // 10분 캐시
 *   @Get(':hospitalId/latest')
 */

export const CACHE_TTL_KEY = 'httpCache:ttl';
export const CacheTTL = (seconds: number) => SetMetadata(CACHE_TTL_KEY, seconds);

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: CacheService,
    private readonly reflector: Reflector,
  ) {}

  // 모노레포 루트/apps/api의 rxjs 이중 인스턴스 타입 충돌 회피를 위해 any 반환
  intercept(context: ExecutionContext, next: CallHandler): any {
    const ttl = this.reflector.getAllAndOverride<number>(CACHE_TTL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();

    // TTL 미지정 또는 GET이 아니면 캐시 안 함
    if (!ttl || request.method !== 'GET') {
      return next.handle();
    }

    // 키: ps:http:<originalUrl> — hospitalId가 URL에 포함되므로 병원 단위 무효화 가능
    const key = `ps:http:${request.originalUrl || request.url}`;

    return from(this.cache.get(key)).pipe(
      switchMap((cached): any => {
        if (cached !== null) return of(cached);
        return (next.handle() as any).pipe(
          tap((response: any) => {
            // fire-and-forget 저장 (요청 지연 없음)
            void this.cache.set(key, response, ttl);
          }),
        );
      }),
    ) as any;
  }
}
