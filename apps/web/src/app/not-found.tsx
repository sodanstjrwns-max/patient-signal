import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-[#f4f4f8] text-[#111118]">
      <div className="text-[clamp(6rem,18vw,12rem)] font-medium leading-none tracking-[-0.09em] text-[#5b4dff]">404</div>

      <section className="text-center max-w-md">
        <h1 className="text-3xl font-semibold tracking-[-0.055em] text-[#111118] mb-2">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-slate-500">
          주소가 잘못되었거나 페이지가 이동되었을 수 있습니다.
        </p>
      </section>

      <Link
        href="/dashboard"
        className="px-6 py-2.5 bg-[#111118] text-white rounded-none font-semibold hover:bg-[#5b4dff] flex items-center gap-2"
      >
        <Home className="h-4 w-4" />
        대시보드로 이동
      </Link>
    </main>
  );
}
