'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn, getScoreColor, getScoreBgColor, getScoreLabel } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ScoreCardProps {
  title: string;
  score: number;
  change?: number;
  description?: string;
  icon?: React.ReactNode;
}

export function ScoreCard({ title, score, change, description, icon }: ScoreCardProps) {
  const getTrendIcon = () => {
    if (!change || change === 0) return <Minus className="h-4 w-4 text-gray-400" />;
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getTrendColor = () => {
    if (!change || change === 0) return 'text-gray-500';
    if (change > 0) return 'text-green-600';
    return 'text-red-600';
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={cn('text-3xl font-bold', getScoreColor(score))}>
                {score}
              </span>
              <span className="text-sm text-gray-500">/ 100</span>
            </div>
            {change !== undefined && (
              <div className={cn('flex items-center gap-1 mt-1', getTrendColor())}>
                {getTrendIcon()}
                <span className="text-sm font-medium">
                  {change > 0 ? '+' : ''}{change}점
                </span>
                <span className="text-xs text-gray-400">vs 지난주</span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-full', getScoreBgColor(score))}>
            {icon || (
              <span className={cn('text-lg font-bold', getScoreColor(score))}>
                {getScoreLabel(score)}
              </span>
            )}
          </div>
        </div>
        {description && (
          <p className="mt-3 text-sm text-gray-500">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
