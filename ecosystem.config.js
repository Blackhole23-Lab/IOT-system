// pm2 ecosystem 配置文件
module.exports = {
  apps: [
    {
      name: 'iot-system',
      script: './server/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',

      // 生产环境变量
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
      },
      // 开发环境变量
      env_development: {
        NODE_ENV: 'development',
        PORT: process.env.PORT || 3000,
      },

      // 日志
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // 崩溃自动重启
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 2000,

      // 内存超过 512MB 自动重启
      max_memory_restart: '512M',

      // 监听文件变化（生产模式关闭）
      watch: false,

      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
  ],
}
