import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

/**
 * Webhook 侧：把 Stripe 订阅状态同步到 public.profiles（服务角色写库）。
 */
export async function upsertProfileFromStripeSubscription(
  admin: SupabaseClient,
  params: {
    userId: string;
    customerId: string;
    subscription: Stripe.Subscription;
  }
): Promise<void> {
  const { userId, customerId, subscription } = params;
  const periodEndUnix = (
    subscription as unknown as { current_period_end?: number }
  ).current_period_end;
  const end =
    typeof periodEndUnix === 'number'
      ? new Date(periodEndUnix * 1000).toISOString()
      : null;

  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_current_period_end: end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw error;
  }
}

export async function clearSubscriptionOnProfile(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({
      stripe_subscription_id: null,
      subscription_status: 'canceled',
      subscription_current_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

export async function resolveUserIdFromSubscription(
  admin: SupabaseClient,
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = subscription.metadata?.supabase_user_id;
  if (typeof fromMeta === 'string' && fromMeta.length > 0) {
    return fromMeta;
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) {
    return null;
  }

  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as { id: string };
  return row.id;
}
