'use client';

import { Bell, RefreshCw } from 'lucide-react';
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
    <header className="sticky top-0 z-30 glass-strong border-b border-slate-200/50 px-4 sm:px-6 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">{title}</h1>
        {desc && (
          <p className="text-xs sm:text-sm text-slate-500 truncate">{desc}</p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="border-slate-200 bg-white/60 hover:bg-white shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline text-xs">새로고침</span>
            <span className="sm:hidden text-xs">갱신</span>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100">
          <Bell className="h-[18px] w-[18px] text-slate-400" />
        </Button>
      </div>
    </header>
  );
}
