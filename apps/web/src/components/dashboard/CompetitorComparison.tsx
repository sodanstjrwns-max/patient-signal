'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, getScoreColor } from '@/lib/utils';
import { Trophy, Users, Crown } from 'lucide-react';

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
  const maxScore = Math.max(...allHospitals.map(h => h.score), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-brand-100">
              <Users className="h-4 w-4 text-brand-600" />
            </div>
            경쟁사 비교
          </CardTitle>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-50 border border-amber-100">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700">{myRank}위</span>
            <span className="text-xs text-amber-500">/ {allHospitals.length}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {allHospitals.slice(0, 10).map((hospital, index) => (
            <div
              key={hospital.name}
              className={cn(
                'flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-200',
                hospital.isMe 
                  ? 'bg-brand-50/80 border border-brand-200/60 shadow-sm' 
                  : 'bg-white/60 backdrop-blur-sm border border-slate-100/80 hover:bg-white/80 hover:shadow-card'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm',
                  index === 0
                    ? 'bg-gradient-to-br from-amber-200 to-yellow-300 text-amber-800 shadow-sm'
                    : index === 1
                    ? 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700'
                    : index === 2
                    ? 'bg-gradient-to-br from-orange-200 to-amber-200 text-orange-800'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                {index === 0 ? <Crown className="w-4 h-4" /> : index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'font-medium truncate text-sm',
                      hospital.isMe && 'text-brand-700 font-semibold'
                    )}
                  >
                    {hospital.name}
                  </span>
                  {hospital.isMe && (
                    <span className="px-2 py-0.5 bg-brand-100 text-brand-700 text-xs rounded-full font-medium">
                      내 병원
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        hospital.isMe ? 'bg-brand-500' : 'bg-slate-300'
                      )}
                      style={{ width: `${(hospital.score / maxScore) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    언급 {hospital.mentionCount}회
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className={cn('text-lg font-bold', getScoreColor(hospital.score))}>
                  {hospital.score}
                </span>
                <span className="text-xs text-slate-400 ml-0.5">점</span>
              </div>
            </div>
          ))}
        </div>
        {competitors.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">등록된 경쟁사가 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">경쟁사를 추가해보세요.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
