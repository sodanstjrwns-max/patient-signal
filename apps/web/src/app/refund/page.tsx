import type { Metadata } from 'next';
import { ArrowLeft, ScanSearch } from 'lucide-react';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: '환불규정 - Patient Signal',
  description: '페이션트 시그널 환불규정',
};

// 2026-08-20 전 사이트 공통 법적 페이지 템플릿 적용 ({{서비스명}}=페이션트 시그널)
// §2 단건 상품은 "해당 상품 판매 사이트에만 게시" — 시그널은 SaaS 구독만이므로 제외
export default function RefundPage() {
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
        <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.05em] text-[#17212e] mb-3">페이션트 시그널 환불규정</h1>
        <p className="text-sm text-[#8390a0] mb-8">적용일: 2026년 8월 20일</p>

        <div className="rounded-[18px] border border-[#e7ecf2] bg-white p-6 sm:p-9 shadow-[0_1px_2px_rgba(18,33,54,0.025)] divide-y divide-[#eef1f5] [&>section]:py-7 [&>section:first-child]:pt-0 [&>section:last-child]:pb-0">
          <section id="refund-subscription">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              1. 구독 서비스 (월간·연간 결제)
            </h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                결제일로부터 <strong>7일 이내</strong>이고 서비스를{' '}
                <strong>실질적으로 이용하지 않은 경우</strong>(데이터 입력·분석 실행 등 핵심 기능
                미사용): 전액 환불
              </li>
              <li>
                그 외의 경우: 총 결제금액에서 이용 일수에 해당하는 금액을 일할 계산으로 공제한
                잔액을 환불
              </li>
              <li>
                연간 결제(2개월 무료 혜택 적용)의 중도 해지 시: 무료 혜택을 제외한 월간 정가
                기준으로 이용분을 계산하여 공제 후 환불
              </li>
              <li>
                월간 구독의 단순 해지는 환불이 아닌 갱신 중단으로 처리되며, 결제된 이용기간
                종료일까지 이용 가능합니다. 위약금은 없습니다.
              </li>
            </ol>
          </section>

          <section id="refund-process">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">2. 환불 절차</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                고객센터(이메일{' '}
                <a
                  href="mailto:patientsfunnel@gmail.com"
                  className="text-[#285cf4] hover:text-[#204bce]"
                >
                  patientsfunnel@gmail.com
                </a>{' '}
                / 010-4445-1873)로 환불 요청
              </li>
              <li>회사는 요청일로부터 3영업일 이내에 환불 가능 여부와 금액을 안내</li>
              <li>
                환불은 원 결제수단으로 진행되며, 카드 결제 취소는 카드사 사정에 따라 3~7영업일이
                소요될 수 있습니다.
              </li>
            </ol>
          </section>

          <section id="refund-misc">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">3. 기타</h2>
            <ul className="list-disc list-inside text-slate-600 space-y-2">
              <li>
                이 규정에서 정하지 않은 사항은 「전자상거래 등에서의 소비자보호에 관한 법률」 등
                관련 법령에 따릅니다.
              </li>
              <li>
                회사의 귀책 사유(서비스 장애 등)로 정상 이용이 불가했던 기간은 이용 일수 계산에서
                제외합니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">부칙</h2>
            <p className="text-slate-600">이 규정은 2026년 8월 20일부터 적용됩니다.</p>
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
