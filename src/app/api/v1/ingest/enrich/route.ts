import { NextResponse } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { canEnrichSignal } from '@/lib/ingest-signal-access';
import { asBilingualData, isMetaRecord } from '@/lib/generation/intel-profile-metadata';
import { supabaseAdmin } from '@/lib/supabase';
import type { IngestIntelBilingual } from '@/services/bilingual-intel-repair';
import {
  normalizeIngestIntel,
  repairIntelEnglishFromChinese,
} from '@/services/bilingual-intel-repair';
import { regenerateFullIntelJsonFromRaw } from '@/services/regenerate-ingest-intel';
import type { BilingualData } from '@/types/database';

/** intel 步骤仍在本路由执行（短预算）；情报体征已迁至 /api/v1/generation/jobs */
export const maxDuration = 60;
const INTEL_STEP_BUDGET_MS = 8_000;

/** 从 signals 行还原入库用 intel 结构 */
function buildIntelFromRow(row: Record<string, unknown>): IngestIntelBilingual {
  const verdictStr = typeof row.verdict === 'string' ? row.verdict : '';
  const prevMeta = isMetaRecord(row.metadata) ? row.metadata : {};
  const bi = prevMeta.bilingual;
  let enV = '';
  if (bi && typeof bi === 'object' && bi !== null && 'en' in bi) {
    const e = (bi as Record<string, unknown>).en;
    if (typeof e === 'string') enV = e;
  }
  const facts = asBilingualData(row.hard_facts);
  const fluff = asBilingualData(row.fluff_words);
  return normalizeIngestIntel({
    verdict: { cn: verdictStr, en: enV },
    facts,
    fluff,
  });
}

export type EnrichStep = 'intel' | 'profile';

interface EnrichBody {
  signalId?: string;
  step?: EnrichStep;
  forceRegenerate?: boolean;
}

/**
 * 入库后补全：
 * - intel：脚注补全 + 英文化修复 + 回写列与 metadata.bilingual
 * - profile：已废弃本路由同步执行，请使用 POST /api/v1/generation/jobs（kind: intel_profile）
 */
export async function POST(req: Request) {
  const startedAt = Date.now();
  try {
    const auth = await assertIngestAuthorized(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as EnrichBody;
    const signalId = typeof body.signalId === 'string' ? body.signalId.trim() : '';
    const step = body.step === 'profile' ? 'profile' : 'intel';

    if (!signalId) {
      return NextResponse.json({ success: false, error: 'Missing signalId' }, { status: 400 });
    }

    if (step === 'profile') {
      return NextResponse.json(
        {
          success: false,
          error:
            '情报体征已改为异步任务队列，请使用 POST /api/v1/generation/jobs（kind: intel_profile）。',
          code: 'PROFILE_USE_JOB_QUEUE',
        },
        { status: 410 }
      );
    }

    const { data: row, error: qErr } = await supabaseAdmin
      .from('signals')
      .select('*')
      .eq('id', signalId)
      .maybeSingle();

    if (qErr || !row) {
      return NextResponse.json({ success: false, error: 'Signal not found' }, { status: 404 });
    }

    const rowObj = row as Record<string, unknown>;
    if (!canEnrichSignal(auth, { owner_id: rowObj.owner_id as string | null | undefined })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const rawContent = typeof rowObj.raw_content === 'string' ? rowObj.raw_content : '';

    let intel = buildIntelFromRow(rowObj);
    const intelDeadlineAt = Date.now() + INTEL_STEP_BUDGET_MS;

    const cnFluff = intel?.fluff?.cn;
    if (!Array.isArray(cnFluff) || cnFluff.length === 0) {
      if (Date.now() < intelDeadlineAt) {
        try {
          const regen = await regenerateFullIntelJsonFromRaw(rawContent);
          intel = {
            ...intel,
            verdict: regen.verdict,
            facts: regen.facts,
            fluff: regen.fluff,
          };
        } catch {
          /* 与 save 一致：补全失败则沿用行内数据 */
        }
      }
    }

    if (Date.now() < intelDeadlineAt) {
      try {
        intel = await repairIntelEnglishFromChinese(intel);
      } catch {
        /* 静默降级 */
      }
    }

    const prevMeta = isMetaRecord(rowObj.metadata) ? { ...rowObj.metadata } : {};
    const bilingualOut = {
      cn: intel.verdict?.cn ?? (typeof rowObj.verdict === 'string' ? rowObj.verdict : ''),
      en: intel.verdict?.en ?? '',
    };

    const { error: upErr } = await supabaseAdmin
      .from('signals')
      .update({
        fluff_words: (intel.fluff || { cn: [], en: [] }) as BilingualData,
        hard_facts: (intel.facts || { cn: [], en: [] }) as BilingualData,
        verdict: intel.verdict?.cn || (typeof rowObj.verdict === 'string' ? rowObj.verdict : '资产解析降级'),
        metadata: {
          ...prevMeta,
          bilingual: bilingualOut,
        },
      })
      .eq('id', signalId);

    if (upErr) throw upErr;

    return NextResponse.json({
      success: true,
      data: {
        signalId,
        step: 'intel' as const,
        elapsedMs: Date.now() - startedAt,
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'enrich failed';
    if (process.env.NODE_ENV === 'development') {
      console.error('🔴 [ingest/enrich] ->', {
        errMsg,
        elapsedMs: Date.now() - startedAt,
      });
    }
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
