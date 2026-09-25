import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-[#08090a] text-[#f5f5ef]">
      <div className="text-[clamp(6rem,18vw,12rem)] font-medium leading-none tracking-[-0.09em] text-[#c0c4c7]">404</div>

      <section className="text-center max-w-md">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em] text-[#f5f5ef] mb-2">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-[#959c9f]">
          주소가 잘못되었거나 페이지가 이동되었을 수 있습니다.
        </p>
      </section>

      <Link
        href="/dashboard"
        className="px-6 py-2.5 bg-[#08090a] text-white rounded-none font-semibold hover:bg-[#d9ff43] hover:text-[#08090a] flex items-center gap-2"
      >
        <Home className="h-4 w-4" />
        대시보드로 이동
      </Link>
    </main>
  );
}
