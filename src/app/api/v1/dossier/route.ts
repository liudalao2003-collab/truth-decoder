import { NextResponse } from 'next/server';

/**
 * 卷宗同步流式接口已退役：长跑改由 Supabase 任务表 + 独立 Worker 执行。
 * 前端请使用 POST /api/v1/generation/jobs（kind: dossier）并轮询 GET /api/v1/generation/jobs/:id。
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        '此接口已迁移至异步任务队列。请升级客户端以使用 /api/v1/generation/jobs。',
    },
    { status: 410 }
  );
}
