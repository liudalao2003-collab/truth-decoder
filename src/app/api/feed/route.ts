import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiResponse } from '@/types';
import { SignalRecord } from '@/types/database';

export const runtime = 'edge';

/**
 * 核心业务：工业级游标分页的情报流接口
 * 🚨 已降权：彻底废弃 supabaseAdmin，启用遵循 RLS 的服务端客户端
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<SignalRecord[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor'); 

    // 唤醒遵守物理隔离法则的普通步兵客户端
    const supabase = await createClient();

    let query = supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Database query failed';
    if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因:', errMsg);
    }
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}