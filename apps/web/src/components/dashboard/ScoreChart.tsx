'use client';

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ScoreChartProps {
  data: {
    scoreDate: string;
    overallScore: number;
    mentionCount?: number;
  }[];
  title?: string;
  subtitle?: string;
}

export function ScoreChart({ data, title = 'AI 가시성 점수 추이', subtitle }: ScoreChartProps) {
  const chartData = data.map((item) => ({
    date: new Date(item.scoreDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    score: item.overallScore,
    mentions: item.mentionCount || 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {subtitle && (
          <p className="text-xs text-[#959c9f] font-medium mt-1">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff6a24" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ff6a24" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#30343a" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#959c9f' }}
                tickLine={false}
                axisLine={{ stroke: '#30343a' }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: '#959c9f' }}
                tickLine={false}
                axisLine={{ stroke: '#30343a' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#181b1e',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid #30343a', color: '#f5f5ef',
                  borderRadius: '2px',
                  boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.08)',
                  padding: '12px 16px',
                }}
                labelStyle={{ color: '#c0c4c7', fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#ff6a24"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorScore)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
