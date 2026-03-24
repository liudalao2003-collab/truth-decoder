import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🚀 只保留 TypeScript 强行忽略，顺应 Next.js 16 规则
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;