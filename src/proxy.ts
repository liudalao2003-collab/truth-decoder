import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * 核心业务说明：
 * 全局边缘巡逻器 (Edge Middleware)。
 * 彻底废弃旧版 truth_admin_token，采用 Supabase SSR 方案。
 * 在此层强制同步 Cookie 会话，并对 /admin 核心区进行物理隔离。
 */
export async function proxy(request: NextRequest) {
  // 1. 初始化并缝合 Edge 会话响应体
  let response = NextResponse.next({
    request,
  });

  // 2. 建立边缘环境下的只读/只写客户端
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 同步请求链路
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          // 同步响应链路
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;

  // 3. 核心防线：拦截所有 /admin 且非 /admin/login 的请求
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    // 强制校验底层 JWT 令牌的合法性
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因:', '边缘巡逻器拦截到未授权访问，强制遣送至暗门');
      }
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return response;
}

// 设定巡逻范围
export const config = {
  matcher: ['/admin/:path*'],
};