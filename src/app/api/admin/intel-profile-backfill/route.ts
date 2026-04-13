import { NextResponse } from 'next/server';
import { insertIntelProfileGenerationJob } from '@/lib/generation/insert-intel-profile-job';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/utils/logger';

async function verifyCommander() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  return Boolean(user && user.email?.toLowerCase() === adminEmail?.toLowerCase());
}

function isMetaRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export const maxDuration = 60;

/**
 * CEO 后台：批量入队缺失 metadata.intelProfile 的异步任务（Worker 消费）。
 */
export async function POST(req: Request) {
  if (!(await verifyCommander())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let limit = 5;
  try {
    const body = await req.json();
    if (typeof body?.limit === 'number' && body.limit > 0 && body.limit <= 20) {
      limit = Math.floor(body.limit);
    }
  } catch {
    /* 空 body 使用默认 limit */
  }

  try {
    logger.start(`情报体征补算入队 batch limit=${limit}`);

    const { data: rows, error: qErr } = await supabaseAdmin
      .from('signals')
      .select('id, metadata')
      .order('created_at', { ascending: false })
      .limit(80);

    if (qErr) throw qErr;

    const targets =
      rows?.filter((r) => {
        const m = r.metadata;
        if (!isMetaRecord(m)) return true;
        if (m.intelProfile == null) return true;
        return m.intelProfileError != null;
      }) ?? [];

    const slice = targets.slice(0, limit);
    const results: { id: string; enqueued: boolean; error?: string }[] = [];

    for (const row of slice) {
      const ins = await insertIntelProfileGenerationJob(supabaseAdmin, {
        signalId: row.id,
        forceRegenerate: false,
        userId: null,
      });
      if (ins.ok) {
        results.push({ id: row.id, enqueued: true });
      } else {
        results.push({ id: row.id, enqueued: false, error: ins.message });
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    const enqueued = results.filter((r) => r.enqueued).length;
    logger.success(`补算入队完成 enqueued=${enqueued}/${results.length}`);
    return NextResponse.json({
      success: true,
      data: { processed: results.length, enqueued, results },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Backfill failure';
    logger.crash(errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
