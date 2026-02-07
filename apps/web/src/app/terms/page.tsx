'use client';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">이용약관</h1>
        
        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">제1조 (목적)</h2>
            <p className="text-gray-600 leading-relaxed">
              본 약관은 페이션트 시그널(Patient Signal, 이하 "회사")이 제공하는 AI 검색 가시성 분석 서비스(이하 "서비스")의 
              이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">제2조 (정의)</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li><strong>"서비스"</strong>란 회사가 제공하는 AI 플랫폼(ChatGPT, Claude, Perplexity, Gemini 등)에서의 
                병원/의료기관 검색 가시성 분석, 경쟁사 비교, 개선 인사이트 제공 등의 서비스를 말합니다.</li>
              <li><strong>"이용자"</strong>란 본 약관에 따라 서비스를 이용하는 병원, 의료기관 또는 개인을 말합니다.</li>
              <li><strong>"구독"</strong>이란 이용자가 서비스를 이용하기 위해 정기적으로 결제하는 유료 이용권을 말합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal list-inside text-gray-600 space-y-2">
              <li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
              <li>회사는 필요하다고 인정되는 경우 본 약관을 변경할 수 있으며, 변경된 약관은 공지 후 효력이 발생합니다.</li>
              <li>이용자는 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">제4조 (서비스의 제공)</h2>
            <ol className="list-decimal list-inside text-gray-600 space-y-2">
              <li>회사는 다음과 같은 서비스를 제공합니다:
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>AI 플랫폼 검색 결과 모니터링 및 분석</li>
                  <li>가시성 점수 및 통계 제공</li>
                  <li>경쟁사 비교 분석</li>
                  <li>개선 인사이트 및 추천</li>
                  <li>정기 리포트 제공</li>
                </ul>
              </li>
              <li>서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다. 단, 시스템 점검 등의 사유로 
                서비스가 일시 중단될 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">제5조 (이용요금 및 결제)</h2>
            <ol className="list-decimal list-inside text-gray-600 space-y-2">
              <li>서비스 이용요금은 회사가 정한 요금 정책에 따릅니다.</li>
              <li>신규 가입 시 7일간의 무료 체험 기간이 제공됩니다.</li>
              <li>결제는 토스페이먼츠를 통해 처리되며, 카드결제, 계좌이체 등의 방법을 지원합니다.</li>
              <li>구독은 매월(또는 매년) 자동으로 갱신되며, 갱신일 전에 해지하지 않으면 자동으로 결제됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">제6조 (환불 정책)</h2>
            <ol className="list-decimal list-inside text-gray-600 space-y-2">
              <li>무료 체험 기간 중에는 언제든지 해지가 가능하며, 별도의 비용이 청구되지 않습니다.</li>
              <li>유료 구독 후 7일 이내에 해지를 요청하는 경우, 전액 환불됩니다.</li>
              <li>7일 이후 해지 시에는 남은 기간에 대한 부분 환불이 불가합니다.</li>
              <li>환불 요청은 고객센터를 통해 접수할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">제7조 (이용자의 의무)</h2>
            <ol className="list-decimal list-inside text-gray-600 space-y-2">
              <li>이용자는 정확한 정보를 제공해야 하며, 허위 정보 제공 시 서비스 이용이 제한될 수 있습니다.</li>
              <li>이용자는 계정 정보를 안전하게 관리해야 하며, 제3자에게 계정을 양도하거나 공유할 수 없습니다.</li>
              <li>이용자는 서비스를 부정한 목적으로 사용해서는 안 됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">제8조 (면책조항)</h2>
            <ol className="list-decimal list-inside text-gray-600 space-y-2">
              <li>회사는 AI 플랫폼의 정책 변경이나 기술적 문제로 인한 서비스 제공 중단에 대해 책임지지 않습니다.</li>
              <li>회사는 이용자가 서비스를 통해 얻은 정보에 기반한 의사결정의 결과에 대해 책임지지 않습니다.</li>
              <li>서비스에서 제공하는 분석 결과는 참고 자료이며, 최종 의사결정은 이용자의 책임입니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">제9조 (분쟁해결)</h2>
            <p className="text-gray-600 leading-relaxed">
              서비스 이용과 관련하여 분쟁이 발생한 경우, 회사와 이용자는 원만한 해결을 위해 성실히 협의합니다. 
              협의가 이루어지지 않는 경우, 관할 법원에 의해 해결합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">부칙</h2>
            <p className="text-gray-600">
              본 약관은 2024년 1월 1일부터 시행됩니다.
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
