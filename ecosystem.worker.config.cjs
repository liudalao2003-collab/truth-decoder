/**
 * PM2：常驻 generation Worker（云 VPS / Oracle Free 等）。
 * 用法：pm2 start ecosystem.worker.config.cjs
 * 需在仓库根目录放置 .env 或 .env.local（含 Supabase 与 DeepSeek）。
 */
const path = require('path');
const isWindows = process.platform === 'win32';
const nodeBin = isWindows ? 'node.exe' : 'node';

module.exports = {
  apps: [
    {
      name: 'truth-decoder-worker',
      cwd: path.resolve(__dirname),
      script: nodeBin,
      args: '--import tsx scripts/generation-worker.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 80,
      min_uptime: '8s',
      exp_backoff_restart_delay: 2000,
      max_memory_restart: '900M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
