# 云 VPS 常驻 Worker（0 月费最优路径）

长耗时 AI（卷宗 / 终端 / 情报体征 / 翻译）由 `generation_jobs` 表 + **本进程**消费。Vercel 只负责网站与短 API；**Worker 必须长期在线**，建议放在 **免费云 VPS**（如 Oracle Cloud Always Free ARM），避免依赖个人电脑。

## 1. 准备云主机

- 系统：Ubuntu 22.04/24.04 LTS
- 规格：1 OCPU / 1GB RAM 可跑（队列不深时够用）
- 安全组：**出站**允许 HTTPS（访问 Supabase、DeepSeek）

## 2. 安装 Node 20+

```bash
# 示例：NodeSource（以官方文档为准）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 3. 拉代码与密钥

```bash
sudo mkdir -p /opt && sudo chown "$USER":"$USER" /opt
cd /opt
git clone https://github.com/YOUR_ORG/truth-decoder.git
cd truth-decoder
```

复制 `.env.worker.example` 为 `.env.local`，填入：

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（与 Vercel 环境一致）
- `DEEPSEEK_API_KEY`

## 4. 一键安装 PM2 + Worker

```bash
chmod +x scripts/setup-worker-vps.sh
./scripts/setup-worker-vps.sh
```

按提示执行 `npx pm2 startup` 输出的 `sudo env PATH=...` 一行，实现**开机自启**。

## 5. 更新部署

```bash
cd /opt/truth-decoder
git pull origin main
npm ci
npm run worker:pm2:reload
```

## 6. 运维命令

| 命令 | 说明 |
|------|------|
| `npx pm2 logs truth-decoder-worker` | 实时日志 |
| `npx pm2 status` | 进程状态 |
| `npx pm2 restart truth-decoder-worker` | 硬重启 |
| `npm run worker:pm2:reload` | 重载并刷新环境变量 |

## 7. 不用 PM2 时

可使用 `scripts/systemd/truth-decoder-worker.service`，修改 `User`、`WorkingDirectory`、`ExecStart` 后：

```bash
sudo cp scripts/systemd/truth-decoder-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now truth-decoder-worker
```

---

**注意**：Oracle 免费机「抢配额」因地区而异；若无法开通，可换其它长期在线的低成本或免费档，原则不变：**Worker 与网站分离、进程守护、仅出站 HTTPS。**
