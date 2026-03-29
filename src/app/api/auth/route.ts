import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 核心业务说明：
 * C端与 B端通用的身份签发网关。
 * 接收前端的账号密码，调用 Supabase Auth 签发 JWT。
 * 依赖 `@supabase/ssr` 底层机制，成功登录后会自动将 Session 注入浏览器的 Cookie 中。
 */
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (process.env.NODE_ENV === 'development') {
      const maskedEmail = email ? `${email.substring(0, 3)}***` : "EMPTY";
      console.log('🟢 [模块_发起] -> 动作/参数:', `请求核心数据库核验身份: [${maskedEmail}]`);
    }

    // 唤醒服务端重装步兵客户端
    const supabase = await createClient();

    // 向 Supabase 核心发起验证请求
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因:', error?.message || '凭证无效或被拒绝访问');
      }
      return NextResponse.json({ success: false, error: 'Unauthorized Access' }, { status: 401 });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔵 [模块_成功] -> 产物:', `指挥官身份验证通过, 分配独立 Session, UserID: ${data.user.id}`);
    }

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : '身份验证服务遭遇未知物理崩塌';
    if (process.env.NODE_ENV === 'development') {
      console.log('🔴 [模块_崩溃] -> 原因:', errMsg);
    }
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}