"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Sentry 테스트 페이지</h1>
        <p className="text-gray-600 mb-6">버튼을 클릭하면 테스트 에러가 Sentry로 전송됩니다.</p>
        <button
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          onClick={() => {
            Sentry.captureException(new Error("Sentry 테스트 에러 - Patient Signal"));
          }}
        >
          테스트 에러 발생
        </button>
      </div>
    </div>
  );
}
