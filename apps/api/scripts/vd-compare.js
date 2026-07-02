const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const VD_ID_NAME = '불당본점 서울비디치과의원';

async function main() {
  // 1. 최신 점수 병원 전체 (활성)
  const latestScores = await prisma.$queryRaw`
    SELECT DISTINCT ON (ds.hospital_id)
      ds.hospital_id, h.name, h.plan_type, ds.overall_score, ds.platform_scores, ds.sov_percent, ds.mention_count, ds.score_date
    FROM daily_scores ds
    JOIN hospitals h ON h.id = ds.hospital_id
    WHERE h.subscription_status IN ('ACTIVE','TRIAL')
    ORDER BY ds.hospital_id, ds.score_date DESC
  `;
  const vd = latestScores.find(r => r.name === VD_ID_NAME);
  if (!vd) return console.log('비디 본계정 없음');
  const higher = latestScores.filter(r => r.overall_score > vd.overall_score && r.hospital_id !== vd.hospital_id)
    .sort((a,b) => b.overall_score - a.overall_score);

  console.log(`비디 본계정: ${vd.overall_score}점 | 플랫폼: ${JSON.stringify(vd.platform_scores)}`);
  console.log(`\n===== 비디보다 높은 병원 ${higher.length}곳 플랫폼별 비교 =====`);
  const platforms = ['chatgpt','claude','perplexity','gemini','grok','clova_x'];
  // 상위 병원들의 플랫폼별 평균
  const avg = {};
  platforms.forEach(p => {
    const vals = higher.map(h => (h.platform_scores || {})[p]).filter(v => v != null);
    avg[p] = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
  });
  console.log('\n플랫폼 | 비디 | 상위그룹 평균 | 격차');
  platforms.forEach(p => {
    const v = (vd.platform_scores || {})[p];
    if (avg[p] == null && v == null) return;
    console.log(`${p.padEnd(10)} | ${String(v ?? '-').padStart(4)} | ${String(avg[p] ?? '-').padStart(6)} | ${v != null && avg[p] != null ? (v - avg[p] > 0 ? '+' : '') + (v - avg[p]) : '-'}`);
  });
  console.log('\n상위 병원 개별:');
  higher.forEach(h => {
    const ps = h.platform_scores || {};
    console.log(`${String(h.overall_score).padStart(3)}점 ${h.name.slice(0,16).padEnd(16)} | C:${ps.chatgpt??'-'} Cl:${ps.claude??'-'} P:${ps.perplexity??'-'} G:${ps.gemini??'-'} Gr:${ps.grok??'-'}`);
  });

  // 2. 비디의 프롬프트(질문)별 성과 — 최근 7일, 언급률 낮은 카테고리
  const d7 = new Date(Date.now() - 7*86400000);
  const promptPerf = await prisma.$queryRaw`
    SELECT p.prompt_text, 
      COUNT(*)::int AS asks,
      SUM(CASE WHEN r.is_mentioned THEN 1 ELSE 0 END)::int AS mentioned
    FROM ai_responses r JOIN prompts p ON p.id = r.prompt_id
    WHERE r.hospital_id = ${vd.hospital_id} AND r.response_date >= ${d7}
    GROUP BY p.prompt_text
    ORDER BY (SUM(CASE WHEN r.is_mentioned THEN 1 ELSE 0 END)::float / COUNT(*)) ASC
  `;
  const zero = promptPerf.filter(r => r.mentioned === 0);
  const weak = promptPerf.filter(r => r.mentioned > 0 && r.mentioned / r.asks < 0.3);
  const strong = promptPerf.filter(r => r.mentioned / r.asks >= 0.7);
  console.log(`\n===== 비디 프롬프트 성과 (최근 7일, 총 ${promptPerf.length}개 질문) =====`);
  console.log(`완전 미언급(0%): ${zero.length}개 | 약함(<30%): ${weak.length}개 | 강함(70%+): ${strong.length}개`);
  console.log('\n--- 완전 미언급 질문 (전체) ---');
  zero.forEach(r => console.log(`  0/${r.asks} | ${r.prompt_text.slice(0,60)}`));
  console.log('\n--- 약한 질문 (<30%) ---');
  weak.slice(0, 15).forEach(r => console.log(`  ${r.mentioned}/${r.asks} | ${r.prompt_text.slice(0,60)}`));
  console.log('\n--- 강한 질문 (70%+) 상위 10 ---');
  strong.slice(-10).forEach(r => console.log(`  ${r.mentioned}/${r.asks} | ${r.prompt_text.slice(0,60)}`));
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
