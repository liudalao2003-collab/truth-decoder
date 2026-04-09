# Truth Decoder · 商业叙事解码器

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind">
  <img src="https://img.shields.io/badge/AI-DeepSeek--V3-green?style=flat-square" alt="DeepSeek">
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase" alt="Supabase">
</p>

> **拒绝“摘要”，交付“情报”。**
> 把长篇通稿、公关话术、财报叙事，拆成你能决策的「硬事实 + 风险结构」。Truth Decoder 是一款面向高阶分析师的叙事情报挖掘平台。

---

## 📸 产品展示

| Secure Gate 指挥台 | 终局裁定与导出 |
|:---:|:---:|
| ![Secure Gate 首页](./docs/screenshots/01-home-secure-gate.png?raw=true) | ![终局裁定](./docs/screenshots/02-verdict-export.png?raw=true) |

| Intel Signature 情报体征 | 利益相关方与核验清单 |
|:---:|:---:|
| ![情报体征](./docs/screenshots/03-intel-signature.jpg?raw=true) | ![利益链与核验](./docs/screenshots/04-stakeholder-verification.jpg?raw=true) |

| 原文深读与 Deep Insight | Pro Terminal 深度追问 |
|:---:|:---:|
| ![原文高亮](./docs/screenshots/05-deep-insight-source.jpg?raw=true) | ![Pro 终端](./docs/screenshots/06-pro-terminal.png?raw=true) |

---

## 🎯 核心痛点与回应

| 市场痛点 | Truth Decoder 的回应 |
| :--- | :--- |
| **信息过载**：读完通稿仍不知输赢 | [cite_start]**剥离粉饰**：直接拆解「表层叙事 → 机制 → 代价」 [cite: 9] |
| **逻辑缺失**：摘要丢掉了因果链 | [cite_start]**结构输出**：交付利益相关方链、叙事杠杆与认识论缺口 [cite: 13] |
| **AI 幻觉**：无法追溯结论来源 | [cite_start]**锚点原文**：所有裁定均强制关联原文证据 [cite: 556] |
| **决策滞后**：难以快速识别风险 | [cite_start]**暗影卷宗**：深度解构隐藏契约与博弈逻辑 [cite: 558] |

---

## 🚀 亮点功能

### 1. Secure Gate 指挥台
[cite_start]粘贴即拦截。支持 **CN / EN** 双语切换，顶层感知 **COMMANDER_ACTIVE** 引擎状态，实现毫秒级叙事捕获 [cite: 158]。

### 2. Intel Signature (情报体征)
[cite_start]基于四维雷达图（叙事杠杆、利益张力、行动压力、可验证性）进行对抗式素描，自动生成高管级“一页纸研判” [cite: 1246, 1249]。

### 3. 暗影卷宗 (Shadow Dossier)
[cite_start]引入麦肯锡 MECE、杜邦分析及博弈论模型。对原文进行“剥洋葱”式的逻辑展开，注入 20-30 个深度注脚揭露底层机制 [cite: 540, 558]。

### 4. Pro Terminal (深度审讯终端)
[cite_start]在已确认的硬事实之上，使用指令式追问继续“审讯”。系统注入“华尔街做空机构”人格，粉碎一切“向好”幻想 [cite: 525, 526]。

---

## 🛠️ 技术架构

### 核心栈
- [cite_start]**前端/路由**: [Next.js 16 (App Router)](https://nextjs.org/) [cite: 14]
- [cite_start]**交互/状态**: [React 19](https://react.dev/), [Framer Motion](https://www.framer.com/motion/) [cite: 14, 60]
- [cite_start]**样式**: [Tailwind CSS 4](https://tailwindcss.com/) [cite: 51]
- [cite_start]**数据/鉴权**: [Supabase](https://supabase.com/) (`@supabase/ssr`) [cite: 15, 43]
- [cite_start]**大脑**: [DeepSeek V3 API](https://www.deepseek.com/) (通过环境变量配置) [cite: 16]

### 基础设施
- [cite_start]**缓存/限流**: [Upstash Redis](https://upstash.com/) [cite: 15, 1877]
- [cite_start]**支付网关**: [Stripe](https://stripe.com/) [cite: 15, 348]
- [cite_start]**导出服务**: [Playwright](https://playwright.dev/) (用于高精度 PDF 渲染) [cite: 664, 1758]

---

## 📦 快速开始

### 1. 环境准备
- Node.js 20+
- 已配置的 Supabase 项目
- DeepSeek API Key

### 2. 安装与运行
```bash
# 克隆仓库
git clone [https://github.com/liudalao2003-collab/truth-decoder.git](https://github.com/liudalao2003-collab/truth-decoder.git)
cd truth-decoder

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的密钥

# 启动开发服务器
npm run dev
````

### 3\. 环境变量配置

| 变量名 | 说明 |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 |
| `SUPABASE_SERVICE_ROLE_KEY` | [cite_start]服务端权限密钥（必须） [cite: 18] |
| `DEEPSEEK_API_KEY` | [cite_start]核心 AI 引擎密钥 [cite: 19] |
| `STRIPE_SECRET_KEY` | [cite_start]支付配置（可选） [cite: 20] |
| `INGEST_TOKEN` | [cite_start]机器人/脚本调用的鉴权令牌 [cite: 19] |

-----

## 🛡️ 安全与规范

  - [cite_start]**密钥保护**：严禁将 AI Key 写入前端代码或提交至 Git 仓库 [cite: 21]。
  - [cite_start]**合规说明**：产品输出仅用于辅助研究，不构成任何投资建议 [cite: 21]。
  - [cite_start]**物理隔离**：管理员路由受邮件白名单保护（`NEXT_PUBLIC_ADMIN_EMAIL`） [cite: 49]。

-----

## 🗺️ 路线图

  - [ ] 更强的段落级引用与溯源
  - [ ] 团队协作与私有知识库
  - [ ] 行业模板（财报 / 政策 / 并购）

-----

## 📄 许可证

本项目暂未指定开源许可证。使用前请联系维护者确认使用范围。

-----

## English Brief

**Truth Decoder** is a narrative-intelligence workbench for dense official text. It goes beyond summarization: **Intel Signature** metrics, **Shadow Dossiers** (McKinsey-style analysis), **Verification Checklists**, and a **Pro Terminal** for directive-driven interrogation.
Powered by Next.js 16, React 19, and DeepSeek.

-----

\<p align="center"\>
\<b\>如果这个项目对你有用，欢迎 Star ⭐。\</b\>
\</p\>
