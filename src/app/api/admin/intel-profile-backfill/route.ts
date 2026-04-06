import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { generateIntelProfile } from '@/services/intel-profile';
import type { IntelProfileError } from '@/types/intel-profile';
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

export const maxDuration = 120;

/**
 * CEO 后台：批量补算缺失的 metadata.intelProfile（节流顺序执行）。
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
    logger.start(`情报体征补算 batch limit=${limit}`);

    const { data: rows, error: qErr } = await supabaseAdmin
      .from('signals')
      .select('id, raw_content, hard_facts, metadata')
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
    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const row of slice) {
      const prev = isMetaRecord(row.metadata) ? row.metadata : {};
      try {
        const profile = await generateIntelProfile(row.raw_content, row.hard_facts);
        const rest = { ...prev };
        delete rest.intelProfileError;
        const nextMeta = { ...rest, intelProfile: profile };
        const { error: uErr } = await supabaseAdmin
          .from('signals')
          .update({ metadata: nextMeta })
          .eq('id', row.id);
        if (uErr) throw uErr;
        results.push({ id: row.id, ok: true });
      } catch (e: unknown) {
        const errPayload: IntelProfileError = {
          message: e instanceof Error ? e.message : 'backfill failed',
          at: new Date().toISOString(),
        };
        const rest2 = { ...prev };
        delete rest2.intelProfile;
        const nextMeta = { ...rest2, intelProfileError: errPayload };
        await supabaseAdmin.from('signals').update({ metadata: nextMeta }).eq('id', row.id);
        results.push({
          id: row.id,
          ok: false,
          error: errPayload.message,
        });
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    logger.success(`补算完成 processed=${results.length}`);
    return NextResponse.json({ success: true, data: { processed: results.length, results } });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Backfill failure';
    logger.crash(errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
