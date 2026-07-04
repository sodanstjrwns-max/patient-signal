import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * 【스케일】DATABASE_URL에 커넥션 풀 파라미터 자동 부여
 *
 * Prisma 기본 pool size = (CPU코어 × 2 + 1) — Render 소형 인스턴스에서 3~5개.
 * 수백 병원 동시 대시보드 조회 + 크롤 워커가 겹치면 "Timed out fetching connection" 발생.
 *
 * env로 명시 제어:
 *  - DB_CONNECTION_LIMIT (기본 15) — Supabase/Neon pooler 한도 내에서 상향
 *  - DB_POOL_TIMEOUT    (기본 20초) — 커넥션 대기 타임아웃
 *
 * URL에 이미 connection_limit이 있으면 그대로 존중 (운영자가 직접 지정한 경우).
 */
function buildDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '15');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '20');
    }
    return url.toString();
  } catch {
    return raw; // URL 파싱 실패 시 원본 그대로 (프로토콜 특이 케이스)
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const datasourceUrl = buildDatabaseUrl();
    super({
      ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
      log: process.env.NODE_ENV === 'development' 
        ? ['warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    // 【스케일 안전망】take 미지정 findMany에 전역 상한 부여
    // AIResponse는 병원당 월 ~5,000행씩 쌓임 → take 없는 분석 쿼리가 25곳.
    // 정상 병원은 영향 없고(30일 윈도우 ≪ 상한), 데이터 폭주 병원이
    // 수십만 행을 한 번에 메모리로 끌어와 서버를 OOM시키는 사고만 차단.
    const MAX_ROWS: Record<string, number> = {
      AIResponse: 20000,
      LiveQueryResponse: 10000,
      CitedSourceSnapshot: 10000,
      DailyScore: 5000,
      ContentGap: 2000,
    };
    this.$use(async (params, next) => {
      const cap = params.model ? MAX_ROWS[params.model] : undefined;
      if (cap && params.action === 'findMany' && params.args?.take == null) {
        params.args = { ...(params.args ?? {}), take: cap };
      }
      return next(params);
    });

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }
    
    // 테스트용 데이터 정리
    const models = Reflect.ownKeys(this).filter(
      (key) => typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$'),
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        if (model && typeof (model as any).deleteMany === 'function') {
          return (model as any).deleteMany();
        }
        return Promise.resolve();
      }),
    );
  }
}
