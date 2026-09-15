import { PrismaService } from '../prisma/prisma.service';

/**
 * 【2026-09-15】오래된 AI 응답 원문 아카이브 — DB 가 하루 ~20MB 씩 커지는 문제의 1단계 대책
 *
 * ai_responses 한 행은 평균 1.6KB 인데 그중 대부분이 response_text·source_hints 다. 통계(점수·언급률·감성·경쟁사)는
 * 일별 집계와 작은 컬럼만 쓰므로, N일이 지난 행의 원문은 별도 테이블(ai_response_archive)로 옮기고 본 테이블에는
 * 빈 문자열만 남긴다. 아무것도 지우지 않는다(원문은 아카이브에 그대로, 목록 화면은 아카이브에서 폴백해 보여줌).
 * 효과: 자주 읽는 ai_responses 의 크기가 최근 N일치로 고정돼 DB 메모리 캐시에 계속 들어간다.
 * 2단계(디스크): 아카이브가 수 GB 가 되면 월 단위로 R2 에 JSONL 로 내보내고 삭제 — 아직 미구현.
 */
export interface ArchiveResult {
  days: number;
  archived: number;
  batches: number;
  remaining: number;
  dbSizeMb: number;
  hotTableMb: number;
  archiveTableMb: number;
  ms: number;
}

const BATCH = 2000;

export async function archiveOldResponseTexts(prisma: PrismaService, days: number, limit: number): Promise<ArchiveResult> {
  const started = Date.now();
  const d = Math.max(30, Math.min(3650, days));
  const max = Math.max(BATCH, Math.min(200_000, limit));
  let archived = 0;
  let batches = 0;

  while (archived < max) {
    // 한 배치를 한 트랜잭션으로: 아카이브에 복사(중복은 무시) → 본 테이블 원문 비움
    const n = await prisma.$transaction(async (tx) => {
      const ids = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM ai_responses
        WHERE response_date < CURRENT_DATE - ${d}::int AND response_text <> ''
        ORDER BY response_date
        LIMIT ${BATCH}`;
      if (ids.length === 0) return 0;
      const idList = ids.map((r) => r.id);
      await tx.$executeRaw`
        INSERT INTO ai_response_archive (id, response_text, source_hints)
        SELECT r.id, r.response_text, r.source_hints FROM ai_responses r
        WHERE r.id = ANY(${idList}::text[])
        ON CONFLICT (id) DO NOTHING`;
      const updated = await tx.$executeRaw`
        UPDATE ai_responses SET response_text = '', source_hints = NULL
        WHERE id = ANY(${idList}::text[])`;
      return Number(updated);
    }, { timeout: 120_000 });
    batches++;
    archived += n;
    if (n < BATCH) break;
  }

  const [rem] = await prisma.$queryRaw<Array<{ c: number }>>`
    SELECT COUNT(*)::int AS c FROM ai_responses
    WHERE response_date < CURRENT_DATE - ${d}::int AND response_text <> ''`;
  const [sz] = await prisma.$queryRaw<Array<{ db: number; hot: number; arc: number }>>`
    SELECT (pg_database_size(current_database()) / 1048576)::int AS db,
           (pg_total_relation_size('ai_responses') / 1048576)::int AS hot,
           (pg_total_relation_size('ai_response_archive') / 1048576)::int AS arc`;
  return {
    days: d, archived, batches, remaining: rem?.c ?? 0,
    dbSizeMb: sz?.db ?? 0, hotTableMb: sz?.hot ?? 0, archiveTableMb: sz?.arc ?? 0,
    ms: Date.now() - started,
  };
}

/** 목록 화면용: 원문이 비어 있는(아카이브된) 행의 원문을 아카이브에서 채운다. */
export async function fillArchivedTexts<T extends { id: string; responseText: string }>(prisma: PrismaService, rows: T[]): Promise<T[]> {
  const empty = rows.filter((r) => !r.responseText).map((r) => r.id);
  if (empty.length === 0) return rows;
  try {
    const found = await prisma.$queryRaw<Array<{ id: string; response_text: string }>>`
      SELECT id, response_text FROM ai_response_archive WHERE id = ANY(${empty}::text[])`;
    const map = new Map(found.map((f) => [f.id, f.response_text]));
    return rows.map((r) => (map.has(r.id) ? { ...r, responseText: map.get(r.id) as string } : r));
  } catch {
    return rows; // 아카이브 테이블 미생성 등 → 그대로
  }
}
