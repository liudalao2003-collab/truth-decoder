import { createBrowserClient } from '@supabase/ssr';

/**
 * 核心业务说明：
 * C端浏览器环境的 Supabase 客户端。
 * 负责在客户端组件 (如 "use client" 的页面) 中维持用户的登录态。
 * 它的底层逻辑会自动在浏览器的 Cookie 中寻找并携带 JWT 令牌。
 */
export function createClient() {
  if (process.env.NODE_ENV === 'development') {
    console.log('🟢 [模块_发起] -> 动作/参数:', '唤醒 Browser Supabase 客户端');
  }
  
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}