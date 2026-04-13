import type { SupabaseClient } from '@supabase/supabase-js';
import { generateIntelProfile } from '@/services/intel-profile';
import type { IntelProfileError } from '@/types/intel-profile';
import { isIntelProfileFallback } from '@/types/intel-profile';
import {
  asBilingualData,
  isMetaRecord,
  needsIntelProfileRegeneration,
} from '@/lib/generation/intel-profile-metadata';

/**
 * Worker 侧情报体征预算：不受 Vercel 限制，保留硬熔断防止进程永久挂死。
 */
const WORKER_PROFILE_FETCH_TIMEOUT_MS = 180_000;
const WORKER_PROFILE_LLM_BUDGET_MS = 22 * 60_000;
const WORKER_PROFILE_HARD_DEADLINE_MS = 25 * 60_000;

export type IntelProfileJobProfileStatus = 'success' | 'fallback' | 'error' | 'skipped';

export interface IntelProfileJobOk {
  ok: true;
  signalId: string;
  profileStatus: IntelProfileJobProfileStatus;
}

export interface IntelProfileJobInfraFail {
  ok: false;
  error: string;
}

export type IntelProfileJobResult = IntelProfileJobOk | IntelProfileJobInfraFail;

/**
 * 业务说明：在 Worker（或任意 Node 长进程）内执行情报体征生成并写回 signals.metadata。
 * 与旧 enrich/profile 语义对齐，仅拉长 LLM 预算。
 */
export async function runIntelProfileJob(
  supabase: SupabaseClient,
  params: { signalId: string; forceRegenerate: boolean }
): Promise<IntelProfileJobResult> {
  const { signalId, forceRegenerate } = params;

  const { data: row, error: qErr } = await supabase
    .from('signals')
    .select('*')
    .eq('id', signalId)
    .maybeSingle();

  if (qErr || !row) {
    return { ok: false, error: qErr?.message ?? 'Signal not found' };
  }

  const rowObj = row as Record<string, unknown>;
  const rawContent = typeof rowObj.raw_content === 'string' ? rowObj.raw_content : '';
  const prevMeta = isMetaRecord(rowObj.metadata) ? rowObj.metadata : {};

  if (!forceRegenerate && !needsIntelProfileRegeneration(prevMeta)) {
    const { error: upErr } = await supabase
      .from('signals')
      .update({
        metadata: { ...prevMeta, enrichmentPending: false },
      })
      .eq('id', signalId);

    if (upErr) {
      return { ok: false, error: upErr.message };
    }

    return { ok: true, signalId, profileStatus: 'skipped' };
  }

  const factsForProfile = asBilingualData(rowObj.hard_facts);
  let mergedMeta: Record<string, unknown> = { ...prevMeta };

  if (forceRegenerate) {
    const currentCount =
      typeof mergedMeta.qualityRecomputeCount === 'number'
        ? mergedMeta.qualityRecomputeCount
        : 0;
    mergedMeta.qualityRecomputeCount = currentCount + 1;
    mergedMeta.lastRecomputeAt = new Date().toISOString();
    mergedMeta.lastRecomputeReason = 'user_quality_recompute';
  }

  let profileStatus: IntelProfileJobProfileStatus = 'success';

  try {
    const profile = await generateIntelProfile(rawContent, factsForProfile, {
      fetchTimeoutMs: WORKER_PROFILE_FETCH_TIMEOUT_MS,
      llmBudgetMs: WORKER_PROFILE_LLM_BUDGET_MS,
      hardDeadlineMs: WORKER_PROFILE_HARD_DEADLINE_MS,
    });

    if (isIntelProfileFallback(profile)) {
      const errPayload: IntelProfileError = {
        message: '情报体征 AI 生成超时，请使用重试按钮重新生成',
        at: new Date().toISOString(),
      };
      mergedMeta = { ...mergedMeta, intelProfileError: errPayload };
      delete mergedMeta.intelProfile;
      profileStatus = 'fallback';
    } else {
      mergedMeta = { ...mergedMeta, intelProfile: profile };
      delete mergedMeta.intelProfileError;
      profileStatus = 'success';
    }
  } catch (e: unknown) {
    const errPayload: IntelProfileError = {
      message: e instanceof Error ? e.message : '情报体征生成失败',
      at: new Date().toISOString(),
    };
    delete mergedMeta.intelProfile;
    mergedMeta = { ...mergedMeta, intelProfileError: errPayload };
    profileStatus = 'error';
  }

  mergedMeta.enrichmentPending = false;

  const { error: metaErr } = await supabase
    .from('signals')
    .update({ metadata: mergedMeta })
    .eq('id', signalId);

  if (metaErr) {
    return { ok: false, error: metaErr.message };
  }

  return { ok: true, signalId, profileStatus };
}
