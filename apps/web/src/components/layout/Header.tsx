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
    <header className="sticky top-0 z-30 glass-solid border-b border-white/30 px-4 sm:px-6 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate">{title}</h1>
        {desc && (
          <p className="text-xs sm:text-sm text-slate-500 truncate font-medium">{desc}</p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="glass border-white/40 hover:bg-white/60 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline text-xs font-semibold">새로고침</span>
            <span className="sm:hidden text-xs font-semibold">갱신</span>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/40">
          <Bell className="h-[18px] w-[18px] text-slate-400" />
        </Button>
      </div>
    </header>
  );
}
