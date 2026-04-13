import type { SupabaseClient } from '@supabase/supabase-js';

export interface InsertIntelProfileJobInput {
  signalId: string;
  forceRegenerate: boolean;
  userId: string | null;
}

export type InsertIntelProfileJobResult =
  | { ok: true; id: string; accessToken: string }
  | { ok: false; message: string };

/**
 * 业务说明：向 generation_jobs 插入 intel_profile 任务（服务端 service_role）。
 */
export async function insertIntelProfileGenerationJob(
  admin: SupabaseClient,
  input: InsertIntelProfileJobInput
): Promise<InsertIntelProfileJobResult> {
  const { data, error } = await admin
    .from('generation_jobs')
    .insert({
      user_id: input.userId,
      kind: 'intel_profile',
      status: 'pending',
      payload: {
        signalId: input.signalId,
        forceRegenerate: input.forceRegenerate,
      },
    })
    .select('id, access_token')
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? '任务入队失败' };
  }

  const row = data as { id: string; access_token: string };
  return { ok: true, id: row.id, accessToken: row.access_token };
}
