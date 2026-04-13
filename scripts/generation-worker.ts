/**
 * 异步生成 Worker：在 Vercel 外常驻运行（本地、免费 VPS、PM2 等），消费 Supabase 中的 generation_jobs。
 *
 * 环境变量：NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、DEEPSEEK_API_KEY
 * 启动：npm run worker:generation
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { createDeepSeekStream } from '@/services/deepseek-stream';
import { buildDossierMessages } from '@/lib/generation/dossier-messages';
import { buildTerminalMessages } from '@/lib/generation/terminal-messages';
import { accumulateDeepSeekSseResponse } from '@/lib/generation/deepseek-sse-accumulate';
import {
  dossierJobPayloadSchema,
  intelProfileJobPayloadSchema,
  terminalJobPayloadSchema,
} from '@/lib/generation/job-payload-schemas';
import { runIntelProfileJob } from '@/lib/generation/intel-profile-job-runner';

config({ path: '.env.local' });
config({ path: '.env' });

interface GenerationJobRow {
  id: string;
  user_id: string | null;
  kind: 'dossier' | 'terminal' | 'intel_profile';
  status: string;
  payload: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function markJobFailed(
  supabase: SupabaseClient,
  jobId: string,
  message: string
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('generation_jobs')
    .update({
      status: 'failed',
      error_message: message,
      finished_at: now,
      updated_at: now,
    })
    .eq('id', jobId);
}

async function processJob(supabase: SupabaseClient, job: GenerationJobRow): Promise<void> {
  const { id } = job;

  const touchResult = async (full: string) => {
    await supabase
      .from('generation_jobs')
      .update({
        result_text: full,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  };

  try {
    if (job.kind === 'dossier') {
      const p = dossierJobPayloadSchema.parse(job.payload);
      const { messages, temperature, presencePenalty } = buildDossierMessages(
        p.rawContent,
        p.lang,
        p.retryAttempt
      );
      const streamResponse = await createDeepSeekStream(messages, false, {
        presence_penalty: presencePenalty,
        temperature,
      });
      const outcome = await accumulateDeepSeekSseResponse(
        streamResponse.body,
        touchResult,
        { flushEveryMs: 900, flushCharDelta: 6000 }
      );
      const now = new Date().toISOString();
      await supabase
        .from('generation_jobs')
        .update({
          status: 'completed',
          result_text: outcome.text,
          result_meta: {
            finishReason: outcome.finishReason,
            receivedDoneSignal: outcome.receivedDoneSignal,
            abortedByQuality: outcome.abortedByQuality,
          },
          finished_at: now,
          updated_at: now,
        })
        .eq('id', id);
      return;
    }

    if (job.kind === 'terminal') {
      const p = terminalJobPayloadSchema.parse(job.payload);
      const safeMessages = buildTerminalMessages(p.messages);
      const streamResponse = await createDeepSeekStream(safeMessages);
      const outcome = await accumulateDeepSeekSseResponse(
        streamResponse.body,
        touchResult,
        { flushEveryMs: 700, flushCharDelta: 2000 }
      );
      const now = new Date().toISOString();
      await supabase
        .from('generation_jobs')
        .update({
          status: 'completed',
          result_text: outcome.text,
          result_meta: {
            finishReason: outcome.finishReason,
            receivedDoneSignal: outcome.receivedDoneSignal,
            abortedByQuality: outcome.abortedByQuality,
          },
          finished_at: now,
          updated_at: now,
        })
        .eq('id', id);
      return;
    }

    if (job.kind === 'intel_profile') {
      const p = intelProfileJobPayloadSchema.parse(job.payload);
      const result = await runIntelProfileJob(supabase, {
        signalId: p.signalId,
        forceRegenerate: p.forceRegenerate === true,
      });
      const now = new Date().toISOString();
      if (!result.ok) {
        await markJobFailed(supabase, id, result.error);
        return;
      }
      await supabase
        .from('generation_jobs')
        .update({
          status: 'completed',
          result_meta: {
            profileStatus: result.profileStatus,
            signalId: result.signalId,
          },
          finished_at: now,
          updated_at: now,
        })
        .eq('id', id);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Worker 处理失败';
    if (process.env.NODE_ENV === 'development') {
      console.log('🔴 [Worker_崩溃] -> 原因:', msg);
    }
    await markJobFailed(supabase, id, msg);
  }
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('缺少 DEEPSEEK_API_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  if (process.env.NODE_ENV === 'development') {
    console.log('🟢 [Worker_发起] -> 异步生成 Worker 已启动，轮询 claim_generation_job');
  }

  for (;;) {
    const { data, error } = await supabase.rpc('claim_generation_job');

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [Worker_崩溃] -> claim RPC:', error.message);
      }
      await sleep(3000);
      continue;
    }

    const rows = data as GenerationJobRow[] | null;
    const job = rows && rows.length > 0 ? rows[0] : null;

    if (!job) {
      await sleep(1200);
      continue;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🟡 [Worker_异步] -> 目标: 执行任务', job.id, job.kind);
    }

    await processJob(supabase, job);
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
