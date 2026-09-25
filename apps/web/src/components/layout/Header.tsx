"use client";

import { ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
interface HeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}
export function Header({
  title,
  description,
  subtitle,
  onRefresh,
  refreshing,
}: HeaderProps) {
  const hospital = useAuthStore((state) => state.user?.hospital);
  return (
    <header className="flex min-h-[44px] items-center justify-between gap-4 border-b border-[#30343a] px-5 py-2 sm:px-8 lg:min-h-[76px] lg:py-3 xl:px-10">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/dashboard"
            className="hidden font-numeric text-[36px] font-bold italic leading-none tracking-[-.07em] text-[#ff6a24] lg:block"
          >
            signal<span className="text-[#d9ff43]">.</span>
          </Link>
          <span className="hidden h-5 border-l border-[#30343a]/25 lg:block" />
          <h1 className="font-display truncate text-[13px] font-semibold text-[#f5f5ef]">
            {title}
          </h1>
        </div>
        {(description || subtitle) && (
          <p className="sr-only">{description || subtitle}</p>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        {hospital?.name && (
          <Link
            href="/dashboard/settings"
            className="hidden max-w-[220px] items-center gap-2 truncate text-[11px] font-medium md:flex"
          >
            <span className="h-2 w-2 shrink-0 bg-[#ff6a24]" />
            {hospital.name}
          </Link>
        )}
        <Link
          href="/dashboard/guide"
          className="hidden items-center gap-1 border-l border-[#30343a] pl-5 text-[11px] text-[#959c9f] hover:text-[#f5f5ef] xl:flex"
        >
          이용 가이드
          <ArrowUpRight className="h-3 w-3" />
        </Link>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="desk-action flex shrink-0 items-center gap-2 border border-[#30343a] px-3 py-2 text-[11px] font-semibold text-[#f5f5ef] hover:border-[#ff6a24] hover:bg-[#281a13] hover:text-[#ff9565] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            <span>새로고침</span>
          </button>
        )}
      </div>
    </header>
  );
}
