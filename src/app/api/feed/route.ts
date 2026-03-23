import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ApiResponse } from '@/types';
import { SignalRecord } from '@/types/database';

export const runtime = 'edge';

/**
 * 核心业务：工业级游标分页的情报流接口
 * 接受 searchParams 中的 cursor (created_at 时间戳)
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<SignalRecord[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor'); // 获取前端传来的上一片末尾时间戳

    let query = supabaseAdmin
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15); // 工业级分片厚度：15条

    // 🚨 核心逻辑：分页防线
    if (cursor) {
      // LT 代表 Lower Than (小于)，只查询比当前 cursor 更早的情报
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}