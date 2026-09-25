import Link from 'next/link';
import { SearchX, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-[#f6f7f9] text-[#17212e]">
      <div className="w-16 h-16 bg-[#eff4ff] rounded-[16px] flex items-center justify-center">
        <SearchX className="h-8 w-8 text-[#285cf4]" />
      </div>

      <section className="text-center max-w-md">
        <h1 className="text-2xl font-bold tracking-[-0.04em] text-[#17212e] mb-2">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-slate-500">
          주소가 잘못되었거나 페이지가 이동되었을 수 있습니다.
        </p>
      </section>

      <Link
        href="/dashboard"
        className="px-6 py-2.5 bg-[#285cf4] text-white rounded-[10px] font-semibold hover:bg-[#204bce] flex items-center gap-2"
      >
        <Home className="h-4 w-4" />
        대시보드로 이동
      </Link>
    </main>
  );
}
