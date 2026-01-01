module.exports = {
  apps: [
    {
      name: 'tvpage-nextjs',              // PM2 应用名
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 6060',
      cwd: '/opt/tvpage-nextjs',           // ⚠️ 改成你真实的项目路径
      instances: 1,                        // Next.js 一般单实例
      exec_mode: 'fork',

      // 环境变量
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_ENV: 'production',
      },

      // 日志
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // 稳定性
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
