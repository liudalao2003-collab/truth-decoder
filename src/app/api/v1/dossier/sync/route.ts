import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * 核心业务说明：
 * 静默持久化探针 (Silent Sync Gateway)。
 * 🚀 工业级修复：强化异常流解析逻辑，彻底消除 TypeScript 对 unknown 类型的阻断。
 */
export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🟢 [模块_发起] -> 动作/参数: 接收双轨卷宗静默同步请求 (Node.js 引擎)');
    }

    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, dossier_content } = await req.json();
    if (!id || !dossier_content) {
      return NextResponse.json({ success: false, error: 'Invalid Payload' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('signals')
      .update({ dossier_content })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    // 🛡️ 架构师防线：强制执行类型收缩 (Type Narrowing) [cite: 307, 308]
    let errorDetails = '未知持久化物理故障';
    
    if (err instanceof Error) {
      errorDetails = err.message;
    } else if (err && typeof err === 'object') {
      // 兼容 Supabase 等返回的普通对象错误
      errorDetails = (err as any).message || (err as any).details || JSON.stringify(err);
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('\n🔴 [模块_崩溃] -> 真实死因已锁定:');
      console.log(errorDetails);
    }
    
    return NextResponse.json({ success: false, error: errorDetails }, { status: 500 });
  }
}