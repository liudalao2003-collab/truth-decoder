import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { SignalRecord } from '@/types/database';
import { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

export async function GET(): Promise<NextResponse<ApiResponse<SignalRecord[]>>> {
  try {
    logger.start('发起 Truth Feed 全局情报拉取');

    const { data, error } = await supabaseAdmin
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    logger.success(`成功提取 ${data?.length || 0} 条高净值情报`);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '数据库索引失效';
    logger.crash(`Feed 获取链路崩溃: ${errMsg}`);
    return NextResponse.json({ success: false, error: '无法加载情报流' }, { status: 500 });
  }
}