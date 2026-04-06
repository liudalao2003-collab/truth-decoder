import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateIntelProfile } from '@/services/intel-profile';
import type { IntelProfileError } from '@/types/intel-profile';
import { logger } from '@/utils/logger';

function isMetaRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export const maxDuration = 60;

/**
 * Cron：每轮最多补算 3 条缺失 intelProfile 的信号（Bearer CRON_SECRET）。
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const BATCH = 3;

  try {
    logger.start('Cron intel-profile backfill');

    const { data: rows, error: qErr } = await supabaseAdmin
      .from('signals')
      .select('id, raw_content, hard_facts, metadata')
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
      const prev = isMetaRecord(row.metadata) ? row.metadata : {};
      try {
        const profile = await generateIntelProfile(row.raw_content, row.hard_facts);
        const rest = { ...prev };
        delete rest.intelProfileError;
        await supabaseAdmin
          .from('signals')
          .update({ metadata: { ...rest, intelProfile: profile } })
          .eq('id', row.id);
        ok += 1;
      } catch (e: unknown) {
        const errPayload: IntelProfileError = {
          message: e instanceof Error ? e.message : 'cron intel-profile failed',
          at: new Date().toISOString(),
        };
        const rest2 = { ...prev };
        delete rest2.intelProfile;
        await supabaseAdmin
          .from('signals')
          .update({ metadata: { ...rest2, intelProfileError: errPayload } })
          .eq('id', row.id);
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    logger.success(`Cron intel-profile done ok=${ok}/${slice.length}`);
    return NextResponse.json({
      success: true,
      message: 'Intel profile cron pass',
      data: { attempted: slice.length, succeeded: ok },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Cron intel-profile error';
    logger.crash(errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
