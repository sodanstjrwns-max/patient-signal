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
    <header className="flex min-h-[76px] items-center justify-between gap-5 border-b border-[#dee4d9] px-5 py-4 sm:px-8 xl:px-10">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2 text-[9px] font-medium uppercase tracking-[.16em] text-[#87917e]">
          <span>Workspace</span>
          <span>/</span>
          <span className="text-[#36765a]">Signal</span>
        </div>
        <h1 className="text-sm font-semibold tracking-[-.025em] text-[#15231b]">
          {title}
        </h1>
        {(description || subtitle) && (
          <p className="mt-1 hidden text-[11px] text-[#778378] sm:block">
            {description || subtitle}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-5">
        <Link
          href="/dashboard/guide"
          className="hidden items-center gap-1 text-[11px] text-[#778378] hover:text-[#15231b] md:flex"
        >
          이용 가이드
          <ArrowUpRight className="h-3 w-3" />
        </Link>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-md border border-[#d7dfcf] px-3 py-2 text-[11px] font-medium text-[#4b5c48] hover:bg-white disabled:opacity-50"
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
