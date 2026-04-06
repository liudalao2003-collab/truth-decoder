import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * 双轨鉴权：机器脚本 Bearer INGEST_TOKEN，或浏览器 Cookie 会话用户。
 * 用于 ingest / dossier / translate 等贵接口，避免密钥进前端 bundle。
 */

export type IngestAuthOk =
  | { ok: true; kind: 'service' }
  | { ok: true; kind: 'user'; userId: string; user: User };

export type IngestAuthResult = IngestAuthOk | { ok: false };

export async function assertIngestAuthorized(
  request: Request
): Promise<IngestAuthResult> {
  const authHeader = request.headers.get('Authorization');
  const token = process.env.INGEST_TOKEN;
  if (token && authHeader === `Bearer ${token}`) {
    return { ok: true, kind: 'service' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false };
  }

  return { ok: true, kind: 'user', userId: user.id, user };
}
