/**
 * 해운대함소아한의원 구제 스크립트 (1회성)
 * - 프롬프트 0개 → V3 매트릭스 엔진으로 STARTER 상한(5개)만큼 생성
 * - 다음 크롤 세션에서 starved 우선순위(0순위)로 자동 처리됨
 */
import { PrismaClient } from '@prisma/client';
import { generateMatrixCandidates, selectDailyPrompts } from '../src/scheduler/daily-prompt-matrix';

const prisma = new PrismaClient();

async function main() {
  const h = await prisma.hospital.findFirst({
    where: { name: { contains: '해운대함소아' } },
  });
  if (!h) throw new Error('병원 없음');

  const existing = await prisma.prompt.count({ where: { hospitalId: h.id } });
  if (existing > 0) {
    console.log(`이미 프롬프트 ${existing}개 존재 — 중단`);
    return;
  }

  const candidates = generateMatrixCandidates({
    name: h.name,
    specialtyType: h.specialtyType,
    regionSido: h.regionSido,
    regionSigungu: h.regionSigungu,
    regionDong: (h as any).regionDong,
    coreTreatments: (h as any).coreTreatments || [],
    keyProcedures: (h as any).keyProcedures || [],
    targetRegions: (h as any).targetRegions || [],
    hospitalStrengths: (h as any).hospitalStrengths || [],
  });
  console.log(`매트릭스 후보: ${candidates.length}개`);

  const selected = selectDailyPrompts(candidates, new Set(), 5, true); // STARTER maxPrompts=5
  console.log(`선택된 프롬프트 ${selected.length}개:`);
  selected.forEach((s, i) => console.log(`  ${i + 1}. [${s.intent}] ${s.text}`));

  for (const s of selected) {
    await prisma.prompt.create({
      data: {
        hospitalId: h.id,
        promptText: s.text,
        promptType: 'AUTO_GENERATED',
        isActive: true,
        specialtyCategory: s.procedure || null,
      } as any,
    });
  }
  console.log(`\n✅ ${selected.length}개 프롬프트 생성 완료 — 다음 세션에서 starved 최우선으로 크롤됩니다`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
