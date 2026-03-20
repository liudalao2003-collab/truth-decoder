import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ApiResponse } from '@/types';
import { SignalRecord } from '@/types/database';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

/**
 * 核心业务说明：
 * 升级后的情报流接口。支持 cursor (时间戳) 分页。
 * 确保前端可以实现“加载更多”功能，逐步榨取数据库中的历史资产。
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<SignalRecord[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor'); // 获取前端传来的最后一条情报的时间

    logger.start('发起 Truth Feed 分页情报拉取', { cursor });

    let query = supabaseAdmin
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10); // 每次只泵出 10 条，平衡性能与体验

    // 🚨 核心分页过滤：只查询比当前最末尾情报更早的数据
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) throw error;

    logger.success(`成功提取 ${data?.length || 0} 条高净值情报`);
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '数据库索引失效';
    logger.crash(`Feed 获取链路崩溃: ${errMsg}`);
    return NextResponse.json({ success: false, error: '无法加载情报流' }, { status: 500 });
  }
}

// 物理级清空保留（仅供备忘，建议日常注释掉以保安全）
/*
export async function DELETE() {
  const { count } = await supabaseAdmin.from('signals').delete().neq('id', 'void');
  return NextResponse.json({ success: true, erasedCount: count });
}
*/