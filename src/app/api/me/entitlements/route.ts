import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getIsProForUser } from '@/lib/billing-entitlements';
import { getDossierQuotaState } from '@/lib/dossier-quota';

/**
 * 当前登录用户的订阅权益（供前端解锁 Pro 功能）。
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

  // 与 getIsProForUser 单一真源对齐，避免 profiles 字段分叉导致 Pro 仍显示月度限额
  if (isPro) {
    dossierQuota = {
      limit: 0,
      used: 0,
      remaining: 0,
      period: dossierQuota.period,
      isUnlimited: true,
    };
  }

  return NextResponse.json({
    success: true,
    data: { isPro, dossierQuota },
  });
}
