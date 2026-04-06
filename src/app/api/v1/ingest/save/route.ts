import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateIntelProfile } from '@/services/intel-profile';
import { regenerateFullIntelJsonFromRaw } from '@/services/regenerate-ingest-intel';
import type { BilingualData } from '@/types/database';
import type { IntelProfileError } from '@/types/intel-profile';

/**
 * 含 after() 内异步体征写入的总执行窗口；与 vercel.json 对齐。
 * 响应可先返回，但平台仍会等待 after 任务结束，需留足余量。
 */
export const maxDuration = 120;

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

/** 异步合并体征并写回 metadata（供 after() 调用，避免阻塞 HTTP 导致 504） */
async function mergeIntelProfileMetadata(
  signalId: string,
  rawContent: string,
  hardFacts: BilingualData | string[] | undefined,
  baseMeta: Record<string, unknown>
): Promise<void> {
  const profileStartedAt = Date.now();
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0c753ea0-b6cf-4d53-95cb-28c61cb08775', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'ingest/save:mergeIntelProfileMetadata',
      message: 'async intel profile start',
      data: { hypothesisId: 'H2', signalIdLen: signalId.length },
      timestamp: Date.now(),
      runId: 'ingest-504',
    }),
  }).catch(() => {});
  // #endregion

  let mergedMeta: Record<string, unknown> = { ...baseMeta };
  try {
    const profile = await generateIntelProfile(rawContent, hardFacts);
    mergedMeta = { ...mergedMeta, intelProfile: profile };
    delete mergedMeta.intelProfileError;
  } catch (e: unknown) {
    const errPayload: IntelProfileError = {
      message: e instanceof Error ? e.message : '情报体征生成失败',
      at: new Date().toISOString(),
    };
    mergedMeta = { ...mergedMeta, intelProfileError: errPayload };
  }

  await supabaseAdmin.from('signals').update({ metadata: mergedMeta }).eq('id', signalId);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0c753ea0-b6cf-4d53-95cb-28c61cb08775', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'ingest/save:mergeIntelProfileMetadata',
      message: 'async intel profile done',
      data: {
        hypothesisId: 'H2',
        profileMs: Date.now() - profileStartedAt,
        hasErrorKey: mergedMeta.intelProfileError != null,
      },
      timestamp: Date.now(),
      runId: 'ingest-504',
    }),
  }).catch(() => {});
  // #endregion
}

export async function POST(req: Request) {
  const wallStart = Date.now();
  try {
    const auth = await assertIngestAuthorized(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const rawContent = body?.rawContent || "内容流失兜底";
    let intel = body?.intel || {};

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0c753ea0-b6cf-4d53-95cb-28c61cb08775', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'ingest/save:POST',
        message: 'after fluff regen',
        data: {
          hypothesisId: 'H1',
          regenPathMs: Date.now() - wallStart,
          rawLen: rawContent.length,
        },
        timestamp: Date.now(),
        runId: 'ingest-504',
      }),
    }).catch(() => {});
    // #endregion

    const safeSnippet = rawContent.substring(0, 100).replace(/[%_]/g, '');
    const { data: existing } = await supabaseAdmin
      .from('signals')
      .select('id, metadata')
      .ilike('raw_content', `${safeSnippet}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      const row = existing[0];
      const prevMeta = isMetaRecord(row.metadata) ? row.metadata : {};
      const dupNeedsProfile = needsIntelProfileRegeneration(prevMeta);

      if (dupNeedsProfile) {
        const sid = row.id;
        const facts = intel?.facts;
        const base = { ...prevMeta };
        after(() => mergeIntelProfileMetadata(sid, rawContent, facts, base));
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0c753ea0-b6cf-4d53-95cb-28c61cb08775', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'ingest/save:POST',
          message: 'duplicate branch response',
          data: {
            hypothesisId: 'H3',
            duplicate: true,
            deferredProfile: dupNeedsProfile,
            preReturnMs: Date.now() - wallStart,
          },
          timestamp: Date.now(),
          runId: 'ingest-504',
        }),
      }).catch(() => {});
      // #endregion

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

    const metaBase = { ...baseMetadata };
    after(() =>
      mergeIntelProfileMetadata(signalId, rawContent, intel?.facts, metaBase)
    );

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0c753ea0-b6cf-4d53-95cb-28c61cb08775', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'ingest/save:POST',
        message: 'insert branch response',
        data: {
          hypothesisId: 'H3',
          duplicate: false,
          deferredProfile: true,
          preReturnMs: Date.now() - wallStart,
        },
        timestamp: Date.now(),
        runId: 'ingest-504',
      }),
    }).catch(() => {});
    // #endregion

    return NextResponse.json({ success: true, data: { signalId } });
  } catch (error: unknown) {
    // 🚀 核心修复：抹平 unknown 访问障碍
    const errMsg = error instanceof Error ? error.message : '入库链路遭遇物理阻断';
    console.error('🔴 [闪电入库崩溃] ->', errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}