import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const rawContent = body?.rawContent || "内容流失兜底";
    const intel = body?.intel || {}; 

    const safeSnippet = rawContent.substring(0, 100).replace(/[%_]/g, '');
    const { data: existing } = await supabaseAdmin
      .from('signals')
      .select('id')
      .ilike('raw_content', `${safeSnippet}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, data: { signalId: existing[0].id } });
    }

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

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, data: { signalId } });
  } catch (error: unknown) {
    // 🚀 核心修复：抹平 unknown 访问障碍
    const errMsg = error instanceof Error ? error.message : '入库链路遭遇物理阻断';
    console.error('🔴 [闪电入库崩溃] ->', errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}