import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint 에러 무시 (빌드 시)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TypeScript 에러 무시 (빌드 시)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry 조직 및 프로젝트
  org: "patientsignal",
  project: "javascript-nextjs",

  // 소스맵 숨기기
  hideSourceMaps: true,

  // 빌드 로그 숨기기
  silent: true,

  // Sentry 로거 비활성화
  disableLogger: true,
});
