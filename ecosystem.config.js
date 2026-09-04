/**
 * PM2 配置文件
 * 用于生产环境进程管理
 * 
 * 使用方法:
 * 1. 安装 PM2: npm install -g pm2
 * 2. 启动服务: pm2 start ecosystem.config.js
 * 3. 查看状态: pm2 status
 * 4. 查看日志: pm2 logs
 * 5. 停止服务: pm2 stop all
 * 6. 开机自启: pm2 startup && pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'math-learning-backend',
      cwd: './backend',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    {
      name: 'mcq-extractor',
      cwd: './mcq-extractor',
      script: 'python',
      args: '-m uvicorn main:app --port 8000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PYTHONUNBUFFERED: '1'
      },
      error_file: './logs/mcq-extractor-error.log',
      out_file: './logs/mcq-extractor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    {
      // MinerU API Service - document parsing with math formula → LaTeX conversion
      // Requires: pip install "mineru[pipeline]" and model download (run scripts/install-mineru.ps1)
      name: 'mineru-api',
      script: 'mineru-api',
      args: '--host 127.0.0.1 --port 8080',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '4G', // MinerU uses significant memory for model inference
      env: {
        PYTHONUNBUFFERED: '1'
      },
      error_file: './logs/mineru-api-error.log',
      out_file: './logs/mineru-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
    // 前端通常由 Nginx 或后端提供静态文件服务
    // 如需独立运行前端开发服务器，取消下方注释
    // {
    //   name: 'math-learning-frontend',
    //   cwd: './frontend',
    //   script: 'npm',
    //   args: 'run preview',
    //   instances: 1,
    //   autorestart: true,
    //   watch: false,
    //   env: {
    //     NODE_ENV: 'production'
    //   }
    // }
  ]
};