const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  for (const email of ['rememberdental@gmail.com', 'rememberdental@naver.com']) {
    const u = await prisma.user.findUnique({
      where: { email },
      include: { hospital: { select: { id:true, name:true, planType:true, subscriptionStatus:true } } },
    });
    console.log(`\n=== ${email} ===`);
    if (!u) { console.log('  (계정 없음)'); continue; }
    console.log('  userId:', u.id);
    console.log('  name:', u.name, '| role:', u.role, '| verified:', u.emailVerified, '| createdAt:', u.createdAt?.toISOString?.().slice(0,10));
    console.log('  hospitalId:', u.hospitalId);
    if (u.hospital) console.log('  병원:', u.hospital.name, `(${u.hospital.planType}/${u.hospital.subscriptionStatus})`);
    // 같은 병원에 연결된 다른 유저들
    if (u.hospitalId) {
      const sameHospUsers = await prisma.user.findMany({ where: { hospitalId: u.hospitalId }, select: { email:true, role:true } });
      console.log('  같은 병원 공유 계정:', sameHospUsers.map(x => `${x.email}(${x.role})`).join(', '));
    }
  }
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
