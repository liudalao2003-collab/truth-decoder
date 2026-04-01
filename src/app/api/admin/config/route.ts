import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/utils/logger';

interface SystemConfigRow {
  id: string;
  value: unknown;
  updated_at?: string;
}

// 🛡️ 强制鉴权对齐
async function verifyCommander() { 
   // 🚨 架构师修复：废弃硬编码 Cookie，强制走 Supabase 核验
   const supabase = await createClient();
   const { data: { user } } = await supabase.auth.getUser();
   const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
   
   if (!user || user.email?.toLowerCase() !== adminEmail?.toLowerCase()) {
       logger.crash(`[API鉴权] 阻截非法请求。当前用户: ${user?.email || '未登录'}`);
       return false;
   }
   return true;
}

export async function GET() {
  logger.start("[API-GET] 接收读取配置请求");
  if (!(await verifyCommander())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    logger.async("向 Supabase 发起配置树查询");
    const { data, error } = await supabaseAdmin.from('system_configs').select('*');
    if (error) {
      logger.crash(`数据库查询失败: ${error.message}`);
      throw error;
    }
    
    logger.success(`从 Supabase 成功拉取配置条数: ${data?.length}`);
    const configMap = (data || []).reduce((acc: Record<string, unknown>, row: SystemConfigRow) => ({ 
        ...acc, 
        [row.id]: row.value 
    }), {});

    return NextResponse.json({ success: true, data: configMap });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown Database Error';
    logger.crash(`获取配置异常: ${errMsg}`);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  logger.start("[API-POST] 接收修改配置请求");

  if (!(await verifyCommander())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await req.json() as { id: string; value: unknown };
    const { id, value } = payload;
    
    logger.async(`准备写入 Supabase -> 键: [${id}]`);
    const { error } = await supabaseAdmin
      .from('system_configs')
      .upsert({ id, value, updated_at: new Date().toISOString() });

    if (error) {
      logger.crash(`数据库写入失败: ${error.message}`);
      throw error;
    }
    
    logger.success(`写入 Supabase 成功 -> 键: [${id}]`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown Server Error';
    logger.crash(`[API-POST] 致命错误: ${errMsg}`);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}