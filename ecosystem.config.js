module.exports = {
  apps: [
    {
      name: 'tvpage-nextjs',

      // ⭐ 唯一推荐方式
      script: 'npm',
      args: 'run start:prod',

      // ⭐ 一定是项目根目录
      cwd: '/root/code/tvpage',

      exec_mode: 'fork',
      instances: 1,

      env_production: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_ENV: 'production',
      },

      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,

      // ⭐ 用绝对路径，避免歧义
      out_file: '/root/code/tvpage/logs/out.log',
      error_file: '/root/code/tvpage/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
