import type { Metadata } from 'next';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: '환불규정 - Patient Signal',
  description: '페이션트 시그널 구독 서비스의 환불 및 해지 규정 안내',
};

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16 w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">환불규정</h1>
        <p className="text-sm text-slate-400 mb-8">시행일: 2026년 8월 20일</p>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-8 space-y-8">
          <section id="refund-scope">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제1조 (적용 범위)</h2>
            <p className="text-slate-600 leading-relaxed">
              본 환불규정은 페이션트퍼널(이하 &quot;회사&quot;)이 운영하는 페이션트 시그널(Patient
              Signal) 유료 구독 서비스의 결제 취소 및 환불에 적용됩니다. 본 규정에서 정하지 않은
              사항은 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관련 법령 및 이용약관에
              따릅니다.
            </p>
          </section>

          <section id="refund-subscription">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제2조 (월간 구독 환불)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                <strong>결제 후 7일 이내</strong>이고 서비스를 <strong>이용하지 않은 경우</strong>{' '}
                전액 환불됩니다. (이용 여부는 결제 이후 크롤링 실행, 리포트 열람 등 유료 기능 사용
                기록 기준)
              </li>
              <li>
                결제 후 7일이 지났거나 서비스를 이용한 경우, 잔여 기간에 대해{' '}
                <strong>일할 계산</strong>하여 환불합니다.
              </li>
              <li>월간 구독은 언제든 해지할 수 있으며, 해지에 따른 위약금은 없습니다.</li>
              <li>
                해지 시 별도 환불 요청이 없으면 현재 결제 주기 종료일까지 서비스를 계속 이용할 수
                있고, 다음 결제일부터 요금이 청구되지 않습니다.
              </li>
            </ol>
          </section>

          <section id="refund-annual">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              제3조 (연간 결제 환불 — 2개월 무료 혜택)
            </h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                연간 결제(12개월 요금으로 결제, 2개월 무료 혜택 적용)는 중도 해지 시{' '}
                <strong>무료 제공분을 제외하고</strong> 실제 이용 기간을 월간 정가 기준으로 일할
                정산한 후 잔액을 환불합니다.
              </li>
              <li>결제 후 7일 이내 미사용 시에는 전액 환불됩니다.</li>
            </ol>
          </section>

          <section id="refund-trial">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제4조 (무료 체험)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                14일 무료 체험은 카드 등록 없이 제공되며, 체험 기간 중 어떠한 요금도 청구되지
                않습니다.
              </li>
              <li>체험 종료 후 이용자가 직접 결제하기 전에는 자동으로 과금되지 않습니다.</li>
            </ol>
          </section>

          <section id="refund-company-fault">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              제5조 (회사 귀책 사유로 인한 환불)
            </h2>
            <p className="text-slate-600 leading-relaxed">
              회사의 시스템 장애 등 회사 귀책 사유로 서비스를 정상적으로 이용하지 못한 기간이
              발생한 경우, 해당 기간만큼 이용 기간을 연장하거나 일할 계산하여 환불합니다.
            </p>
          </section>

          <section id="refund-process">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제6조 (환불 절차)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                환불 요청은 대시보드 내 <strong>설정 &gt; 구독 관리</strong> 또는 이메일(
                <a
                  href="mailto:sodanstjrwns@naver.com"
                  className="text-indigo-600 hover:text-indigo-700"
                >
                  sodanstjrwns@naver.com
                </a>
                )로 접수할 수 있습니다.
              </li>
              <li>
                환불은 접수일로부터 <strong>영업일 기준 3~5일 이내</strong>에 원 결제수단으로
                처리됩니다. (카드사 사정에 따라 카드 취소 반영은 추가 소요될 수 있습니다)
              </li>
              <li>결제 처리 및 환불은 토스페이먼츠(주)를 통해 이루어집니다.</li>
            </ol>
          </section>

          <section id="refund-misc">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">제7조 (기타)</h2>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>
                이용약관 위반(부정 사용, 계정 공유 등)으로 이용이 제한된 경우 환불이 제한될 수
                있습니다.
              </li>
              <li>본 규정은 관련 법령 개정 또는 정책 변경 시 사전 공지 후 변경될 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">부칙</h2>
            <p className="text-slate-600">본 환불규정은 2026년 8월 20일부터 시행됩니다.</p>
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
