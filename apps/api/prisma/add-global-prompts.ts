// 데모 병원(서울비디치과)에 외국어 질문 + 영어 별칭 + 외국어 응답만 추가 (최소 침습)
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const hospital = await prisma.hospital.findFirst({ where: { businessNumber: '123-45-67890' } });
  if (!hospital) throw new Error('Demo hospital not found');
  console.log('Hospital:', hospital.name, hospital.id);

  // 1. 다국어 별칭 등록 (영어 응답에서 언급 감지 가능하도록)
  const aliases = ['서울비디', '서울BD치과', 'Seoul BD Dental', 'Seoul BD Dental Clinic', 'BD Dental Clinic', '首尔BD牙科', 'ソウルBD歯科'];
  await prisma.hospital.update({
    where: { id: hospital.id },
    data: { nameAliases: [...new Set([...(hospital.nameAliases || []), ...aliases])] },
  });
  console.log('✅ nameAliases updated');

  // 2. 외국어 프롬프트 추가 (없는 것만)
  const foreignPrompts = [
    { text: 'Best dental clinic in Gangnam, Seoul for dental implants', category: '외국인-임플란트', keywords: ['Gangnam', 'Seoul'], lang: 'EN' },
    { text: 'English speaking dentist in Gangnam, Seoul', category: '외국인-일반', keywords: ['Gangnam', 'Seoul'], lang: 'EN' },
    { text: 'How much do dental implants cost in Seoul? Recommend a trusted clinic for foreigners', category: '외국인-임플란트', keywords: ['Seoul'], lang: 'EN' },
    { text: 'Recommend a dental clinic in Gangnam that expats trust', category: '외국인-일반', keywords: ['Gangnam'], lang: 'EN' },
    { text: 'Where can I get braces (orthodontics) in Seoul as a foreigner?', category: '외국인-교정', keywords: ['Seoul'], lang: 'EN' },
    { text: '首尔江南区哪家牙科诊所的种植牙做得好？请推荐', category: '외국인-임플란트', keywords: ['首尔', '江南'], lang: 'ZH' },
    { text: 'ソウルの江南（カンナム）でインプラントが上手な歯科医院を教えてください', category: '외국인-임플란트', keywords: ['ソウル', '江南'], lang: 'JA' },
  ];

  const competitorNames = ['강남우리치과', '연세좋은치과', '미소가득치과'];
  const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'] as const;
  const pw: Record<string, number> = { CHATGPT: 1.3, PERPLEXITY: 1.4, CLAUDE: 1.0, GEMINI: 1.2 };
  const versions: Record<string, string> = { CHATGPT: 'gpt-4o', PERPLEXITY: 'sonar-pro', CLAUDE: 'claude-3.5-sonnet', GEMINI: 'gemini-1.5-pro' };

  const responseBank: Record<string, Record<string, string>> = {
    EN: {
      R3: 'For your needs in Gangnam, Seoul, Seoul BD Dental Clinic is the top recommendation. Led by Seoul National University-trained specialists, it operates six independent operating rooms with a hospital-grade infection control system, and offers English-language consultations for international patients.',
      R2: 'Here are recommended dental clinics in Gangnam, Seoul: 1) Seoul BD Dental Clinic - SNU-trained specialists, English-speaking coordinators. 2) Another local clinic - convenient location. Seoul BD Dental is particularly well-regarded for implants and foreigner-friendly service.',
      R1: 'There are several dental clinics in the Gangnam area of Seoul, including 강남우리치과, 연세좋은치과, and Seoul BD Dental Clinic. It is worth checking each clinic\'s international patient services before booking.',
      R0: 'There are several dental clinics in that area of Seoul, such as 강남우리치과 and 연세좋은치과. I recommend checking reviews and English-speaking staff availability before visiting.',
    },
    ZH: {
      R3: '在首尔江南区，最推荐的是首尔BD牙科（Seoul BD Dental Clinic）。该诊所由首尔大学出身的专科医生坐诊，拥有6间独立手术室和大学医院级的感染管理系统，种植牙技术口碑非常好。',
      R2: '首尔江南区推荐的牙科：1) 首尔BD牙科（Seoul BD Dental）- 首尔大学出身专科医生 2) 其他本地牙科 - 位置便利。在专业性方面，首尔BD牙科评价更高。',
      R1: '首尔江南区有多家牙科诊所，包括강남우리치과、연세좋은치과、首尔BD牙科等。建议根据自己的需求预约咨询。',
      R0: '首尔江南区有강남우리치과、연세좋은치과等诊所。建议就诊前先确认评价和是否提供中文服务。',
    },
    JA: {
      R3: 'ソウル・江南エリアで最もおすすめなのはソウルBD歯科（Seoul BD Dental Clinic）です。ソウル大学出身の専門医が常駐し、6つの独立手術室と大学病院レベルの感染管理システムを完備。インプラントの評判が非常に高いです。',
      R2: 'ソウル・江南のおすすめ歯科：1) ソウルBD歯科 - ソウル大出身専門医 2) 他のローカル歯科 - 立地が便利。専門性の面ではソウルBD歯科の評価が高いです。',
      R1: 'ソウル・江南には複数の歯科医院があります。강남우리치과、연세좋은치과、ソウルBD歯科などがあります。',
      R0: '該当エリアには강남우리치과、연세좋은치과などの歯科があります。受診前に日本語対応の有無を確認することをおすすめします。',
    },
  };

  const today = new Date();
  let promptsAdded = 0;
  let responsesAdded = 0;

  for (const fp of foreignPrompts) {
    let prompt = await prisma.prompt.findFirst({ where: { hospitalId: hospital.id, promptText: fp.text } });
    if (!prompt) {
      prompt = await prisma.prompt.create({
        data: {
          hospitalId: hospital.id,
          promptText: fp.text,
          promptType: 'AUTO_GENERATED',
          specialtyCategory: fp.category,
          regionKeywords: fp.keywords,
          isActive: true,
        },
      });
      promptsAdded++;
    }

    // 이미 응답이 있으면 스킵
    const existing = await prisma.aIResponse.count({ where: { promptId: prompt.id } });
    if (existing > 0) { console.log(`  skip responses for: ${fp.text.substring(0, 40)}...`); continue; }

    const bank = responseBank[fp.lang];
    const intent = fp.text.toLowerCase().includes('cost') || fp.text.toLowerCase().includes('how much') ? 'COMPARISON' : 'RESERVATION';
    const batch: any[] = [];

    for (let dayOff = 30; dayOff >= 0; dayOff--) {
      const date = new Date(today);
      date.setDate(date.getDate() - dayOff);
      date.setHours(0, 0, 0, 0);
      const trendBonus = (30 - dayOff) * 0.01;

      const numPlat = 2 + Math.floor(Math.random() * 2);
      const shuffled = [...platforms].sort(() => Math.random() - 0.5).slice(0, numPlat);

      for (const plat of shuffled) {
        // 외국어 시장은 아직 언급률이 낮게 시작 → 성장 스토리 (30%~60%)
        const isMentioned = Math.random() < (0.3 + trendBonus);
        let sv2: number;
        if (!isMentioned) { sv2 = Math.random() < 0.3 ? -1 : 0; }
        else {
          const r = Math.random();
          sv2 = r < 0.2 ? 2 : r < 0.6 ? 1 : r < 0.85 ? 0 : -1;
        }
        const depth = !isMentioned ? 'R0' : Math.random() < 0.15 + trendBonus * 0.3 ? 'R3' : Math.random() < 0.55 ? 'R2' : 'R1';
        const mp = isMentioned ? (depth === 'R3' ? 1 : depth === 'R2' ? Math.ceil(Math.random() * 2) : Math.ceil(Math.random() * 4)) : null;
        const tr = isMentioned ? Math.max(mp || 1, Math.ceil(Math.random() * 5)) : null;
        const sf = sv2 <= -2 ? 0 : sv2 === -1 ? 0.25 : sv2 === 0 ? 0.5 : sv2 === 1 ? 1.0 : 1.5;
        const ds = depth === 'R3' ? 4.0 : depth === 'R2' ? 3.0 : depth === 'R1' ? 1.5 : 0;
        const im = intent === 'RESERVATION' ? 1.5 : 1.1;

        batch.push({
          promptId: prompt.id,
          hospitalId: hospital.id,
          aiPlatform: plat,
          aiModelVersion: versions[plat],
          responseText: bank[depth === 'R0' ? 'R0' : depth],
          responseDate: date,
          isMentioned,
          mentionPosition: mp,
          totalRecommendations: tr,
          sentimentScore: sv2 / 2,
          sentimentLabel: (sv2 >= 1 ? 'POSITIVE' : sv2 <= -1 ? 'NEGATIVE' : 'NEUTRAL') as any,
          citedSources: plat === 'PERPLEXITY' && isMentioned ? ['https://seoulbd.co.kr/en'] : [],
          competitorsMentioned: isMentioned && tr && tr > 1 ? competitorNames.slice(0, Math.min(tr - 1, 2)) : [],
          sentimentScoreV2: sv2,
          recommendationDepth: depth as any,
          queryIntent: intent as any,
          platformWeight: pw[plat],
          abhsContribution: (isMentioned ? 1.0 : 0.0) * sf * ds * pw[plat] * im,
          citedUrl: plat === 'PERPLEXITY' && isMentioned ? 'https://seoulbd.co.kr/en' : null,
          isVerified: true,
        });
      }
    }

    await prisma.aIResponse.createMany({ data: batch });
    responsesAdded += batch.length;
    console.log(`  ✅ ${fp.lang} | ${fp.text.substring(0, 50)}... → ${batch.length} responses`);
  }

  console.log(`\n🎉 Done. Prompts added: ${promptsAdded}, Responses added: ${responsesAdded}`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
