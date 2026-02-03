import { NextRequest, NextResponse } from 'next/server';

// Vercel Cron Job - 매일 오전 9시(한국 시간) 자동 크롤링
// vercel.json에서 스케줄 설정 필요

const API_BASE_URL = 'https://patient-signal.onrender.com/api';
const CRON_SECRET = process.env.CRON_SECRET || 'patient-signal-cron-secret-2024';

export async function GET(request: NextRequest) {
  // Cron 인증 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON] Starting daily crawl job...');

    // 모든 활성 병원 목록 조회
    const hospitalsResponse = await fetch(`${API_BASE_URL}/hospitals/active`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': CRON_SECRET,
      },
    });

    if (!hospitalsResponse.ok) {
      throw new Error('Failed to fetch hospitals');
    }

    const hospitals = await hospitalsResponse.json();
    console.log(`[CRON] Found ${hospitals.length} active hospitals`);

    // 각 병원에 대해 크롤링 실행
    const results = [];
    for (const hospital of hospitals) {
      try {
        const crawlResponse = await fetch(
          `${API_BASE_URL}/ai-crawler/crawl/${hospital.id}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Cron-Secret': CRON_SECRET,
            },
          }
        );

        if (crawlResponse.ok) {
          const result = await crawlResponse.json();
          results.push({ hospitalId: hospital.id, status: 'success', jobId: result.jobId });
          console.log(`[CRON] Crawl started for ${hospital.name}: ${result.jobId}`);
        } else {
          results.push({ hospitalId: hospital.id, status: 'failed' });
        }
      } catch (error) {
        results.push({ hospitalId: hospital.id, status: 'error', error: String(error) });
      }

      // Rate limiting: 각 병원 사이에 1초 대기
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[CRON] Daily crawl completed. ${results.filter(r => r.status === 'success').length}/${results.length} successful`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalHospitals: hospitals.length,
      results,
    });
  } catch (error) {
    console.error('[CRON] Daily crawl failed:', error);
    return NextResponse.json(
      { error: 'Crawl job failed', details: String(error) },
      { status: 500 }
    );
  }
}

// Vercel Cron 설정을 위한 config
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
