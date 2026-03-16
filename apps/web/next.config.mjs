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

export default nextConfig;
