import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

/**
 * 删除信号：Bearer INGEST_TOKEN 为机器全量权限；Cookie 会话仅当邮箱与 NEXT_PUBLIC_ADMIN_EMAIL 一致时可删（不再按 owner_id 放行）。
 */
export async function DELETE(request: Request) {
  try {
    logger.start('接收物理抹杀请求');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      logger.crash('抹杀目标 ID 缺失');
      return NextResponse.json(
        { success: false, error: 'Missing Target ID' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    const token = process.env.INGEST_TOKEN;
    if (token && authHeader === `Bearer ${token}`) {
      logger.async(`INGEST_TOKEN 抹除 -> [${id}]`);
      const { error } = await supabaseAdmin.from('signals').delete().eq('id', id);
      if (error) {
        logger.crash(`[PURGE_FAILED] 抹杀失败: ${error.message}`);
        throw error;
      }
      logger.success(`[PURGE_SUCCESS] 资产已物理销毁: ${id}`);
      return NextResponse.json({ success: true, message: 'Asset Neutralized' });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      logger.crash('清除权限不足 (401)');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Clearance Level Too Low' },
        { status: 401 }
      );
    }

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();
    const isPurgeAdmin =
      !!adminEmail &&
      !!user.email &&
      user.email.toLowerCase() === adminEmail;

    if (!isPurgeAdmin) {
      logger.crash('非管理员禁止抹除 (403)');
      return NextResponse.json(
        { success: false, error: 'Forbidden: purge not allowed' },
        { status: 403 }
      );
    }

    logger.async(`管理员抹除 -> [${id}]`);
    const { error } = await supabaseAdmin.from('signals').delete().eq('id', id);
    if (error) {
      logger.crash(`[PURGE_FAILED] 抹杀失败: ${error.message}`);
      throw error;
    }

    logger.success(`[PURGE_SUCCESS] 资产已物理销毁: ${id}`);
    return NextResponse.json({ success: true, message: 'Asset Neutralized' });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Internal Server Error';
    logger.crash(`抹杀链路异常: ${errMsg}`);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
