import { NextResponse } from 'next/server';

/**
 * 懒翻译已迁至异步任务队列：POST /api/v1/generation/jobs（kind: translate）+ Worker。
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        '此接口已迁移至异步任务队列。请使用 /api/v1/generation/jobs（kind: translate）。',
      code: 'TRANSLATE_USE_JOB_QUEUE',
    },
    { status: 410 }
  );
}
