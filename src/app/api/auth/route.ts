import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

export async function POST(req: Request) {
  try {
    const { passcode } = await req.json();
    const serverPass = process.env.ADMIN_PASSCODE;

    // 🚨 架构师修复：使用统一 logger 并包裹环境检查，防止 Vercel 日志泄露密码
    if (process.env.NODE_ENV === 'development') {
      console.log("-----------------------------------------");
      console.log("🔐 [DEBUG] 正在核对指挥官权限...");
      // 对敏感字符执行脱敏处理，即使在开发环境也保持警惕
      const maskedPass = passcode ? `${passcode.substring(0, 2)}****` : "EMPTY";
      console.log("📡 [收到请求] 用户输入:", `[${maskedPass}]`);
    }
    
    if (passcode === serverPass && serverPass !== undefined) {
      logger.success("指挥官身份验证通过，准予进入中控台");
      (await cookies()).set('truth_admin_token', 'ACCESS_GRANTED_2026', { 
        maxAge: 60 * 60 * 24 * 7, 
        httpOnly: true,
        path: '/'
      });
      return NextResponse.json({ success: true });
    }
    
    logger.crash("身份验证失败：凭证不匹配");
    return NextResponse.json({ success: false }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}