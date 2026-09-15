import { PrismaService } from '../prisma/prisma.service';

/**
 * 【2026-09-15】병원별 응답 통계 — 일별 집계 테이블(response_daily / mention_daily) + 최근 2일 실시간 합산
 *
 * 배경: 대시보드·경쟁사 비교가 ai_responses 30일치(대형 병원은 6만 행, 1.6KB/행)를 매번 읽어
 *       DB 캐시 밖 디스크 I/O로 25~40초가 걸렸다(웹 30초 타임아웃 → "불러오지 못함").
 * 설계: 그저께까지는 매일 10:00 KST 갱신되는 집계 테이블에서 읽고(수십 행),
 *       어제·오늘(집계가 아직 불완전할 수 있는 구간)만 원본을 실시간으로 센다(한 병원 이틀치 = 수천 행, 최근 쓰기라 캐시에 있음).
 *       집계가 아직 없으면(백필 전) 전 구간 실시간으로 폴백한다.
 */
export interface ResponseStats {
  total: number;
  mentioned: number;
  withCompetitors: number;
  pos: number;
  neu: number;
  neg: number;
  mentPos: number;
  mentNeg: number;
  mentLabeled: number;
  /** 집계 테이블을 사용했는지(false = 전 구간 실시간 폴백) */
  aggregated: boolean;
}

type StatsRow = {
  total: number; mentioned: number; with_comp: number; pos: number; neu: number; neg: number;
  ment_pos: number; ment_neg: number; ment_labeled: number;
};

const zero = (): StatsRow => ({ total: 0, mentioned: 0, with_comp: 0, pos: 0, neu: 0, neg: 0, ment_pos: 0, ment_neg: 0, ment_labeled: 0 });
const add = (a: StatsRow, b: StatsRow): StatsRow => ({
  total: a.total + b.total, mentioned: a.mentioned + b.mentioned, with_comp: a.with_comp + b.with_comp,
  pos: a.pos + b.pos, neu: a.neu + b.neu, neg: a.neg + b.neg,
  ment_pos: a.ment_pos + b.ment_pos, ment_neg: a.ment_neg + b.ment_neg, ment_labeled: a.ment_labeled + b.ment_labeled,
});
const toStats = (r: StatsRow, aggregated: boolean): ResponseStats => ({
  total: r.total, mentioned: r.mentioned, withCompetitors: r.with_comp, pos: r.pos, neu: r.neu, neg: r.neg,
  mentPos: r.ment_pos, mentNeg: r.ment_neg, mentLabeled: r.ment_labeled, aggregated,
});

function sinceDate(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/** 원본 실시간 집계 (from 이후 전부). */
async function liveStats(prisma: PrismaService, hospitalId: string, from: Date, onlyRecent: boolean): Promise<StatsRow> {
  const rows = onlyRecent
    ? await prisma.$queryRaw<StatsRow[]>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE is_mentioned)::int AS mentioned,
             COUNT(*) FILTER (WHERE array_length(competitors_mentioned, 1) > 0)::int AS with_comp,
             COUNT(*) FILTER (WHERE sentiment_label = 'POSITIVE')::int AS pos,
             COUNT(*) FILTER (WHERE sentiment_label = 'NEUTRAL')::int AS neu,
             COUNT(*) FILTER (WHERE sentiment_label = 'NEGATIVE')::int AS neg,
             COUNT(*) FILTER (WHERE is_mentioned AND sentiment_label = 'POSITIVE')::int AS ment_pos,
             COUNT(*) FILTER (WHERE is_mentioned AND sentiment_label = 'NEGATIVE')::int AS ment_neg,
             COUNT(*) FILTER (WHERE is_mentioned AND sentiment_label IS NOT NULL)::int AS ment_labeled
      FROM ai_responses
      WHERE hospital_id = ${hospitalId}
        AND response_date >= GREATEST(${from}::date, CURRENT_DATE - 1)`
    : await prisma.$queryRaw<StatsRow[]>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE is_mentioned)::int AS mentioned,
             COUNT(*) FILTER (WHERE array_length(competitors_mentioned, 1) > 0)::int AS with_comp,
             COUNT(*) FILTER (WHERE sentiment_label = 'POSITIVE')::int AS pos,
             COUNT(*) FILTER (WHERE sentiment_label = 'NEUTRAL')::int AS neu,
             COUNT(*) FILTER (WHERE sentiment_label = 'NEGATIVE')::int AS neg,
             COUNT(*) FILTER (WHERE is_mentioned AND sentiment_label = 'POSITIVE')::int AS ment_pos,
             COUNT(*) FILTER (WHERE is_mentioned AND sentiment_label = 'NEGATIVE')::int AS ment_neg,
             COUNT(*) FILTER (WHERE is_mentioned AND sentiment_label IS NOT NULL)::int AS ment_labeled
      FROM ai_responses
      WHERE hospital_id = ${hospitalId} AND response_date >= ${from}::date`;
  return rows[0] ?? zero();
}

