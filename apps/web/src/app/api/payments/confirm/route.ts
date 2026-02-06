import { NextRequest, NextResponse } from 'next/server';

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || '';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://patient-signal.onrender.com/api';

export async function POST(request: NextRequest) {
  try {
    const { orderId, paymentKey, amount } = await request.json();

    console.log('결제 승인 요청:', { orderId, paymentKey: paymentKey?.slice(0, 20) + '...', amount });

    if (!orderId || !paymentKey || !amount) {
      return NextResponse.json(
        { success: false, message: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 시크릿 키 확인
    if (!TOSS_SECRET_KEY) {
      console.error('TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { success: false, message: '서버 설정 오류입니다.' },
        { status: 500 }
      );
    }

    // 토스페이먼츠 결제 승인 API 호출
    const encryptedSecretKey = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');

    console.log('토스페이먼츠 결제 승인 API 호출 중...');
    console.log('사용 중인 시크릿 키:', TOSS_SECRET_KEY.slice(0, 15) + '...');

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

    console.log('토스페이먼츠 결제 승인 성공:', {
      orderId: data.orderId,
      status: data.status,
      method: data.method,
      totalAmount: data.totalAmount,
      approvedAt: data.approvedAt,
    });

    // 백엔드 API로 결제 정보 저장 (fire-and-forget 방식으로 처리)
    try {
      const backendResponse = await fetch(`${API_URL}/payments/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: data.orderId,
          paymentKey: data.paymentKey,
          amount: data.totalAmount,
          status: data.status,
          method: data.method,
          approvedAt: data.approvedAt,
          receipt: data.receipt,
          card: data.card,
          virtualAccount: data.virtualAccount,
          easyPay: data.easyPay,
          transfer: data.transfer,
          metadata: data.metadata,
        }),
      });

      if (backendResponse.ok) {
        console.log('백엔드에 결제 정보 저장 완료');
      } else {
        console.error('백엔드 저장 실패:', await backendResponse.text());
      }
    } catch (backendError) {
      // 백엔드 저장 실패해도 결제 승인은 완료된 것으로 처리
      console.error('백엔드 API 호출 오류 (결제는 완료됨):', backendError);
    }

    // 메타데이터에서 플랜 정보 추출
    const metadata = data.metadata || {};

    return NextResponse.json({
      success: true,
      data: {
        orderId: data.orderId,
        paymentKey: data.paymentKey,
        amount: data.totalAmount,
        method: data.method,
        status: data.status,
        approvedAt: data.approvedAt,
        receiptUrl: data.receipt?.url,
        plan: metadata.plan || 'starter',
        billing: metadata.billing || 'monthly',
        // 가상계좌 정보 (있는 경우)
        virtualAccount: data.virtualAccount ? {
          bank: data.virtualAccount.bank,
          accountNumber: data.virtualAccount.accountNumber,
          dueDate: data.virtualAccount.dueDate,
          customerName: data.virtualAccount.customerName,
        } : null,
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
