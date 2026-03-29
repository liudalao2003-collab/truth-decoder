import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 核心业务说明：
 * Edge 运行时下的会话缝合器。
 * 解决 Vercel Edge 环境下 Cookie 上下文撕裂的问题。
 * 它的核心任务是在用户每次发起请求时，检查 JWT 是否过期，并在必要时自动刷新它，
 * 然后将新的 Token 同时写回 Request 和 Response，确保整个链路的状态绝对一致。
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 同步更新进来的请求
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          
          supabaseResponse = NextResponse.next({
            request,
          });
          
          // 同步更新发出的响应
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 触发一次 getUser，强制底层检验 Token 有效性并执行刷新逻辑
  const { data: { user }, error } = await supabase.auth.getUser();

  if (process.env.NODE_ENV === 'development') {
    if (user) {
      console.log('🔵 [模块_成功] -> 产物:', `边缘巡逻器已捕获合法会话, UserID: ${user.id}`);
    } else if (error) {
      console.log('🟡 [模块_异步] -> 目标:', '当前为匿名请求，未捕获到登录会话');
    }
  }

  return supabaseResponse;
}