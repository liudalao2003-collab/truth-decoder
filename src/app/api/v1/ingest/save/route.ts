import { NextResponse } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateIntelProfile } from '@/services/intel-profile';
import type { IntelProfileError } from '@/types/intel-profile';

export async function POST(req: Request) {
  try {
    const auth = await assertIngestAuthorized(req);
    if (!auth.ok) {
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
    const baseMetadata: Record<string, unknown> = { bilingual: intel?.verdict || {} };

    const ownerId =
      auth.kind === 'user' ? auth.userId : null;

    const { error: dbError } = await supabaseAdmin.from('signals').insert([
      {
        id: signalId,
        raw_content: rawContent,
        fluff_words: intel?.fluff || { cn: [], en: [] },
        hard_facts: intel?.facts || { cn: [], en: [] },
        verdict:
          intel?.verdict?.cn ||
          (typeof intel?.verdict === 'string' ? intel.verdict : '资产解析降级'),
        view_count: 0,
        metadata: baseMetadata,
        owner_id: ownerId,
      },
    ]);

    if (dbError) throw dbError;

    let mergedMeta: Record<string, unknown> = { ...baseMetadata };
    try {
      const profile = await generateIntelProfile(rawContent, intel?.facts);
      mergedMeta = { ...mergedMeta, intelProfile: profile };
      delete mergedMeta.intelProfileError;
    } catch (e: unknown) {
      const errPayload: IntelProfileError = {
        message: e instanceof Error ? e.message : '情报体征生成失败',
        at: new Date().toISOString(),
      };
      mergedMeta = { ...mergedMeta, intelProfileError: errPayload };
    }

    const { error: metaErr } = await supabaseAdmin
      .from('signals')
      .update({ metadata: mergedMeta })
      .eq('id', signalId);

    if (metaErr && process.env.NODE_ENV === 'development') {
      console.log('🔴 [模块_崩溃] -> 体征元数据回写失败:', metaErr.message);
    }

    return NextResponse.json({ success: true, data: { signalId } });
  } catch (error: unknown) {
    // 🚀 核心修复：抹平 unknown 访问障碍
    const errMsg = error instanceof Error ? error.message : '入库链路遭遇物理阻断';
    console.error('🔴 [闪电入库崩溃] ->', errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}