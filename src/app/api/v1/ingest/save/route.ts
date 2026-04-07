import { NextResponse } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeIngestIntel } from '@/services/bilingual-intel-repair';

/**
 * 闪电入库：仅做鉴权 + 归一化 + DB 写入，必须在数秒内返回。
 * 重 AI（脚注补全、英文化、情报体征）改由客户端在入库成功后链式调用
 * POST /api/v1/ingest/enrich?step=intel|profile，避免 Vercel Hobby ~10s 单请求上限导致 504。
 */
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const auth = await assertIngestAuthorized(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const rawContent = body?.rawContent || '内容流失兜底';
    const intel = normalizeIngestIntel(body?.intel);

    const safeSnippet = rawContent.substring(0, 100).replace(/[%_]/g, '');
    const { data: existing } = await supabaseAdmin
      .from('signals')
      .select('id, metadata')
      .ilike('raw_content', `${safeSnippet}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      const row = existing[0];
      return NextResponse.json({
        success: true,
        data: {
          signalId: row.id,
          duplicate: true as const,
          enrichmentRequired: true as const,
        },
      });
    }

    const signalId = `SIGNAL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const baseMetadata: Record<string, unknown> = {
      bilingual: intel?.verdict || {},
      enrichmentPending: true,
    };

    const ownerId = auth.kind === 'user' ? auth.userId : null;

    const { error: dbError } = await supabaseAdmin.from('signals').insert([
      {
        id: signalId,
        raw_content: rawContent,
        fluff_words: intel?.fluff || { cn: [], en: [] },
        hard_facts: intel?.facts || { cn: [], en: [] },
        verdict: intel?.verdict?.cn || '资产解析降级',
        view_count: 0,
        metadata: baseMetadata,
        owner_id: ownerId,
      },
    ]);

    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      data: {
        signalId,
        duplicate: false as const,
        enrichmentRequired: true as const,
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '入库链路遭遇物理阻断';
    console.error('🔴 [闪电入库崩溃] ->', errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
