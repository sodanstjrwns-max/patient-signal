/**
 * API Key 생성 스크립트
 * 
 * 사용법:
 *   npx ts-node src/public-api/scripts/generate-api-key.ts "Patient Pulse Production"
 * 
 * 또는 DB에 직접 SQL로 삽입:
 *   이 스크립트가 출력하는 INSERT 문을 사용하세요.
 * 
 * 중요: 생성된 원본 키는 이 시점에서만 확인 가능합니다.
 *       해시만 DB에 저장되므로 분실 시 재발급해야 합니다.
 */

import { randomBytes, createHash } from 'crypto';

function generateApiKey(name: string) {
  // 1. 랜덤 키 생성 (ps_live_ + 32바이트 hex = 총 72자)
  const randomPart = randomBytes(32).toString('hex');
  const apiKey = `ps_live_${randomPart}`;
  
  // 2. SHA-256 해시 (DB 저장용)
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  
  // 3. 프리픽스 (식별용)
  const keyPrefix = apiKey.substring(0, 16);
  
  console.log('='.repeat(60));
  console.log('🔑 Patient Signal - Public API Key 생성');
  console.log('='.repeat(60));
  console.log('');
  console.log(`📛 이름:     ${name}`);
  console.log(`🔑 API Key:  ${apiKey}`);
  console.log(`#️⃣  Hash:     ${keyHash}`);
  console.log(`🏷️  Prefix:   ${keyPrefix}`);
  console.log('');
  console.log('⚠️  위 API Key는 지금만 확인 가능합니다. 안전하게 보관하세요!');
  console.log('');
  console.log('── DB 삽입 SQL ──');
  console.log(`
INSERT INTO api_keys (id, name, key_hash, key_prefix, scopes, rate_limit_per_min, is_active, usage_count, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '${name}',
  '${keyHash}',
  '${keyPrefix}',
  ARRAY['read:aeo', 'read:rankings', 'read:competitors'],
  60,
  true,
  0,
  NOW(),
  NOW()
);
  `.trim());
  console.log('');
  console.log('── Patient Pulse .env 설정 ──');
  console.log(`PATIENT_SIGNAL_API_KEY=${apiKey}`);
  console.log(`PATIENT_SIGNAL_API_URL=https://your-api-domain.com/api/public/v1`);
  console.log('');
  
  return { apiKey, keyHash, keyPrefix };
}

// CLI 실행
const name = process.argv[2] || 'Patient Pulse';
generateApiKey(name);
