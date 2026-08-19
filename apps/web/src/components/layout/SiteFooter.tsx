import Link from 'next/link';
import { Sparkles } from 'lucide-react';

/**
 * 공통 푸터 — 전자상거래법 사업자 표기 (2026-08-20 법적 표기 가이드 기준)
 * 페이션트퍼널 패밀리 10개 사이트 공통 포맷
 */
export default function SiteFooter() {
  return (
    <footer id="site-footer" className="py-10 border-t border-slate-200/50 bg-white/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 브랜드 + 법적 페이지 링크 */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 via-violet-500 to-brand-600 flex items-center justify-center shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold">Patient Signal by 페이션트퍼널</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-5" aria-label="법적 고지 및 안내">
            <Link href="/terms" className="hover:text-slate-600 transition-colors font-medium">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-slate-600 transition-colors font-medium">
              개인정보처리방침
            </Link>
            <Link href="/refund" className="hover:text-slate-600 transition-colors font-medium">
              환불규정
            </Link>
            <Link href="/guide" className="hover:text-slate-600 transition-colors font-medium">
              사용 가이드
            </Link>
            <Link href="/pricing" className="hover:text-slate-600 transition-colors font-medium">
              요금제
            </Link>
          </nav>
        </div>

        {/* 사업자 정보 (전자상거래법 필수 표기) */}
        <div id="business-info" className="border-t border-slate-200/50 pt-5 text-xs text-slate-400 leading-relaxed space-y-1">
          <p>
            상호: 페이션트퍼널 <span className="mx-1.5 text-slate-300">|</span> 대표: 문석준
            <span className="mx-1.5 text-slate-300">|</span> 사업자등록번호:{' '}
            <a
              href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=4690103014"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-slate-600"
            >
              469-01-03014
            </a>
            <span className="mx-1.5 text-slate-300">|</span> 통신판매업신고: 제2024-서울강남-03817호
          </p>
          <p>
            주소: 서울특별시 강남구 영동대로 602, 6층 z208 (삼성동, 삼성동 미켈란 107)
            <span className="mx-1.5 text-slate-300">|</span> 연락처: 010-5832-3372
            <span className="mx-1.5 text-slate-300">|</span> 이메일: sodanstjrwns@naver.com
          </p>
          <p>
            호스팅: Cloudflare, Inc.
            <span className="mx-1.5 text-slate-300">|</span>{' '}
            <a
              href="https://patientfunnel.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-600 font-medium"
            >
              페이션트퍼널 패밀리
            </a>
          </p>
          <p className="pt-1 text-slate-300">
            © {new Date().getFullYear()} 페이션트퍼널. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
