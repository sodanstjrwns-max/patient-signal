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
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{title}</h1>
        {desc && (
          <p className="text-xs sm:text-sm text-gray-500 truncate">{desc}</p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">새로고침</span>
            <span className="sm:hidden">갱신</span>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Bell className="h-5 w-5 text-gray-500" />
        </Button>
      </div>
    </header>
  );
}
