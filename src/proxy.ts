import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
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
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  // 🚀 获取当前会话状态
  const { data: { user } } = await supabase.auth.getUser();

  // 🛡️ 路由保护逻辑
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // 排除登录页本身，防止死循环重定向
    if (request.nextUrl.pathname === '/admin/login') {
      return response;
    }

    // 如果未登录，或者登录邮箱不是指挥官邮箱，强制打回
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (!user || user.email?.toLowerCase() !== adminEmail?.toLowerCase()) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};