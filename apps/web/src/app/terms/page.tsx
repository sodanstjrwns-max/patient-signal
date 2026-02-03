'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          홈으로 돌아가기
        </Link>
        
        <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">이용약관</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-6">
              <strong>시행일자: 2024년 1월 1일</strong>
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제1조 (목적)</h2>
            <p className="text-gray-700 mb-6">
              이 약관은 Patient Signal(이하 "회사")이 제공하는 AI 검색 가시성 분석 서비스(이하 "서비스")의 
              이용조건 및 절차, 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제2조 (정의)</h2>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li><strong>"서비스"</strong>란 회사가 제공하는 AI 검색 가시성 분석, 모니터링, 리포팅 등 관련 제반 서비스를 의미합니다.</li>
              <li><strong>"회원"</strong>이란 회사와 서비스 이용계약을 체결하고 회원 아이디를 부여받은 자를 의미합니다.</li>
              <li><strong>"아이디(ID)"</strong>란 회원의 식별과 서비스 이용을 위하여 회원이 설정하고 회사가 승인한 이메일 주소를 의미합니다.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal pl-6 text-gray-700 mb-6">
              <li className="mb-2">이 약관은 서비스를 이용하고자 하는 모든 회원에게 그 효력이 발생합니다.</li>
              <li className="mb-2">회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 이 약관을 변경할 수 있습니다.</li>
              <li className="mb-2">약관이 변경되는 경우 회사는 변경사항을 시행일자 7일 전부터 공지합니다.</li>
            </ol>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제4조 (서비스의 내용)</h2>
            <p className="text-gray-700 mb-4">회사가 제공하는 서비스는 다음과 같습니다.</p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>AI 플랫폼(ChatGPT, Perplexity, Claude, Gemini 등)에서의 병원 노출 모니터링</li>
              <li>AI 검색 가시성 점수 산출 및 분석</li>
              <li>경쟁사 비교 분석</li>
              <li>개선 권고 사항 제공</li>
              <li>이메일/카카오톡 알림 서비스</li>
              <li>정기 리포트 제공</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제5조 (회원가입)</h2>
            <ol className="list-decimal pl-6 text-gray-700 mb-6">
              <li className="mb-2">회원가입은 이용자가 약관의 내용에 동의하고, 회원가입 신청을 한 후 회사가 이를 승낙함으로써 체결됩니다.</li>
              <li className="mb-2">회사는 다음 각 호에 해당하는 신청에 대하여는 승낙을 하지 않을 수 있습니다.
                <ul className="list-disc pl-6 mt-2">
                  <li>타인의 명의를 사용하여 신청한 경우</li>
                  <li>허위의 정보를 기재한 경우</li>
                  <li>기타 회원으로 등록하는 것이 회사의 서비스 운영에 현저히 지장이 있다고 판단되는 경우</li>
                </ul>
              </li>
            </ol>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제6조 (서비스 이용료 및 결제)</h2>
            <ol className="list-decimal pl-6 text-gray-700 mb-6">
              <li className="mb-2">서비스 이용료는 회사가 정한 요금 정책에 따릅니다.</li>
              <li className="mb-2">유료 서비스의 경우, 회원은 회사가 정한 결제 방법으로 이용료를 납부해야 합니다.</li>
              <li className="mb-2">회사는 이용료를 변경할 수 있으며, 변경 시 30일 전에 공지합니다.</li>
            </ol>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제7조 (회원의 의무)</h2>
            <ol className="list-decimal pl-6 text-gray-700 mb-6">
              <li className="mb-2">회원은 서비스 이용 시 다음 각 호의 행위를 하여서는 안 됩니다.
                <ul className="list-disc pl-6 mt-2">
                  <li>타인의 정보 도용</li>
                  <li>회사가 게시한 정보의 무단 변경</li>
                  <li>회사가 허용한 정보 이외의 정보 송신 또는 게시</li>
                  <li>회사 및 제3자의 저작권 등 지적재산권에 대한 침해</li>
                  <li>회사 및 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                </ul>
              </li>
            </ol>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제8조 (서비스의 중지)</h2>
            <p className="text-gray-700 mb-6">
              회사는 다음 각 호에 해당하는 경우 서비스의 전부 또는 일부를 제한하거나 중지할 수 있습니다.
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>서비스용 설비의 보수 등 공사로 인한 부득이한 경우</li>
              <li>전기통신사업법에 규정된 기간통신사업자가 전기통신 서비스를 중지했을 경우</li>
              <li>기타 불가항력적 사유가 있는 경우</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제9조 (면책조항)</h2>
            <ol className="list-decimal pl-6 text-gray-700 mb-6">
              <li className="mb-2">회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 책임이 면제됩니다.</li>
              <li className="mb-2">회사는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.</li>
              <li className="mb-2">회사는 AI 플랫폼의 응답 내용의 정확성이나 신뢰성에 대해 보증하지 않습니다.</li>
            </ol>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제10조 (분쟁해결)</h2>
            <ol className="list-decimal pl-6 text-gray-700 mb-6">
              <li className="mb-2">회사와 회원 간에 발생한 분쟁에 관한 소송은 대한민국 법을 준거법으로 합니다.</li>
              <li className="mb-2">회사와 회원 간에 발생한 분쟁에 관한 소송은 서울중앙지방법원을 관할 법원으로 합니다.</li>
            </ol>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">부칙</h2>
            <p className="text-gray-700 mb-6">
              이 약관은 2024년 1월 1일부터 시행됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
