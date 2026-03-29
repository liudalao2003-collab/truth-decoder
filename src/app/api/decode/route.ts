import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SignalRecord } from '@/types/database';

/**
 * 核心业务说明：
 * C端解码数据泵出接口。
 * 🚨 已降权：强制剥夺上帝权限，确保越权读取被数据库物理阻断。
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) throw new Error('Missing ID');

    // 唤醒遵守物理隔离法则的普通步兵客户端
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    const record = data as SignalRecord;

    // 🛡️ 架构师防线：平滑过渡旧版 string 与新版 JSONB
    if (typeof record.dossier_content === 'string') {
        record.dossier_content = { 
            cn: record.dossier_content, 
            en: '' 
        };
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Database retrieval failed';
    if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因:', errMsg);
    }
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}