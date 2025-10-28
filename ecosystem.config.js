module.exports = {
  apps: [
    {
      name: 'neurogrid-api',
      cwd: './coordinator-server',
      script: 'src/app.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        LOG_LEVEL: 'info'
      },
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      error_file: '/var/log/neurogrid/api-error.log',
      out_file: '/var/log/neurogrid/api-out.log',
      log_file: '/var/log/neurogrid/api.log',
      time: true,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      source_map_support: true
    },
    {
      name: 'neurogrid-web',
      cwd: './web-interface',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 10,
      error_file: '/var/log/neurogrid/web-error.log',
      out_file: '/var/log/neurogrid/web-out.log',
      log_file: '/var/log/neurogrid/web.log',
      time: true,
      autorestart: true,
      watch: false
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'https://github.com/mikagit25/neurogrid.git',
      path: '/var/www/neurogrid',
      'pre-deploy-local': '',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};