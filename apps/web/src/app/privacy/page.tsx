'use client';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">개인정보처리방침</h1>
        
        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <p className="text-gray-600 leading-relaxed mb-4">
              페이션트 시그널(Patient Signal, 이하 "회사")은 이용자의 개인정보를 중요시하며, 
              「개인정보 보호법」 등 관련 법령을 준수하고 있습니다. 본 개인정보처리방침은 회사가 
              이용자의 개인정보를 어떻게 수집, 이용, 보호하는지를 설명합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">1. 수집하는 개인정보 항목</h2>
            <div className="text-gray-600 space-y-3">
              <p><strong>필수 항목:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>이메일 주소</li>
                <li>이름 (또는 담당자명)</li>
                <li>비밀번호 (암호화 저장)</li>
              </ul>
              <p className="mt-4"><strong>선택 항목:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>연락처 (전화번호)</li>
                <li>병원/의료기관명</li>
                <li>병원 주소</li>
                <li>사업자등록번호</li>
              </ul>
              <p className="mt-4"><strong>자동 수집 정보:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>접속 IP 주소</li>
                <li>쿠키</li>
                <li>접속 일시</li>
                <li>서비스 이용 기록</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">2. 개인정보의 수집 및 이용 목적</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>회원 가입 및 서비스 제공을 위한 본인 확인</li>
              <li>서비스 이용에 따른 요금 결제 및 정산</li>
              <li>서비스 관련 공지사항 전달</li>
              <li>고객 문의 응대 및 분쟁 해결</li>
              <li>서비스 개선 및 신규 서비스 개발</li>
              <li>마케팅 및 광고 활용 (동의 시에만)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">3. 개인정보의 보유 및 이용 기간</h2>
            <div className="text-gray-600 space-y-3">
              <p>회사는 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 
                 단, 관련 법령에 의해 보존할 필요가 있는 경우 아래와 같이 보관합니다:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><strong>계약 또는 청약철회 등에 관한 기록:</strong> 5년 (전자상거래법)</li>
                <li><strong>대금결제 및 재화 등의 공급에 관한 기록:</strong> 5년 (전자상거래법)</li>
                <li><strong>소비자의 불만 또는 분쟁처리에 관한 기록:</strong> 3년 (전자상거래법)</li>
                <li><strong>접속에 관한 기록:</strong> 3개월 (통신비밀보호법)</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">4. 개인정보의 제3자 제공</h2>
            <p className="text-gray-600 leading-relaxed">
              회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 
              예외로 합니다:
            </p>
            <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">5. 개인정보 처리 위탁</h2>
            <div className="text-gray-600">
              <p className="mb-3">회사는 서비스 제공을 위해 다음과 같이 개인정보 처리업무를 위탁하고 있습니다:</p>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">위탁받는 자</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">위탁 업무</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-2 text-sm border-b">토스페이먼츠(주)</td>
                      <td className="px-4 py-2 text-sm border-b">결제 처리</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-sm border-b">Supabase</td>
                      <td className="px-4 py-2 text-sm border-b">데이터베이스 호스팅</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-sm">Resend</td>
                      <td className="px-4 py-2 text-sm">이메일 발송</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">6. 이용자의 권리와 행사 방법</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              이용자는 언제든지 다음의 권리를 행사할 수 있습니다:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>개인정보 열람 요구</li>
              <li>개인정보 정정 요구</li>
              <li>개인정보 삭제 요구</li>
              <li>개인정보 처리 정지 요구</li>
            </ul>
            <p className="text-gray-600 mt-3">
              위 권리 행사는 서비스 내 설정 페이지 또는 고객센터를 통해 요청할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">7. 개인정보 보호를 위한 기술적/관리적 대책</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li><strong>비밀번호 암호화:</strong> bcrypt 알고리즘을 사용하여 비밀번호를 안전하게 암호화합니다.</li>
              <li><strong>SSL/TLS 암호화:</strong> 모든 데이터 전송은 HTTPS를 통해 암호화됩니다.</li>
              <li><strong>접근 통제:</strong> 개인정보에 대한 접근 권한을 최소화하고 관리합니다.</li>
              <li><strong>정기적 보안 점검:</strong> 시스템 취약점을 정기적으로 점검하고 개선합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">8. 쿠키(Cookie)의 사용</h2>
            <div className="text-gray-600 space-y-3">
              <p>회사는 서비스 이용 과정에서 쿠키를 사용합니다.</p>
              <p><strong>쿠키의 사용 목적:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>로그인 상태 유지</li>
                <li>사용자 설정 저장</li>
                <li>서비스 이용 분석</li>
              </ul>
              <p className="mt-3">
                이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다. 다만, 쿠키 저장을 거부할 경우 
                일부 서비스 이용에 제한이 있을 수 있습니다.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">9. 개인정보 보호책임자</h2>
            <div className="text-gray-600 bg-gray-50 rounded-lg p-4">
              <p><strong>개인정보 보호책임자</strong></p>
              <p className="mt-2">성명: 문석준</p>
              <p>직책: 대표</p>
              <p>이메일: support@patientsignal.kr</p>
            </div>
            <p className="text-gray-600 mt-4">
              개인정보 처리에 관한 불만이나 피해구제 등에 관한 사항은 아래 기관에 문의할 수 있습니다:
            </p>
            <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
              <li>개인정보 침해신고센터 (privacy.kisa.or.kr / 118)</li>
              <li>대검찰청 사이버수사과 (www.spo.go.kr / 1301)</li>
              <li>경찰청 사이버안전국 (cyberbureau.police.go.kr / 182)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">10. 개인정보처리방침 변경</h2>
            <p className="text-gray-600 leading-relaxed">
              본 개인정보처리방침은 법령 또는 서비스 정책의 변경에 따라 수정될 수 있습니다. 
              변경 시에는 서비스 내 공지를 통해 안내드립니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">부칙</h2>
            <p className="text-gray-600">
              본 개인정보처리방침은 2024년 1월 1일부터 시행됩니다.
            </p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
            ← 메인으로 돌아가기
          </a>
        </div>
      </div>
    </div>
  );
}
