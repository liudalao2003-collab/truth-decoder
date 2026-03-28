import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * 核心业务说明：
 * 闪电入库网关。剥离了所有 AI 算力等待，纯粹执行 200ms 级别的数据持久化。
 * [已注入 23505 查重力场防御与优雅降级跳转]
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const rawContent = body?.rawContent || "内容流失兜底";
    const intel = body?.intel || {}; 

    // 🛡️ 架构师防线 1：前置查重。截取前 100 个字符探测，若命中，直接签发旧签证
    const safeSnippet = rawContent.substring(0, 100).replace(/[%_]/g, '');
    const { data: existing } = await supabaseAdmin
      .from('signals')
      .select('id')
      .ilike('raw_content', `${safeSnippet}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [命中缓存] -> 查重力场生效，直接导向已有资产:', existing[0].id);
      }
      return NextResponse.json({ success: true, data: { signalId: existing[0].id } });
    }

    // 若无重复，执行常规入库
    const signalId = `SIGNAL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const { error: dbError } = await supabaseAdmin.from('signals').insert([{
      id: signalId,
      raw_content: rawContent,
      fluff_words: intel?.fluff || { cn: [], en: [] },
      hard_facts: intel?.facts || { cn: [], en: [] },
      verdict: intel?.verdict?.cn || (typeof intel?.verdict === 'string' ? intel.verdict : "资产解析降级"),
      view_count: 0, 
      metadata: { bilingual: intel?.verdict || {} }
    }]);

    if (dbError) {
      // 🛡️ 架构师防线 2：高并发穿透拦截 (23505)
      if (dbError.code === '23505') {
        const { data: retry } = await supabaseAdmin.from('signals').select('id').ilike('raw_content', `${safeSnippet}%`).limit(1);
        if (retry && retry.length > 0) {
            return NextResponse.json({ success: true, data: { signalId: retry[0].id } });
        }
      }
      console.error("🔴 Supabase 数据库拒绝入库:", dbError);
      throw new Error(`数据库写入失败: ${dbError.message} (代码: ${dbError.code})`);
    }

    return NextResponse.json({ success: true, data: { signalId } });
  } catch (error: any) {
    const errMsg = error?.message || '未知的入库物理崩塌';
    console.error('🔴 [闪电入库崩溃] ->', errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}