// Patient Signal - Demo Account Seed Script
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. 데모 병원 생성
  const demoHospital = await prisma.hospital.upsert({
    where: { businessNumber: '123-45-67890' },
    update: {},
    create: {
      name: '서울비디치과 (데모)',
      businessNumber: '123-45-67890',
      specialtyType: 'DENTAL',
      subSpecialties: ['임플란트', '교정', '미백', '심미치료', '충치치료'],
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
  console.log('✅ Demo hospital created:', demoHospital.name);

  // 2. 데모 사용자 생성 (관리자 권한)
  const hashedPassword = await bcrypt.hash('demo1234!', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@patientsignal.kr' },
    update: {
      passwordHash: hashedPassword,
      hospitalId: demoHospital.id,
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
  console.log('✅ Demo user created:', demoUser.email);

  // 3. 프리셋 질문 생성
  const presetPrompts = [
    { specialtyType: 'DENTAL', category: '임플란트', promptTemplate: '{지역} 임플란트 잘하는 치과 추천해줘', priority: 1 },
    { specialtyType: 'DENTAL', category: '임플란트', promptTemplate: '{지역}에서 임플란트 가격 저렴한 곳 알려줘', priority: 2 },
    { specialtyType: 'DENTAL', category: '교정', promptTemplate: '{지역} 치아교정 잘하는 치과 어디야?', priority: 1 },
    { specialtyType: 'DENTAL', category: '교정', promptTemplate: '투명교정 vs 메탈교정 {지역}에서 어디가 좋아?', priority: 2 },
    { specialtyType: 'DENTAL', category: '미백', promptTemplate: '{지역} 치아미백 효과 좋은 치과 추천', priority: 1 },
    { specialtyType: 'DENTAL', category: '충치', promptTemplate: '{지역} 충치치료 잘하는 치과 알려줘', priority: 1 },
    { specialtyType: 'DENTAL', category: '일반', promptTemplate: '{지역} 치과 어디가 좋아?', priority: 1 },
    { specialtyType: 'DENTAL', category: '일반', promptTemplate: '{지역} 주말 진료 치과 추천해줘', priority: 2 },
  ];

  for (const prompt of presetPrompts) {
    await prisma.presetPrompt.upsert({
      where: { id: `preset_${prompt.category}_${prompt.priority}` },
      update: {},
      create: {
        id: `preset_${prompt.category}_${prompt.priority}`,
        specialtyType: prompt.specialtyType as any,
        category: prompt.category,
        promptTemplate: prompt.promptTemplate,
        priority: prompt.priority,
        isActive: true,
      },
    });
  }
  console.log('✅ Preset prompts created:', presetPrompts.length);

  // 4. 병원용 모니터링 질문 생성
  const hospitalPrompts = [
    { promptText: '강남 임플란트 잘하는 치과 추천해줘', promptType: 'PRESET', specialtyCategory: '임플란트', regionKeywords: ['강남', '역삼'] },
    { promptText: '강남역 근처 치아교정 잘하는 곳 알려줘', promptType: 'PRESET', specialtyCategory: '교정', regionKeywords: ['강남역', '역삼역'] },
    { promptText: '서울 강남 치아미백 효과 좋은 치과', promptType: 'PRESET', specialtyCategory: '미백', regionKeywords: ['서울', '강남'] },
    { promptText: '역삼동 치과 추천 부탁해', promptType: 'CUSTOM', specialtyCategory: '일반', regionKeywords: ['역삼동', '역삼'] },
    { promptText: '강남구 임플란트 가격 비교', promptType: 'CUSTOM', specialtyCategory: '임플란트', regionKeywords: ['강남구'] },
  ];

  for (const prompt of hospitalPrompts) {
    await prisma.prompt.create({
      data: {
        hospitalId: demoHospital.id,
        promptText: prompt.promptText,
        promptType: prompt.promptType as any,
        specialtyCategory: prompt.specialtyCategory,
        regionKeywords: prompt.regionKeywords,
        isActive: true,
      },
    });
  }
  console.log('✅ Hospital prompts created:', hospitalPrompts.length);

  // 5. 샘플 일일 점수 데이터 생성 (최근 30일)
  const today = new Date();
  for (let i = 30; i >= 0; i--) {
    const scoreDate = new Date(today);
    scoreDate.setDate(scoreDate.getDate() - i);
    scoreDate.setHours(0, 0, 0, 0);

    // 점수가 점점 상승하는 트렌드
    const baseScore = 55 + Math.floor(i * 0.5);
    const randomVariation = Math.floor(Math.random() * 10) - 5;
    const overallScore = Math.min(100, Math.max(0, baseScore + randomVariation));

    await prisma.dailyScore.upsert({
      where: {
        hospitalId_scoreDate: {
          hospitalId: demoHospital.id,
          scoreDate: scoreDate,
        },
      },
      update: {},
      create: {
        hospitalId: demoHospital.id,
        scoreDate: scoreDate,
        overallScore: overallScore,
        specialtyScores: {
          implant: overallScore + Math.floor(Math.random() * 10) - 5,
          orthodontics: overallScore + Math.floor(Math.random() * 10) - 5,
          whitening: overallScore + Math.floor(Math.random() * 10) - 5,
        },
        platformScores: {
          chatgpt: overallScore + Math.floor(Math.random() * 15) - 7,
          perplexity: overallScore + Math.floor(Math.random() * 15) - 7,
          claude: overallScore + Math.floor(Math.random() * 15) - 7,
          gemini: overallScore + Math.floor(Math.random() * 15) - 7,
        },
        mentionCount: Math.floor(Math.random() * 20) + 5,
        positiveRatio: 0.6 + Math.random() * 0.3,
      },
    });
  }
  console.log('✅ Daily scores created for 31 days');

  // 6. 경쟁사 데이터 생성
  const competitors = [
    { name: '강남우리치과', region: '강남구', isAutoDetected: true },
    { name: '연세좋은치과', region: '강남구', isAutoDetected: true },
    { name: '미소가득치과', region: '강남구', isAutoDetected: false },
  ];

  for (const comp of competitors) {
    const competitor = await prisma.competitor.create({
      data: {
        hospitalId: demoHospital.id,
        competitorName: comp.name,
        competitorRegion: comp.region,
        isAutoDetected: comp.isAutoDetected,
        isActive: true,
      },
    });

    // 경쟁사 점수 데이터
    for (let i = 30; i >= 0; i--) {
      const scoreDate = new Date(today);
      scoreDate.setDate(scoreDate.getDate() - i);
      scoreDate.setHours(0, 0, 0, 0);

      await prisma.competitorScore.upsert({
        where: {
          competitorId_scoreDate: {
            competitorId: competitor.id,
            scoreDate: scoreDate,
          },
        },
        update: {},
        create: {
          competitorId: competitor.id,
          scoreDate: scoreDate,
          overallScore: 40 + Math.floor(Math.random() * 30),
          mentionCount: Math.floor(Math.random() * 15) + 2,
        },
      });
    }
  }
  console.log('✅ Competitors created:', competitors.length);

  // 7. 개선 액션 제안
  const improvementActions = [
    { actionType: 'CONTENT', title: '임플란트 후기 콘텐츠 보강', description: '블로그 및 SNS에 임플란트 시술 후기 5건 이상 작성 권장', expectedImpact: 8 },
    { actionType: 'SEO', title: '네이버 플레이스 정보 업데이트', description: '진료시간, 주차정보, 시술 목록 최신화 필요', expectedImpact: 7 },
    { actionType: 'REVIEW', title: '긍정 리뷰 수집 캠페인', description: '만족 환자 대상 리뷰 작성 요청 프로세스 구축', expectedImpact: 9 },
  ];

  for (const action of improvementActions) {
    await prisma.improvementAction.create({
      data: {
        hospitalId: demoHospital.id,
        actionType: action.actionType,
        title: action.title,
        description: action.description,
        expectedImpact: action.expectedImpact,
        status: 'PENDING',
      },
    });
  }
  console.log('✅ Improvement actions created:', improvementActions.length);

  // 8. 콘텐츠 갭 분석 데이터
  const contentGaps = [
    { gapType: 'CONTENT', topic: '투명교정 비용 안내', competitorHas: true, priorityScore: 85 },
    { gapType: 'KEYWORD', topic: '강남 야간진료 치과', competitorHas: true, priorityScore: 72 },
    { gapType: 'TOPIC', topic: '임플란트 시술 과정 영상', competitorHas: false, priorityScore: 65 },
  ];

  for (const gap of contentGaps) {
    await prisma.contentGap.create({
      data: {
        hospitalId: demoHospital.id,
        gapType: gap.gapType as any,
        topic: gap.topic,
        competitorHas: gap.competitorHas,
        priorityScore: gap.priorityScore,
        status: 'PENDING',
      },
    });
  }
  console.log('✅ Content gaps created:', contentGaps.length);

  // 9. 지역 데이터
  const regions = [
    { sido: '서울특별시', sigungu: '강남구', dong: '역삼동' },
    { sido: '서울특별시', sigungu: '강남구', dong: '삼성동' },
    { sido: '서울특별시', sigungu: '강남구', dong: '논현동' },
    { sido: '서울특별시', sigungu: '서초구', dong: '서초동' },
    { sido: '서울특별시', sigungu: '서초구', dong: '반포동' },
  ];

  for (const region of regions) {
    await prisma.region.upsert({
      where: {
        sido_sigungu_dong: {
          sido: region.sido,
          sigungu: region.sigungu,
          dong: region.dong,
        },
      },
      update: {},
      create: region,
    });
  }
  console.log('✅ Regions created:', regions.length);

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\n📋 Demo Account Info:');
  console.log('   📧 Email: demo@patientsignal.kr');
  console.log('   🔐 Password: demo1234!');
  console.log('   🏥 Hospital: 서울비디치과 (데모)');
  console.log('   👑 Role: OWNER (전체 관리자 권한)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
