import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🚨 架构师战术突围：针对 Next.js 16.1.6 引擎定制
  // 1. 彻底移除已废弃的 eslint 配置节点，消除引擎校验警告
  // 2. 逃生舱已物理关闭：恢复严格的 TypeScript 编译期校验，确保 Vercel 零故障交付
  typescript: {
    ignoreBuildErrors: false,
  }
};

export default nextConfig;