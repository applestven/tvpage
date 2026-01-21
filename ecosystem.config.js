// ecosystem.config.js
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'tvpage-nextjs',

      script: 'npm',
      args: 'run start:prod',

      // 使用当前 ecosystem.config.js 所在目录
      cwd: path.resolve(__dirname),

      exec_mode: 'fork',
      instances: 1,

      env_production: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_ENV: 'production',
      },

      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,

      // 日志也放到项目目录下
      out_file: path.resolve(__dirname, 'logs/out.log'),
      error_file: path.resolve(__dirname, 'logs/error.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
