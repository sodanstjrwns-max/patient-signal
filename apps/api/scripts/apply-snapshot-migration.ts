/**
 * Apply CitedSourceSnapshot migration directly via Prisma raw SQL
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const sqlPath = path.join(__dirname, '..', 'prisma', 'migrations', '20260521_add_cited_source_snapshot', 'migration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // 주석 제거 후 statement 분리 (개행 보존 위해 정교하게)
  const cleaned = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleaned
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Found ${statements.length} statements to execute`);

  for (const [i, stmt] of statements.entries()) {
    const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`  [${i + 1}/${statements.length}] ✅ ${preview}...`);
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log(`  [${i + 1}/${statements.length}] ⏭  (already exists) ${preview}...`);
      } else {
        console.error(`  [${i + 1}/${statements.length}] ❌ ${e.message}`);
        console.error(`     statement: ${stmt.substring(0, 200)}`);
        throw e;
      }
    }
  }

  // 검증
  const count = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) as c FROM cited_source_snapshots`
  );
  console.log(`\n✅ Table exists, rows: ${count[0].c}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
