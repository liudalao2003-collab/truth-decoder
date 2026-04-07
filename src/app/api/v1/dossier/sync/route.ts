import { NextResponse } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
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

    const auth = await assertIngestAuthorized(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, dossier_content, skipQuotaIncrement } = await req.json() as {
      id?: string;
      dossier_content?: unknown;
      /** 懒翻译等补全同步不计入「本月卷宗次数」 */
      skipQuotaIncrement?: boolean;
    };
    if (!id || !dossier_content) {
      return NextResponse.json({ success: false, error: 'Invalid Payload' }, { status: 400 });
    }

    if (auth.kind === 'user') {
      const { data: row, error: qErr } = await supabaseAdmin
        .from('signals')
        .select('owner_id')
        .eq('id', id)
        .maybeSingle();
      if (qErr || !row) {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      }
      const signalRow = row as { owner_id: string | null };
      if (signalRow.owner_id !== auth.userId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const { error } = await supabaseAdmin
      .from('signals')
      .update({ dossier_content })
      .eq('id', id);

    if (error) throw error;

    if (auth.kind === 'user' && !skipQuotaIncrement) {
      const { error: rpcErr } = await supabaseAdmin.rpc(
        'increment_dossier_quota_if_needed',
        { p_user_id: auth.userId }
      );
      if (rpcErr && process.env.NODE_ENV === 'development') {
        const msg = rpcErr.message ?? '';
        const rpcMissing =
          msg.includes('increment_dossier_quota_if_needed') ||
          msg.includes('Could not find the function');
        if (rpcMissing) {
          console.log(
            '🟡 [模块_异步] -> 卷宗计次: 数据库未部署 RPC，请在 Supabase SQL 执行 supabase/migrations/002_dossier_quota.sql'
          );
        } else {
          console.log('🟡 [模块_异步] -> 目标: 卷宗计次 RPC', msg);
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    // 🛡️ 架构师防线：强制执行类型收缩 (Type Narrowing)
    let errorDetails = '未知持久化物理故障';

    if (err instanceof Error) {
      errorDetails = err.message;
    } else if (err && typeof err === 'object') {
      // 🚨 架构师修复：强制类型校验，确保最终赋值绝对是 string，修复 Vercel 部署阻断
      const errObj = err as Record<string, unknown>;
      errorDetails = typeof errObj.message === 'string' 
        ? errObj.message 
        : typeof errObj.details === 'string'
          ? errObj.details
          : JSON.stringify(err);
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('\n🔴 [模块_崩溃] -> 真实死因已锁定:');
      console.log(errorDetails);
    }
    
    return NextResponse.json({ success: false, error: errorDetails }, { status: 500 });
  }
}