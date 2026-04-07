import { NextResponse } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  normalizeIngestIntel,
  repairIntelEnglishFromChinese,
  repairIntelProfileEnglishFromChinese,
  needsIntelProfileEnglishRepair,
} from '@/services/bilingual-intel-repair';
import { generateIntelProfile } from '@/services/intel-profile';
import { regenerateFullIntelJsonFromRaw } from '@/services/regenerate-ingest-intel';
import type { IntelProfileError } from '@/types/intel-profile';

/** Vercel 默认短时上限下体征易截断；与 vercel.json 中本路由 maxDuration 对齐 */
export const maxDuration = 60;

function isMetaRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** 缺失体征或曾失败时允许在重复入库时重算，避免永久锁死在首次简略结果 */
function needsIntelProfileRegeneration(meta: Record<string, unknown>): boolean {
  const hasProfile =
    meta.intelProfile != null && typeof meta.intelProfile === 'object';
  const hasError = meta.intelProfileError != null;
  return !hasProfile || hasError;
}

export async function POST(req: Request) {
  try {
    const auth = await assertIngestAuthorized(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const rawContent = body?.rawContent || "内容流失兜底";
    let intel = normalizeIngestIntel(body?.intel);

    /** 客户端 SSE 常在 fluff 段之前截断：启发式无法救回时，用单次非流式与 wash 同契约补全，保证红字气泡与事实一致 */
    const cnFluff = intel?.fluff?.cn;
    if (!Array.isArray(cnFluff) || cnFluff.length === 0) {
      try {
        const regen = await regenerateFullIntelJsonFromRaw(rawContent);
        intel = {
          ...intel,
          verdict: regen.verdict,
          facts: regen.facts,
          fluff: regen.fluff,
        };
      } catch {
        /* 兜底失败时沿用客户端 intel，不阻断入库 */
      }
    }

    /** 以中文为准补齐英文判决/事实/脚注，避免抢救分支只回填 CN */
    intel = await repairIntelEnglishFromChinese(intel);

    const safeSnippet = rawContent.substring(0, 100).replace(/[%_]/g, '');
    const { data: existing } = await supabaseAdmin
      .from('signals')
      .select('id, metadata')
      .ilike('raw_content', `${safeSnippet}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      const row = existing[0];
      const prevMeta = isMetaRecord(row.metadata) ? row.metadata : {};

      if (needsIntelProfileRegeneration(prevMeta)) {
        let mergedMeta: Record<string, unknown> = { ...prevMeta };
        try {
          let profile = await generateIntelProfile(rawContent, intel?.facts);
          if (needsIntelProfileEnglishRepair(profile)) {
            profile = await repairIntelProfileEnglishFromChinese(profile);
          }
          mergedMeta = { ...mergedMeta, intelProfile: profile };
          delete mergedMeta.intelProfileError;
        } catch (e: unknown) {
          const errPayload: IntelProfileError = {
            message: e instanceof Error ? e.message : '情报体征生成失败',
            at: new Date().toISOString(),
          };
          mergedMeta = { ...mergedMeta, intelProfileError: errPayload };
        }
        await supabaseAdmin
          .from('signals')
          .update({ metadata: mergedMeta })
          .eq('id', row.id);
      }

      return NextResponse.json({ success: true, data: { signalId: row.id } });
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
      let profile = await generateIntelProfile(rawContent, intel?.facts);
      if (needsIntelProfileEnglishRepair(profile)) {
        profile = await repairIntelProfileEnglishFromChinese(profile);
      }
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