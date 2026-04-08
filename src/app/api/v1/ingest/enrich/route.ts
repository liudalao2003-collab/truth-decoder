import { NextResponse } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { canEnrichSignal } from '@/lib/ingest-signal-access';
import { supabaseAdmin } from '@/lib/supabase';
import type { IngestIntelBilingual } from '@/services/bilingual-intel-repair';
import {
  normalizeIngestIntel,
  repairIntelEnglishFromChinese,
} from '@/services/bilingual-intel-repair';
import { generateIntelProfile } from '@/services/intel-profile';
import { regenerateFullIntelJsonFromRaw } from '@/services/regenerate-ingest-intel';
import type { IntelProfileError } from '@/types/intel-profile';
import { isIntelProfileFallback } from '@/types/intel-profile';
import type { BilingualData } from '@/types/database';

/** 与 vercel.json 对齐；Hobby 档单次仍约 10s，故拆成 intel / profile 两步各享独立预算 */
export const maxDuration = 60;
const PENDING_STALE_MS = 3 * 60 * 1000;
const INTEL_STEP_BUDGET_MS = 8_000;
/**
 * profile 步骤三层预算：
 * - fetchTimeoutMs：单次 DeepSeek 调用完整超时（44s，覆盖 fetch 连接 + body 读取全程）。
 *   DeepSeek 生成 4096 token JSON 约需 20-35s；44s 留有充足缓冲。
 * - llmBudgetMs：LLM 链整体预算（44s，单次尝试内完成）
 * - hardDeadlineMs：Promise.race 硬熔断（48s），Vercel 60s 前必然返回
 */
const PROFILE_STEP_FETCH_TIMEOUT_MS = 44_000;
const PROFILE_STEP_LLM_BUDGET_MS = 44_000;
const PROFILE_STEP_HARD_DEADLINE_MS = 48_000;

function isMetaRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function needsIntelProfileRegeneration(meta: Record<string, unknown>): boolean {
  const profileObj = meta.intelProfile;
  // 将降级占位体征（promptVersion 含 'fallback'）视为需重新生成，
  // 保证用户手动 retry 时可触发真实 AI 调用
  const hasRealProfile =
    profileObj != null &&
    typeof profileObj === 'object' &&
    !String(
      ((profileObj as Record<string, unknown>).audit as Record<string, unknown>)?.promptVersion ?? ''
    ).includes('fallback');
  const hasError = meta.intelProfileError != null;
  return !hasRealProfile || hasError;
}

function asBilingualData(x: unknown): { cn: string[]; en: string[] } {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { cn: [], en: [] };
  const o = x as Record<string, unknown>;
  const cn = Array.isArray(o.cn) ? o.cn.filter((v): v is string => typeof v === 'string') : [];
  const en = Array.isArray(o.en) ? o.en.filter((v): v is string => typeof v === 'string') : [];
  return { cn, en };
}

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
type ProfileStatus =
  | 'skipped'
  | 'stale-pending-tripped'
  | 'success'
  | 'fallback'
  | 'error';

interface EnrichBody {
  signalId?: string;
  step?: EnrichStep;
  forceRegenerate?: boolean;
}

