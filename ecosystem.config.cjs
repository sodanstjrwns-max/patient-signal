module.exports = {
  apps: [
    {
      name: 'patient-signal-api',
      cwd: './apps/api',
      script: 'node',
      args: 'dist/src/main.js',
      env: {
        NODE_ENV: 'development',
        PORT: 4000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'patient-signal-web',
      cwd: './apps/web',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // 샌드박스(RAM 985MB) 전용 힙 제한 — Render/Vercel 운영에는 영향 없음
        NODE_OPTIONS: '--max-old-space-size=400'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
