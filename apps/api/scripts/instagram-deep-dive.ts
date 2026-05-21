/**
 * Instagram 출처 심층 분석 — 원장님 관찰 검증용
 * "의외로 인스타그램 출처가 높다" → 진짜인가? 누구를 인용하나? 어느 AI가 가장 많이 쓰나?
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractRealDomain(s: any): string | null {
  if (!s || typeof s !== 'object') return null;
  const t = (s.title || '').toString().trim().toLowerCase();
  const d = (s.domain || '').toString().trim().toLowerCase();
  const ok = (x: string) => x.length > 0 && x.includes('.') && !x.includes(' ') && !x.includes('vertexaisearch');
  if (ok(t)) return t.replace(/^www\./, '');
  if (ok(d)) return d.replace(/^www\./, '');
  return null;
}

function isInstagramDomain(domain: string): boolean {
  return domain === 'instagram.com' ||
         domain === 'www.instagram.com' ||
         domain.endsWith('.instagram.com') ||
         domain === 'instagr.am';
}

function extractInstagramHandle(url: string): string | null {
  try {
    const u = new URL(url);
    if (!isInstagramDomain(u.hostname.replace(/^www\./, ''))) return null;
    // /username, /username/, /p/postid (post), /reel/xxx, /stories/xxx
    const path = u.pathname.replace(/^\/+|\/+$/g, '');
    if (!path) return '(home)';
    const segs = path.split('/');
    const first = segs[0]?.toLowerCase();
    if (!first) return null;
    // post/reel/stories는 핸들이 아님
    if (['p', 'reel', 'reels', 'stories', 'tv', 'explore'].includes(first)) {
      return `(${first})`;
    }
    return `@${first}`;
  } catch {
    return null;
  }
}

async function main() {
  const hid = '2a6776fd-a4ae-4022-9331-7a62810988aa';
  const since = new Date(); since.setDate(since.getDate() - 30);

  const hospital = await prisma.hospital.findUnique({
    where: { id: hid },
    select: { name: true, websiteUrl: true, nameAliases: true },
  });
  console.log(`🏥 ${hospital?.name} | 최근 30일 분석\n`);

  const responses = await prisma.aIResponse.findMany({
    where: { hospitalId: hid, createdAt: { gte: since } },
    select: {
      citedSources: true,
      citedUrl: true,
      aiPlatform: true,
      isMentioned: true,
      sentimentLabel: true,
      competitorsMentioned: true,
      sourceHints: true,
      responseText: true,
    },
  });

  // 모든 URL을 디코딩하면서 인스타 케이스 추출
  let totalCitations = 0;
  let igCitations = 0;
  const igUrls = new Map<string, number>();        // 정확한 URL → 횟수
  const igHandles = new Map<string, number>();     // 핸들/타입 → 횟수
  const igByPlatform = new Map<string, number>();  // AI별
  const igMentionedWithUs: { url: string; platform: string; sentiment: string | null; competitors: string[] }[] = [];
  const igHandleByPlatform = new Map<string, Map<string, number>>(); // platform → handle → count

  for (const r of responses) {
    const rawUrls = [
      ...(r.citedSources || []),
      ...(r.citedUrl ? [r.citedUrl] : []),
    ];

    // Gemini 디코딩
    const hints: string[] = [];
    if (r.aiPlatform === 'GEMINI' && r.sourceHints) {
      try {
        const arr = Array.isArray((r.sourceHints as any)?.sources) ? (r.sourceHints as any).sources : [];
        for (const s of arr) {
          const real = extractRealDomain(s);
          if (real) hints.push(real);
        }
      } catch {}
    }

    let hi = 0;
    for (const url of rawUrls) {
      let domain = '';
      let resolvedUrl = url;
      try {
        domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      } catch { continue; }

      // Gemini 리다이렉트 처리 — 도메인만 알 수 있고 실 URL은 모름
      if (r.aiPlatform === 'GEMINI' && url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/')) {
        const real = hints[hi] || hints[0];
        if (real) domain = real;
        hi++;
        // Gemini 리다이렉트는 실 URL을 알 수 없으므로 핸들 추출 불가
        resolvedUrl = `(gemini-redirect → ${domain})`;
      }

      if (!domain) continue;
      totalCitations++;

      if (isInstagramDomain(domain)) {
        igCitations++;

        // 정확한 URL 카운트
        igUrls.set(resolvedUrl, (igUrls.get(resolvedUrl) || 0) + 1);

        // 핸들/타입 추출
        const handle = extractInstagramHandle(url) || '(unknown)';
        igHandles.set(handle, (igHandles.get(handle) || 0) + 1);

        // AI별
        igByPlatform.set(r.aiPlatform, (igByPlatform.get(r.aiPlatform) || 0) + 1);
        if (!igHandleByPlatform.has(r.aiPlatform)) igHandleByPlatform.set(r.aiPlatform, new Map());
        const phMap = igHandleByPlatform.get(r.aiPlatform)!;
        phMap.set(handle, (phMap.get(handle) || 0) + 1);

        // 우리 병원 언급된 응답에서 인용된 경우
        if (r.isMentioned) {
          igMentionedWithUs.push({
            url: resolvedUrl,
            platform: r.aiPlatform,
            sentiment: r.sentimentLabel,
            competitors: r.competitorsMentioned || [],
          });
        }
      }
    }
  }

  // === 1) 총 통계 ===
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Instagram 전체 통계');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`총 인용 URL: ${totalCitations.toLocaleString()}개`);
  console.log(`인스타그램: ${igCitations.toLocaleString()}개 (${(igCitations/totalCitations*100).toFixed(2)}%)`);
  console.log(`고유 인스타 URL: ${igUrls.size}개`);
  console.log(`고유 핸들/타입: ${igHandles.size}개`);

  // === 2) AI 플랫폼별 ===
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 AI 플랫폼별 인스타그램 인용 빈도');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const sortedPlatforms = Array.from(igByPlatform.entries()).sort((a, b) => b[1] - a[1]);
  for (const [p, c] of sortedPlatforms) {
    const pct = (c/igCitations*100).toFixed(1);
    const bar = '█'.repeat(Math.round(c/igCitations*30));
    console.log(`${p.padEnd(20)} ${bar} ${c}회 (${pct}%)`);
  }

  // === 3) Top 핸들 ===
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👤 TOP 20 인용 인스타 핸들/타입');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const topHandles = Array.from(igHandles.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [h, c] of topHandles) {
    console.log(`${h.padEnd(40)} ${c}회`);
  }

  // === 4) Top URL ===
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔗 TOP 15 인스타 URL (전체)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const topUrls = Array.from(igUrls.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [u, c] of topUrls) {
    console.log(`[${c}회] ${u.substring(0, 100)}`);
  }

  // === 5) 우리 병원 언급된 응답에서 인스타 인용 ===
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✨ 우리 병원 언급 응답 중 인스타 인용: ${igMentionedWithUs.length}건`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const igMentSample = igMentionedWithUs.slice(0, 10);
  for (const m of igMentSample) {
    console.log(`[${m.platform} · ${m.sentiment || 'NEUTRAL'}] ${m.url.substring(0, 80)}`);
    if (m.competitors.length > 0) console.log(`  ↳ 동시언급 경쟁사: ${m.competitors.slice(0, 3).join(', ')}`);
  }

  // === 6) AI별 Top 핸들 ===
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 AI별 가장 자주 인용하는 인스타 핸들 TOP 3');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const [platform, hmap] of igHandleByPlatform.entries()) {
    const top3 = Array.from(hmap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    console.log(`\n${platform}:`);
    for (const [h, c] of top3) console.log(`  ${h.padEnd(40)} ${c}회`);
  }

  // === 7) 인사이트 자동 진단 ===
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 자동 진단');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const igPct = igCitations/totalCitations*100;
  if (igPct > 5) console.log(`⚠️ 인스타 인용 비중 ${igPct.toFixed(2)}% — 일반적 의료 카테고리 평균(1~3%) 대비 높음`);
  else if (igPct > 2) console.log(`📌 인스타 인용 비중 ${igPct.toFixed(2)}% — 평균 범위`);
  else console.log(`✅ 인스타 인용 비중 ${igPct.toFixed(2)}% — 낮음`);

  const ourHandle = topHandles.find(([h]) => h.toLowerCase().includes('bd') || h.toLowerCase().includes('seoul') || h.toLowerCase().includes('비디'));
  if (ourHandle) console.log(`🏥 우리 병원 추정 핸들: ${ourHandle[0]} (${ourHandle[1]}회)`);
  else console.log(`🚨 우리 병원 인스타 계정이 TOP 20에 없음 — 인스타 SEO 부재`);

  const homepageMostly = (igHandles.get('(home)') || 0) + (igHandles.get('(p)') || 0) + (igHandles.get('(reel)') || 0);
  console.log(`📊 핸들 직접 인용 ${igHandles.size - 3}건 vs 포스트/릴 인용 ${homepageMostly}건`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
