import { NextResponse } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { assertCanStartDossierStream } from '@/lib/dossier-quota';
import { assertCanStartTerminalStream } from '@/lib/terminal-quota';
import { createGenerationJobBodySchema } from '@/lib/generation/job-payload-schemas';
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

    let admin;
    try {
      admin = getSupabaseServiceRoleOrThrow();
    } catch {
      return NextResponse.json(
        { error: '服务器未配置 SUPABASE_SERVICE_ROLE_KEY，无法入队任务。' },
        { status: 503 }
      );
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
