/**
 * 신규 출처 엔드포인트 verify (DB 직접 쿼리 + 로직 시뮬레이션)
 * - sourceHints 디코딩 효과 확인
 * - Top URL 후보 미리보기
 * - URL × AI 매트릭스 미리보기
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const hospital = await prisma.hospital.findUnique({
    where: { id: '2a6776fd-a4ae-4022-9331-7a62810988aa' },
    select: { id: true, name: true },
  });
  if (!hospital) {
    console.log('❌ 서울비디치과 not found');
    return;
  }
  console.log(`🏥 ${hospital.name} (${hospital.id})\n`);

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const responses = await prisma.aIResponse.findMany({
    where: { hospitalId: hospital.id, createdAt: { gte: since } },
    select: { citedSources: true, citedUrl: true, aiPlatform: true, sourceHints: true },
  });

  console.log(`📦 30일 응답: ${responses.length}건\n`);

  // 시뮬레이션: Gemini 디코딩 효과
  let geminiTotalUrls = 0;
  let geminiRedirectUrls = 0;
  let geminiDecodedDomains = 0;
  const beforeDomains: Record<string, number> = {};
  const afterDomains: Record<string, number> = {};
  const urlMatrix: Record<string, Record<string, number>> = {};

  for (const r of responses) {
    const rawUrls = [
      ...(r.citedSources || []),
      ...(r.citedUrl ? [r.citedUrl] : []),
    ];

    const geminiHintDomains: string[] = [];
    if (r.aiPlatform === 'GEMINI' && r.sourceHints) {
      try {
        const hints: any = r.sourceHints;
        const sources = Array.isArray(hints?.sources) ? hints.sources : [];
        for (const s of sources) {
          // title 우선 (실제 도메인) → fallback domain (단 vertexaisearch 제외)
          const title = (s?.title || '').toString().trim().toLowerCase();
          const domain = (s?.domain || '').toString().trim().toLowerCase();
          const isDomainLike = (str: string) => str.length > 0 && str.includes('.') && !str.includes(' ') && !str.includes('vertexaisearch');
          let real: string | null = null;
          if (isDomainLike(title)) real = title.replace(/^www\./, '');
          else if (isDomainLike(domain)) real = domain.replace(/^www\./, '');
          if (real) geminiHintDomains.push(real);
        }
      } catch {}
    }

    if (r.aiPlatform === 'GEMINI') geminiTotalUrls += rawUrls.length;

    let hintIndex = 0;
    for (const url of rawUrls) {
      let beforeDomain = 'invalid';
      try { beforeDomain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      beforeDomains[beforeDomain] = (beforeDomains[beforeDomain] || 0) + 1;

      let afterDomain = beforeDomain;
      const isGeminiRedirect = url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/');
      if (r.aiPlatform === 'GEMINI' && isGeminiRedirect) {
        geminiRedirectUrls++;
        const real = geminiHintDomains[hintIndex] || geminiHintDomains[0];
        if (real) { afterDomain = real; geminiDecodedDomains++; }
        hintIndex++;
      }
      afterDomains[afterDomain] = (afterDomains[afterDomain] || 0) + 1;

      // matrix
      if (!urlMatrix[afterDomain]) urlMatrix[afterDomain] = {};
      urlMatrix[afterDomain][r.aiPlatform] = (urlMatrix[afterDomain][r.aiPlatform] || 0) + 1;
    }
  }

  // ━━━ B 결과 ━━━
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 B. Gemini 디코딩 효과');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Gemini 전체 URL:            ${geminiTotalUrls}`);
  console.log(`Gemini grounding-redirect: ${geminiRedirectUrls}`);
  console.log(`실제 도메인 디코딩 성공:    ${geminiDecodedDomains} (${geminiRedirectUrls > 0 ? Math.round(geminiDecodedDomains/geminiRedirectUrls*100) : 0}%)`);
  console.log(`BEFORE 고유 도메인 수:      ${Object.keys(beforeDomains).length}`);
  console.log(`AFTER  고유 도메인 수:      ${Object.keys(afterDomains).length}`);
  console.log(`✨ 신규 노출 도메인:        ${Object.keys(afterDomains).length - Object.keys(beforeDomains).length}\n`);

  console.log('📊 BEFORE Top 10 (디코딩 전)');
  Object.entries(beforeDomains).sort((a,b) => b[1]-a[1]).slice(0, 10).forEach(([d, c], i) => {
    console.log(`  ${(i+1).toString().padStart(2)}. ${d.padEnd(50)} ${c}`);
  });
  console.log('\n📊 AFTER  Top 10 (디코딩 후)');
  Object.entries(afterDomains).sort((a,b) => b[1]-a[1]).slice(0, 10).forEach(([d, c], i) => {
    console.log(`  ${(i+1).toString().padStart(2)}. ${d.padEnd(50)} ${c}`);
  });

  // ━━━ A2 매트릭스 미리보기 ━━━
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 A-2. URL × AI 매트릭스 미리보기 (도메인 기준 상위 10)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const PLATFORMS = ['CHATGPT','PERPLEXITY','CLAUDE','GEMINI','GROK','CLOVA_X'];
  const header = ['도메인'.padEnd(40), ...PLATFORMS.map(p => p.substring(0,7).padStart(7))].join(' | ');
  console.log(header);
  console.log('-'.repeat(header.length));
  const topDomains = Object.entries(afterDomains).sort((a,b) => b[1]-a[1]).slice(0, 10);
  for (const [domain] of topDomains) {
    const row = urlMatrix[domain] || {};
    const cells = PLATFORMS.map(p => (row[p] || 0).toString().padStart(7));
    console.log([domain.substring(0,38).padEnd(40), ...cells].join(' | '));
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
