import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;
  private readonly appName = 'Patient Signal';
  private readonly appUrl: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (apiKey && apiKey.length > 10) {
      this.resend = new Resend(apiKey);
      this.logger.log('✅ Resend 이메일 서비스 초기화 완료');
    } else {
      this.resend = null;
      this.logger.warn('⚠️ RESEND_API_KEY가 설정되지 않았습니다. 이메일 발송이 비활성화됩니다.');
    }

    this.fromEmail = process.env.EMAIL_FROM || 'noreply@patientsignal.kr';
    this.appUrl = process.env.FRONTEND_URL || 'https://patient-signal-web-2bbe.vercel.app';
  }

  /**
   * 이메일 발송 가능 여부 확인
   */
  isAvailable(): boolean {
    return this.resend !== null;
  }

  /**
   * 이메일 인증 코드 발송
   */
  async sendVerificationEmail(to: string, code: string, name: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`이메일 발송 건너뜀 (서비스 비활성화): ${to}`);
      return false;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #4F46E5; }
    .code-box { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
    .code { font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px; }
    .message { color: #666; font-size: 14px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏥 ${this.appName}</div>
    </div>
    
    <h2>안녕하세요, ${name}님!</h2>
    <p>이메일 인증을 완료하려면 아래 인증 코드를 입력해주세요.</p>
    
    <div class="code-box">
      <div class="code">${code}</div>
    </div>
    
    <p class="message">
      이 코드는 <strong>10분간</strong> 유효합니다.<br>
      본인이 요청하지 않은 경우 이 이메일을 무시해주세요.
    </p>
    
    <div class="footer">
      <p>© 2024 ${this.appName}. All rights reserved.</p>
      <p>본 메일은 발신 전용입니다.</p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      const result = await this.resend.emails.send({
        from: `${this.appName} <${this.fromEmail}>`,
        to: [to],
        subject: `[${this.appName}] 이메일 인증 코드: ${code}`,
        html,
      });

      this.logger.log(`이메일 인증 코드 발송 완료: ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 비밀번호 재설정 이메일 발송
   */
  async sendPasswordResetEmail(to: string, token: string, name: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`이메일 발송 건너뜀 (서비스 비활성화): ${to}`);
      return false;
    }

    const resetUrl = `${this.appUrl}/auth/reset-password?token=${token}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #4F46E5; }
    .button { display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .message { color: #666; font-size: 14px; }
    .url-box { background: #f5f5f5; border-radius: 8px; padding: 15px; word-break: break-all; font-size: 12px; color: #666; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏥 ${this.appName}</div>
    </div>
    
    <h2>안녕하세요, ${name}님!</h2>
    <p>비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.</p>
    
    <div style="text-align: center;">
      <a href="${resetUrl}" class="button">비밀번호 재설정</a>
    </div>
    
    <p class="message">버튼이 작동하지 않으면 아래 URL을 브라우저에 직접 복사해 붙여넣으세요:</p>
    <div class="url-box">${resetUrl}</div>
    
    <p class="message">
      이 링크는 <strong>1시간</strong> 동안 유효합니다.<br>
      본인이 요청하지 않은 경우 이 이메일을 무시해주세요.
    </p>
    
    <div class="footer">
      <p>© 2024 ${this.appName}. All rights reserved.</p>
      <p>본 메일은 발신 전용입니다.</p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      const result = await this.resend.emails.send({
        from: `${this.appName} <${this.fromEmail}>`,
        to: [to],
        subject: `[${this.appName}] 비밀번호 재설정`,
        html,
      });

      this.logger.log(`비밀번호 재설정 이메일 발송 완료: ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 환영 이메일 발송
   */
  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`이메일 발송 건너뜀 (서비스 비활성화): ${to}`);
      return false;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #4F46E5; }
    .feature { background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 15px 0; }
    .feature-title { font-weight: bold; color: #4F46E5; margin-bottom: 5px; }
    .button { display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏥 ${this.appName}</div>
    </div>
    
    <h2>${name}님, 환영합니다! 🎉</h2>
    <p>${this.appName}에 가입해 주셔서 감사합니다. AI 시대의 병원 마케팅, 이제 시작해볼까요?</p>
    
    <div class="feature">
      <div class="feature-title">📊 AI 가시성 추적</div>
      <p>ChatGPT, Perplexity, Claude, Gemini에서 우리 병원이 어떻게 언급되는지 추적하세요.</p>
    </div>
    
    <div class="feature">
      <div class="feature-title">📈 경쟁사 분석</div>
      <p>경쟁 병원들과 비교하여 우리 병원의 AI 노출도를 분석하세요.</p>
    </div>
    
    <div class="feature">
      <div class="feature-title">💡 개선 인사이트</div>
      <p>AI 검색 결과에서 더 자주 추천받기 위한 맞춤 조언을 받아보세요.</p>
    </div>
    
    <div style="text-align: center;">
      <a href="${this.appUrl}/dashboard" class="button">대시보드 바로가기</a>
    </div>
    
    <p>🎁 <strong>7일 무료 체험</strong>이 시작되었습니다!</p>
    
    <div class="footer">
      <p>문의사항이 있으시면 언제든 연락주세요.</p>
      <p>© 2024 ${this.appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      const result = await this.resend.emails.send({
        from: `${this.appName} <${this.fromEmail}>`,
        to: [to],
        subject: `[${this.appName}] ${name}님, 환영합니다! 🎉`,
        html,
      });

      this.logger.log(`환영 이메일 발송 완료: ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 구독 만료 예정 알림 이메일
   */
  async sendSubscriptionExpiringEmail(to: string, name: string, daysRemaining: number, hospitalName: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`이메일 발송 건너뜀 (서비스 비활성화): ${to}`);
      return false;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #4F46E5; }
    .warning-box { background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0; border-left: 4px solid #F59E0B; }
    .days { font-size: 48px; font-weight: bold; color: #D97706; }
    .button { display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏥 ${this.appName}</div>
    </div>
    
    <h2>안녕하세요, ${name}님!</h2>
    <p><strong>${hospitalName}</strong>의 구독이 곧 만료됩니다.</p>
    
    <div class="warning-box">
      <div>구독 만료까지</div>
      <div class="days">${daysRemaining}일</div>
      <div>남았습니다</div>
    </div>
    
    <p>구독이 만료되면:</p>
    <ul>
      <li>새로운 AI 크롤링이 중단됩니다</li>
      <li>대시보드 접근이 제한됩니다</li>
      <li>경쟁사 분석 기능을 사용할 수 없습니다</li>
    </ul>
    
    <p>지금 결제 수단을 등록하면 자동으로 갱신됩니다.</p>
    
    <div style="text-align: center;">
      <a href="${this.appUrl}/dashboard/settings" class="button">구독 관리하기</a>
    </div>
    
    <div class="footer">
      <p>© 2024 ${this.appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      const result = await this.resend.emails.send({
        from: `${this.appName} <${this.fromEmail}>`,
        to: [to],
        subject: `[${this.appName}] 구독 만료 ${daysRemaining}일 전 안내`,
        html,
      });

      this.logger.log(`구독 만료 알림 이메일 발송 완료: ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 결제 완료 이메일
   */
  async sendPaymentConfirmationEmail(
    to: string, 
    name: string, 
    data: { amount: number; planType: string; receiptUrl?: string }
  ): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`이메일 발송 건너뜀 (서비스 비활성화): ${to}`);
      return false;
    }

    const planNames: Record<string, string> = {
      STARTER: '스타터',
      STANDARD: '스탠다드',
      PRO: '프로',
      ENTERPRISE: '엔터프라이즈',
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #4F46E5; }
    .success-box { background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%); border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0; }
    .check { font-size: 48px; }
    .amount { font-size: 24px; font-weight: bold; color: #059669; }
    .details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .button { display: inline-block; background: #4F46E5; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: bold; margin: 10px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏥 ${this.appName}</div>
    </div>
    
    <h2>${name}님, 결제가 완료되었습니다!</h2>
    
    <div class="success-box">
      <div class="check">✅</div>
      <div class="amount">${data.amount.toLocaleString()}원</div>
      <div>결제 완료</div>
    </div>
    
    <div class="details">
      <p><strong>플랜:</strong> ${planNames[data.planType] || data.planType}</p>
      <p><strong>결제 금액:</strong> ${data.amount.toLocaleString()}원</p>
      <p><strong>결제 일시:</strong> ${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}</p>
    </div>
    
    ${data.receiptUrl ? `
    <div style="text-align: center;">
      <a href="${data.receiptUrl}" class="button">영수증 확인</a>
    </div>
    ` : ''}
    
    <p>결제해 주셔서 감사합니다. 앞으로도 좋은 서비스로 보답하겠습니다!</p>
    
    <div class="footer">
      <p>© 2024 ${this.appName}. All rights reserved.</p>
      <p>결제 관련 문의는 언제든 연락주세요.</p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      const result = await this.resend.emails.send({
        from: `${this.appName} <${this.fromEmail}>`,
        to: [to],
        subject: `[${this.appName}] 결제 완료 안내 - ${data.amount.toLocaleString()}원`,
        html,
      });

      this.logger.log(`결제 완료 이메일 발송 완료: ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${error.message}`);
      return false;
    }
  }
}
