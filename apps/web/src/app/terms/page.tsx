import type { Metadata } from 'next';
import { ArrowLeft, ScanSearch } from 'lucide-react';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: '이용약관 - Patient Signal',
  description: '페이션트 시그널 이용약관',
};

// 2026-08-20 전 사이트 공통 법적 페이지 템플릿 적용 ({{서비스명}}=페이션트 시그널)
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f6f7f9] flex flex-col text-[#17212e]">
      <header className="border-b border-[#e7ecf2] bg-white">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between px-5 sm:px-8">
          <a href="/" className="flex items-center gap-3 text-sm font-bold"><span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#285cf4] text-white"><ScanSearch className="h-4 w-4" /></span>Patient Signal</a>
          <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#69788b] hover:text-[#285cf4]"><ArrowLeft className="h-4 w-4" /> 홈으로</a>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto px-5 sm:px-8 py-12 sm:py-16 w-full">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#285cf4]">Legal</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.05em] text-[#17212e] mb-3">페이션트 시그널 이용약관</h1>
        <p className="text-sm text-[#8390a0] mb-8">시행일: 2026년 8월 20일</p>

        <div className="rounded-[18px] border border-[#e7ecf2] bg-white p-6 sm:p-9 shadow-[0_1px_2px_rgba(18,33,54,0.025)] divide-y divide-[#eef1f5] [&>section]:py-7 [&>section:first-child]:pt-0 [&>section:last-child]:pb-0">
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제1조 (목적)</h2>
            <p className="text-slate-600 leading-relaxed">
              이 약관은 페이션트퍼널(이하 &quot;회사&quot;)이 제공하는 페이션트 시그널 및 관련 제반
              서비스(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 회원 간의 권리, 의무 및
              책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제2조 (정의)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                &quot;서비스&quot;란 회사가 웹사이트를 통해 제공하는 병·의원 경영 지원 소프트웨어 및
                부가 기능 일체를 말합니다.
              </li>
              <li>&quot;회원&quot;이란 이 약관에 동의하고 회사와 이용계약을 체결한 자를 말합니다.</li>
              <li>
                &quot;구독&quot;이란 회원이 요금제를 선택하고 정기 결제를 통해 서비스를 이용하는 계약
                형태를 말합니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제3조 (약관의 게시와 개정)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>회사는 이 약관을 서비스 초기 화면 또는 연결 화면에 게시합니다.</li>
              <li>
                회사는 관련 법령을 위배하지 않는 범위에서 약관을 개정할 수 있으며, 개정 시 적용일자
                7일 전(회원에게 불리한 변경은 30일 전)부터 공지합니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제4조 (이용계약의 체결)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>이용계약은 가입 신청자가 약관에 동의하고 회사가 이를 승낙함으로써 체결됩니다.</li>
              <li>
                회사는 타인 명의 도용, 허위 정보 기재 등의 경우 승낙을 거부하거나 사후에 계약을
                해지할 수 있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제5조 (요금제·결제·갱신)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                서비스 요금제와 가격은 서비스 내 요금 안내 페이지에 게시하며, 부가가치세는
                별도입니다.
              </li>
              <li>
                구독 요금은 선택한 주기(월간/연간)에 따라 등록된 결제수단으로 자동 결제됩니다.
              </li>
              <li>
                구독은 해지하지 않는 한 동일 조건으로 자동 갱신됩니다. 가격이 변경되는 경우 갱신일
                30일 전까지 고지합니다.
              </li>
              <li>
                무료 체험 기간(14일)에는 결제수단 등록 없이 이용할 수 있으며, 체험 종료 후 유료
                전환은 회원의 명시적 신청으로만 이루어집니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제6조 (구독 해지와 환불)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                회원은 언제든지 서비스 내 설정 또는 고객센터를 통해 구독을 해지할 수 있으며,
                위약금은 없습니다.
              </li>
              <li>해지 시 이미 결제된 이용기간 종료일까지 서비스를 이용할 수 있습니다.</li>
              <li>
                환불은 별도{' '}
                <a href="/refund" className="text-[#285cf4] hover:text-[#204bce] underline">
                  「환불규정」
                </a>
                에 따릅니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제7조 (회사의 의무)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                회사는 안정적인 서비스 제공을 위해 노력하며, 설비 장애 또는 데이터 멸실 시 지체 없이
                복구합니다.
              </li>
              <li>
                회사는 회원의 개인정보를{' '}
                <a href="/privacy" className="text-[#285cf4] hover:text-[#204bce] underline">
                  「개인정보처리방침」
                </a>
                에 따라 보호합니다.
              </li>
              <li>정기 점검 등 서비스 중단이 필요한 경우 사전에 공지합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제8조 (회원의 의무)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                회원은 서비스 이용 시 관련 법령(의료법, 개인정보 보호법 등)을 준수해야 하며, 특히
                환자 정보 등 제3자의 개인정보를 서비스에 입력·저장하는 경우 해당 정보 처리에 필요한
                적법한 근거를 갖추어야 합니다.
              </li>
              <li>회원은 계정 정보를 제3자에게 공유·양도할 수 없습니다.</li>
              <li>
                회원은 서비스를 역설계, 크롤링, 재판매하거나 시스템에 부하를 일으키는 행위를 해서는
                안 됩니다.
              </li>
              <li>
                서비스가 제공하는 경쟁·비교 통계(다른 의료기관의 AI 답변 등장률, 순위형 표시 등)는 AI
                답변을 관찰·집계한 참고 자료이며 의료의 질이나 실력에 대한 평가가 아닙니다. 회원은 이를
                계약 병원의 내부 경영 참고용으로만 사용해야 하며, 화면 캡처·외부 게시·의료광고나 홍보물
                인용을 할 수 없습니다. 이를 어겨 발생하는 의료법(의료광고 규제) 등 법적 책임은 회원에게
                있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제9조 (데이터의 귀속과 보관)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>회원이 서비스에 입력한 데이터의 권리는 회원에게 있습니다.</li>
              <li>
                계약 종료 후 30일간 데이터를 보관하며, 이 기간 내 회원의 요청 시 내보내기를
                제공합니다. 기간 경과 후 데이터는 파기됩니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제10조 (책임의 제한)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                회사는 천재지변, 통신사업자의 귀책 등 불가항력으로 인한 손해에 대해 책임지지
                않습니다.
              </li>
              <li>
                서비스가 제공하는 분석·예측·추천 결과는 경영 참고 자료이며, 이에 근거한 의사결정의
                최종 책임은 회원에게 있습니다.
              </li>
              <li>
                회사의 배상 책임은 회원이 최근 12개월간 회사에 지급한 이용요금 총액을 한도로 합니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제11조 (분쟁 해결)</h2>
            <p className="text-slate-600 leading-relaxed">
              이 약관은 대한민국 법률에 따라 해석되며, 분쟁에 관한 소송은 민사소송법상 관할법원에
              제기합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">부칙</h2>
            <p className="text-slate-600">이 약관은 2026년 8월 20일부터 시행합니다.</p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="text-[#285cf4] hover:text-[#204bce] font-medium">
            ← 메인으로 돌아가기
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
