import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseServiceRoleOrThrow } from '@/lib/supabase';

interface GenerationJobSelect {
  id: string;
  user_id: string | null;
  kind: string;
  status: string;
  result_text: string | null;
  error_message: string | null;
  result_meta: unknown;
  access_token: string;
}

/**
 * 业务说明：轮询任务状态；鉴权支持「登录 Cookie」或「匿名 access_token」。
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  let admin;
  try {
    admin = getSupabaseServiceRoleOrThrow();
  } catch {
    return NextResponse.json({ error: '服务器配置异常' }, { status: 503 });
  }

  const { data: job, error } = await admin
    .from('generation_jobs')
    .select(
      'id, user_id, kind, status, result_text, error_message, result_meta, access_token'
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const row = job as GenerationJobSelect;
  const token = request.nextUrl.searchParams.get('token');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (row.user_id) {
    const sessionOk = user?.id === row.user_id;
    const tokenOk = token === row.access_token;
    if (!sessionOk && !tokenOk) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    if (!token || token !== row.access_token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return NextResponse.json({
    id: row.id,
    kind: row.kind,
    status: row.status,
    resultText: row.result_text,
    errorMessage: row.error_message,
    resultMeta: row.result_meta,
  });
}
