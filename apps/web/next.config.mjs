import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withSentryConfig(nextConfig, {
  // Sentry 설정
  org: "patientsignal",
  project: "patient-signal",

  // 소스맵 업로드 (에러 추적에 필요)
  silent: !process.env.CI,
  
  // 빌드 시 소스맵 숨기기
  hideSourceMaps: true,

  // 클라이언트 번들에 Sentry 자동 포함
  disableLogger: true,
});
