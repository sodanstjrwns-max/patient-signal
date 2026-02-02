'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPlatformName, getPlatformColor } from '@/lib/utils';

interface PlatformStatsProps {
  data: Record<string, number>;
}

export function PlatformStats({ data }: PlatformStatsProps) {
  const platforms = Object.entries(data).map(([platform, score]) => ({
    name: getPlatformName(platform.toUpperCase()),
    score,
    color: getPlatformColor(platform.toUpperCase()),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">플랫폼별 가시성</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {platforms.map((platform) => (
            <div key={platform.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: platform.color }}
                  />
                  <span className="text-sm font-medium">{platform.name}</span>
                </div>
                <span className="text-sm font-semibold">{platform.score}점</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${platform.score}%`,
                    backgroundColor: platform.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {platforms.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            아직 데이터가 없습니다. 크롤링을 실행해주세요.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
