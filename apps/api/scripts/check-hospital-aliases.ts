import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { PrismaClient } from '@prisma/client';
import { isOwnHospital } from '../src/ai-crawler/breadth.classifier';
const prisma = new PrismaClient();
async function main() {
  const HID = '2a6776fd-a4ae-4022-9331-7a62810988aa';
  const h = await prisma.hospital.findUnique({
    where: { id: HID },
    select: { name: true, websiteUrl: true, nameAliases: true },
  });
  console.log('Hospital:', h);
  console.log('\nbdbddc.com isOwn?', isOwnHospital('bdbddc.com', h!.name, h!.websiteUrl, h!.nameAliases));
  console.log('bdseoulbd.com isOwn?', isOwnHospital('bdseoulbd.com', h!.name, h!.websiteUrl, h!.nameAliases));
  await prisma.$disconnect();
}
main();
