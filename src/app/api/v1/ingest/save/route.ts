import { NextResponse } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeIngestIntel } from '@/services/bilingual-intel-repair';

/**
 * 闪电入库：鉴权 + 归一化 + DB 写入，数秒内返回。
 * 重 AI（脚注补全、英文化、情报体征）由客户端在成功后链式调用
 * POST /api/v1/ingest/enrich?step=intel|profile，避免单请求超时。
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
      .select('id, metadata, owner_id')
      .ilike('raw_content', `${safeSnippet}%`)
      .limit(8);

    const reusableRow = (existing ?? []).find((row) => {
      const typedRow = row as { owner_id?: string | null };
      if (auth.kind === 'service') return true;
      const ownerId = typedRow.owner_id ?? null;
      // 仅复用当前用户可后续 enrich/sync 的记录，避免落入 403 Forbidden 死链
      return ownerId === null || ownerId === '' || ownerId === auth.userId;
    });

    if (reusableRow) {
      return NextResponse.json({
        success: true,
        data: {
          signalId: reusableRow.id,
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
