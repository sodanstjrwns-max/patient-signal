import Link from 'next/link';
import { PublicBrand } from '@/components/public/PublicBrand';

/**
 * 공통 푸터 — 전자상거래법 사업자 표기 (2026-08-20 법적 표기 가이드 기준)
 * 페이션트퍼널 패밀리 10개 사이트 공통 포맷
 */
export default function SiteFooter() {
  return (
    <footer id="site-footer" className="py-10 border-t border-[#dedee8] bg-[#f4f4f8]">
      <div className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-14">
        {/* 브랜드 + 법적 페이지 링크 */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#737382] mb-6">
          <PublicBrand />
          <nav className="flex flex-wrap items-center justify-center gap-5" aria-label="법적 고지 및 안내">
            <Link href="/terms" className="hover:text-[#111118] transition-colors font-medium">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-[#111118] transition-colors font-medium">
              개인정보처리방침
            </Link>
            <Link href="/refund" className="hover:text-[#111118] transition-colors font-medium">
              환불규정
            </Link>
            <Link href="/guide" className="hover:text-[#111118] transition-colors font-medium">
              사용 가이드
            </Link>
            <Link href="/pricing" className="hover:text-[#111118] transition-colors font-medium">
              요금제
            </Link>
          </nav>
        </div>

        {/* 사업자 정보 (전자상거래법 필수 표기) */}
        <div id="business-info" className="border-t border-[#dedee8] pt-5 text-xs text-[#737382] leading-relaxed space-y-1">
          <p>
            상호: 페이션트퍼널 <span className="mx-1.5 text-[#9997ad]">|</span> 대표: 문석준
            <span className="mx-1.5 text-[#9997ad]">|</span> 사업자등록번호:{' '}
            <a
              href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=4690103014"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-[#111118]"
            >
              469-01-03014
            </a>
            <span className="mx-1.5 text-[#9997ad]">|</span> 통신판매업신고: 제2024-서울강남-03817호
          </p>
          <p>
            주소: 서울특별시 강남구 영동대로 602, 6층 z208 (삼성동, 삼성동 미켈란 107)
            <span className="mx-1.5 text-[#9997ad]">|</span> 연락처: 010-4445-1873
            <span className="mx-1.5 text-[#9997ad]">|</span> 이메일: patientsfunnel@gmail.com
          </p>
          <p>
            호스팅: Cloudflare, Inc.
            <span className="mx-1.5 text-[#9997ad]">|</span>{' '}
            <a
              href="https://patientfunnel.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#111118] font-medium"
            >
              페이션트퍼널 패밀리
            </a>
          </p>
          <p className="pt-1 text-[#9997ad]">
            © {new Date().getFullYear()} 페이션트퍼널. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
