import { NextRequest, NextResponse } from 'next/server';

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_sk_GePWvyJnrK44AxRNdWeL8gLzN97E';

export async function POST(request: NextRequest) {
  try {
    const { orderId, paymentKey, amount } = await request.json();

    if (!orderId || !paymentKey || !amount) {
      return NextResponse.json(
        { success: false, message: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 토스페이먼츠 결제 승인 API 호출
    const encryptedSecretKey = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');

    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encryptedSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        paymentKey,
        amount,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('토스페이먼츠 결제 승인 실패:', data);
      return NextResponse.json(
        { 
          success: false, 
          message: data.message || '결제 승인에 실패했습니다.',
          code: data.code 
        },
        { status: response.status }
      );
    }

    // 결제 성공 시 백엔드 API로 구독 정보 저장
    // TODO: 실제 서비스에서는 백엔드 API 호출하여 구독 정보 저장
    console.log('결제 승인 성공:', {
      orderId: data.orderId,
      paymentKey: data.paymentKey,
      amount: data.totalAmount,
      method: data.method,
      status: data.status,
      approvedAt: data.approvedAt,
    });

    // 메타데이터에서 플랜 정보 추출
    const metadata = data.metadata || {};
    
    // TODO: 백엔드 API 호출
    // await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${userToken}`,
    //   },
    //   body: JSON.stringify({
    //     orderId: data.orderId,
    //     paymentKey: data.paymentKey,
    //     plan: metadata.plan,
    //     billing: metadata.billing,
    //     amount: data.totalAmount,
    //   }),
    // });

    return NextResponse.json({
      success: true,
      data: {
        orderId: data.orderId,
        amount: data.totalAmount,
        method: data.method,
        status: data.status,
        approvedAt: data.approvedAt,
        plan: metadata.plan,
        billing: metadata.billing,
      },
    });
  } catch (error) {
    console.error('결제 승인 처리 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
