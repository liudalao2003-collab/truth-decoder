import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/utils/logger';

// 🚨 架构师排雷：将超时时间重置为默认，不再强行续命，因为此处已无耗时逻辑
export const runtime = 'edge';

// 🛡️ 严格定义系统配置行契约，确保 id 具备 string 属性
interface SystemConfigRow {
  id: string;
  value: {
    status?: string;
    [key: string]: unknown;
  };
}

/**
 * 核心业务说明：
 * 自动化巡航送报员 (心跳版)。
 * 已切除所有爬虫与 AI 逻辑，目前仅作为系统的“脉搏”存在。
 * 它的作用是定期检查系统总开关状态，并记录最后一次心跳时间。
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    logger.start("云端心跳检查开始");

    // 1. 获取系统配置
    const { data: configs } = await supabaseAdmin.from('system_configs').select('*');
    
    // 🚀 核心修复：注入 SystemConfigRow 契约，锁定 row.id 物理类型，通过 Turbopack 校验
    const configMap = (configs as SystemConfigRow[] | null)?.reduce((acc: Record<string, SystemConfigRow['value']>, row: SystemConfigRow) => ({ 
      ...acc, 
      [row.id]: row.value 
    }), {}) || {};

    // 2. 检查总开关
    // 🛡️ 由于已注入契约，此处逻辑已受 TS 保护
    if (configMap.master_switch?.status === 'OFF') {
      logger.async("系统总开关已关闭，跳过心跳记录");
      return NextResponse.json({ success: true, message: 'System Sleeping' });
    }

    // 3. 仅更新心跳时间，不进行任何抓取
    await supabaseAdmin.from('system_configs').upsert({ 
      id: 'cron_last_heartbeat', 
      value: { time: new Date().toISOString() },
      updated_at: new Date().toISOString() 
    });

    logger.success("云端心跳记录完成，负载已安全卸载至 Python 端");
    return NextResponse.json({ success: true, message: 'Heartbeat recorded' });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown Heartbeat Error';
    logger.crash(errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}