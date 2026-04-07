import { NextResponse } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * 终端审讯计次同步网关（Terminal Quota Sync Gateway）。
 * 在客户端流式读取完成后静默调用，将本次审讯计入当月配额。
 * 仅对已登录的非 Pro 用户计次；Pro 用户在 RPC 内部直接跳过。
 */
export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🟢 [Terminal_发起] -> 动作/参数: 接收终端审讯计次同步请求');
    }

    const auth = await assertIngestAuthorized(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as { signalId?: string };
    const { signalId } = body;

    if (process.env.NODE_ENV === 'development') {
      console.log('🟡 [Terminal_异步] -> 目标: 终端计次 RPC, signalId:', signalId ?? 'N/A');
    }

    // 仅对实名登录用户计次，匿名模式（apikey）不追踪
    if (auth.kind === 'user') {
      const { error: rpcErr } = await supabaseAdmin.rpc(
        'increment_terminal_quota_if_needed',
        { p_user_id: auth.userId }
      );

      if (rpcErr) {
        if (process.env.NODE_ENV === 'development') {
          const msg = rpcErr.message ?? '';
          const rpcMissing =
            msg.includes('increment_terminal_quota_if_needed') ||
            msg.includes('Could not find the function');
          if (rpcMissing) {
            console.log(
              '🟡 [Terminal_异步] -> 终端计次: 数据库未部署 RPC，请在 Supabase SQL 执行 supabase/migrations/003_terminal_quota.sql'
            );
          } else {
            console.log('🔴 [Terminal_崩溃] -> 终端计次 RPC 失败:', msg);
          }
        }
        // 计次失败不阻断响应，下次请求时配额检查会拦截
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔵 [Terminal_成功] -> 产物: 终端审讯计次同步完成');
    }

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    let errorDetails = '终端计次同步物理故障';

    if (err instanceof Error) {
      errorDetails = err.message;
    } else if (err && typeof err === 'object') {
      const errObj = err as Record<string, unknown>;
      errorDetails = typeof errObj.message === 'string'
        ? errObj.message
        : typeof errObj.details === 'string'
          ? errObj.details
          : JSON.stringify(err);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔴 [Terminal_崩溃] -> 原因:', errorDetails);
    }

    return NextResponse.json({ success: false, error: errorDetails }, { status: 500 });
  }
}
