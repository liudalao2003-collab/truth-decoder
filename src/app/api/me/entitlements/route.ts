import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getIsProForUser } from '@/lib/billing-entitlements';
import { getDossierQuotaState } from '@/lib/dossier-quota';
import { getTerminalQuotaState } from '@/lib/terminal-quota';

/**
 * 当前登录用户的订阅权益（供前端解锁 Pro 功能）。
 * 同时返回卷宗配额和终端配额两个维度的快照。
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const isPro = await getIsProForUser(supabase, user.id);
  let dossierQuota = await getDossierQuotaState(supabase, user.id);
  let terminalQuota = await getTerminalQuotaState(supabase, user.id);

  // 与 getIsProForUser 单一真源对齐，避免 profiles 字段分叉导致 Pro 仍显示月度限额
  if (isPro) {
    dossierQuota = {
      limit: 0,
      used: 0,
      remaining: 0,
      period: dossierQuota.period,
      isUnlimited: true,
    };
    terminalQuota = {
      limit: 0,
      used: 0,
      remaining: 0,
      period: terminalQuota.period,
      isUnlimited: true,
    };
  }

  return NextResponse.json({
    success: true,
    data: { isPro, dossierQuota, terminalQuota },
  });
}