/**
 * 入库后补全：须拆成两步独立请求，避免 Vercel Hobby ~10s 硬上限导致 504。
 * - intel：脚注补全 + 英文化修复 + 回写列与 metadata.bilingual
 * - profile：情报体征 + 可选英文译补 + 清除 enrichmentPending
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
    const forceRegenerate = body.forceRegenerate === true;

    if (!signalId) {
      return NextResponse.json({ success: false, error: 'Missing signalId' }, { status: 400 });
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
    const rowCreatedAtMs = (() => {
      const s = rowObj.created_at;
      if (typeof s !== 'string') return null;
      const t = Date.parse(s);
      return Number.isNaN(t) ? null : t;
    })();

    if (step === 'intel') {
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

      // 超时预算内再做英文化修复；预算耗尽则跳过，优先保证主链可落盘
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
    }

    // step === 'profile'
    const prevMeta = isMetaRecord(rowObj.metadata) ? rowObj.metadata : {};
    if (!forceRegenerate && !needsIntelProfileRegeneration(prevMeta)) {
      await supabaseAdmin
        .from('signals')
        .update({
          metadata: { ...prevMeta, enrichmentPending: false },
        })
        .eq('id', signalId);

      return NextResponse.json({
        success: true,
        data: {
          signalId,
          step: 'profile' as const,
          skipped: true,
          profileStatus: 'skipped' as ProfileStatus,
          elapsedMs: Date.now() - startedAt,
        },
      }, {
        headers: { 'x-td-profile-status': 'skipped' },
      });
    }

    // 运维保险：陈旧 pending（>3分钟）直接熔断，避免页面无限加载骨架
    if (rowCreatedAtMs && Date.now() - rowCreatedAtMs > PENDING_STALE_MS) {
      const stalePayload: IntelProfileError = {
        message: 'intel profile pending timeout (stale pending tripped)',
        at: new Date().toISOString(),
      };
      const staleMeta: Record<string, unknown> = {
        ...prevMeta,
        intelProfileError: stalePayload,
        enrichmentPending: false,
      };
      delete staleMeta.intelProfile;
      const { error: staleErr } = await supabaseAdmin
        .from('signals')
        .update({ metadata: staleMeta })
        .eq('id', signalId);
      if (staleErr) throw staleErr;

      if (process.env.NODE_ENV === 'development') {
        console.log('🟡 [模块_异步] -> 目标: stale pending tripped', {
          signalId,
          ageMs: Date.now() - rowCreatedAtMs,
        });
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            signalId,
            step: 'profile' as const,
            stalePendingTripped: true,
            profileStatus: 'stale-pending-tripped' as ProfileStatus,
            elapsedMs: Date.now() - startedAt,
          },
        },
        {
          headers: { 'x-td-profile-status': 'stale-pending-tripped' },
        }
      );
    }

    const factsForProfile = asBilingualData(rowObj.hard_facts);
    let mergedMeta: Record<string, unknown> = { ...prevMeta };
    // 质量重算：用户主动触发时记录审计字段，便于线上问题回溯。
    if (forceRegenerate) {
      const currentCount =
        typeof mergedMeta.qualityRecomputeCount === 'number'
          ? mergedMeta.qualityRecomputeCount
          : 0;
      mergedMeta.qualityRecomputeCount = currentCount + 1;
      mergedMeta.lastRecomputeAt = new Date().toISOString();
      mergedMeta.lastRecomputeReason = 'user_quality_recompute';
    }

    let profileStatus: ProfileStatus = 'success';
    try {
      const profile = await generateIntelProfile(rawContent, factsForProfile, {
        fetchTimeoutMs: PROFILE_STEP_FETCH_TIMEOUT_MS,
        llmBudgetMs: PROFILE_STEP_LLM_BUDGET_MS,
        hardDeadlineMs: PROFILE_STEP_HARD_DEADLINE_MS,
      });

      if (isIntelProfileFallback(profile)) {
        // 硬超时熔断 / LLM 全失败时，写 intelProfileError 而非占位体征数据。
        // 确保前端显示"重试"入口，而非把无意义的占位内容误作真实体征展示给用户。
        const errPayload: IntelProfileError = {
          message: '情报体征 AI 生成超时，请使用重试按钮重新生成',
          at: new Date().toISOString(),
        };
        mergedMeta = { ...mergedMeta, intelProfileError: errPayload };
        delete mergedMeta.intelProfile;
        profileStatus = 'fallback';
      } else {
        // 🚨 Vercel 60s 超时防线：profile 步骤禁止再做二次英文化修复（高耗时）
        mergedMeta = { ...mergedMeta, intelProfile: profile };
        delete mergedMeta.intelProfileError;
        profileStatus = 'success';
      }
    } catch (e: unknown) {
      const errPayload: IntelProfileError = {
        message: e instanceof Error ? e.message : '情报体征生成失败',
        at: new Date().toISOString(),
      };
      mergedMeta = { ...mergedMeta, intelProfileError: errPayload };
      profileStatus = 'error';
    }

    mergedMeta.enrichmentPending = false;

    const { error: metaErr } = await supabaseAdmin
      .from('signals')
      .update({ metadata: mergedMeta })
      .eq('id', signalId);

    if (metaErr) throw metaErr;

    return NextResponse.json(
      {
        success: true,
        data: {
          signalId,
          step: 'profile' as const,
          profileStatus,
          elapsedMs: Date.now() - startedAt,
        },
      },
      {
        headers: { 'x-td-profile-status': profileStatus },
      }
    );
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
