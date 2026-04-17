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
      return <TrendingUp className="h-5 w-5 text-emerald-500" />;
    }
    if (insight.includes('📉')) {
      return <TrendingDown className="h-5 w-5 text-red-500" />;
    }
    return <Lightbulb className="h-5 w-5 text-brand-500" />;
  };

  const removeEmoji = (text: string) => {
    return text.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, '').replace(/[\u2600-\u27BF]/g, '').trim();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-100">
            <Lightbulb className="h-4 w-4 text-amber-600" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          {insights.map((insight, index) => (
            <li
              key={index}
              className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-100/80 hover:bg-white/80 hover:shadow-card transition-all duration-200"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(insight)}
              </div>
              <span className="text-sm text-slate-700 leading-relaxed">{removeEmoji(insight)}</span>
            </li>
          ))}
        </ul>
        {insights.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Lightbulb className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">아직 인사이트가 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
