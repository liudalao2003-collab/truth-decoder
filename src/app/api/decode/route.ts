import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });
    }

    // 🚀 执行物理检索
    const { data, error } = await supabaseAdmin
      .from('signals')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.warn(`[API_DECODE] 信号不存在: ${id}`);
      // 🚨 即使没找到，也必须返回标准的 JSON 结构
      return NextResponse.json({ success: false, error: 'Signal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error(`[API_DECODE] 链路崩溃:`, err.message);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}