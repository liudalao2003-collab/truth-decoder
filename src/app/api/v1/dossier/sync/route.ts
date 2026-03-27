import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';

/**
 * 核心业务说明：
 * 静默持久化探针 (Silent Sync Gateway)。
 * 专门用于接收前端的 Lazy-Translate 和初次生成的缓存回写请求。
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, dossier_content } = await req.json();

    if (!id || !dossier_content) {
      return NextResponse.json({ success: false, error: 'Invalid Payload' }, { status: 400 });
    }

    // 🔪 直接覆写底层数据为双语 JSONB
    const { error } = await supabaseAdmin
      .from('signals')
      .update({ dossier_content })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}