import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

// 🛡️ 强制定义数据库行契约，彻底消灭 unknown 键名引发的编译阻断
interface SystemConfigRow {
  id: string;
  value: unknown;
  updated_at?: string;
}

// 🛡️ 强制鉴权
async function verifyCommander() { 
   const cookieStore = await cookies(); 
   const token = cookieStore.get('truth_admin_token'); 
   
   // 🚀 核心修复：修复语法撕裂，并引入符合防线标准的脱敏日志打印 
   const safeTokenLog = token?.value ? "********(已隐匿)" : "无"; 
   console.log("🔐 [API鉴权] 当前携带的 Token = ", safeTokenLog); 
   
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
    
    // 🚀 核心修复：注入 SystemConfigRow 契约，明确规定 row.id 为 string 类型
    const configMap = (data || []).reduce((acc: Record<string, unknown>, row: SystemConfigRow) => ({ 
        ...acc, 
        [row.id]: row.value 
    }), {});
    
    return NextResponse.json({ success: true, data: configMap });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown Database Error';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  console.log("📡 [API-POST] 收到修改配置请求！");
  if (!(await verifyCommander())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 🚀 核心修复：为请求体载荷注入严密类型，拒绝 any 的隐式推导
    const payload = await req.json() as { id: string; value: unknown };
    const { id, value } = payload;
    
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
    
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown Server Error';
    console.error("❌ [API-POST] 致命错误:", errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}