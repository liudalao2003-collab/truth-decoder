import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * 核心业务说明：
 * 闪电入库网关。剥离了所有 AI 算力等待，纯粹执行 200ms 级别的数据持久化。
 * [注入了最高级空指针防御与全量数据库契约]
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const rawContent = body?.rawContent || "内容流失兜底";
    // 🛡️ 架构师防线：如果前端传来的 intel 是畸形的，强行赋默认值，阻断 TypeError
    const intel = body?.intel || {}; 

    const signalId = `SIGNAL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // 🔪 极限界数据契约：补齐 view_count，所有链条挂载 ?. 防御
    const { error: dbError } = await supabaseAdmin.from('signals').insert([{
      id: signalId,
      raw_content: rawContent,
      fluff_words: intel?.fluff || { cn: [], en: [] },
      hard_facts: intel?.facts || { cn: [], en: [] },
      verdict: intel?.verdict?.cn || (typeof intel?.verdict === 'string' ? intel.verdict : "资产解析降级"),
      view_count: 0, // 🚀 核心补全：满足 Supabase 可能的 NOT NULL 数据库底层约束
      metadata: { bilingual: intel?.verdict || {} }
    }]);

    if (dbError) {
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