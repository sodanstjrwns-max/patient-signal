"use client";

import { ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
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
  return (
    <header className="flex min-h-[76px] items-center justify-between gap-5 border-b border-[#dedee8] bg-white/60 px-5 py-4 sm:px-8 xl:px-10">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2 text-[9px] font-medium uppercase tracking-[.16em] text-[#858592]">
          <span>Workspace</span>
          <span>/</span>
          <span className="text-[#5b4dff]">Signal</span>
        </div>
        <h1 className="text-sm font-semibold tracking-[-.025em] text-[#111118]">
          {title}
        </h1>
        {(description || subtitle) && (
          <p className="mt-1 hidden text-[11px] text-[#737382] sm:block">
            {description || subtitle}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-5">
        <Link
          href="/dashboard/guide"
          className="hidden items-center gap-1 text-[11px] text-[#737382] hover:text-[#111118] md:flex"
        >
          이용 가이드
          <ArrowUpRight className="h-3 w-3" />
        </Link>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="signal-button flex items-center gap-2 rounded-lg border border-[#d9d8e6] bg-white px-3 py-2 text-[11px] font-medium text-[#545067] hover:border-[#5b4dff] hover:text-[#5b4dff] disabled:opacity-50"
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
