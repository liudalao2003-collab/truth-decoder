import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

// 🛡️ 强制鉴权
async function verifyCommander() {
  const cookieStore = await cookies();
  const token = cookieStore.get('truth_admin_token');
  console.log("🔐 [API鉴权] 当前携带的 Token:", token?.value || "无");
  return token?.value === 'ACCESS_GRANTED_2026';
}

export async function GET() {
  console.log("📡 [API-GET] 收到读取配置请求！");
  if (!(await verifyCommander())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data, error } = await supabaseAdmin.from('system_configs').select('*');
    if (error) {
      console.error("❌ [API-GET] 数据库查询失败:", error.message);
      throw error;
    }
    console.log("✅ [API-GET] 从 Supabase 成功拉取配置条数:", data?.length);
    const configMap = data.reduce((acc: any, row: any) => ({ ...acc, [row.id]: row.value }), {});
    return NextResponse.json({ success: true, data: configMap });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  console.log("📡 [API-POST] 收到修改配置请求！");
  if (!(await verifyCommander())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, value } = await req.json();
    console.log(`📝 [API-POST] 准备写入 Supabase -> 键: [${id}], 值:`, value);
    
    const { error } = await supabaseAdmin
      .from('system_configs')
      .upsert({ id, value, updated_at: new Date().toISOString() });

    if (error) {
      console.error("❌ [API-POST] 数据库写入失败:", error.message);
      throw error;
    }
    console.log("✅ [API-POST] 写入 Supabase 成功！");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ [API-POST] 致命错误:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}