import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';

export async function DELETE(request: Request) {
  try {
    // 🛡️ 最高权限校验 (上帝模式通行证)
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Clearance Level Too Low' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing Target ID' }, { status: 400 });
    }

    // 🔪 物理抹杀执行
    const { error } = await supabaseAdmin
      .from('signals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[PURGE_FAILED] 抹杀失败: ${error.message}`);
      throw error;
    }

    console.log(`[PURGE_SUCCESS] 资产已物理销毁: ${id}`);
    return NextResponse.json({ success: true, message: 'Asset Neutralized' });

  } catch (_err: unknown) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}