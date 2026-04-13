import { NextResponse } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { canEnrichSignal } from '@/lib/ingest-signal-access';
import { assertCanStartDossierStream } from '@/lib/dossier-quota';
import { assertCanStartTerminalStream } from '@/lib/terminal-quota';
import { createGenerationJobBodySchema } from '@/lib/generation/job-payload-schemas';
import {
  isMetaRecord,
  needsIntelProfileRegeneration,
} from '@/lib/generation/intel-profile-metadata';
import { insertIntelProfileGenerationJob } from '@/lib/generation/insert-intel-profile-job';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseServiceRoleOrThrow } from '@/lib/supabase';

/**
 * 业务说明：创建异步生成任务（仅写库，毫秒级返回）。
 * 长跑由 scripts/generation-worker 在 Vercel 外消费，避免 60s 熔断。
 */
export async function POST(request: Request) {
  try {
    const json: unknown = await request.json();
    const parsed = createGenerationJobBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { kind, payload } = parsed.data;

    let admin;
    try {
      admin = getSupabaseServiceRoleOrThrow();
    } catch {
      return NextResponse.json(
        { error: '服务器未配置 SUPABASE_SERVICE_ROLE_KEY，无法入队任务。' },
        { status: 503 }
      );
    }

    if (kind === 'intel_profile') {
      const auth = await assertIngestAuthorized(request);
      if (!auth.ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const signalId = payload.signalId;
      const forceRegenerate = payload.forceRegenerate === true;

      const { data: row, error: qErr } = await admin
        .from('signals')
        .select('owner_id, metadata')
        .eq('id', signalId)
        .maybeSingle();

      if (qErr || !row) {
        return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
      }

      const r = row as { owner_id: string | null; metadata: unknown };
      if (!canEnrichSignal(auth, { owner_id: r.owner_id })) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const prevMeta = isMetaRecord(r.metadata) ? r.metadata : {};
      if (!forceRegenerate && !needsIntelProfileRegeneration(prevMeta)) {
        await admin
          .from('signals')
          .update({
            metadata: { ...prevMeta, enrichmentPending: false },
          })
          .eq('id', signalId);

        return NextResponse.json({ skipped: true });
      }

      const userIdForJob = auth.kind === 'user' ? auth.userId : null;
      const ins = await insertIntelProfileGenerationJob(admin, {
        signalId,
        forceRegenerate,
        userId: userIdForJob,
      });

      if (!ins.ok) {
        return NextResponse.json({ error: ins.message }, { status: 500 });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [模块_成功] -> 产物:', `generation job ${ins.id} (intel_profile)`);
      }

      return NextResponse.json({
        id: ins.id,
        accessToken: ins.accessToken,
      });
    }

    if (kind === 'translate') {
      const auth = await assertIngestAuthorized(request);
      if (!auth.ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const userIdForJob = auth.kind === 'user' ? auth.userId : null;

      const { data: row, error: insErr } = await admin
        .from('generation_jobs')
        .insert({
          user_id: userIdForJob,
          kind: 'translate',
          status: 'pending',
          payload: payload as unknown as Record<string, unknown>,
        })
        .select('id, access_token')
        .single();

      if (insErr || !row) {
        return NextResponse.json({ error: '任务入队失败' }, { status: 500 });
      }

      const rec = row as { id: string; access_token: string };
      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [模块_成功] -> 产物:', `generation job ${rec.id} (translate)`);
      }

      return NextResponse.json({
        id: rec.id,
        accessToken: rec.access_token,
      });
    }

    const supabaseUser = await createClient();
    let userIdForJob: string | null = null;

    if (kind === 'dossier') {
      const auth = await assertIngestAuthorized(request);
      if (!auth.ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (auth.kind === 'user') {
        const allowed = await assertCanStartDossierStream(supabaseUser, auth.userId);
        if (!allowed) {
          return NextResponse.json(
            {
              error: 'Dossier quota exceeded for this month',
              code: 'DOSSIER_QUOTA_EXCEEDED',
            },
            { status: 403 }
          );
        }
        userIdForJob = auth.userId;
      }
    } else {
      const {
        data: { user },
      } = await supabaseUser.auth.getUser();
      if (user) {
        const allowed = await assertCanStartTerminalStream(supabaseUser, user.id);
        if (!allowed) {
          return NextResponse.json(
            {
              error: 'Terminal quota exceeded for this month',
              code: 'TERMINAL_QUOTA_EXCEEDED',
            },
            { status: 403 }
          );
        }
      }
      userIdForJob = user?.id ?? null;
    }

    const { data: row, error } = await admin
      .from('generation_jobs')
      .insert({
        user_id: userIdForJob,
        kind,
        status: 'pending',
        payload: payload as unknown as Record<string, unknown>,
      })
      .select('id, access_token')
      .single();

    if (error || !row) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因:', error?.message ?? 'insert generation_jobs failed');
      }
      return NextResponse.json({ error: '任务入队失败' }, { status: 500 });
    }

    const rec = row as { id: string; access_token: string };

    if (process.env.NODE_ENV === 'development') {
      console.log('🔵 [模块_成功] -> 产物:', `generation job ${rec.id} (${kind})`);
    }

    return NextResponse.json({
      id: rec.id,
      accessToken: rec.access_token,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '任务网关异常';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
