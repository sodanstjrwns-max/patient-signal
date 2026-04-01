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

  // ==================== A1: 트라이얼 만료 전 전환 유도 이메일 ====================

  /**
   * 트라이얼 만료 전 전환 유도 이메일 (D-3, D-1, D-day)
   */
  async sendTrialConversionEmail(
    to: string,
    name: string,
    data: {
      hospitalName: string;
      daysRemaining: number;
      mentionRate?: number;
      totalQueries?: number;
      abhsScore?: number;
      topPlatform?: string;
    },
  ): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`이메일 발송 건너뜀 (서비스 비활성화): ${to}`);
      return false;
    }

    const urgencyColor = data.daysRemaining <= 0 ? '#EF4444' : data.daysRemaining <= 1 ? '#F59E0B' : '#3B82F6';
    const urgencyText = data.daysRemaining <= 0 ? '오늘 만료' : `${data.daysRemaining}일 남음`;
    const subject = data.daysRemaining <= 0
      ? `[Patient Signal] 체험 기간이 오늘 종료됩니다 ⏰`
      : `[Patient Signal] 체험 기간 만료 ${data.daysRemaining}일 전 안내`;

    const statsSection = (data.mentionRate || data.totalQueries || data.abhsScore) ? `
    <div style="background:#F0F9FF;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #3B82F6;">
      <p style="font-weight:bold;color:#1E40AF;margin-bottom:12px;">📊 체험 기간 동안의 ${data.hospitalName} 성과</p>
      ${data.mentionRate !== undefined ? `<p>🎯 AI 언급률: <strong>${data.mentionRate}%</strong></p>` : ''}
      ${data.abhsScore !== undefined ? `<p>📈 ABHS 점수: <strong>${data.abhsScore}점</strong></p>` : ''}
      ${data.totalQueries !== undefined ? `<p>🔍 총 AI 분석: <strong>${data.totalQueries}회</strong></p>` : ''}
      ${data.topPlatform ? `<p>🏆 최고 성과 플랫폼: <strong>${data.topPlatform}</strong></p>` : ''}
      <p style="color:#6B7280;font-size:13px;margin-top:12px;">유료 전환하면 매일 자동 추적하여 경쟁사 대비 변화를 실시간으로 확인할 수 있습니다.</p>
    </div>` : '';

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#333;}
  .container{max-width:600px;margin:0 auto;padding:40px 20px;}
  .header{text-align:center;margin-bottom:30px;}
  .logo{font-size:24px;font-weight:bold;color:#4F46E5;}
  .urgency-box{background:linear-gradient(135deg,${urgencyColor}11,${urgencyColor}22);border-radius:12px;padding:24px;text-align:center;margin:24px 0;border:2px solid ${urgencyColor}44;}
  .urgency-text{font-size:14px;color:${urgencyColor};}
  .urgency-days{font-size:42px;font-weight:bold;color:${urgencyColor};}
  .button{display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white;text-decoration:none;padding:16px 48px;border-radius:8px;font-weight:bold;font-size:16px;}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;text-align:center;color:#999;font-size:12px;}
</style></head>
<body><div class="container">
  <div class="header"><div class="logo">🏥 Patient Signal</div></div>
  <h2>안녕하세요, ${name} 원장님!</h2>
  <p><strong>${data.hospitalName}</strong>의 무료 체험 기간이 곧 종료됩니다.</p>
  <div class="urgency-box">
    <div class="urgency-text">무료 체험 종료까지</div>
    <div class="urgency-days">${urgencyText}</div>
    <div class="urgency-text">체험 종료 후 FREE 플랜으로 전환됩니다</div>
  </div>
  ${statsSection}
  <p>지금 유료 전환하면:</p>
  <ul>
    <li>✅ 매일 자동 AI 크롤링 (4개 플랫폼)</li>
    <li>✅ 경쟁사 AEO 비교 분석</li>
    <li>✅ 실시간 질문 5회/일 이상</li>
    <li>✅ 주간 AI 리포트 자동 발송</li>
  </ul>
  <div style="text-align:center;margin:30px 0;">
    <a href="${this.appUrl}/dashboard/billing" class="button">유료 전환하기 →</a>
  </div>
  <div class="footer"><p>© 2026 Patient Signal. All rights reserved.</p></div>
</div></body></html>`;

    try {
      await this.resend.emails.send({
        from: `Patient Signal <${this.fromEmail}>`,
        to: [to],
        subject,
        html,
      });
      this.logger.log(`[A1] 트라이얼 전환 이메일 발송 완료: ${to} (D-${data.daysRemaining})`);
      return true;
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${error.message}`);
      return false;
    }
  }

  // ==================== A3: 이탈 리마인드 이메일 ====================

  /**
   * 미접속 리마인드 이메일 (3일, 7일 미접속)
   */
  async sendInactivityReminderEmail(
    to: string,
    name: string,
    data: {
      hospitalName: string;
      daysSinceLogin: number;
      recentMentionRate?: number;
      scoreChange?: number;
    },
  ): Promise<boolean> {
    if (!this.resend) return false;

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#333;}
  .container{max-width:600px;margin:0 auto;padding:40px 20px;}
  .header{text-align:center;margin-bottom:30px;}
  .logo{font-size:24px;font-weight:bold;color:#4F46E5;}
  .highlight{background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #3B82F6;}
  .button{display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:bold;}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;text-align:center;color:#999;font-size:12px;}
</style></head>
<body><div class="container">
  <div class="header"><div class="logo">🏥 Patient Signal</div></div>
  <h2>${name} 원장님, ${data.daysSinceLogin}일째 안 오셨어요! 😢</h2>
  <p><strong>${data.hospitalName}</strong>의 AI 가시성은 계속 추적되고 있습니다.</p>
  ${data.recentMentionRate !== undefined ? `
  <div class="highlight">
    <p>📊 지금 확인 안 하고 계신 데이터:</p>
    <p>🎯 최근 AI 언급률: <strong>${data.recentMentionRate}%</strong></p>
    ${data.scoreChange !== undefined ? `<p>${data.scoreChange >= 0 ? '📈' : '📉'} 점수 변화: <strong>${data.scoreChange >= 0 ? '+' : ''}${data.scoreChange}점</strong></p>` : ''}
    <p style="color:#6B7280;font-size:13px;">경쟁사들은 매일 확인하고 있을지도 몰라요...</p>
  </div>` : ''}
  <div style="text-align:center;margin:30px 0;">
    <a href="${this.appUrl}/dashboard" class="button">대시보드 확인하기 →</a>
  </div>
  <div class="footer"><p>© 2026 Patient Signal. All rights reserved.</p></div>
</div></body></html>`;

    try {
      await this.resend.emails.send({
        from: `Patient Signal <${this.fromEmail}>`,
        to: [to],
        subject: `[Patient Signal] ${name} 원장님, ${data.hospitalName}의 AI 성과가 변했어요`,
        html,
      });
      this.logger.log(`[A3] 이탈 리마인드 이메일 발송: ${to} (${data.daysSinceLogin}일 미접속)`);
      return true;
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${error.message}`);
      return false;
    }
  }

  // ==================== B1: 주간 AI 리포트 이메일 ====================

  /**
   * 주간 AI 리포트 이메일
   */
  async sendWeeklyReportEmail(
    to: string,
    name: string,
    data: {
      hospitalName: string;
      abhsScore: number;
      abhsChange: number;
      mentionRate: number;
      mentionRateChange: number;
      topPlatform: string;
      topPlatformRate: number;
      weakPlatform: string;
      weakPlatformRate: number;
      competitorAlert?: string;
      totalCrawls: number;
      periodStart: string;
      periodEnd: string;
    },
  ): Promise<boolean> {
    if (!this.resend) return false;

    const trendIcon = (change: number) => change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
    const trendColor = (change: number) => change > 0 ? '#059669' : change < 0 ? '#DC2626' : '#6B7280';

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#333;}
  .container{max-width:600px;margin:0 auto;padding:40px 20px;}
  .header{text-align:center;margin-bottom:30px;}
  .logo{font-size:24px;font-weight:bold;color:#4F46E5;}
  .score-grid{display:flex;gap:12px;margin:20px 0;}
  .score-card{flex:1;background:#F8FAFC;border-radius:12px;padding:16px;text-align:center;}
  .score-value{font-size:28px;font-weight:bold;color:#1E293B;}
  .score-change{font-size:13px;margin-top:4px;}
  .platform-bar{display:flex;align-items:center;gap:8px;padding:8px 0;}
  .bar{height:8px;border-radius:4px;background:#E2E8F0;}
  .bar-fill{height:100%;border-radius:4px;}
  .alert-box{background:#FEF3C7;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #F59E0B;}
  .button{display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:bold;}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;text-align:center;color:#999;font-size:12px;}
</style></head>
<body><div class="container">
  <div class="header"><div class="logo">🏥 Patient Signal</div></div>
  <h2>${name} 원장님의 주간 AI 리포트 📊</h2>
  <p style="color:#6B7280;">${data.periodStart} ~ ${data.periodEnd} | ${data.hospitalName}</p>
  
  <table width="100%" cellpadding="0" cellspacing="8" style="margin:20px 0;">
    <tr>
      <td style="background:#F8FAFC;border-radius:12px;padding:16px;text-align:center;width:50%;">
        <div style="font-size:13px;color:#6B7280;">ABHS 종합점수</div>
        <div style="font-size:28px;font-weight:bold;">${data.abhsScore}</div>
        <div style="font-size:13px;color:${trendColor(data.abhsChange)};">${trendIcon(data.abhsChange)} ${data.abhsChange >= 0 ? '+' : ''}${data.abhsChange}점</div>
      </td>
      <td style="background:#F8FAFC;border-radius:12px;padding:16px;text-align:center;width:50%;">
        <div style="font-size:13px;color:#6B7280;">AI 언급률</div>
        <div style="font-size:28px;font-weight:bold;">${data.mentionRate}%</div>
        <div style="font-size:13px;color:${trendColor(data.mentionRateChange)};">${trendIcon(data.mentionRateChange)} ${data.mentionRateChange >= 0 ? '+' : ''}${data.mentionRateChange}%p</div>
      </td>
    </tr>
  </table>

  <div style="background:#F0FDF4;border-radius:8px;padding:12px 16px;margin:12px 0;">
    🏆 <strong>최고 성과:</strong> ${data.topPlatform} (${data.topPlatformRate}%)
  </div>
  <div style="background:#FEF2F2;border-radius:8px;padding:12px 16px;margin:12px 0;">
    ⚠️ <strong>개선 필요:</strong> ${data.weakPlatform} (${data.weakPlatformRate}%)
  </div>
  ${data.competitorAlert ? `
  <div class="alert-box">
    🔔 <strong>경쟁사 알림:</strong> ${data.competitorAlert}
  </div>` : ''}
  
  <p style="color:#6B7280;font-size:13px;">이번 주 총 ${data.totalCrawls}회 AI 분석 완료</p>
  
  <div style="text-align:center;margin:30px 0;">
    <a href="${this.appUrl}/dashboard/report" class="button">상세 리포트 보기 →</a>
  </div>
  <div class="footer"><p>© 2026 Patient Signal. All rights reserved.</p><p>이 메일은 매주 월요일 자동 발송됩니다.</p></div>
</div></body></html>`;

    try {
      await this.resend.emails.send({
        from: `Patient Signal <${this.fromEmail}>`,
        to: [to],
        subject: `[Patient Signal] ${data.hospitalName} 주간 AI 리포트 | ABHS ${data.abhsScore}점 ${trendIcon(data.abhsChange)}`,
        html,
      });
      this.logger.log(`[B1] 주간 리포트 이메일 발송: ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${error.message}`);
      return false;
    }
  }

  // ==================== 쿠폰 만료 안내 이메일 ====================

  /**
   * 쿠폰 만료 안내 이메일 (D-30, D-7, D-3, D-1, D-day)
   */
  async sendCouponExpirationEmail(
    to: string,
    name: string,
    data: {
      hospitalName: string;
      daysRemaining: number;
      couponName: string;
      planType: string;
      expirationDate: string;
      mentionRate?: number;
      abhsScore?: number;
    },
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

    const urgencyColor = data.daysRemaining <= 1 ? '#EF4444' : data.daysRemaining <= 3 ? '#F59E0B' : data.daysRemaining <= 7 ? '#F97316' : '#3B82F6';
    const urgencyBg = data.daysRemaining <= 1 ? '#FEF2F2' : data.daysRemaining <= 3 ? '#FFFBEB' : data.daysRemaining <= 7 ? '#FFF7ED' : '#EFF6FF';
    const urgencyText = data.daysRemaining <= 0 ? '오늘 만료' : `${data.daysRemaining}일 남음`;

    const subject = data.daysRemaining <= 0
      ? `[Patient Signal] ${data.couponName} 혜택이 오늘 만료됩니다 ⏰`
      : data.daysRemaining <= 3
        ? `[Patient Signal] ${data.couponName} 만료 ${data.daysRemaining}일 전 ⚠️`
        : `[Patient Signal] ${data.couponName} 만료 ${data.daysRemaining}일 전 안내`;

    const statsSection = (data.mentionRate !== undefined || data.abhsScore !== undefined) ? `
    <div style="background:#F0F9FF;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #3B82F6;">
      <p style="font-weight:bold;color:#1E40AF;margin-bottom:12px;">📊 ${data.hospitalName}의 현재 AI 성과</p>
      ${data.abhsScore !== undefined ? `<p>📈 ABHS 종합점수: <strong>${data.abhsScore}점</strong></p>` : ''}
      ${data.mentionRate !== undefined ? `<p>🎯 AI 언급률: <strong>${data.mentionRate}%</strong></p>` : ''}
      <p style="color:#6B7280;font-size:13px;margin-top:12px;">쿠폰 만료 후에도 유료 결제하시면 이 성과를 계속 추적할 수 있습니다.</p>
    </div>` : '';

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#333;}
  .container{max-width:600px;margin:0 auto;padding:40px 20px;}
  .header{text-align:center;margin-bottom:30px;}
  .logo{font-size:24px;font-weight:bold;color:#4F46E5;}
  .urgency-box{background:${urgencyBg};border-radius:12px;padding:24px;text-align:center;margin:24px 0;border:2px solid ${urgencyColor}44;}
  .urgency-label{font-size:14px;color:${urgencyColor};}
  .urgency-days{font-size:42px;font-weight:bold;color:${urgencyColor};}
  .coupon-info{background:#F8FAFC;border-radius:12px;padding:16px 20px;margin:20px 0;}
  .button{display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white;text-decoration:none;padding:16px 48px;border-radius:8px;font-weight:bold;font-size:16px;}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;text-align:center;color:#999;font-size:12px;}
</style></head>
<body><div class="container">
  <div class="header"><div class="logo">🏥 Patient Signal</div></div>
  <h2>안녕하세요, ${name} 원장님!</h2>
  <p><strong>${data.hospitalName}</strong>에 적용된 <strong>${data.couponName}</strong> 혜택이 곧 만료됩니다.</p>
  
  <div class="urgency-box">
    <div class="urgency-label">🎟️ 쿠폰 혜택 종료까지</div>
    <div class="urgency-days">${urgencyText}</div>
    <div class="urgency-label">만료일: ${data.expirationDate}</div>
  </div>

  <div class="coupon-info">
    <p style="margin:4px 0;"><strong>쿠폰:</strong> ${data.couponName}</p>
    <p style="margin:4px 0;"><strong>현재 플랜:</strong> ${planNames[data.planType] || data.planType}</p>
    <p style="margin:4px 0;"><strong>만료 후:</strong> FREE 플랜으로 자동 전환</p>
  </div>

  ${statsSection}

  <p>쿠폰 만료 후 변경사항:</p>
  <ul>
    <li>❌ AI 플랫폼: 4개 → <strong>Perplexity 1개만</strong></li>
    <li>❌ 모니터링 질문: 5개 → <strong>1개</strong></li>
    <li>❌ 크롤링: 매일 → <strong>주 1회</strong></li>
    <li>❌ 경쟁사 분석: <strong>사용 불가</strong></li>
  </ul>

  <p>지금 유료 결제를 등록하시면 만료 후에도 중단 없이 이용하실 수 있습니다!</p>

  <div style="text-align:center;margin:30px 0;">
    <a href="${this.appUrl}/dashboard/billing" class="button">결제 수단 등록하기 →</a>
  </div>
  <div class="footer">
    <p>© 2026 Patient Signal. All rights reserved.</p>
    <p>이 메일은 쿠폰 만료 안내를 위해 자동 발송됩니다.</p>
  </div>
</div></body></html>`;

    try {
      await this.resend.emails.send({
        from: `Patient Signal <${this.fromEmail}>`,
        to: [to],
        subject,
        html,
      });
      this.logger.log(`[쿠폰 만료] 이메일 발송 완료: ${to} (D-${data.daysRemaining}, ${data.couponName})`);
      return true;
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${error.message}`);
      return false;
    }
  }

  // ==================== B2: 경쟁사 변동 알림 이메일 ====================

  /**
   * 경쟁사 점수 변동 알림
   */
  async sendCompetitorChangeEmail(
    to: string,
    name: string,
    data: {
      hospitalName: string;
      changes: Array<{
        competitorName: string;
        oldScore: number;
        newScore: number;
        change: number;
      }>;
    },
  ): Promise<boolean> {
    if (!this.resend) return false;

    const changesHtml = data.changes.map(c => {
      const icon = c.change > 0 ? '📈' : '📉';
      const color = c.change > 0 ? '#DC2626' : '#059669'; // 경쟁사 올라가면 빨간색(위험), 내려가면 초록(기회)
      return `<tr>
        <td style="padding:8px 12px;">${c.competitorName}</td>
        <td style="padding:8px 12px;text-align:center;">${c.oldScore}</td>
        <td style="padding:8px 12px;text-align:center;">${c.newScore}</td>
        <td style="padding:8px 12px;text-align:center;color:${color};font-weight:bold;">${icon} ${c.change >= 0 ? '+' : ''}${c.change}</td>
      </tr>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#333;}
  .container{max-width:600px;margin:0 auto;padding:40px 20px;}
  .header{text-align:center;margin-bottom:30px;}
  .logo{font-size:24px;font-weight:bold;color:#4F46E5;}
  table.changes{width:100%;border-collapse:collapse;margin:20px 0;}
  table.changes th{background:#F1F5F9;padding:10px 12px;text-align:left;font-size:13px;color:#475569;}
  table.changes td{border-bottom:1px solid #F1F5F9;}
  .button{display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:bold;}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;text-align:center;color:#999;font-size:12px;}
</style></head>
<body><div class="container">
  <div class="header"><div class="logo">🏥 Patient Signal</div></div>
  <h2>🔔 경쟁사 변동 알림</h2>
  <p><strong>${data.hospitalName}</strong>의 경쟁사 AI 점수가 크게 변동되었습니다.</p>
  <table class="changes">
    <tr><th>경쟁사</th><th>이전</th><th>현재</th><th>변동</th></tr>
    ${changesHtml}
  </table>
  <div style="text-align:center;margin:30px 0;">
    <a href="${this.appUrl}/dashboard/competitors" class="button">경쟁사 분석 보기 →</a>
  </div>
  <div class="footer"><p>© 2026 Patient Signal. All rights reserved.</p></div>
</div></body></html>`;

    try {
      await this.resend.emails.send({
        from: `Patient Signal <${this.fromEmail}>`,
        to: [to],
        subject: `[Patient Signal] 🔔 ${data.hospitalName} 경쟁사 점수 변동 알림`,
        html,
      });
      this.logger.log(`[B2] 경쟁사 변동 이메일 발송: ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${error.message}`);
      return false;
    }
  }
}
