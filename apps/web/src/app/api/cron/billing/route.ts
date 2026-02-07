import { NextRequest, NextResponse } from 'next/server';

// 구독 자동 갱신 Cron - 매일 오전 6시(한국 시간) 실행
// vercel.json에서 schedule: "0 21 * * *" (UTC)

const API_BASE_URL = 'https://patient-signal.onrender.com/api';
const CRON_SECRET = process.env.CRON_SECRET || 'patient-signal-cron-secret-2024';

export async function GET(request: NextRequest) {
  try {
    console.log('[BILLING CRON] Starting auto-renewal process...');

    // 1. 자동 갱신 처리
    const renewalResponse = await fetch(`${API_BASE_URL}/payments/billing/process-renewals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': CRON_SECRET,
      },
    });

    if (!renewalResponse.ok) {
      const errorText = await renewalResponse.text();
      throw new Error(`Auto-renewal failed: ${errorText}`);
    }

    const renewalResult = await renewalResponse.json();
    console.log(`[BILLING CRON] Renewal results: ${JSON.stringify(renewalResult)}`);

    // 2. 만료 예정 알림 발송 (3일 전)
    // TODO: 이메일/카카오 알림 연동 후 활성화
    // const expiringResponse = await fetch(`${API_BASE_URL}/notifications/expiring-subscriptions`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-Cron-Secret': CRON_SECRET,
    //   },
    //   body: JSON.stringify({ daysBeforeExpiry: 3 }),
    // });

    console.log('[BILLING CRON] Auto-renewal process completed');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      renewal: renewalResult,
    });
  } catch (error) {
    console.error('[BILLING CRON] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Billing cron failed', 
        details: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
