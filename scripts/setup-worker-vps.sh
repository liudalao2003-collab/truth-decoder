#!/usr/bin/env bash
# 在 Ubuntu/Debian 云主机上首次部署 Worker（Oracle Free / 其它 VPS）
# 用法：chmod +x scripts/setup-worker-vps.sh && ./scripts/setup-worker-vps.sh
# 使用项目内 pm2（npm ci 后 npx pm2），无需全局安装 PM2。

set -euo pipefail

echo "==> TruthDecoder Worker VPS 安装（需已安装 Node 20+ 与 git）"

if ! command -v node >/dev/null 2>&1; then
  echo "请先安装 Node.js 20+（推荐 nvm 或 NodeSource）"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.local ]] && [[ ! -f .env ]]; then
  echo "未找到 .env.local 或 .env。请复制 .env.worker.example 为 .env.local 并填入密钥后再运行。"
  exit 1
fi

npm ci

echo "==> 启动 / 重载 Worker（项目内 npx pm2）"
npx pm2 start ecosystem.worker.config.cjs 2>/dev/null || npx pm2 reload ecosystem.worker.config.cjs --update-env

npx pm2 save
echo "==> 配置开机自启（需 sudo；若失败可忽略，改用手动 crontab @reboot）"
npx pm2 startup systemd -u "${USER}" --hp "${HOME}" || true

echo "==> 完成。常用命令（在 $ROOT 下）："
echo "    npx pm2 logs truth-decoder-worker"
echo "    npx pm2 status"
echo "    npm run worker:pm2:reload"
echo "    git pull && npm ci && npm run worker:pm2:reload"
