'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, getScoreColor } from '@/lib/utils';
import { Trophy, Users } from 'lucide-react';

interface CompetitorData {
  name: string;
  score: number;
  mentionCount: number;
  isMe?: boolean;
}

interface CompetitorComparisonProps {
  myHospital: {
    name: string;
    score: number;
    mentionCount: number;
  };
  competitors: CompetitorData[];
}

export function CompetitorComparison({ myHospital, competitors }: CompetitorComparisonProps) {
  const allHospitals = [
    { ...myHospital, isMe: true },
    ...competitors.map((c) => ({ ...c, isMe: false })),
  ].sort((a, b) => b.score - a.score);

  const myRank = allHospitals.findIndex((h) => h.isMe) + 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            경쟁사 비교
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span>내 순위: </span>
            <span className="font-bold text-blue-600">{myRank}위</span>
            <span className="text-gray-500">/ {allHospitals.length}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allHospitals.slice(0, 10).map((hospital, index) => (
            <div
              key={hospital.name}
              className={cn(
                'flex items-center gap-4 p-3 rounded-lg transition-colors',
                hospital.isMe ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                  index === 0
                    ? 'bg-yellow-100 text-yellow-700'
                    : index === 1
                    ? 'bg-gray-200 text-gray-700'
                    : index === 2
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-600'
                )}
              >
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'font-medium truncate',
                      hospital.isMe && 'text-blue-700'
                    )}
                  >
                    {hospital.name}
                  </span>
                  {hospital.isMe && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      내 병원
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  언급 {hospital.mentionCount}회
                </div>
              </div>
              <div className="text-right">
                <span className={cn('text-lg font-bold', getScoreColor(hospital.score))}>
                  {hospital.score}
                </span>
                <span className="text-sm text-gray-500">점</span>
              </div>
            </div>
          ))}
        </div>
        {competitors.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            등록된 경쟁사가 없습니다. 경쟁사를 추가해보세요.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
