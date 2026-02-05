import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://f0b96a709eaa59a93cfa871e59304ede@o4510824390787072.ingest.us.sentry.io/4510824397275136",

  // 프로덕션에서만 활성화
  enabled: process.env.NODE_ENV === "production",

  // 성능 모니터링 (10% 샘플링)
  tracesSampleRate: 0.1,

  // 디버그 모드 끄기
  debug: false,
});
