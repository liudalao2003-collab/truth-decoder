import { NextResponse } from 'next/server';
import { insertIntelProfileGenerationJob } from '@/lib/generation/insert-intel-profile-job';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/utils/logger';

function isMetaRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export const maxDuration = 60;

/**
 * Cron：每轮最多入队 3 条缺失 intelProfile 的异步任务（Bearer CRON_SECRET）。
 * 实际 LLM 在 Worker 中执行，避免 Vercel 时长限制。
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const BATCH = 3;

  try {
    logger.start('Cron intel-profile enqueue');

    const { data: rows, error: qErr } = await supabaseAdmin
      .from('signals')
      .select('id, metadata')
      .order('created_at', { ascending: false })
      .limit(60);

    if (qErr) throw qErr;

    const targets =
      rows?.filter((r) => {
        const m = r.metadata;
        if (!isMetaRecord(m)) return true;
        if (m.intelProfile == null) return true;
        return m.intelProfileError != null;
      }) ?? [];

    const slice = targets.slice(0, BATCH);
    let ok = 0;

    for (const row of slice) {
      const ins = await insertIntelProfileGenerationJob(supabaseAdmin, {
        signalId: row.id,
        forceRegenerate: false,
        userId: null,
      });
      if (ins.ok) {
        ok += 1;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    logger.success(`Cron intel-profile enqueue done ok=${ok}/${slice.length}`);
    return NextResponse.json({
      success: true,
      message: 'Intel profile cron enqueue pass',
      data: { attempted: slice.length, enqueued: ok },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Cron intel-profile error';
    logger.crash(errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
