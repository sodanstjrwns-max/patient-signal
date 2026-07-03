import Link from 'next/link';
import { SearchX, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-slate-50">
      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
        <SearchX className="h-10 w-10 text-slate-400" />
      </div>

      <section className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-slate-500">
          주소가 잘못되었거나 페이지가 이동되었을 수 있습니다.
        </p>
      </section>

      <Link
        href="/dashboard"
        className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 flex items-center gap-2"
      >
        <Home className="h-4 w-4" />
        대시보드로 이동
      </Link>
    </main>
  );
}
