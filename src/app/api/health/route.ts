import { NextResponse } from 'next/server';

/**
 * 公开健康检查：返回当前构建所绑定的 Supabase 主机名（不含密钥），便于核对本地与 Vercel 是否同一项目。
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseHost: string | null = null;
  try {
    if (url) {
      supabaseHost = new URL(url).hostname;
    }
  } catch {
    supabaseHost = null;
  }

  return NextResponse.json({
    ok: true,
    supabaseHost,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