/** 최근 N일 응답 통계 (집계 + 실시간). */
export async function hospitalResponseStats(prisma: PrismaService, hospitalId: string, days: number): Promise<ResponseStats> {
  const from = sinceDate(days);
  let agg: StatsRow | null = null;
  try {
    const rows = await prisma.$queryRaw<StatsRow[]>`
      SELECT COALESCE(SUM(total), 0)::int AS total,
             COALESCE(SUM(mentioned), 0)::int AS mentioned,
             COALESCE(SUM(with_comp), 0)::int AS with_comp,
             COALESCE(SUM(pos), 0)::int AS pos,
             COALESCE(SUM(neu), 0)::int AS neu,
             COALESCE(SUM(neg), 0)::int AS neg,
             COALESCE(SUM(ment_pos), 0)::int AS ment_pos,
             COALESCE(SUM(ment_neg), 0)::int AS ment_neg,
             COALESCE(SUM(ment_labeled), 0)::int AS ment_labeled
      FROM response_daily
      WHERE hospital_id = ${hospitalId} AND day >= ${from}::date AND day < CURRENT_DATE - 1`;
    agg = rows[0] ?? null;
  } catch {
    agg = null; // 테이블 미생성 등 → 실시간 폴백
  }
  if (!agg || agg.total === 0) {
    // 집계 없음(백필 전) 또는 이 병원 데이터 없음 → 전 구간 실시간
    return toStats(await liveStats(prisma, hospitalId, from, false), false);
  }
  const live = await liveStats(prisma, hospitalId, from, true);
  return toStats(add(agg, live), true);
}

/** 최근 N일 경쟁 병원명 언급 횟수 (competitors_mentioned 원소 단위). 집계(mention_daily) + 실시간. */
export async function hospitalCompetitorMentions(prisma: PrismaService, hospitalId: string, days: number, useAggregate = true): Promise<Record<string, number>> {
  const from = sinceDate(days);
  const counts: Record<string, number> = {};
  type Row = { name: string; cnt: number };
  let aggregated = false;
  if (useAggregate) {
    try {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT name, SUM(cnt)::int AS cnt
        FROM mention_daily
        WHERE hospital_id = ${hospitalId} AND day >= ${from}::date AND day < CURRENT_DATE - 1 AND name <> '*'
        GROUP BY name`;
      for (const r of rows) counts[r.name] = (counts[r.name] || 0) + r.cnt;
      aggregated = true;
    } catch {
      aggregated = false;
    }
  }
  const live = aggregated
    ? await prisma.$queryRaw<Row[]>`
        SELECT x.name, COUNT(*)::int AS cnt
        FROM (SELECT unnest(competitors_mentioned) AS name FROM ai_responses
              WHERE hospital_id = ${hospitalId}
                AND response_date >= GREATEST(${from}::date, CURRENT_DATE - 1)
                AND array_length(competitors_mentioned, 1) > 0) x
        GROUP BY x.name`
    : await prisma.$queryRaw<Row[]>`
        SELECT x.name, COUNT(*)::int AS cnt
        FROM (SELECT unnest(competitors_mentioned) AS name FROM ai_responses
              WHERE hospital_id = ${hospitalId}
                AND response_date >= ${from}::date
                AND array_length(competitors_mentioned, 1) > 0) x
        GROUP BY x.name`;
  for (const r of live) counts[r.name] = (counts[r.name] || 0) + r.cnt;
  return counts;
}
