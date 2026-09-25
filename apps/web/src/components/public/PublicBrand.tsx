import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SignalMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[#ff6a24]/50 bg-[#08090a] text-[#ff6a24] ${className}`}
    >
      <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none">
        <path
          d="M5 23V11M11 23V5M17 23V15M23 23V2"
          stroke="currentColor"
          strokeWidth="3.5"
        />
      </svg>
    </span>
  );
}

export function SignalWordmark({
  className = "",
  outlined = false,
  compact = false,
}: {
  className?: string;
  outlined?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label="Patient Signal"
      className={`block whitespace-nowrap font-numeric font-bold leading-[0.8] tracking-[-0.075em] ${className}`}
    >
      <span
        aria-hidden="true"
        className={
          compact
            ? "mb-[0.12em] block"
            : "mb-[0.18em] block text-[0.56em] tracking-[-0.055em]"
        }
      >
        patient
      </span>
      <span aria-hidden="true" className="block">
        sig
        <span
          style={
            outlined
              ? {
                  WebkitTextStroke: "1px #ff6a24",
                  WebkitTextFillColor: "transparent",
                }
              : undefined
          }
        >
          nal
        </span>
        <span className="ml-[0.035em] inline-block h-[0.075em] w-[0.075em] bg-[#d9ff43]" />
      </span>
    </span>
  );
}

export function PublicBrand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Patient Signal 홈"
      className={`inline-flex items-center gap-2.5 ${light ? "text-[#f5f5ef]" : "text-[#ff6a24]"}`}
    >
      <SignalMark className="!h-8 !w-8" />
      <SignalWordmark compact className="text-[22px]" />
    </Link>
  );
}

export function PublicHeader({
  active,
  loggedIn = false,
  dark = true,
}: {
  active?: "pricing" | "guide";
  loggedIn?: boolean;
  dark?: boolean;
}) {
  return (
    <header className="relative z-10 border-b border-[#30343a] bg-[#08090a] text-[#f5f5ef]">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-3 px-5 sm:px-8 lg:px-10">
        <PublicBrand light={dark} />
        <nav
          className="hidden items-center gap-7 text-xs font-semibold md:flex"
          aria-label="주요 메뉴"
        >
          <Link
            href="/#how-it-works"
            className="text-[#959c9f] transition-colors hover:text-[#ff6a24]"
          >
            제품 둘러보기
          </Link>
          <Link
            href="/pricing"
            aria-current={active === "pricing" ? "page" : undefined}
            className={`transition-colors hover:text-[#ff6a24] ${active === "pricing" ? "text-[#ff6a24]" : "text-[#959c9f]"}`}
          >
            요금제
          </Link>
          <Link
            href="/guide"
            aria-current={active === "guide" ? "page" : undefined}
            className={`transition-colors hover:text-[#ff6a24] ${active === "guide" ? "text-[#ff6a24]" : "text-[#959c9f]"}`}
          >
            사용 가이드
          </Link>
        </nav>
        <Link
          href={loggedIn ? "/dashboard" : "/login"}
          className="group inline-flex shrink-0 items-center gap-4 border border-[#ff6a24] px-4 py-2.5 text-xs font-semibold text-[#ff6a24] transition-colors hover:bg-[#ff6a24] hover:text-[#08090a]"
        >
          {loggedIn ? "내 대시보드" : "로그인"}
          <ArrowRight className="h-3.5 w-3.5 transition-transform motion-safe:group-hover:translate-x-0.5" />
        </Link>
      </div>
    </header>
  );
}
