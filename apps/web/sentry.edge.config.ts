import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 프로덕션에서만 활성화
  enabled: process.env.NODE_ENV === "production",

  // 성능 모니터링 (10% 샘플링)
  tracesSampleRate: 0.1,

  // 디버그 모드 (개발 시에만)
  debug: false,
});
