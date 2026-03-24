import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { passcode } = await req.json();
    const serverPass = process.env.ADMIN_PASSCODE;

    // 🚨 这里的日志会直接出现在你的 VS Code 终端里
    console.log("-----------------------------------------");
    console.log("🔐 [DEBUG] 正在核对指挥官权限...");
    console.log("📡 [收到请求] 用户输入:", `[${passcode}]`);
    console.log("📦 [后端读取] 环境变量:", `[${serverPass}]`);
    
    if (passcode === serverPass && serverPass !== undefined) {
      console.log("✅ [结果] 匹配成功，准予进入！");
      (await cookies()).set('truth_admin_token', 'ACCESS_GRANTED_2026', { 
        maxAge: 60 * 60 * 24 * 7, 
        httpOnly: true,
        path: '/'
      });
      return NextResponse.json({ success: true });
    }
    
    console.log("❌ [结果] 匹配失败：密码不一致或环境变量未读取");
    return NextResponse.json({ success: false }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}