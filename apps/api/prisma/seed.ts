// Patient Signal - 프로덕션용 시드 스크립트
// 데모 계정, ABHS 데이터, AI 응답 전체 포함
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database (Production-ready)...');

  // ===== 1. 데모 병원 생성 =====
  const demoHospital = await prisma.hospital.upsert({
    where: { businessNumber: '123-45-67890' },
    update: {
      name: '서울비디치과 (데모)',
      specialtyType: 'DENTAL',
      subSpecialties: ['임플란트', '교정', '미백', '심미치료', '충치치료'],
      keyProcedures: ['임플란트', '교정', '미백'],
      regionSido: '서울특별시',
      regionSigungu: '강남구',
      regionDong: '역삼동',
      planType: 'PRO',
      subscriptionStatus: 'ACTIVE',
    },
    create: {
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
  console.log('✅ Demo hospital:', demoHospital.name, demoHospital.id);

  // ===== 2. 데모 사용자 생성 =====
  const hashedPassword = await bcrypt.hash('demo1234!', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@patientsignal.kr' },
    update: {
      passwordHash: hashedPassword,
      hospitalId: demoHospital.id,
      name: '문석준 원장 (데모)',
      role: 'OWNER',
      isPfMember: true,
      emailVerified: true,
    },
    create: {
      email: 'demo@patientsignal.kr',
      passwordHash: hashedPassword,
      name: '문석준 원장 (데모)',
      phone: '010-1234-5678',
      role: 'OWNER',
      hospitalId: demoHospital.id,
      isPfMember: true,
      emailVerified: true,
    },
  });
  console.log('✅ Demo user:', demoUser.email);

  // ===== 3. 구독 정보 =====
  try {
    await prisma.subscription.upsert({
      where: { hospitalId: demoHospital.id },
      update: {
        planType: 'PRO',
        status: 'ACTIVE',
      },
      create: {
        hospitalId: demoHospital.id,
        planType: 'PRO',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date('2099-12-31'),
        autoRenewal: true,
      },
    });
    console.log('✅ Subscription created');
  } catch (e) {
    console.warn('⚠️ Subscription skip:', (e as any).message?.substring(0, 80));
  }

  // ===== 4. 모니터링 질문 생성 =====
  // 기존 프롬프트 삭제 후 재생성
  await prisma.prompt.deleteMany({ where: { hospitalId: demoHospital.id } });

  const promptTemplates = [
    { text: '강남 임플란트 잘하는 치과 추천해줘', type: 'PRESET' as const, category: '임플란트', keywords: ['강남', '역삼'] },
    { text: '강남역 근처 치아교정 잘하는 곳 알려줘', type: 'PRESET' as const, category: '교정', keywords: ['강남역', '역삼역'] },
    { text: '서울 강남 치아미백 효과 좋은 치과', type: 'PRESET' as const, category: '미백', keywords: ['서울', '강남'] },
    { text: '역삼동 치과 추천 부탁해', type: 'CUSTOM' as const, category: '일반', keywords: ['역삼동'] },
    { text: '강남구 임플란트 가격 비교해줘', type: 'CUSTOM' as const, category: '임플란트', keywords: ['강남구'] },
    { text: '강남 치과 후기 좋은 곳 알려줘', type: 'AUTO_GENERATED' as const, category: '일반', keywords: ['강남'] },
    { text: '역삼 스케일링 잘하는 치과 추천', type: 'AUTO_GENERATED' as const, category: '스케일링', keywords: ['역삼'] },
    { text: '강남 사랑니 발치 잘하는 치과', type: 'AUTO_GENERATED' as const, category: '발치', keywords: ['강남'] },
    { text: '임플란트 아프지 않은 치과 강남', type: 'AUTO_GENERATED' as const, category: '임플란트', keywords: ['강남'] },
    { text: '강남 치과 가격 합리적인 곳', type: 'AUTO_GENERATED' as const, category: '일반', keywords: ['강남'] },
    { text: '역삼동 라미네이트 잘하는 치과', type: 'AUTO_GENERATED' as const, category: '라미네이트', keywords: ['역삼동'] },
    { text: '강남 소아치과 잘하는 곳 추천', type: 'AUTO_GENERATED' as const, category: '소아', keywords: ['강남'] },
    { text: '서울 강남 잇몸치료 잘하는 치과', type: 'AUTO_GENERATED' as const, category: '잇몸', keywords: ['서울', '강남'] },
    { text: '강남역 야간 진료 치과 알려줘', type: 'AUTO_GENERATED' as const, category: '일반', keywords: ['강남역'] },
  ];

  const createdPrompts = [];
  for (const p of promptTemplates) {
    const prompt = await prisma.prompt.create({
      data: {
        hospitalId: demoHospital.id,
        promptText: p.text,
        promptType: p.type,
        specialtyCategory: p.category,
        regionKeywords: p.keywords,
        isActive: true,
      },
    });
    createdPrompts.push(prompt);
  }
  console.log('✅ Prompts created:', createdPrompts.length);

  // ===== 5. AI 응답 데이터 생성 (ABHS 계산에 필수) =====
  await prisma.aIResponse.deleteMany({ where: { hospitalId: demoHospital.id } });

  const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'] as const;
  const platformWeights: Record<string, number> = {
    CHATGPT: 1.3, PERPLEXITY: 1.4, CLAUDE: 1.0, GEMINI: 1.2,
  };

  // 의도 분류 함수
  const classifyIntent = (text: string): string => {
    if (['추천', '알려줘', '어디', '가고', '소개', '좋은'].some(k => text.includes(k))) return 'RESERVATION';
    if (['비교', 'vs', '차이', '가격 비교'].some(k => text.includes(k))) return 'COMPARISON';
    if (['후기', '리뷰', '경험', '솔직'].some(k => text.includes(k))) return 'REVIEW';
    if (['아프', '무섭', '두려', '걱정'].some(k => text.includes(k))) return 'FEAR';
    return 'INFORMATION';
  };

  const competitorNames = ['강남우리치과', '연세좋은치과', '미소가득치과', '강남바른치과', '예스치과'];

  // 최근 30일치 AI 응답 생성
  let totalResponses = 0;
  const today = new Date();

  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const responseDate = new Date(today);
    responseDate.setDate(responseDate.getDate() - dayOffset);
    responseDate.setHours(0, 0, 0, 0);

    // 매일 일부 프롬프트 선택 (평일은 더 많이)
    const dayOfWeek = responseDate.getDay();
    const promptsPerDay = dayOfWeek === 0 || dayOfWeek === 6 
      ? Math.floor(createdPrompts.length * 0.5) 
      : createdPrompts.length;
    
    const todaysPrompts = createdPrompts.slice(0, promptsPerDay);

    for (const prompt of todaysPrompts) {
      // 각 프롬프트에 대해 2~4개 플랫폼에서 응답 생성
      const platformCount = 2 + Math.floor(Math.random() * 3); // 2~4
      const shuffledPlatforms = [...platforms].sort(() => Math.random() - 0.5).slice(0, platformCount);

      for (const platform of shuffledPlatforms) {
        // 점수 트렌드: 시간이 갈수록 좋아짐
        const trendBonus = (30 - dayOffset) * 0.01; // 0 ~ 0.3
        const isMentioned = Math.random() < (0.45 + trendBonus); // 45%~75% 언급률
        
        const intent = classifyIntent(prompt.promptText) as any;
        
        // 감성 점수 V2 (-2 ~ +2)
        let sentimentV2: number;
        if (!isMentioned) {
          sentimentV2 = Math.random() < 0.3 ? -1 : 0;
        } else {
          const roll = Math.random();
          if (roll < 0.15) sentimentV2 = 2;      // 15% 강한 긍정
          else if (roll < 0.55) sentimentV2 = 1;   // 40% 긍정
          else if (roll < 0.80) sentimentV2 = 0;   // 25% 중립
          else if (roll < 0.95) sentimentV2 = -1;   // 15% 부정
          else sentimentV2 = -2;                     // 5% 강한 부정
        }

        // 추천 깊이
        let depth: string;
        if (!isMentioned) {
          depth = 'R0';
        } else {
          const depthRoll = Math.random();
          if (depthRoll < 0.15 + trendBonus * 0.3) depth = 'R3';     // 단독 추천
          else if (depthRoll < 0.45 + trendBonus * 0.2) depth = 'R2'; // 상위 추천
          else depth = 'R1';                                            // 단순 언급
        }

        const mentionPosition = isMentioned ? (depth === 'R3' ? 1 : depth === 'R2' ? Math.ceil(Math.random() * 2) : Math.ceil(Math.random() * 5)) : null;
        const totalRecs = isMentioned ? Math.max(mentionPosition || 1, Math.ceil(Math.random() * 5)) : null;
        
        // 감성 레이블 (기존 호환)
        const sentimentLabel = sentimentV2 >= 1 ? 'POSITIVE' : sentimentV2 <= -1 ? 'NEGATIVE' : 'NEUTRAL';
        const sentimentScore = sentimentV2 / 2; // -1 ~ 1

        // 경쟁사 언급
        const mentionedCompetitors: string[] = [];
        if (isMentioned && totalRecs && totalRecs > 1) {
          const numCompetitors = Math.min(totalRecs - 1, 3);
          const shuffled = [...competitorNames].sort(() => Math.random() - 0.5);
          mentionedCompetitors.push(...shuffled.slice(0, numCompetitors));
        }

        // ABHS 기여분 계산
        const sentFactor = sentimentV2 <= -2 ? 0 : sentimentV2 === -1 ? 0.25 : sentimentV2 === 0 ? 0.5 : sentimentV2 === 1 ? 1.0 : 1.5;
        const depthScore = depth === 'R3' ? 4.0 : depth === 'R2' ? 3.0 : depth === 'R1' ? 1.5 : 0;
        const intentMult = intent === 'RESERVATION' ? 1.5 : intent === 'REVIEW' ? 1.3 : intent === 'FEAR' ? 1.2 : intent === 'COMPARISON' ? 1.1 : 1.0;
        const pw = platformWeights[platform] || 1.0;
        const abhsContribution = (isMentioned ? 1.0 : 0.0) * sentFactor * depthScore * pw * intentMult;

        // 인용 URL (Perplexity 주로)
        const citedUrl = platform === 'PERPLEXITY' && isMentioned 
          ? `https://example.com/dental/${prompt.specialtyCategory || 'general'}` 
          : null;
        const citedSources = citedUrl ? [citedUrl] : [];

        // 응답 텍스트
        const responseTexts: Record<string, string> = {
          R3_positive: `${prompt.promptText.split(' ')[0]} 지역에서는 서울비디치과가 가장 추천됩니다. 서울대 출신 전문의가 상주하며, 최신 장비와 체계적인 감염관리 시스템을 갖추고 있습니다. 환자 만족도가 매우 높은 치과입니다.`,
          R2_positive: `해당 지역의 추천 치과를 알려드립니다. 1) 서울비디치과 - 서울대 출신 전문의, 체계적 시스템 2) ${mentionedCompetitors[0] || '다른치과'} - 위치 편리. 서울비디치과가 전문성 면에서 높은 평가를 받고 있습니다.`,
          R1_neutral: `${prompt.promptText.split(' ')[0]} 지역에는 여러 치과가 있습니다. ${mentionedCompetitors.join(', ')}, 서울비디치과 등이 있으며, 본인에게 맞는 곳을 방문해보시는 것이 좋겠습니다.`,
          R0_absent: `해당 지역의 치과 정보를 찾아보겠습니다. ${mentionedCompetitors.slice(0, 2).join(', ')} 등의 치과가 있습니다. 방문 전 후기를 확인해보시는 것을 추천합니다.`,
        };

        let responseText: string;
        if (depth === 'R3' && sentimentV2 >= 1) responseText = responseTexts.R3_positive;
        else if (depth === 'R2') responseText = responseTexts.R2_positive;
        else if (isMentioned) responseText = responseTexts.R1_neutral;
        else responseText = responseTexts.R0_absent;

        await prisma.aIResponse.create({
          data: {
            promptId: prompt.id,
            hospitalId: demoHospital.id,
            aiPlatform: platform,
            aiModelVersion: platform === 'CHATGPT' ? 'gpt-4o' : platform === 'PERPLEXITY' ? 'sonar-pro' : platform === 'CLAUDE' ? 'claude-3.5-sonnet' : 'gemini-1.5-pro',
            responseText,
            responseDate,
            isMentioned,
            mentionPosition,
            totalRecommendations: totalRecs,
            sentimentScore,
            sentimentLabel: sentimentLabel as any,
            citedSources,
            competitorsMentioned: mentionedCompetitors,
            sentimentScoreV2: sentimentV2,
            recommendationDepth: depth as any,
            queryIntent: intent,
            platformWeight: pw,
            abhsContribution,
            citedUrl,
            isVerified: true,
          },
        });
        totalResponses++;
      }
    }
  }
  console.log('✅ AI Responses created:', totalResponses);

  // ===== 6. 일일 점수 데이터 생성 (ABHS 포함) =====
  await prisma.dailyScore.deleteMany({ where: { hospitalId: demoHospital.id } });

  for (let i = 30; i >= 0; i--) {
    const scoreDate = new Date(today);
    scoreDate.setDate(scoreDate.getDate() - i);
    scoreDate.setHours(0, 0, 0, 0);

    const trendBonus = (30 - i) * 0.5;
    const baseScore = 52 + trendBonus;
    const variation = Math.floor(Math.random() * 8) - 4;
    const overallScore = Math.min(100, Math.max(0, Math.round(baseScore + variation)));

    // ABHS 점수 (상승 트렌드)
    const abhsBase = 38 + trendBonus * 0.8;
    const abhsScore = Math.min(100, Math.max(0, Math.round(abhsBase + Math.random() * 8 - 4)));

    // SoV % (상승 트렌드)
    const sovBase = 35 + trendBonus * 0.6;
    const sovPercent = Math.min(100, Math.max(0, Math.round((sovBase + Math.random() * 10 - 5) * 10) / 10));

    // 감성 평균 (점점 좋아짐)
    const sentBase = 0.3 + trendBonus * 0.015;
    const avgSentimentV2 = Math.min(2, Math.max(-2, Math.round((sentBase + Math.random() * 0.6 - 0.3) * 100) / 100));

    // 플랫폼별 기여도
    const platformContributions = {
      CHATGPT: { weight: 1.3, contribution: 25 + Math.random() * 15, sovPercent: sovPercent + Math.random() * 10 - 5, avgSentiment: avgSentimentV2 + Math.random() * 0.4 - 0.2, avgDepth: 'R2', responseCount: 8 + Math.floor(Math.random() * 4) },
      PERPLEXITY: { weight: 1.4, contribution: 28 + Math.random() * 15, sovPercent: sovPercent + Math.random() * 10 - 5, avgSentiment: avgSentimentV2 + Math.random() * 0.4 - 0.2, avgDepth: 'R2', responseCount: 7 + Math.floor(Math.random() * 4) },
      CLAUDE: { weight: 1.0, contribution: 18 + Math.random() * 12, sovPercent: sovPercent + Math.random() * 10 - 5, avgSentiment: avgSentimentV2 + Math.random() * 0.4 - 0.2, avgDepth: 'R1', responseCount: 6 + Math.floor(Math.random() * 3) },
      GEMINI: { weight: 1.2, contribution: 22 + Math.random() * 12, sovPercent: sovPercent + Math.random() * 10 - 5, avgSentiment: avgSentimentV2 + Math.random() * 0.4 - 0.2, avgDepth: 'R2', responseCount: 7 + Math.floor(Math.random() * 3) },
    };

    // 의도별 점수
    const intentScores = {
      RESERVATION: Math.round(55 + trendBonus * 0.8 + Math.random() * 15 - 7),
      COMPARISON: Math.round(45 + trendBonus * 0.6 + Math.random() * 12 - 6),
      INFORMATION: Math.round(50 + trendBonus * 0.5 + Math.random() * 10 - 5),
      REVIEW: Math.round(48 + trendBonus * 0.7 + Math.random() * 14 - 7),
      FEAR: Math.round(42 + trendBonus * 0.4 + Math.random() * 10 - 5),
    };

    // 깊이 분포
    const depthDistribution = {
      R0: Math.max(0, Math.round(8 - trendBonus * 0.15 + Math.random() * 3)),
      R1: Math.round(6 + Math.random() * 4),
      R2: Math.round(5 + trendBonus * 0.1 + Math.random() * 3),
      R3: Math.round(2 + trendBonus * 0.08 + Math.random() * 2),
    };

    await prisma.dailyScore.create({
      data: {
        hospitalId: demoHospital.id,
        scoreDate,
        overallScore,
        specialtyScores: {
          implant: Math.min(100, overallScore + Math.floor(Math.random() * 10) - 5),
          orthodontics: Math.min(100, overallScore + Math.floor(Math.random() * 10) - 5),
          whitening: Math.min(100, overallScore + Math.floor(Math.random() * 12) - 6),
        },
        platformScores: {
          chatgpt: Math.min(100, overallScore + Math.floor(Math.random() * 15) - 7),
          perplexity: Math.min(100, overallScore + Math.floor(Math.random() * 15) - 7),
          claude: Math.min(100, overallScore + Math.floor(Math.random() * 12) - 6),
          gemini: Math.min(100, overallScore + Math.floor(Math.random() * 12) - 6),
        },
        mentionCount: Math.floor(8 + trendBonus * 0.3 + Math.random() * 8),
        positiveRatio: Math.min(1, 0.55 + trendBonus * 0.008 + Math.random() * 0.15),
        abhsScore,
        sovPercent,
        avgSentimentV2,
        platformContributions,
        intentScores,
        depthDistribution,
      },
    });
  }
  console.log('✅ Daily scores created for 31 days (with ABHS)');

  // ===== 7. 경쟁사 데이터 =====
  await prisma.competitor.deleteMany({ where: { hospitalId: demoHospital.id } });

  const competitorData = [
    { name: '강남우리치과', region: '강남구', auto: true },
    { name: '연세좋은치과', region: '강남구', auto: true },
    { name: '미소가득치과', region: '강남구', auto: false },
  ];

  for (const comp of competitorData) {
    const competitor = await prisma.competitor.create({
      data: {
        hospitalId: demoHospital.id,
        competitorName: comp.name,
        competitorRegion: comp.region,
        isAutoDetected: comp.auto,
        isActive: true,
      },
    });

    for (let i = 30; i >= 0; i--) {
      const scoreDate = new Date(today);
      scoreDate.setDate(scoreDate.getDate() - i);
      scoreDate.setHours(0, 0, 0, 0);

      await prisma.competitorScore.create({
        data: {
          competitorId: competitor.id,
          scoreDate,
          overallScore: 35 + Math.floor(Math.random() * 25),
          mentionCount: Math.floor(Math.random() * 12) + 2,
        },
      });
    }
  }
  console.log('✅ Competitors created:', competitorData.length);

  // ===== 8. 개선 액션 =====
  await prisma.improvementAction.deleteMany({ where: { hospitalId: demoHospital.id } });

  const actions = [
    { type: 'CONTENT', title: '임플란트 후기 콘텐츠 보강', desc: '블로그 및 SNS에 임플란트 시술 후기 5건 이상 작성', impact: 8 },
    { type: 'SEO', title: '네이버 플레이스 정보 업데이트', desc: '진료시간, 주차정보, 시술 목록 최신화 필요', impact: 7 },
    { type: 'REVIEW', title: '긍정 리뷰 수집 캠페인', desc: '만족 환자 대상 리뷰 작성 요청 프로세스 구축', impact: 9 },
    { type: 'AI_OPTIMIZE', title: 'Perplexity 인용 최적화', desc: '병원 웹사이트 구조화 데이터(JSON-LD) 추가', impact: 8 },
    { type: 'CONTENT', title: 'FAQ 페이지 보강', desc: '자주 묻는 질문 30개 이상 추가하여 AI 크롤러 대응', impact: 7 },
  ];

  for (const a of actions) {
    await prisma.improvementAction.create({
      data: {
        hospitalId: demoHospital.id,
        actionType: a.type,
        title: a.title,
        description: a.desc,
        expectedImpact: a.impact,
        status: 'PENDING',
      },
    });
  }
  console.log('✅ Actions created:', actions.length);

  // ===== 9. 콘텐츠 갭 =====
  await prisma.contentGap.deleteMany({ where: { hospitalId: demoHospital.id } });

  const gaps = [
    { type: 'CONTENT' as const, topic: '투명교정 비용 안내', has: true, score: 85, action: '투명교정 비용 비교 가이드 콘텐츠 제작' },
    { type: 'KEYWORD' as const, topic: '강남 야간진료 치과', has: true, score: 72, action: '야간진료 안내 페이지 생성 및 구조화 데이터 추가' },
    { type: 'TOPIC' as const, topic: '임플란트 시술 과정 영상', has: false, score: 65, action: '시술 과정 설명 동영상 콘텐츠 제작' },
    { type: 'CONTENT' as const, topic: '치아교정 전후 비교', has: true, score: 78, action: '교정 전후 비교 사진 갤러리 페이지 제작' },
  ];

  for (const gap of gaps) {
    await prisma.contentGap.create({
      data: {
        hospitalId: demoHospital.id,
        gapType: gap.type,
        topic: gap.topic,
        competitorHas: gap.has,
        priorityScore: gap.score,
        suggestedAction: gap.action,
        status: 'PENDING',
      },
    });
  }
  console.log('✅ Content gaps created:', gaps.length);

  // ===== 10. 프리셋 프롬프트 =====
  await prisma.presetPrompt.deleteMany({});

  const presets = [
    { spec: 'DENTAL' as const, cat: '임플란트', tpl: '{지역} 임플란트 잘하는 치과 추천해줘', pri: 1 },
    { spec: 'DENTAL' as const, cat: '임플란트', tpl: '{지역}에서 임플란트 가격 저렴한 곳 알려줘', pri: 2 },
    { spec: 'DENTAL' as const, cat: '교정', tpl: '{지역} 치아교정 잘하는 치과 어디야?', pri: 1 },
    { spec: 'DENTAL' as const, cat: '교정', tpl: '투명교정 vs 메탈교정 {지역}에서 어디가 좋아?', pri: 2 },
    { spec: 'DENTAL' as const, cat: '미백', tpl: '{지역} 치아미백 효과 좋은 치과 추천', pri: 1 },
    { spec: 'DENTAL' as const, cat: '충치', tpl: '{지역} 충치치료 잘하는 치과 알려줘', pri: 1 },
    { spec: 'DENTAL' as const, cat: '일반', tpl: '{지역} 치과 어디가 좋아?', pri: 1 },
    { spec: 'DENTAL' as const, cat: '일반', tpl: '{지역} 주말 진료 치과 추천해줘', pri: 2 },
  ];

  for (const p of presets) {
    await prisma.presetPrompt.create({
      data: {
        specialtyType: p.spec,
        category: p.cat,
        promptTemplate: p.tpl,
        priority: p.pri,
        isActive: true,
      },
    });
  }
  console.log('✅ Preset prompts created:', presets.length);

  // ===== 11. 지역 데이터 =====
  const regions = [
    { sido: '서울특별시', sigungu: '강남구', dong: '역삼동' },
    { sido: '서울특별시', sigungu: '강남구', dong: '삼성동' },
    { sido: '서울특별시', sigungu: '강남구', dong: '논현동' },
    { sido: '서울특별시', sigungu: '서초구', dong: '서초동' },
    { sido: '서울특별시', sigungu: '서초구', dong: '반포동' },
  ];

  for (const r of regions) {
    await prisma.region.upsert({
      where: { sido_sigungu_dong: { sido: r.sido, sigungu: r.sigungu, dong: r.dong } },
      update: {},
      create: r,
    });
  }
  console.log('✅ Regions created:', regions.length);

  // ===== 12. 진료과 프리셋 시드 =====
  try {
    await prisma.specialtyPreset.deleteMany({});
    
    const specialtyPresets = [
      { type: 'DENTAL' as const, name: '임플란트', alias: ['임플', 'implant', '인공치아'], cat: 'core', popular: true, order: 1 },
      { type: 'DENTAL' as const, name: '교정', alias: ['치아교정', '치열교정', 'orthodontics', '투명교정'], cat: 'core', popular: true, order: 2 },
      { type: 'DENTAL' as const, name: '미백', alias: ['치아미백', 'whitening', '화이트닝'], cat: 'cosmetic', popular: true, order: 3 },
      { type: 'DENTAL' as const, name: '충치치료', alias: ['충치', '레진', '인레이', '크라운'], cat: 'general', popular: false, order: 4 },
      { type: 'DENTAL' as const, name: '잇몸치료', alias: ['잇몸', '치주치료', '스케일링'], cat: 'general', popular: false, order: 5 },
      { type: 'DENTAL' as const, name: '사랑니발치', alias: ['사랑니', '매복사랑니', '발치'], cat: 'general', popular: false, order: 6 },
      { type: 'DENTAL' as const, name: '라미네이트', alias: ['라미', 'laminate', '심미보철'], cat: 'cosmetic', popular: true, order: 7 },
      { type: 'DENTAL' as const, name: '턱관절', alias: ['턱관절치료', 'TMJ', '이갈이'], cat: 'core', popular: false, order: 8 },
      { type: 'DENTAL' as const, name: '소아치과', alias: ['소아', '아이치과', '유치'], cat: 'general', popular: false, order: 9 },
      { type: 'DENTAL' as const, name: '신경치료', alias: ['근관치료'], cat: 'general', popular: false, order: 10 },
      { type: 'DERMATOLOGY' as const, name: '보톡스', alias: ['보톡스', 'botox', '주름보톡스'], cat: 'cosmetic', popular: true, order: 1 },
      { type: 'DERMATOLOGY' as const, name: '필러', alias: ['filler', '볼필러', '이마필러'], cat: 'cosmetic', popular: true, order: 2 },
      { type: 'DERMATOLOGY' as const, name: '리프팅', alias: ['울쎄라', '써마지', '실리프팅'], cat: 'cosmetic', popular: true, order: 3 },
      { type: 'DERMATOLOGY' as const, name: '레이저토닝', alias: ['토닝', '피코토닝', '레이저'], cat: 'cosmetic', popular: true, order: 4 },
      { type: 'DERMATOLOGY' as const, name: '탈모치료', alias: ['탈모', '모발이식', '두피관리'], cat: 'core', popular: true, order: 5 },
      { type: 'OPHTHALMOLOGY' as const, name: '라식', alias: ['LASIK', '라식수술'], cat: 'core', popular: true, order: 1 },
      { type: 'OPHTHALMOLOGY' as const, name: '라섹', alias: ['LASEK', '라섹수술'], cat: 'core', popular: true, order: 2 },
      { type: 'OPHTHALMOLOGY' as const, name: '스마일라식', alias: ['SMILE', '스마일'], cat: 'core', popular: true, order: 3 },
      { type: 'OPHTHALMOLOGY' as const, name: '백내장', alias: ['백내장수술', '다초점렌즈'], cat: 'core', popular: true, order: 4 },
    ];

    for (const sp of specialtyPresets) {
      await prisma.specialtyPreset.create({
        data: {
          specialtyType: sp.type,
          procedureName: sp.name,
          procedureAlias: sp.alias,
          category: sp.cat,
          isPopular: sp.popular,
          sortOrder: sp.order,
        },
      });
    }
    console.log('✅ Specialty presets created:', specialtyPresets.length);
  } catch (e) {
    console.warn('⚠️ Specialty presets skip:', (e as any).message?.substring(0, 80));
  }

  // ===== 13. 쿼리 템플릿 =====
  try {
    await prisma.queryTemplate.deleteMany({});

    const templates = [
      { intent: 'RESERVATION' as const, text: '{region} {procedure} 잘하는 {specialty} 추천해줘', desc: '예약 의도 기본', weekly: true },
      { intent: 'RESERVATION' as const, text: '{region}에서 {procedure} 전문 {specialty} 어디가 좋아?', desc: '예약 의도 변형', weekly: true },
      { intent: 'RESERVATION' as const, text: '{region} {procedure} 잘하는 곳 알려줘', desc: '예약 의도 간결', weekly: true },
      { intent: 'COMPARISON' as const, text: '{region} {procedure} 가격 비교해줘', desc: '비교 의도 가격', weekly: true },
      { intent: 'COMPARISON' as const, text: '{region} {specialty} 추천 순위 알려줘', desc: '비교 의도 순위', weekly: true },
      { intent: 'INFORMATION' as const, text: '{procedure} 시술 과정이 궁금해', desc: '정보 탐색', weekly: true },
      { intent: 'INFORMATION' as const, text: '{region} {specialty} 진료 시간 알려줘', desc: '정보 탐색 시간', weekly: true },
      { intent: 'REVIEW' as const, text: '{region} {procedure} 후기 좋은 {specialty}', desc: '후기 의도', weekly: true },
      { intent: 'REVIEW' as const, text: '{region} {specialty} 후기 알려줘', desc: '후기 의도 일반', weekly: true },
      { intent: 'FEAR' as const, text: '{procedure} 아프나요? {region} 무통 {specialty}', desc: '공포 의도', weekly: true },
      { intent: 'RESERVATION' as const, text: '{region} {procedure} 추천 Perplexity', desc: 'Perplexity 전용', weekly: true, platform: 'PERPLEXITY' as const },
      { intent: 'RESERVATION' as const, text: '{region} {procedure} 추천 ChatGPT', desc: 'ChatGPT 전용', weekly: true, platform: 'CHATGPT' as const },
      { intent: 'RESERVATION' as const, text: '{region} {procedure} 추천 Gemini', desc: 'Gemini 전용', weekly: true, platform: 'GEMINI' as const },
      { intent: 'RESERVATION' as const, text: '{region} {procedure} 추천 Claude', desc: 'Claude 전용', weekly: true, platform: 'CLAUDE' as const },
    ];

    let order = 1;
    for (const t of templates) {
      await prisma.queryTemplate.create({
        data: {
          intentCategory: t.intent,
          templateText: t.text,
          description: t.desc,
          platformSpecific: (t as any).platform || null,
          isWeekly: t.weekly,
          isMonthly: false,
          sortOrder: order++,
          isActive: true,
        },
      });
    }
    console.log('✅ Query templates created:', templates.length);
  } catch (e) {
    console.warn('⚠️ Query templates skip:', (e as any).message?.substring(0, 80));
  }

  // ===== 14. 알림 샘플 =====
  await prisma.notification.deleteMany({ where: { hospitalId: demoHospital.id } });

  const notifications = [
    { type: 'WEEKLY_REPORT' as const, title: '주간 ABHS 리포트 도착', msg: '이번 주 ABHS 점수가 5.2점 상승했습니다. 자세한 내용을 확인해보세요.', ch: 'EMAIL' as const },
    { type: 'NEGATIVE_SENTIMENT' as const, title: '부정 언급 감지', msg: 'Perplexity에서 임플란트 관련 부정적 언급이 발견되었습니다.', ch: 'EMAIL' as const },
    { type: 'COMPETITOR_SURGE' as const, title: '경쟁사 점수 급상승', msg: '강남우리치과의 SoV가 최근 7일간 15% 상승했습니다.', ch: 'EMAIL' as const },
  ];

  for (const n of notifications) {
    await prisma.notification.create({
      data: {
        hospitalId: demoHospital.id,
        userId: demoUser.id,
        notificationType: n.type,
        title: n.title,
        message: n.msg,
        channel: n.ch,
        isRead: false,
      },
    });
  }
  console.log('✅ Notifications created:', notifications.length);

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\n📋 Demo Account Info:');
  console.log('   📧 Email: demo@patientsignal.kr');
  console.log('   🔐 Password: demo1234!');
  console.log('   🏥 Hospital: 서울비디치과 (데모)');
  console.log('   👑 Plan: PRO (전체 기능 활성)');
  console.log('   📊 AI Responses:', totalResponses, 'records');
  console.log('   📈 Daily Scores: 31 days (with ABHS)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
