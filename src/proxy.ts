import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 🚨 核心修复：必须命名为 proxy
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🛡️ 保护所有 /admin 下的路由，但放行 /admin/login 本身
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('truth_admin_token');
    
    // 如果没有通行证，或者通行证造假，直接遣送回暗门入口
    if (!token || token.value !== 'ACCESS_GRANTED_2026') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }
  
  return NextResponse.next();
}

// 配置保安的巡逻范围
export const config = {
  matcher: ['/admin/:path*'],
};