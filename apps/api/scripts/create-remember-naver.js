// 서울리멤버치과 — 실장 관리용 추가 계정 생성 (rememberdental@naver.com)
//
// 의미:
//   - 새 "병원 데이터"를 만드는 게 아니라, 기존 병원(서울리멤버치과)에
//     두 번째 사용자 계정을 연결 → 같은 대시보드/데이터를 공유
//   - 이게 곧 "데이터 백필" (새 계정이 기존 병원 데이터를 그대로 보게 됨)
//
// 사용법:
//   node scripts/create-remember-naver.js               (dry-run)
//   node scripts/create-remember-naver.js --apply        (실제 생성)
//   node scripts/create-remember-naver.js --apply --pw=원하는비번
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const pwArg = (process.argv.find(a => a.startsWith('--pw=')) || '').split('=')[1];

const NEW_EMAIL = 'rememberdental@naver.com';
const SOURCE_EMAIL = 'rememberdental@gmail.com';
const NEW_ROLE = 'ADMIN';          // 실장 관리용 (OWNER는 원장 본인 계정 유지)
const NEW_NAME = '서울리멤버치과 실장';
const DEFAULT_PW = pwArg || 'Remember2026!';  // 첫 로그인 후 변경 권장

(async () => {
  console.log(`\n${'='.repeat(56)}`);
  console.log(`추가 계정 생성 ${APPLY ? '【APPLY — 실제 생성】' : '【DRY-RUN】'}`);
  console.log(`${'='.repeat(56)}\n`);

  // 1) 기준(원본) 계정 + 병원 확인
  const source = await prisma.user.findUnique({
    where: { email: SOURCE_EMAIL },
    include: { hospital: true },
  });
  if (!source || !source.hospital) {
    console.log(`❌ 원본 계정/병원을 찾을 수 없음: ${SOURCE_EMAIL}`);
    return prisma.$disconnect();
  }
  console.log(`원본 계정: ${SOURCE_EMAIL} (role=${source.role})`);
  console.log(`연결 병원: ${source.hospital.name} [${source.hospitalId}]`);
  console.log(`           ${source.hospital.planType} / ${source.hospital.subscriptionStatus}\n`);

  // 2) 새 이메일 중복 확인
  const dup = await prisma.user.findUnique({ where: { email: NEW_EMAIL } });
  if (dup) {
    console.log(`⚠️  이미 존재하는 계정: ${NEW_EMAIL} (생성 중단)`);
    return prisma.$disconnect();
  }

  console.log(`생성할 계정:`);
  console.log(`  email   : ${NEW_EMAIL}`);
  console.log(`  name    : ${NEW_NAME}`);
  console.log(`  role    : ${NEW_ROLE}`);
  console.log(`  hospital: ${source.hospital.name} (같은 병원 → 데이터 그대로 공유)`);
  console.log(`  password: ${DEFAULT_PW}  (첫 로그인 후 변경 권장)\n`);

  if (!APPLY) {
    console.log(`→ 실제 생성하려면: node scripts/create-remember-naver.js --apply`);
    return prisma.$disconnect();
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PW, 10);
  const created = await prisma.user.create({
    data: {
      email: NEW_EMAIL,
      passwordHash,
      name: NEW_NAME,
      role: NEW_ROLE,
      hospitalId: source.hospitalId,   // ← 같은 병원 연결 = 데이터 백필
      emailVerified: true,             // 관리자 생성 계정이므로 인증 완료 처리
      isPfMember: source.isPfMember ?? false,
    },
  });

  console.log(`✅ 계정 생성 완료`);
  console.log(`   userId: ${created.id}`);
  console.log(`   ${NEW_EMAIL} → ${source.hospital.name} 데이터 즉시 열람 가능`);

  // 검증: 같은 병원 공유 계정 목록
  const shared = await prisma.user.findMany({
    where: { hospitalId: source.hospitalId },
    select: { email: true, role: true },
  });
  console.log(`\n   현재 ${source.hospital.name} 공유 계정:`);
  shared.forEach(s => console.log(`     - ${s.email} (${s.role})`));

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
