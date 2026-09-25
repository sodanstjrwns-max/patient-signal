import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SignalMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center bg-[#ff5d2a] text-[#141512] ${className}`}
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

export function SignalWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block font-black leading-[0.8] tracking-[-0.095em] ${className}`}
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      signal
      <span
        className="ml-[0.035em] inline-block h-[0.105em] w-[0.105em] bg-current"
        aria-hidden="true"
      />
    </span>
  );
}

export function PublicBrand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Patient Signal 홈"
      className={`inline-flex items-center gap-2.5 ${light ? "text-[#f1f1eb]" : "text-[#141512]"}`}
    >
      <SignalMark className="!h-8 !w-8" />
      <span>
        <span className="mb-1.5 block font-mono text-[7px] leading-none tracking-[0.18em]">
          PATIENT
        </span>
        <SignalWordmark className="text-[25px]" />
      </span>
    </Link>
  );
}

export function PublicHeader({
  active,
  loggedIn = false,
  dark = false,
}: {
  active?: "pricing" | "guide";
  loggedIn?: boolean;
  dark?: boolean;
}) {
  return (
    <header
      className={`relative z-10 border-b ${dark ? "border-[#f1f1eb]/25 bg-[#141512] text-[#f1f1eb]" : "border-[#141512] bg-[#f1f1eb] text-[#141512]"}`}
    >
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-3 px-5 sm:px-8 lg:px-10">
        <PublicBrand light={dark} />
        <nav
          className="hidden items-center gap-7 text-xs font-semibold md:flex"
          aria-label="주요 메뉴"
        >
          <Link
            href="/#how-it-works"
            className="underline-offset-4 hover:underline"
          >
            제품 둘러보기
          </Link>
          <Link
            href="/pricing"
            aria-current={active === "pricing" ? "page" : undefined}
            className={`underline-offset-4 hover:underline ${active === "pricing" ? "underline" : ""}`}
          >
            요금제
          </Link>
          <Link
            href="/guide"
            aria-current={active === "guide" ? "page" : undefined}
            className={`underline-offset-4 hover:underline ${active === "guide" ? "underline" : ""}`}
          >
            사용 가이드
          </Link>
        </nav>
        <Link
          href={loggedIn ? "/dashboard" : "/login"}
          className={`group inline-flex shrink-0 items-center gap-4 px-4 py-2.5 text-xs font-semibold transition-colors ${dark ? "bg-[#d0ff43] text-[#141512] hover:bg-[#ff5d2a]" : "bg-[#141512] text-[#f1f1eb] hover:bg-[#ff5d2a] hover:text-[#141512]"}`}
        >
          {loggedIn ? "내 대시보드" : "로그인"}
          <ArrowRight className="h-3.5 w-3.5 transition-transform motion-safe:group-hover:translate-x-0.5" />
        </Link>
      </div>
    </header>
  );
}
