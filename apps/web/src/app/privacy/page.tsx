'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-8">개인정보처리방침</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-6">
              <strong>시행일자: 2024년 1월 1일</strong>
            </p>

            <p className="text-gray-700 mb-6">
              Patient Signal(이하 "회사")은 개인정보보호법에 따라 이용자의 개인정보 보호 및 권익을 보호하고 
              개인정보와 관련한 이용자의 고충을 원활하게 처리할 수 있도록 다음과 같은 처리방침을 두고 있습니다.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제1조 (개인정보의 수집 항목 및 수집 방법)</h2>
            <p className="text-gray-700 mb-4">회사는 다음의 개인정보 항목을 수집하고 있습니다.</p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>필수항목: 이메일 주소, 이름, 비밀번호</li>
              <li>선택항목: 전화번호, 병원명, 병원 주소</li>
              <li>자동수집항목: 서비스 이용 기록, 접속 로그, 접속 IP 정보</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제2조 (개인정보의 수집 및 이용 목적)</h2>
            <p className="text-gray-700 mb-4">회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>서비스 제공: AI 검색 가시성 분석 서비스 제공</li>
              <li>회원 관리: 회원제 서비스 이용에 따른 본인확인, 개인식별</li>
              <li>마케팅 및 광고: 신규 서비스 개발 및 맞춤 서비스 제공</li>
              <li>서비스 개선: 서비스 이용에 대한 통계, 서비스 개선에 활용</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제3조 (개인정보의 보유 및 이용 기간)</h2>
            <p className="text-gray-700 mb-6">
              회사는 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 
              단, 관계법령의 규정에 의하여 보존할 필요가 있는 경우 회사는 아래와 같이 관계법령에서 정한 일정한 기간 동안 회원정보를 보관합니다.
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
              <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
              <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
              <li>웹사이트 방문기록: 3개월 (통신비밀보호법)</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제4조 (개인정보의 제3자 제공)</h2>
            <p className="text-gray-700 mb-6">
              회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 
              다만, 아래의 경우에는 예외로 합니다.
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제5조 (개인정보의 파기 절차 및 방법)</h2>
            <p className="text-gray-700 mb-6">
              회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체없이 파기합니다. 
              파기절차 및 방법은 다음과 같습니다.
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>파기절차: 회원이 회원가입 등을 위해 입력하신 정보는 목적이 달성된 후 별도의 DB로 옮겨져 내부 방침 및 기타 관련 법령에 의한 정보보호 사유에 따라 일정 기간 저장된 후 파기됩니다.</li>
              <li>파기방법: 전자적 파일형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제6조 (이용자의 권리와 그 행사방법)</h2>
            <p className="text-gray-700 mb-6">
              이용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며, 
              회원탈퇴를 통해 개인정보 이용에 대한 동의를 철회할 수 있습니다.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제7조 (개인정보 보호책임자)</h2>
            <p className="text-gray-700 mb-6">
              회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의 불만처리 및 피해구제를 처리하기 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <ul className="list-none pl-6 text-gray-700 mb-6">
              <li><strong>개인정보 보호책임자</strong></li>
              <li>성명: Patient Signal 운영팀</li>
              <li>이메일: privacy@patientsignal.kr</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제8조 (개인정보처리방침 변경)</h2>
            <p className="text-gray-700 mb-6">
              이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>

            <p className="text-gray-500 mt-8 text-sm">
              본 방침은 2024년 1월 1일부터 시행됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
