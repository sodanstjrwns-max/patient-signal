'use client';

// 주간 리포트는 ABHS 분석 리포트에 흡수되었습니다.
// 동일한 데이터 소스(useABHS/useWeeklyScore/useMentionInsight/useCompetitiveShare/useActionIntelligence)를
// 두 페이지에서 중복 렌더링하던 것을 통합 — 기존 북마크/링크 호환을 위해 리다이렉트만 유지합니다.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ReportRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/analytics');
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        ABHS 분석 리포트로 이동 중...
      </div>
    </main>
  );
}
