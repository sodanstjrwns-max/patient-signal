import { NextRequest, NextResponse } from 'next/server';

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || '';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://patient-signal.onrender.com/api';

/**
 * 토스페이먼츠 웹훅 처리
 * 
 * 웹훅 이벤트 종류:
 * - PAYMENT_STATUS_CHANGED: 결제 상태 변경 (가상계좌 입금 완료 등)
 * - DEPOSIT_CALLBACK: 가상계좌 입금 콜백 (deprecated)
 * - PAYOUT_STATUS_CHANGED: 정산 상태 변경
 * 
 * 토스페이먼츠 상점관리자에서 웹훅 URL 등록 필요:
 * https://app.tosspayments.com > 설정 > 웹훅
 * URL: https://patient-signal-web-2bbe.vercel.app/api/payments/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('=== 토스페이먼츠 웹훅 수신 ===');
    console.log('Event Type:', body.eventType);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Body:', JSON.stringify(body, null, 2));

    // 시크릿 키로 서명 검증 (선택사항이지만 권장)
    // 토스페이먼츠는 Basic Auth 헤더로 요청을 보냄
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const expectedAuth = `Basic ${Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')}`;
      // 토스 웹훅은 시크릿 키 검증이 아닌 다른 방식을 사용할 수 있음
      console.log('Auth header received');
    }

    const { eventType, data } = body;

    switch (eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        await handlePaymentStatusChanged(data);
        break;

      case 'DEPOSIT_CALLBACK':
        // 가상계좌 입금 완료 (deprecated - PAYMENT_STATUS_CHANGED 사용 권장)
        await handleVirtualAccountDeposit(data);
        break;

      case 'PAYOUT_STATUS_CHANGED':
        // 정산 상태 변경 (정산 관련 처리 필요 시)
        console.log('정산 상태 변경:', data);
        break;

      default:
        console.log('알 수 없는 이벤트 타입:', eventType);
    }

    // 200 OK 반환 (웹훅 성공)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('웹훅 처리 오류:', error);
    // 웹훅은 실패해도 200을 반환하는 것이 좋음 (재시도 방지)
    return NextResponse.json({ success: false, error: 'Internal error' });
  }
}

/**
 * 결제 상태 변경 처리
 */
async function handlePaymentStatusChanged(data: any) {
  console.log('=== 결제 상태 변경 처리 ===');
  console.log('Order ID:', data.orderId);
  console.log('Payment Key:', data.paymentKey);
  console.log('Status:', data.status);

  // 가상계좌 입금 완료 처리
  if (data.status === 'DONE' && data.method === '가상계좌') {
    console.log('가상계좌 입금 완료!');
    
    // 백엔드에 입금 완료 알림
    try {
      const response = await fetch(`${API_URL}/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'VIRTUAL_ACCOUNT_DEPOSIT',
          orderId: data.orderId,
          paymentKey: data.paymentKey,
          status: data.status,
          amount: data.totalAmount,
          approvedAt: data.approvedAt,
        }),
      });

      if (response.ok) {
        console.log('백엔드에 입금 완료 알림 전송 성공');
      } else {
        console.error('백엔드 알림 실패:', await response.text());
      }
    } catch (error) {
      console.error('백엔드 API 호출 오류:', error);
    }

    // TODO: 사용자에게 이메일/카카오 알림 발송
    // await sendDepositNotification(data);
  }

  // 결제 취소 처리
  if (data.status === 'CANCELED' || data.status === 'PARTIAL_CANCELED') {
    console.log('결제 취소됨:', data.status);
    
    try {
      await fetch(`${API_URL}/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'PAYMENT_CANCELED',
          orderId: data.orderId,
          paymentKey: data.paymentKey,
          status: data.status,
          cancelReason: data.cancels?.[0]?.cancelReason,
          cancelAmount: data.cancels?.[0]?.cancelAmount,
        }),
      });
    } catch (error) {
      console.error('취소 알림 전송 오류:', error);
    }
  }
}

/**
 * 가상계좌 입금 처리 (deprecated)
 */
async function handleVirtualAccountDeposit(data: any) {
  console.log('=== 가상계좌 입금 처리 (deprecated) ===');
  console.log('Order ID:', data.orderId);
  console.log('Secret:', data.secret);

  // PAYMENT_STATUS_CHANGED로 처리하는 것을 권장
  // 이 핸들러는 호환성을 위해 유지
}

// GET 요청 - 웹훅 상태 확인용
export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: '토스페이먼츠 웹훅 엔드포인트가 활성화되어 있습니다.',
    supportedEvents: [
      'PAYMENT_STATUS_CHANGED',
      'DEPOSIT_CALLBACK',
      'PAYOUT_STATUS_CHANGED',
    ],
  });
}
