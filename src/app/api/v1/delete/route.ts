import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

export async function DELETE(request: Request) {
  try {
    logger.start("接收物理抹杀请求");
    
    // 🛡️ 最高权限校验 (上帝模式通行证)
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      logger.crash("清除权限不足 (401)");
      return NextResponse.json({ success: false, error: 'Unauthorized: Clearance Level Too Low' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      logger.crash("抹杀目标 ID 缺失");
      return NextResponse.json({ success: false, error: 'Missing Target ID' }, { status: 400 });
    }

    logger.async(`正在执行数据库物理抹除 -> [${id}]`);
    // 🔪 物理抹杀执行
    const { error } = await supabaseAdmin
      .from('signals')
      .delete()
      .eq('id', id);

    if (error) {
      logger.crash(`[PURGE_FAILED] 抹杀失败: ${error.message}`);
      throw error;
    }

    logger.success(`[PURGE_SUCCESS] 资产已物理销毁: ${id}`);
    return NextResponse.json({ success: true, message: 'Asset Neutralized' });

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Internal Server Error';
    logger.crash(`抹杀链路异常: ${errMsg}`);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}