import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) throw new Error('Missing ID');

    const { data, error } = await supabaseAdmin
      .from('signals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    // 🛡️ 强制类型断言，防止 TS 报错
    return NextResponse.json({ success: true, data: data as any });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}