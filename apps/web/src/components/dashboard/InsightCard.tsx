'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, Sparkles } from 'lucide-react';

interface InsightCardProps {
  insights: string[];
  title?: string;
}

export function InsightCard({ insights, title = '주간 인사이트' }: InsightCardProps) {
  const getIcon = (insight: string) => {
    if (insight.includes('🎉') || insight.includes('✨')) {
      return <Sparkles className="h-5 w-5 text-yellow-500" />;
    }
    if (insight.includes('⚠️')) {
      return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    }
    if (insight.includes('📈')) {
      return <TrendingUp className="h-5 w-5 text-green-500" />;
    }
    if (insight.includes('📉')) {
      return <TrendingDown className="h-5 w-5 text-red-500" />;
    }
    return <Lightbulb className="h-5 w-5 text-blue-500" />;
  };

  // 이모지 제거 함수
  const removeEmoji = (text: string) => {
    return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {insights.map((insight, index) => (
            <li
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              {getIcon(insight)}
              <span className="text-sm text-gray-700">{removeEmoji(insight)}</span>
            </li>
          ))}
        </ul>
        {insights.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            아직 인사이트가 없습니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
