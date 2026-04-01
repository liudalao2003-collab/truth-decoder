import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/utils/logger';

/**
 * 核心业务说明：
 * 远程指令触发网关 (信号版)。
 */
async function verifyCommander() {
  // 🚨 架构师修复：废弃硬编码 Cookie，强制走 Supabase 核验
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  return user && user.email?.toLowerCase() === adminEmail?.toLowerCase();
}

export async function POST() {
  if (!(await verifyCommander())) {
    logger.crash("越权触发指令被物理拦截 (401)");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    logger.start("接收到 CEO 手动触发指令");
    // 1. 在数据库中写入触发信号
    const { error } = await supabaseAdmin.from('system_configs').upsert({
      id: 'manual_trigger_signal',
      value: { 
        status: 'PENDING', 
        requested_at: new Date().toISOString(),
        commander: 'CEO'
      },
      updated_at: new Date().toISOString()
    });

    if (error) throw error;

    logger.success("手动触发信号已离岸，等待 Python 猎犬响应");
    
    return NextResponse.json({ 
      success: true, 
      message: '指令已下达。请确保本地 Python 守护进程已启动，它将在 60 秒内感知并执行任务。' 
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Trigger Gateway Failure';
    logger.crash(errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}