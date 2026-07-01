import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * 【P1-7】전역 캐시 모듈 — 어느 모듈에서든 CacheService 주입 가능
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class AppCacheModule {}
