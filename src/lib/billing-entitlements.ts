import type { SupabaseClient } from '@supabase/supabase-js';

/** 视为 Pro 的 Stripe subscription_status（可按商业定义扩展） */
const PRO_STATUSES = new Set(['active', 'trialing']);

export function subscriptionStatusIsPro(
  status: string | null | undefined
): boolean {
  if (!status) return false;
  return PRO_STATUSES.has(status);
}

/**
 * 使用当前用户上下文的 Supabase 客户端（走 RLS）查询是否 Pro。
 */
export async function getIsProForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  const row = data as { subscription_status: string | null };
  return subscriptionStatusIsPro(row.subscription_status);
}
