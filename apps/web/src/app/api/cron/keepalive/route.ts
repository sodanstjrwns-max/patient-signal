import { NextRequest, NextResponse } from 'next/server';

// Keep-alive Cron - 10분마다 API 서버 깨우기 (콜드스타트 방지)
// Render 무료 플랜은 15분 비활동 시 서버가 꺼짐

const API_BASE_URL = 'https://patient-signal.onrender.com/api';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // API 서버에 간단한 요청 보내기
    const response = await fetch(API_BASE_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'PatientSignal-KeepAlive/1.0',
      },
    });

    const responseTime = Date.now() - startTime;
    const isHealthy = response.ok;

    console.log(`[KEEPALIVE] API Server ping: ${response.status} (${responseTime}ms)`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      apiStatus: response.status,
      responseTime: `${responseTime}ms`,
      isHealthy,
    });
  } catch (error) {
    console.error('[KEEPALIVE] API Server ping failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'API Server unreachable',
        details: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
