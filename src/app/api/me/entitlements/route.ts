import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getIsProForUser } from '@/lib/billing-entitlements';
import { getDossierQuotaState } from '@/lib/dossier-quota';

/**
 * 当前登录用户的订阅权益（供前端解锁 Pro 功能）。
 */
export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sbCookieNames = allCookies
    .filter((c) => c.name.startsWith('sb-'))
    .map((c) => c.name);

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0c753ea0-b6cf-4d53-95cb-28c61cb08775', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'api/me/entitlements/route.ts:GET',
      message: 'entitlements auth snapshot',
      data: {
        hypothesisId: 'H1-H2-H5',
        cookieTotal: allCookies.length,
        sbCookieNames,
        hasUser: Boolean(user),
        authErrorMessage: authError?.message ?? null,
      },
      timestamp: Date.now(),
      runId: 'pre-fix',
    }),
  }).catch(() => {});
  // #endregion

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
