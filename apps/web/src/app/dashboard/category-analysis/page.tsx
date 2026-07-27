'use client';

// 카테고리 성과는 기회 분석 페이지의 '카테고리 성과' 탭으로 통합되었습니다.
// (C안 병합: "어디가 비었나"를 한 페이지로 — 노출 기회 / Content Gap / 카테고리 성과)
// 기존 북마크/링크 호환을 위해 리다이렉트만 유지합니다.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function CategoryAnalysisRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/opportunities?tab=category');
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        기회 분석 &gt; 카테고리 성과로 이동 중...
      </div>
    </main>
  );
}
