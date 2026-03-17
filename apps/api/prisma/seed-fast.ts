// Patient Signal - 프로덕션 시드 (배치 최적화 버전)
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding (batch-optimized)...');

  // 기존 데모 병원 조회
  let hospital = await prisma.hospital.findFirst({ where: { businessNumber: '123-45-67890' } });
  
  if (!hospital) {
    hospital = await prisma.hospital.create({
      data: {
        name: '서울비디치과 (데모)',
        businessNumber: '123-45-67890',
        specialtyType: 'DENTAL',
        subSpecialties: ['임플란트', '교정', '미백', '심미치료', '충치치료'],
        keyProcedures: ['임플란트', '교정', '미백'],
        regionSido: '서울특별시',
        regionSigungu: '강남구',
        regionDong: '역삼동',
        address: '서울특별시 강남구 역삼동 123-45',
        websiteUrl: 'https://seoulbd.co.kr',
        naverPlaceId: 'demo_naver_place_id',
        planType: 'PRO',
        subscriptionStatus: 'ACTIVE',
      },
    });
  } else {
    await prisma.hospital.update({
      where: { id: hospital.id },
      data: { keyProcedures: ['임플란트', '교정', '미백'], planType: 'PRO', subscriptionStatus: 'ACTIVE' },
    });
  }
  console.log('✅ Hospital:', hospital.id);

  // 유저 확인
  let user = await prisma.user.findUnique({ where: { email: 'demo@patientsignal.kr' } });
  if (!user) {
    const hash = await bcrypt.hash('demo1234!', 10);
    user = await prisma.user.create({
      data: {
        email: 'demo@patientsignal.kr', passwordHash: hash, name: '문석준 원장 (데모)',
        phone: '010-1234-5678', role: 'OWNER', hospitalId: hospital.id, isPfMember: true, emailVerified: true,
      },
    });
  } else {
    const hash = await bcrypt.hash('demo1234!', 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash, hospitalId: hospital.id } });
  }
  console.log('✅ User:', user.email);

  // 구독
  try {
    await prisma.subscription.upsert({
      where: { hospitalId: hospital.id },
      update: { planType: 'PRO', status: 'ACTIVE' },
      create: { hospitalId: hospital.id, planType: 'PRO', status: 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: new Date('2099-12-31') },
    });
  } catch (e) { console.warn('Sub skip'); }

  // 프롬프트
  const existingPrompts = await prisma.prompt.findMany({ where: { hospitalId: hospital.id } });
  let prompts = existingPrompts;
  
  if (existingPrompts.length === 0) {
    const promptData = [
      { text: '강남 임플란트 잘하는 치과 추천해줘', type: 'PRESET' as const, cat: '임플란트', kw: ['강남'] },
      { text: '강남역 치아교정 잘하는 곳 알려줘', type: 'PRESET' as const, cat: '교정', kw: ['강남역'] },
      { text: '서울 강남 치아미백 효과 좋은 치과', type: 'PRESET' as const, cat: '미백', kw: ['서울', '강남'] },
      { text: '역삼동 치과 추천해줘', type: 'CUSTOM' as const, cat: '일반', kw: ['역삼동'] },
      { text: '강남구 임플란트 가격 비교해줘', type: 'CUSTOM' as const, cat: '임플란트', kw: ['강남구'] },
      { text: '강남 치과 후기 좋은 곳', type: 'AUTO_GENERATED' as const, cat: '일반', kw: ['강남'] },
      { text: '임플란트 아프지 않은 치과 강남', type: 'AUTO_GENERATED' as const, cat: '임플란트', kw: ['강남'] },
    ];
    await prisma.prompt.createMany({
      data: promptData.map(p => ({
        hospitalId: hospital!.id, promptText: p.text, promptType: p.type,
        specialtyCategory: p.cat, regionKeywords: p.kw, isActive: true,
      })),
    });
    prompts = await prisma.prompt.findMany({ where: { hospitalId: hospital.id } });
  }
  console.log('✅ Prompts:', prompts.length);

  // ===== AI 응답 배치 생성 =====
  const existingResponses = await prisma.aIResponse.count({ where: { hospitalId: hospital.id } });
  if (existingResponses > 50) {
    console.log('✅ AI Responses already exist:', existingResponses);
  } else {
    await prisma.aIResponse.deleteMany({ where: { hospitalId: hospital.id } });
    
    const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'] as const;
    const pw: Record<string, number> = { CHATGPT: 1.3, PERPLEXITY: 1.4, CLAUDE: 1.0, GEMINI: 1.2 };
    const versions: Record<string, string> = { CHATGPT: 'gpt-4o', PERPLEXITY: 'sonar-pro', CLAUDE: 'claude-3.5-sonnet', GEMINI: 'gemini-1.5-pro' };

    const classifyIntent = (text: string) => {
      if (['추천', '알려줘', '어디', '좋은'].some(k => text.includes(k))) return 'RESERVATION';
      if (['비교', '가격'].some(k => text.includes(k))) return 'COMPARISON';
      if (['후기', '리뷰'].some(k => text.includes(k))) return 'REVIEW';
      if (['아프', '두려', '걱정'].some(k => text.includes(k))) return 'FEAR';
      return 'INFORMATION';
    };

    const today = new Date();
    const batch: any[] = [];

    // 최근 14일만 생성 (속도를 위해)
    for (let dayOff = 13; dayOff >= 0; dayOff--) {
      const date = new Date(today);
      date.setDate(date.getDate() - dayOff);
      date.setHours(0, 0, 0, 0);

      const trendBonus = (13 - dayOff) * 0.02;

      for (const prompt of prompts) {
        // 2~3 플랫폼
        const numPlat = 2 + Math.floor(Math.random() * 2);
        const shuffled = [...platforms].sort(() => Math.random() - 0.5).slice(0, numPlat);

        for (const plat of shuffled) {
          const isMentioned = Math.random() < (0.5 + trendBonus);
          const intent = classifyIntent(prompt.promptText) as any;
          
          let sv2: number;
          if (!isMentioned) { sv2 = Math.random() < 0.3 ? -1 : 0; }
          else {
            const r = Math.random();
            sv2 = r < 0.15 ? 2 : r < 0.55 ? 1 : r < 0.80 ? 0 : r < 0.95 ? -1 : -2;
          }

          const depth = !isMentioned ? 'R0' as const
            : Math.random() < 0.2 + trendBonus ? 'R3' as const
            : Math.random() < 0.6 ? 'R2' as const : 'R1' as const;

          const mp = isMentioned ? (depth === 'R3' ? 1 : depth === 'R2' ? Math.ceil(Math.random() * 2) : Math.ceil(Math.random() * 4)) : null;
          const tr = isMentioned ? Math.max(mp || 1, Math.ceil(Math.random() * 5)) : null;

          const sf = sv2 <= -2 ? 0 : sv2 === -1 ? 0.25 : sv2 === 0 ? 0.5 : sv2 === 1 ? 1.0 : 1.5;
          const ds = depth === 'R3' ? 4.0 : depth === 'R2' ? 3.0 : depth === 'R1' ? 1.5 : 0;
          const im = intent === 'RESERVATION' ? 1.5 : intent === 'REVIEW' ? 1.3 : intent === 'FEAR' ? 1.2 : intent === 'COMPARISON' ? 1.1 : 1.0;
          const ac = (isMentioned ? 1.0 : 0.0) * sf * ds * (pw[plat]!) * im;

          batch.push({
            promptId: prompt.id,
            hospitalId: hospital!.id,
            aiPlatform: plat,
            aiModelVersion: versions[plat],
            responseText: isMentioned 
              ? `서울비디치과는 해당 지역에서 높은 평가를 받는 치과입니다. 전문의가 상주하며 체계적인 진료를 제공합니다.`
              : `해당 지역에 여러 치과가 있습니다. 방문 전 후기를 확인해보세요.`,
            responseDate: date,
            isMentioned,
            mentionPosition: mp,
            totalRecommendations: tr,
            sentimentScore: sv2 / 2,
            sentimentLabel: (sv2 >= 1 ? 'POSITIVE' : sv2 <= -1 ? 'NEGATIVE' : 'NEUTRAL') as any,
            citedSources: plat === 'PERPLEXITY' && isMentioned ? ['https://seoulbd.co.kr'] : [],
            competitorsMentioned: isMentioned && tr && tr > 1 ? ['강남우리치과'] : [],
            sentimentScoreV2: sv2,
            recommendationDepth: depth,
            queryIntent: intent,
            platformWeight: pw[plat],
            abhsContribution: ac,
            citedUrl: plat === 'PERPLEXITY' && isMentioned ? 'https://seoulbd.co.kr' : null,
            isVerified: true,
          });
        }
      }
    }

    // 500개씩 배치 삽입
    const chunkSize = 500;
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      await prisma.aIResponse.createMany({ data: chunk });
      console.log(`  Batch ${Math.floor(i/chunkSize) + 1}: ${chunk.length} responses`);
    }
    console.log('✅ AI Responses:', batch.length);
  }

  // ===== 일일 점수 배치 =====
  const existingScores = await prisma.dailyScore.count({ where: { hospitalId: hospital.id } });
  if (existingScores >= 28) {
    console.log('✅ Daily scores already exist:', existingScores);
  } else {
    await prisma.dailyScore.deleteMany({ where: { hospitalId: hospital.id } });
    
    const today = new Date();
    const scoreBatch: any[] = [];

    for (let i = 30; i >= 0; i--) {
      const scoreDate = new Date(today);
      scoreDate.setDate(scoreDate.getDate() - i);
      scoreDate.setHours(0, 0, 0, 0);

      const t = (30 - i) * 0.5;
      const os = Math.min(100, Math.max(0, Math.round(52 + t + Math.random() * 8 - 4)));
      const as2 = Math.min(100, Math.max(0, Math.round(38 + t * 0.8 + Math.random() * 8 - 4)));
      const sv = Math.min(100, Math.round((35 + t * 0.6 + Math.random() * 10 - 5) * 10) / 10);
      const se = Math.min(2, Math.round((0.3 + t * 0.015 + Math.random() * 0.6 - 0.3) * 100) / 100);

      scoreBatch.push({
        hospitalId: hospital!.id,
        scoreDate,
        overallScore: os,
        specialtyScores: { implant: os + Math.floor(Math.random() * 10) - 5, orthodontics: os + Math.floor(Math.random() * 8) - 4, whitening: os + Math.floor(Math.random() * 12) - 6 },
        platformScores: { chatgpt: os + Math.floor(Math.random() * 12) - 6, perplexity: os + Math.floor(Math.random() * 12) - 6, claude: os + Math.floor(Math.random() * 10) - 5, gemini: os + Math.floor(Math.random() * 10) - 5 },
        mentionCount: Math.floor(8 + t * 0.3 + Math.random() * 8),
        positiveRatio: Math.min(1, 0.55 + t * 0.008 + Math.random() * 0.15),
        abhsScore: as2,
        sovPercent: sv,
        avgSentimentV2: se,
        platformContributions: {
          CHATGPT: { weight: 1.3, contribution: 25 + Math.random() * 15, sovPercent: sv + Math.random() * 8 - 4, avgDepth: 'R2', responseCount: 8 },
          PERPLEXITY: { weight: 1.4, contribution: 28 + Math.random() * 12, sovPercent: sv + Math.random() * 10 - 5, avgDepth: 'R2', responseCount: 7 },
          CLAUDE: { weight: 1.0, contribution: 18 + Math.random() * 12, sovPercent: sv + Math.random() * 8 - 4, avgDepth: 'R1', responseCount: 6 },
          GEMINI: { weight: 1.2, contribution: 22 + Math.random() * 12, sovPercent: sv + Math.random() * 8 - 4, avgDepth: 'R2', responseCount: 7 },
        },
        intentScores: {
          RESERVATION: Math.round(55 + t * 0.8 + Math.random() * 15 - 7),
          COMPARISON: Math.round(45 + t * 0.6 + Math.random() * 12 - 6),
          INFORMATION: Math.round(50 + t * 0.5 + Math.random() * 10 - 5),
          REVIEW: Math.round(48 + t * 0.7 + Math.random() * 14 - 7),
          FEAR: Math.round(42 + t * 0.4 + Math.random() * 10 - 5),
        },
        depthDistribution: {
          R0: Math.max(0, Math.round(8 - t * 0.15 + Math.random() * 3)),
          R1: Math.round(6 + Math.random() * 4),
          R2: Math.round(5 + t * 0.1 + Math.random() * 3),
          R3: Math.round(2 + t * 0.08 + Math.random() * 2),
        },
      });
    }

    await prisma.dailyScore.createMany({ data: scoreBatch });
    console.log('✅ Daily scores:', scoreBatch.length);
  }

  // ===== 경쟁사 =====
  const existingComps = await prisma.competitor.count({ where: { hospitalId: hospital.id } });
  if (existingComps >= 3) {
    console.log('✅ Competitors already exist:', existingComps);
  } else {
    await prisma.competitor.deleteMany({ where: { hospitalId: hospital.id } });
    
    const comps = [
      { name: '강남우리치과', region: '강남구', auto: true },
      { name: '연세좋은치과', region: '강남구', auto: true },
      { name: '미소가득치과', region: '강남구', auto: false },
    ];

    for (const c of comps) {
      const comp = await prisma.competitor.create({
        data: { hospitalId: hospital.id, competitorName: c.name, competitorRegion: c.region, isAutoDetected: c.auto, isActive: true },
      });

      const csBatch = [];
      const today = new Date();
      for (let i = 30; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        csBatch.push({ competitorId: comp.id, scoreDate: d, overallScore: 35 + Math.floor(Math.random() * 25), mentionCount: 2 + Math.floor(Math.random() * 10) });
      }
      await prisma.competitorScore.createMany({ data: csBatch });
    }
    console.log('✅ Competitors: 3');
  }

  // ===== 개선 액션 & 콘텐츠 갭 =====
  const existingActions = await prisma.improvementAction.count({ where: { hospitalId: hospital.id } });
  if (existingActions < 3) {
    await prisma.improvementAction.deleteMany({ where: { hospitalId: hospital.id } });
    await prisma.improvementAction.createMany({
      data: [
        { hospitalId: hospital.id, actionType: 'CONTENT', title: '임플란트 후기 콘텐츠 보강', description: '블로그 및 SNS에 시술 후기 5건 이상 작성', expectedImpact: 8, status: 'PENDING' },
        { hospitalId: hospital.id, actionType: 'SEO', title: '네이버 플레이스 정보 업데이트', description: '진료시간, 주차정보 최신화', expectedImpact: 7, status: 'PENDING' },
        { hospitalId: hospital.id, actionType: 'REVIEW', title: '긍정 리뷰 수집 캠페인', description: '만족 환자 리뷰 요청 프로세스 구축', expectedImpact: 9, status: 'PENDING' },
        { hospitalId: hospital.id, actionType: 'AI_OPTIMIZE', title: 'Perplexity 인용 최적화', description: '웹사이트 JSON-LD 구조화 데이터 추가', expectedImpact: 8, status: 'PENDING' },
      ],
    });
    console.log('✅ Actions created');
  }

  const existingGaps = await prisma.contentGap.count({ where: { hospitalId: hospital.id } });
  if (existingGaps < 3) {
    await prisma.contentGap.deleteMany({ where: { hospitalId: hospital.id } });
    await prisma.contentGap.createMany({
      data: [
        { hospitalId: hospital.id, gapType: 'CONTENT', topic: '투명교정 비용 안내', competitorHas: true, priorityScore: 85, suggestedAction: '투명교정 비용 가이드 제작', status: 'PENDING' },
        { hospitalId: hospital.id, gapType: 'KEYWORD', topic: '강남 야간진료 치과', competitorHas: true, priorityScore: 72, suggestedAction: '야간진료 안내 페이지 생성', status: 'PENDING' },
        { hospitalId: hospital.id, gapType: 'TOPIC', topic: '임플란트 시술 과정 영상', competitorHas: false, priorityScore: 65, suggestedAction: '시술 과정 영상 콘텐츠 제작', status: 'PENDING' },
      ],
    });
    console.log('✅ Content gaps created');
  }

  console.log('\n🎉 Seeding completed!');
  console.log('📧 Email: demo@patientsignal.kr');
  console.log('🔐 Password: demo1234!');
}

main()
  .catch((e) => { console.error('❌ Failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
