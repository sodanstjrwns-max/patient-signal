const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
(async () => {
  const u = await prisma.user.findUnique({
    where: { email: 'rememberdental@naver.com' },
    include: { hospital: { select: { name:true, planType:true, subscriptionStatus:true } } },
  });
  if (!u) { console.log('계정 없음'); return prisma.$disconnect(); }
  const ok = await bcrypt.compare('Remember2026!', u.passwordHash);
  console.log('로그인 검증:', ok ? '✅ 비밀번호 일치 (로그인 가능)' : '❌ 불일치');
  console.log('email:', u.email, '| role:', u.role, '| verified:', u.emailVerified);
  console.log('병원:', u.hospital?.name, `(${u.hospital?.planType}/${u.hospital?.subscriptionStatus})`);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
