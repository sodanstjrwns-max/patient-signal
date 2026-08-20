import type { Metadata } from 'next';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: '개인정보처리방침 - Patient Signal',
  description: '페이션트 시그널 개인정보처리방침',
};

// 2026-08-20 전 사이트 공통 법적 페이지 템플릿 적용 ({{서비스명}}=페이션트 시그널)
// 위탁 표는 시그널 실제 수탁자 반영: 토스페이먼츠·Cloudflare + Supabase(DB)·Resend(이메일), 카카오 알림톡 미사용으로 제외
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16 w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          페이션트 시그널 개인정보처리방침
        </h1>
        <p className="text-sm text-slate-400 mb-8">적용일: 2026년 8월 20일</p>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <p className="text-slate-600 leading-relaxed">
              페이션트퍼널(이하 &quot;회사&quot;)은 「개인정보 보호법」에 따라 이용자의 개인정보를
              보호하고 관련 고충을 신속히 처리하기 위해 다음과 같이 개인정보처리방침을
              수립·공개합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              1. 수집하는 개인정보 항목과 방법
            </h2>
            <ul className="list-disc list-inside text-slate-600 space-y-2">
              <li>
                <strong>회원가입·서비스 이용:</strong> 이름, 이메일, 휴대폰번호, 소속
                기관명(병·의원명), 비밀번호(암호화 저장)
              </li>
              <li>
                <strong>결제:</strong> 결제 관련 정보는 결제대행사(토스페이먼츠㈜)가 직접
                수집·처리하며, 회사는 결제 결과(승인 여부, 금액, 주문번호)만 보관합니다.
              </li>
              <li>
                <strong>자동 수집:</strong> 접속 IP, 쿠키, 서비스 이용 기록, 기기 정보
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">2. 개인정보의 처리 목적</h2>
            <ul className="list-disc list-inside text-slate-600 space-y-2">
              <li>회원 식별, 서비스 제공 및 운영, 요금 결제·정산</li>
              <li>고객 문의 응대, 공지사항 전달</li>
              <li>서비스 개선을 위한 통계 분석(비식별 처리)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">3. 보유 및 이용 기간</h2>
            <p className="text-slate-600 mb-3">
              회원 탈퇴 시 지체 없이 파기합니다. 단, 관련 법령에 따라 다음 기간 보관합니다:
            </p>
            <ul className="list-disc list-inside text-slate-600 space-y-1">
              <li>계약·청약철회·대금결제·재화 공급 기록: 5년 (전자상거래법)</li>
              <li>소비자 불만·분쟁 처리 기록: 3년 (전자상거래법)</li>
              <li>접속 기록: 3개월 (통신비밀보호법)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">4. 개인정보의 처리 위탁</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-slate-200 rounded-lg">
                <thead className="bg-mesh">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 border-b">
                      수탁자
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 border-b">
                      위탁 업무
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-2 text-sm border-b">토스페이먼츠㈜</td>
                    <td className="px-4 py-2 text-sm border-b">결제 처리 및 결제대행</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-sm border-b">Cloudflare, Inc.</td>
                    <td className="px-4 py-2 text-sm border-b">
                      서비스 인프라 운영(호스팅, 데이터 보관) — 국외(미국 등 Cloudflare 데이터센터
                      소재지), 서비스 이용 시점에 전송, 인프라 운영 목적, 회원 탈퇴 시까지 보관
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-sm border-b">Supabase, Inc.</td>
                    <td className="px-4 py-2 text-sm border-b">데이터베이스 호스팅</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-sm">Resend</td>
                    <td className="px-4 py-2 text-sm">이메일 발송</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">5. 정보주체의 권리</h2>
            <p className="text-slate-600 leading-relaxed">
              이용자는 언제든지 개인정보 열람·정정·삭제·처리정지를 요구할 수 있습니다. 요청은 아래
              개인정보 보호책임자에게 서면, 이메일로 하실 수 있으며 회사는 지체 없이 조치합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">6. 개인정보의 파기</h2>
            <p className="text-slate-600 leading-relaxed">
              보유 기간 경과 또는 처리 목적 달성 시 지체 없이 파기합니다. 전자 파일은 복구 불가능한
              방법으로 삭제하고, 출력물은 분쇄·소각합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">7. 안전성 확보 조치</h2>
            <p className="text-slate-600 leading-relaxed">
              비밀번호 등 주요 정보의 암호화 저장, 전 구간 HTTPS 통신, 접근 권한 관리, 접속 기록
              보관·점검을 시행합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">8. 개인정보 보호책임자</h2>
            <div className="text-slate-600 bg-mesh rounded-lg p-4">
              <p>성명: 문석준 (대표)</p>
              <p>이메일: sodanstjrwns@naver.com</p>
              <p>연락처: 010-5832-3372</p>
            </div>
            <p className="text-slate-600 mt-4">
              기타 개인정보 침해 신고·상담: 개인정보침해신고센터 (privacy.kisa.or.kr / 국번없이 118)
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">부칙</h2>
            <p className="text-slate-600">이 방침은 2026년 8월 20일부터 적용됩니다.</p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
            ← 메인으로 돌아가기
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
