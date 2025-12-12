module.exports = {
  apps: [
    {
      name: 'neurogrid-mvp',
      script: './mvp-server.js',
      cwd: '/root/neurogrid-new',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      kill_timeout: 5000
    },
    {
      name: 'neurogrid-api',
      script: './src/app.js',
      cwd: '/root/neurogrid-new/coordinator-server',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        LOG_LEVEL: 'info'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000
    },
    {
      name: 'neurogrid-web',
      script: 'npm',
      args: 'start',
      cwd: '/root/neurogrid-new/web-interface',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_URL: 'http://api.neurogrid.network'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '15s',
      kill_timeout: 5000
    }
  ]
};