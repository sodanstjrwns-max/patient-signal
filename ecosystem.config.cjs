module.exports = {
  apps: [
    {
      name: 'patient-signal-api',
      cwd: './apps/api',
      script: 'npm',
      args: 'run start:dev',
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
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
