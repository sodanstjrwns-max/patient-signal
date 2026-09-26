import { PrismaService } from '../prisma/prisma.service';

/**
 * 【2026-09-26 확장 대비】질문(prompt)별 누적 응답 수 — 주어진 질문 id 에 대해서만 센다.
 *
 * 배경: `include: { _count: { select: { aiResponses: true } } }` 는 Prisma 가
 *   LEFT JOIN (SELECT prompt_id, COUNT(*) FROM ai_responses GROUP BY prompt_id) 형태로 만들어
 *   병원 한 곳의 질문 목록을 볼 때도 **전 병원 ai_responses 전체**를 집계한다
 *   (pg_stat_statements 실측: 질문 목록 조회 평균 7.2초·최대 83초, 병원 수에 비례해 느려짐).
 * 대책: WHERE prompt_id IN (...) 로 좁혀 (prompt_id, ai_platform) 인덱스로 세고, 결과 모양은 종전과 같게 맞춘다.
 */
export async function countResponsesByPrompt(prisma: PrismaService, promptIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (promptIds.length === 0) return out;
  const CHUNK = 500;
  for (let i = 0; i < promptIds.length; i += CHUNK) {
    const rows = await prisma.aIResponse.groupBy({
      by: ['promptId'],
      where: { promptId: { in: promptIds.slice(i, i + CHUNK) } },
      _count: { _all: true },
    });
    for (const r of rows) if (r.promptId) out.set(r.promptId, r._count._all);
  }
  return out;
}

/** 질문 목록에 종전과 같은 `_count: { aiResponses }` 필드를 붙인다. */
export async function withResponseCounts<T extends { id: string }>(
  prisma: PrismaService,
  prompts: T[],
): Promise<Array<T & { _count: { aiResponses: number } }>> {
  const counts = await countResponsesByPrompt(prisma, prompts.map((p) => p.id));
  return prompts.map((p) => ({ ...p, _count: { aiResponses: counts.get(p.id) ?? 0 } }));
}
