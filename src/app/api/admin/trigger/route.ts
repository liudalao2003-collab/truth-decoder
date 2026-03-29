import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { logger } from '@/utils/logger';

/**
 * 核心业务说明：
 * 远程指令触发网关 (信号版)。
 * 彻底切断与 DeepSeek 和 Jina AI 的直连，防止 Vercel 504 崩溃。
 * 现在的逻辑是：当 CEO 在后台点击“立即执行”时，在数据库插下一枚“待执行”旗帜，
 * 由本地守护进程 (Python) 侦测并执行真实的狩猎任务。
 */
async function verifyCommander() {
  const cookieStore = await cookies();
  const token = cookieStore.get('truth_admin_token');
  return token?.value === 'ACCESS_GRANTED_2026';
}

export async function POST() {
  if (!(await verifyCommander())) {
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