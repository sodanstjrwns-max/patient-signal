'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function Header({ title, description, subtitle, onRefresh, refreshing }: HeaderProps) {
  const desc = description || subtitle;
  return (
    <header className="sticky top-0 z-30 border-b border-[#e9edf1] bg-white/95 px-5 py-4 sm:px-8 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-[26px] font-bold text-[#17212e] tracking-[-0.035em] truncate">{title}</h1>
        {desc && (
          <p className="text-xs sm:text-sm text-[#647284] truncate mt-1">{desc}</p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="border-[#d9e0e8] hover:bg-[#f6f8fb]"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline text-xs font-semibold">새로고침</span>
            <span className="sm:hidden text-xs font-semibold">갱신</span>
          </Button>
        )}
      </div>
    </header>
  );
}
