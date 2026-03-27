import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * 核心业务说明：
 * 闪电入库网关。剥离了所有 AI 算力等待，纯粹执行 200ms 级别的数据持久化。
 * 完美绕过 Vercel 免费版的所有超时陷阱。
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { rawContent, intel } = await req.json();
    const signalId = `SIGNAL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const { error: dbError } = await supabaseAdmin.from('signals').insert([{
      id: signalId,
      raw_content: rawContent,
      fluff_words: intel.fluff || { cn: [], en: [] },
      hard_facts: intel.facts || { cn: [], en: [] },
      verdict: intel.verdict?.cn || "解析失败",
      metadata: { bilingual: intel.verdict || {} }
    }]);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, data: { signalId } });
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') console.log('🔴 [保存崩塌] ->', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}