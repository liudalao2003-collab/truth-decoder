import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { SignalRecord } from '@/types/database';

/**
 * 核心业务说明：
 * C端解码数据泵出接口。
 * 负责从 Supabase 提取指定 Signal ID 的全部关联情报，并清洗向下兼容的数据格式。
 */
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
    
    // 🛡️ 严格剥离 as any，强制注入明确的 TS 契约
    const record = data as SignalRecord;

    // 🛡️ 架构师防线：平滑过渡旧版 string 与新版 JSONB
    // 如果数据库中遗留的是旧版单语种字符串，在传输给前端前，强行包装成双语结构，
    // 确保前端后续直接读取 `dossier_content.cn` 时不会触发 undefined 崩溃。
    if (typeof record.dossier_content === 'string') {
        record.dossier_content = { 
            cn: record.dossier_content, 
            en: '' 
        };
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Database retrieval failed';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}