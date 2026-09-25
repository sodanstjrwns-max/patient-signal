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
    <header className="flex min-h-[44px] items-center justify-between gap-4 border-b border-[#d4d6cb] px-5 py-2 sm:px-8 lg:min-h-[76px] lg:py-3 xl:px-10">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/dashboard"
            className="hidden text-[28px] font-black leading-none tracking-[-.075em] lg:block"
          >
            signal<span className="text-[#ff5d2a]">.</span>
          </Link>
          <span className="hidden h-5 border-l border-[#141512]/25 lg:block" />
          <h1 className="truncate text-[13px] font-semibold text-[#141512]">
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
            <span className="h-2 w-2 shrink-0 bg-[#ff5d2a]" />
            {hospital.name}
          </Link>
        )}
        <Link
          href="/dashboard/guide"
          className="hidden items-center gap-1 border-l border-[#d4d6cb] pl-5 text-[11px] text-[#72756a] hover:text-[#141512] xl:flex"
        >
          이용 가이드
          <ArrowUpRight className="h-3 w-3" />
        </Link>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="desk-action flex shrink-0 items-center gap-2 border border-[#141512] px-3 py-2 text-[11px] font-semibold text-[#141512] hover:bg-[#d0ff43] disabled:opacity-50"
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
