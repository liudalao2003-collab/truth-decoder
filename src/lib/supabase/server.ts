import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 核心业务说明：
 * 服务端/边缘计算环境的 Supabase 客户端。
 * 负责在 Next.js 16 的 Server Components 或 API Routes 中安全地读取和写入 Cookie。
 * 绝不允许越权，完全遵循当前用户的 RLS 行级安全策略。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Next.js 规则：不能在 Server Component 渲染期间写入 Cookie。
            // 如果在此处抛出异常，说明试图在只读阶段刷新 Token。真正的刷新动作将交由 Middleware 接管。
            if (process.env.NODE_ENV === 'development') {
              console.log('🟡 [模块_异步] -> 目标:', 'Server Component 尝试写入 Cookie 被挂起，交由 Middleware 处理');
            }
          }
        },
      },
    }
  );
}